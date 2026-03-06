/**
 * Imports an Apple RoomPlan JSON (CapturedRoom) into a MozRoom.
 *
 * RoomPlan coordinate system: meters, Y-up, right-handed (ARKit).
 * Mozaik coordinate system: mm, Z-up (X=width, Y=depth, Z=height).
 *
 * Transform: X_moz = X_rp * 1000, Y_moz = -Z_rp * 1000, Z_moz = Y_rp * 1000
 */

import type { MozRoom, MozRoomParms, MozWall, MozFixture, MozWallJoint } from './types'
import { rebuildJoints } from '../math/wallEditor'

// ── RoomPlan JSON types (from Swift Codable serialization) ──────────

interface RPSurface {
  identifier: string
  category: string | { door: { isOpen: boolean } }
  transform: number[][]   // 4x4 column-major: [col0, col1, col2, col3], each [x, y, z, w]
  dimensions: number[]    // [width, height, depth] in meters
  confidence: string
  parentIdentifier?: string | null
}

interface RPCapturedRoom {
  identifier: string
  walls: RPSurface[]
  doors: RPSurface[]
  windows: RPSurface[]
  openings: RPSurface[]
}

// ── Coordinate helpers ──────────────────────────────────────────────

/** Extract position (meters) from a 4x4 column-major transform. */
function rpPosition(t: number[][]): [number, number, number] {
  return [t[3][0], t[3][1], t[3][2]]
}

/** Extract right vector (local X axis) from transform. */
function rpRight(t: number[][]): [number, number, number] {
  return [t[0][0], t[0][1], t[0][2]]
}

/** Convert RoomPlan position (meters, Y-up) → Mozaik position (mm, Z-up). */
function rpToMozXY(rp: [number, number, number]): [number, number] {
  return [rp[0] * 1000, -rp[2] * 1000]
}

// ── Wall extraction ─────────────────────────────────────────────────

function wallFromSurface(s: RPSurface, index: number): MozWall {
  const pos = rpPosition(s.transform)
  const [cx, cy] = rpToMozXY(pos)

  // Right vector → wall tangent direction in Mozaik XY
  const right = rpRight(s.transform)
  const rx = right[0]
  const ry = -right[2] // Z negated for Mozaik Y
  const angleDeg = Math.atan2(ry, rx) * 180 / Math.PI

  const widthMM = s.dimensions[0] * 1000
  const heightMM = s.dimensions[1] * 1000

  // Wall start = center - halfWidth along tangent
  const halfW = widthMM / 2
  const angRad = angleDeg * Math.PI / 180
  const posX = cx - halfW * Math.cos(angRad)
  const posY = cy - halfW * Math.sin(angRad)

  return {
    idTag: index + 1,
    wallNumber: index + 1,
    posX,
    posY,
    ang: ((angleDeg % 360) + 360) % 360,
    len: widthMM,
    height: heightMM,
    thickness: 127, // 5" default — RoomPlan doesn't capture real thickness
    invisible: false,
    bulge: 0,
    shapeType: 0,
    cathedralHeight: 0,
    followAngle: false,
  }
}

// ── Wall ring sorting ───────────────────────────────────────────────

function wallEndpoint(w: MozWall): [number, number] {
  const angRad = w.ang * Math.PI / 180
  return [
    w.posX + w.len * Math.cos(angRad),
    w.posY + w.len * Math.sin(angRad),
  ]
}

/**
 * Sort walls into a ring by walking endpoint → nearest start.
 * Starts from the wall whose start is closest to (minX, minY).
 */
function sortWallsIntoRing(walls: MozWall[]): MozWall[] {
  if (walls.length <= 1) return walls

  const tolerance = 200 // 200mm tolerance for matching endpoints

  // Find bottom-left wall
  let startIdx = 0
  let minScore = Infinity
  for (let i = 0; i < walls.length; i++) {
    const score = walls[i].posX + walls[i].posY
    if (score < minScore) { minScore = score; startIdx = i }
  }

  const sorted: MozWall[] = []
  const used = new Set<number>()
  let current = startIdx

  for (let step = 0; step < walls.length; step++) {
    sorted.push(walls[current])
    used.add(current)
    const [endX, endY] = wallEndpoint(walls[current])

    // Find nearest unused wall whose start is close to current endpoint
    let bestIdx = -1
    let bestDist = Infinity
    for (let i = 0; i < walls.length; i++) {
      if (used.has(i)) continue
      const dx = walls[i].posX - endX
      const dy = walls[i].posY - endY
      const dist = Math.sqrt(dx * dx + dy * dy)
      if (dist < bestDist) { bestDist = dist; bestIdx = i }
    }

    if (bestIdx >= 0 && bestDist < tolerance) {
      current = bestIdx
    } else if (step < walls.length - 1) {
      // No close match — pick any unused wall
      for (let i = 0; i < walls.length; i++) {
        if (!used.has(i)) { current = i; break }
      }
    }
  }

  return sorted
}

// ── Fixture extraction ──────────────────────────────────────────────

function categoryName(cat: string | { door: { isOpen: boolean } }): string {
  if (typeof cat === 'string') {
    if (cat === 'window') return 'Window'
    if (cat === 'opening') return 'Opening'
    return 'Door'
  }
  // Object form: { door: { isOpen: true/false } }
  return 'Door'
}

function isWindowCategory(cat: string | { door: { isOpen: boolean } }): boolean {
  return typeof cat === 'string' && cat === 'window'
}

function isOpeningCategory(cat: string | { door: { isOpen: boolean } }): boolean {
  return typeof cat === 'string' && cat === 'opening'
}

