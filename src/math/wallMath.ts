import type { MozWall, MozWallJoint, MozProduct, WallGeometry } from '../mozaik/types'
import { DEG2RAD } from './constants'

/** Compute the endpoint of a wall from its start + angle + length. */
export function wallEndpoint(wall: MozWall): [number, number] {
  const angRad = wall.ang * DEG2RAD
  return [
    wall.posX + wall.len * Math.cos(angRad),
    wall.posY + wall.len * Math.sin(angRad),
  ]
}

/** Compute full geometry for all walls, including normals. */
export function computeWallGeometries(walls: MozWall[]): WallGeometry[] {
  if (walls.length === 0) return []

  const area = signedArea(walls)
  const isCW = area < 0

  return walls.map((wall) => {
    const start: [number, number] = [wall.posX, wall.posY]
    const end = wallEndpoint(wall)
    const angRad = wall.ang * DEG2RAD

    const tangent: [number, number] = [Math.cos(angRad), Math.sin(angRad)]

    // Inward normal: perpendicular to tangent, pointing into the room
    // CW winding → interior is to the RIGHT of each directed edge
    // CCW winding → interior is to the LEFT
    let normal: [number, number]
    if (isCW) {
      // Right perpendicular: (ty, -tx)
      normal = [tangent[1], -tangent[0]]
    } else {
      // Left perpendicular: (-ty, tx)
      normal = [-tangent[1], tangent[0]]
    }

    return {
      wallNumber: wall.wallNumber,
      idTag: wall.idTag,
      start,
      end,
      tangent,
      normal,
      height: wall.height,
      thickness: wall.thickness,
    }
  })
}

/**
 * Compute the signed area of the polygon formed by wall start points.
 * Uses the shoelace formula.
 * Positive = CCW winding, Negative = CW winding (in standard math coords).
 */
export function signedArea(walls: MozWall[]): number {
  let area = 0
  for (let i = 0; i < walls.length; i++) {
    const x1 = walls[i].posX
    const y1 = walls[i].posY
    const next = walls[(i + 1) % walls.length]
    const x2 = next.posX
    const y2 = next.posY
    area += x1 * y2 - x2 * y1
  }
  return area / 2
}

/**
 * Verify that the wall chain forms a closed loop.
 * Returns the gap distance between the last wall's end and the first wall's start.
 */
export function verifyChainClosure(walls: MozWall[]): { closed: boolean; gap: number } {
  if (walls.length === 0) return { closed: false, gap: Infinity }

  const lastEnd = wallEndpoint(walls[walls.length - 1])
  const firstStart: [number, number] = [walls[0].posX, walls[0].posY]
  const gap = Math.sqrt(
    (lastEnd[0] - firstStart[0]) ** 2 +
    (lastEnd[1] - firstStart[1]) ** 2,
  )
  return { closed: gap < 0.01, gap } // 0.01mm tolerance
}

/**
 * Compute normalized plan ordering.
 * Finds the leftmost corner (min X, tiebreak min Y) and returns
 * walls reordered starting from that corner.
 * Original wall IDs are preserved — this is for UI display only.
 */
export function normalizedWallOrder(walls: MozWall[]): number[] {
  if (walls.length === 0) return []

  // Find the wall with the leftmost start point
  let minIdx = 0
  let minX = walls[0].posX
  let minY = walls[0].posY

  for (let i = 1; i < walls.length; i++) {
    const x = walls[i].posX
    const y = walls[i].posY
    if (x < minX || (x === minX && y < minY)) {
      minX = x
      minY = y
      minIdx = i
    }
  }

  // Return wall numbers in normalized order starting from leftmost
  const ordered: number[] = []
  for (let i = 0; i < walls.length; i++) {
    ordered.push(walls[(minIdx + i) % walls.length].wallNumber)
  }
  return ordered
}

/**
 * Compute render trims for each wall based on WallJoint data.
 * Butt joints: arriving wall (Corner=1=end) trims by departing wall's full thickness.
 * Miter joints: both walls trim by half the other wall's thickness.
 */
export function computeWallTrims(
  walls: MozWall[],
  joints: MozWallJoint[],
): Map<number, { trimStart: number; trimEnd: number }> {
  const trims = new Map<number, { trimStart: number; trimEnd: number }>()
  for (const w of walls) trims.set(w.wallNumber, { trimStart: 0, trimEnd: 0 })

  for (const joint of joints) {
    const w1 = walls.find((w) => w.wallNumber === joint.wall1)
    const w2 = walls.find((w) => w.wallNumber === joint.wall2)
    if (!w1 || !w2) continue

    if (joint.miterBack) {
      // Miter: both walls trim by half the other's thickness
      if (joint.wall1Corner === 1) trims.get(w1.wallNumber)!.trimEnd += w2.thickness / 2
      else trims.get(w1.wallNumber)!.trimStart += w2.thickness / 2
      if (joint.wall2Corner === 0) trims.get(w2.wallNumber)!.trimStart += w1.thickness / 2
      else trims.get(w2.wallNumber)!.trimEnd += w1.thickness / 2
    } else {
      // Butt: both walls trim by half the other's thickness
      // (with box geometry, same as miter — angular cut difference is cosmetic only)
      if (joint.wall1Corner === 1) trims.get(w1.wallNumber)!.trimEnd += w2.thickness / 2
      else trims.get(w1.wallNumber)!.trimStart += w2.thickness / 2
      if (joint.wall2Corner === 0) trims.get(w2.wallNumber)!.trimStart += w1.thickness / 2
      else trims.get(w2.wallNumber)!.trimEnd += w1.thickness / 2
    }
  }
  return trims
}

