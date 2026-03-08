/**
 * Build THREE.js geometry from MozPart shape points.
 * Falls back to BoxGeometry for rectangular parts (4 axis-aligned points).
 * Uses ExtrudeGeometry for non-rectangular shapes (L-shapes, arcs, etc.).
 */
import { BoxGeometry, ExtrudeGeometry, Shape, Vector2 } from 'three'
import type { BufferGeometry } from 'three'
import type { MozPart, MozProduct, MozShapePoint } from '../mozaik/types'

/** Infer panel thickness (Mozaik local Z) by part type. */
export function panelThickness(type: string, name: string, partW: number): number {
  if (name.toLowerCase().includes('rod')) return partW
  switch (type.toLowerCase()) {
    case 'metal': return 3
    default: return 19
  }
}

/** Check if shape points form a simple axis-aligned rectangle. */
export function isAxisAlignedRect(pts: MozShapePoint[]): boolean {
  if (pts.length !== 4) return false
  if (pts.some(p => p.ptType === 1)) return false // has arcs
  const xs = new Set(pts.map(p => Math.round(p.x * 100)))
  const ys = new Set(pts.map(p => Math.round(p.y * 100)))
  return xs.size === 2 && ys.size === 2
}

/**
 * Compute the bounding box center of shape points.
 * Returns [centerX, centerY] in shape-local coords.
 */
export function shapeBoundsCenter(pts: MozShapePoint[]): [number, number] {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const p of pts) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  return [(minX + maxX) / 2, (minY + maxY) / 2]
}

/**
 * Compute the bounding box dimensions of shape points.
 * Returns [width, height] (X span, Y span).
 */
export function shapeBoundsDims(pts: MozShapePoint[]): [number, number] {
  let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
  for (const p of pts) {
    if (p.x < minX) minX = p.x
    if (p.x > maxX) maxX = p.x
    if (p.y < minY) minY = p.y
    if (p.y > maxY) maxY = p.y
  }
  return [maxX - minX, maxY - minY]
}

/**
 * Build a THREE.Shape path with proper corner fillet handling.
 *
 * PtType=1 on a shape point means the CORNER at that point is rounded
 * with a fillet of radius = point.data. This is NOT an arc edge between
 * two distant points — it's a corner rounding that shortens the incoming
 * and outgoing edges by the radius, drawing a smooth arc at the corner.
 */
function buildFilletShape(pts: MozShapePoint[]): Shape {
  const n = pts.length
  const shape = new Shape()

  // Pre-compute fillet geometry for each point
  const fillets = pts.map((pt, i) => {
    if (pt.ptType !== 1 || pt.data === 0) {
      const pos = new Vector2(pt.x, pt.y)
      return { has: false, start: pos, end: pos, center: pos, r: 0, cw: false }
    }

    const prev = pts[(i - 1 + n) % n]
    const next = pts[(i + 1) % n]
    const r = Math.abs(pt.data)

    // Edge direction vectors
    const vIn = new Vector2(pt.x - prev.x, pt.y - prev.y).normalize()
    const vOut = new Vector2(next.x - pt.x, next.y - pt.y).normalize()

    // Cross product: < 0 = right turn (concave), > 0 = left turn (convex)
    const cross = vIn.x * vOut.y - vIn.y * vOut.x

    // Fillet trim: shorten incoming edge by r, advance outgoing edge by r
    const filletStart = new Vector2(pt.x - vIn.x * r, pt.y - vIn.y * r)
    const filletEnd = new Vector2(pt.x + vOut.x * r, pt.y + vOut.y * r)

    // Arc center: perpendicular to incoming edge, offset by r
    const px = cross < 0 ? vIn.y : -vIn.y
    const py = cross < 0 ? -vIn.x : vIn.x
    const center = new Vector2(filletStart.x + px * r, filletStart.y + py * r)

    return { has: true, start: filletStart, end: filletEnd, center, r, cw: cross < 0 }
  })

  // Start at point 0's outgoing position
  shape.moveTo(fillets[0].end.x, fillets[0].end.y)

  // Visit points 1 through n (n wraps to 0 for closing)
  for (let k = 1; k <= n; k++) {
    const i = k % n
    const f = fillets[i]

    // Straight line to this point's incoming position
    shape.lineTo(f.start.x, f.start.y)

    // Draw fillet arc if present
    if (f.has) {
      const sa = Math.atan2(f.start.y - f.center.y, f.start.x - f.center.x)
      const ea = Math.atan2(f.end.y - f.center.y, f.end.x - f.center.x)
      let sweep = ea - sa
      if (f.cw) { if (sweep > 0) sweep -= Math.PI * 2 }
      else { if (sweep < 0) sweep += Math.PI * 2 }

      const segs = Math.max(8, Math.ceil(Math.abs(sweep) / (Math.PI / 16)))
      for (let s = 1; s <= segs; s++) {
        const angle = sa + sweep * (s / segs)
        shape.lineTo(f.center.x + f.r * Math.cos(angle), f.center.y + f.r * Math.sin(angle))
      }
    }
  }

  return shape
}