function findParentWall(
  fixture: RPSurface,
  walls: MozWall[],
  rpWalls: RPSurface[],
): MozWall | null {
  // Try parentIdentifier first (iOS 17+)
  if (fixture.parentIdentifier) {
    const parentRPIdx = rpWalls.findIndex(w => w.identifier === fixture.parentIdentifier)
    if (parentRPIdx >= 0 && parentRPIdx < walls.length) return walls[parentRPIdx]
  }

  // Fallback: find nearest wall by perpendicular distance
  const fPos = rpPosition(fixture.transform)
  const [fx, fy] = rpToMozXY(fPos)
  let bestWall: MozWall | null = null
  let bestDist = Infinity

  for (const wall of walls) {
    const angRad = wall.ang * Math.PI / 180
    const nx = -Math.sin(angRad)
    const ny = Math.cos(angRad)
    const dx = fx - wall.posX
    const dy = fy - wall.posY
    const perpDist = Math.abs(dx * nx + dy * ny)
    const alongDist = dx * Math.cos(angRad) + dy * Math.sin(angRad)
    // Must be roughly within wall length
    if (alongDist >= -100 && alongDist <= wall.len + 100 && perpDist < bestDist) {
      bestDist = perpDist
      bestWall = wall
    }
  }

  return bestWall
}

function fixtureFromSurface(
  s: RPSurface, walls: MozWall[], rpWalls: RPSurface[], idTag: number,
): MozFixture | null {
  const parentWall = findParentWall(s, walls, rpWalls)
  if (!parentWall) return null

  const fPos = rpPosition(s.transform)
  const [fx, fy] = rpToMozXY(fPos)
  const angRad = parentWall.ang * Math.PI / 180
  const dx = fx - parentWall.posX
  const dy = fy - parentWall.posY
  const distAlong = dx * Math.cos(angRad) + dy * Math.sin(angRad)
  const fixtureWidth = s.dimensions[0] * 1000
  const fixtureHeight = s.dimensions[1] * 1000
  const fixtureX = distAlong - fixtureWidth / 2

  // Elevation: center Y in RoomPlan - halfHeight = bottom edge
  const elevMM = fPos[1] * 1000 - fixtureHeight / 2

  const isWindow = isWindowCategory(s.category)
  const isOpening = isOpeningCategory(s.category)

  return {
    name: categoryName(s.category),
    idTag,
    type: isWindow ? 6 : 7,
    subType: isOpening ? 2 : 0,
    wall: parentWall.wallNumber,
    onWallFront: true,
    width: fixtureWidth,
    height: fixtureHeight,
    depth: isWindow ? 50.8 : 101.6,
    x: Math.max(0, Math.min(fixtureX, parentWall.len - fixtureWidth)),
    elev: Math.max(0, elevMM),
    rot: 0,
  }
}

// ── Main import function ────────────────────────────────────────────

export function importRoomPlanJSON(jsonText: string): MozRoom {
  const data: RPCapturedRoom = JSON.parse(jsonText)
  if (!data.walls || data.walls.length === 0) {
    throw new Error('No walls found in RoomPlan JSON')
  }

  console.log(`[IMPORT] RoomPlan: ${data.walls.length} walls, ${data.doors?.length ?? 0} doors, ${data.windows?.length ?? 0} windows, ${data.openings?.length ?? 0} openings`)

  // 1. Convert walls
  let walls = data.walls.map((s, i) => wallFromSurface(s, i))

  // 2. Sort into ring order
  walls = sortWallsIntoRing(walls)

  // 3. Re-assign wall numbers + idTags after sorting
  walls = walls.map((w, i) => ({ ...w, wallNumber: i + 1, idTag: i + 1 }))

  // 4. Re-origin to front-left-bottom
  let minX = Infinity, minY = Infinity
  for (const w of walls) {
    minX = Math.min(minX, w.posX)
    minY = Math.min(minY, w.posY)
    const [ex, ey] = wallEndpoint(w)
    minX = Math.min(minX, ex)
    minY = Math.min(minY, ey)
  }
  walls = walls.map(w => ({ ...w, posX: w.posX - minX, posY: w.posY - minY }))

  // 5. Build joints
  const joints: MozWallJoint[] = rebuildJoints(walls)

  // 6. Extract fixtures
  let nextIdTag = walls.length + 1
  const allFixtureSurfaces = [
    ...(data.doors ?? []),
    ...(data.windows ?? []),
    ...(data.openings ?? []),
  ]
  const fixtures: MozFixture[] = []
  for (const s of allFixtureSurfaces) {
    const f = fixtureFromSurface(s, walls, data.walls, nextIdTag)
    if (f) {
      fixtures.push(f)
      nextIdTag++
    }
  }

  // 7. Compute average height for parms
  const avgHeight = walls.reduce((s, w) => s + w.height, 0) / walls.length
  const thickness = walls[0]?.thickness ?? 127

  const parms: MozRoomParms = {
    H_Walls: avgHeight,
    WallThickness: thickness,
    H_Soffit: 152.4,
    H_BaseCab: 876.3,
    H_WallCab: 914.4,
    D_Wall: 304.8,
    D_Base: 609.6,
    D_Tall: 609.6,
    StartingCabNo: 1,
  }

  return {
    uniqueId: String(Date.now() % 100000000),
    name: 'RoomPlan Scan',
    roomType: 0,
    parms,
    walls,
    wallJoints: joints,
    fixtures,
    products: [],
    primaryTextureId: null,
    wallTextureId: null,
    rawText: '',
  }
}