/**
 * Compute world position + wall angle for a product placed on a wall.
 * product.wall format: "3_1" (wallNumber_section) or "0" (no wall).
 * product.x = distance along wall from usable wall start (inside corner).
 * product.elev = height above floor (Mozaik Z).
 * Returns position (Mozaik XYZ) + wall angle for rotation.
 */
export function computeProductWorldOffset(
  product: MozProduct,
  walls: MozWall[],
  joints: MozWallJoint[],
): { position: [number, number, number]; wallAngleDeg: number } | null {
  const wallRef = product.wall
  if (!wallRef || wallRef === '0') return null

  const wallNumber = parseInt(wallRef.split('_')[0], 10)
  if (isNaN(wallNumber)) return null

  const wall = walls.find((w) => w.wallNumber === wallNumber)
  if (!wall) return null

  const geometries = computeWallGeometries(walls)
  const geom = geometries.find((g) => g.wallNumber === wallNumber)
  if (!geom) return null

  // Offset product.x by trimStart — X=0 means "at the inside corner"
  const trims = computeWallTrims(walls, joints)
  const trim = trims.get(wallNumber) ?? { trimStart: 0, trimEnd: 0 }
  // Shift by product.width to compensate for +180° rotation reversing width direction
  const xAlongWall = trim.trimStart + product.x + product.width

  // Normal offset: push product origin (front, Y=0) into room by depth
  // so back (Y=depth) ends up at inner wall surface after Z-flip in ProductView
  const normalOffset = geom.thickness / 2 + product.depth
  const mx = geom.start[0] + xAlongWall * geom.tangent[0] + normalOffset * geom.normal[0]
  const my = geom.start[1] + xAlongWall * geom.tangent[1] + normalOffset * geom.normal[1]
  const mz = product.elev

  return { position: [mx, my, mz], wallAngleDeg: (wall.ang + 180) % 360 }
}

/** 2D line-line intersection: P1 + t*D1 = P2 + s*D2. Returns intersection point or null if parallel. */
function lineIntersect2D(
  p1: [number, number], d1: [number, number],
  p2: [number, number], d2: [number, number],
): [number, number] | null {
  const cross = d1[0] * d2[1] - d1[1] * d2[0]
  if (Math.abs(cross) < 1e-6) return null
  const dx = p2[0] - p1[0]
  const dy = p2[1] - p1[1]
  const t = (dx * d2[1] - dy * d2[0]) / cross
  return [p1[0] + t * d1[0], p1[1] + t * d1[1]]
}

/**
 * Compute inner and outer perimeter polygons for the room.
 * Inner = wall centerline offset by thickness/2 toward room (along normal).
 * Outer = wall centerline offset by thickness/2 away from room (against normal).
 * At each corner, adjacent face lines are intersected to find the true corner point.
 */
export function computeRoomPolygons(
  walls: MozWall[],
): { inner: [number, number][]; outer: [number, number][] } {
  const geos = computeWallGeometries(walls)
  if (geos.length < 3) return { inner: [], outer: [] }

  const inner: [number, number][] = []
  const outer: [number, number][] = []

  for (let i = 0; i < geos.length; i++) {
    const prev = geos[(i - 1 + geos.length) % geos.length]
    const curr = geos[i]

    // Inner face lines: offset by +thickness/2 along inward normal
    const pInner: [number, number] = [
      prev.start[0] + (prev.thickness / 2) * prev.normal[0],
      prev.start[1] + (prev.thickness / 2) * prev.normal[1],
    ]
    const cInner: [number, number] = [
      curr.start[0] + (curr.thickness / 2) * curr.normal[0],
      curr.start[1] + (curr.thickness / 2) * curr.normal[1],
    ]
    const innerPt = lineIntersect2D(pInner, prev.tangent, cInner, curr.tangent)
    inner.push(innerPt ?? cInner)

    // Outer face lines: offset by -thickness/2 along inward normal (= toward outside)
    const pOuter: [number, number] = [
      prev.start[0] - (prev.thickness / 2) * prev.normal[0],
      prev.start[1] - (prev.thickness / 2) * prev.normal[1],
    ]
    const cOuter: [number, number] = [
      curr.start[0] - (curr.thickness / 2) * curr.normal[0],
      curr.start[1] - (curr.thickness / 2) * curr.normal[1],
    ]
    const outerPt = lineIntersect2D(pOuter, prev.tangent, cOuter, curr.tangent)
    outer.push(outerPt ?? cOuter)
  }

  return { inner, outer }
}