/**
 * Build geometry for a part based on its shape points.
 *
 * - < 3 shape points → BoxGeometry(L, thick, W) (standard rectangular)
 * - 4 axis-aligned points → BoxGeometry (faster)
 * - Otherwise → ExtrudeGeometry from Shape path
 *
 * The geometry is centered at the shape's bounding box center
 * with extrusion along the local Y axis (Three.js convention: Y = thickness).
 *
 * Returns { geometry, centerX, centerY } where centerX/Y are the shape
 * bounding box center in Mozaik shape-point space.
 */
export function buildPartGeometry(part: MozPart): {
  geometry: BufferGeometry
  isShape: boolean
  centerX: number
  centerY: number
} {
  const length = Math.max(part.l, 1)
  const width = Math.max(part.w, 1)
  const thick = panelThickness(part.type, part.name, width)
  const pts = part.shapePoints

  // Fall back to box for parts with few shape points or simple rectangles
  if (pts.length < 3 || isAxisAlignedRect(pts)) {
    return {
      geometry: new BoxGeometry(length, thick, width),
      isShape: false,
      centerX: length / 2,
      centerY: width / 2,
    }
  }

  // Build THREE.Shape from shape points with fillet support
  const shape = buildFilletShape(pts)

  // Extrude along thickness
  const extrudeGeo = new ExtrudeGeometry(shape, {
    depth: thick,
    bevelEnabled: false,
  })

  // Center the geometry at its bounding box center
  extrudeGeo.computeBoundingBox()
  const bb = extrudeGeo.boundingBox!
  const cx = (bb.min.x + bb.max.x) / 2
  const cy = (bb.min.y + bb.max.y) / 2
  const cz = (bb.min.z + bb.max.z) / 2
  extrudeGeo.translate(-cx, -cy, -cz)

  // Bake rotation: convert extrusion axis from Z → Y to match BoxGeometry(L, thick, W)
  // Shape XY plane → XZ plane, extrusion Z → Y (thickness axis)
  extrudeGeo.rotateX(-Math.PI / 2)

  // Shape bounds center in Mozaik space
  const [scx, scy] = shapeBoundsCenter(pts)

  console.log(`[SHAPE] Part "${part.name}": ${pts.length} pts, extruded ${thick}mm`)

  return {
    geometry: extrudeGeo,
    isShape: true,
    centerX: scx,
    centerY: scy,
  }
}

/**
 * Compute the 2D outline of a product's footprint.
 * For CRN (non-rect) products: uses TopShapeXml or Bottom part's L-shape points.
 * For rect products: always uses product width × depth (reliable on resize).
 * Returns points in Mozaik product-local coords (X = width, Y = depth).
 */
export function computeProductOutline(product: MozProduct): [number, number][] {
  if (!product.isRectShape && product.topShapePoints && product.topShapePoints.length >= 3) {
    return product.topShapePoints.map(p => [p.x, p.y] as [number, number])
  }
  if (!product.isRectShape) {
    const bottom = product.parts.find(p => p.type.toLowerCase() === 'bottom')
    if (bottom && bottom.shapePoints.length >= 3 && !isAxisAlignedRect(bottom.shapePoints)) {
      return bottom.shapePoints.map(p => [p.x, p.y] as [number, number])
    }
  }
  const w = product.width, d = product.depth
  return [[0, 0], [w, 0], [w, d], [0, d]]
}