/**
 * Compute how far each wall's outer edge extends beyond its trimmed box at each corner.
 * Used to build mitered wall mesh geometry (trapezoidal prism).
 * Returns Map<wallNumber, { startExt, endExt }> in mm along the wall tangent.
 */
export function computeWallMiterExtensions(
  walls: MozWall[],
  joints: MozWallJoint[],
): Map<number, { startExt: number; endExt: number; innerStartExt: number; innerEndExt: number }> {
  const geos = computeWallGeometries(walls)
  const { inner, outer } = computeRoomPolygons(walls)
  const trims = computeWallTrims(walls, joints)
  const result = new Map<number, { startExt: number; endExt: number; innerStartExt: number; innerEndExt: number }>()

  for (let i = 0; i < geos.length; i++) {
    const g = geos[i]
    const nextI = (i + 1) % geos.length
    const trim = trims.get(g.wallNumber) ?? { trimStart: 0, trimEnd: 0 }

    const endDist = g.end[0] === g.start[0] && g.end[1] === g.start[1]
      ? 0 : Math.sqrt((g.end[0] - g.start[0]) ** 2 + (g.end[1] - g.start[1]) ** 2)

    // --- Outer face extensions (convex / outside corners) ---
    const boxOuterStartX = g.start[0] + trim.trimStart * g.tangent[0] - (g.thickness / 2) * g.normal[0]
    const boxOuterStartY = g.start[1] + trim.trimStart * g.tangent[1] - (g.thickness / 2) * g.normal[1]
    const startExt = (boxOuterStartX - outer[i][0]) * g.tangent[0]
                   + (boxOuterStartY - outer[i][1]) * g.tangent[1]

    const boxOuterEndX = g.start[0] + (endDist - trim.trimEnd) * g.tangent[0] - (g.thickness / 2) * g.normal[0]
    const boxOuterEndY = g.start[1] + (endDist - trim.trimEnd) * g.tangent[1] - (g.thickness / 2) * g.normal[1]
    const endExt = (outer[nextI][0] - boxOuterEndX) * g.tangent[0]
                 + (outer[nextI][1] - boxOuterEndY) * g.tangent[1]

    // --- Inner face extensions (concave / inside corners) ---
    const boxInnerStartX = g.start[0] + trim.trimStart * g.tangent[0] + (g.thickness / 2) * g.normal[0]
    const boxInnerStartY = g.start[1] + trim.trimStart * g.tangent[1] + (g.thickness / 2) * g.normal[1]
    const innerStartExt = (boxInnerStartX - inner[i][0]) * g.tangent[0]
                        + (boxInnerStartY - inner[i][1]) * g.tangent[1]

    const boxInnerEndX = g.start[0] + (endDist - trim.trimEnd) * g.tangent[0] + (g.thickness / 2) * g.normal[0]
    const boxInnerEndY = g.start[1] + (endDist - trim.trimEnd) * g.tangent[1] + (g.thickness / 2) * g.normal[1]
    const innerEndExt = (inner[nextI][0] - boxInnerEndX) * g.tangent[0]
                      + (inner[nextI][1] - boxInnerEndY) * g.tangent[1]

    result.set(g.wallNumber, {
      startExt: Math.max(0, startExt),
      endExt: Math.max(0, endExt),
      innerStartExt: Math.max(0, innerStartExt),
      innerEndExt: Math.max(0, innerEndExt),
    })
  }

  return result
}

/** Get a human-readable wall chain report. */
export function wallChainReport(walls: MozWall[]): string {
  const lines: string[] = []
  const geometries = computeWallGeometries(walls)
  const area = signedArea(walls)
  const closure = verifyChainClosure(walls)

  lines.push(`Walls: ${walls.length}`)
  for (const g of geometries) {
    lines.push(
      `  Wall ${g.wallNumber}: start=(${g.start[0].toFixed(1)}, ${g.start[1].toFixed(1)}) ` +
      `end=(${g.end[0].toFixed(1)}, ${g.end[1].toFixed(1)}) ` +
      `normal=(${g.normal[0].toFixed(3)}, ${g.normal[1].toFixed(3)})`,
    )
  }
  lines.push(`Signed area: ${area.toFixed(1)} (${area < 0 ? 'CW' : 'CCW'} winding)`)
  lines.push(`Chain closure: ${closure.closed ? 'PASS' : 'FAIL'} (gap=${closure.gap.toFixed(4)}mm)`)
  lines.push(`Normalized order: [${normalizedWallOrder(walls).join(', ')}]`)
  return lines.join('\n')
}
