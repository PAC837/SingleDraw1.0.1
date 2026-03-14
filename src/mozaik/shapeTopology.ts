/**
 * Topology mapper: propagate TopShapeXml equations to matching part shape points.
 *
 * CRN (corner/L-shaped) products have parametric equations on product-level
 * TopShapeXml points, but individual part PartShapeXml shapes are raw numbers.
 * This module maps each L-shaped part's shape points to the corresponding
 * TopShapeXml point and captures the manufacturing offset, so that during
 * resize we can evaluate equations + offset instead of relying on fragile
 * numeric inference.
 */

import type { MozProduct, MozShapePoint } from './types'
import { evaluateShapeEq, buildEvalContext, type EvalContext } from './shapeEquations'

/** Propagated equation info for a single shape point. */
export interface PropagatedEq {
  xEq?: string    // equation from TopShapeXml (e.g., "W-CornerEndWRight")
  yEq?: string
  dataEq?: string
  offsetX: number  // partPoint.x - evaluate(xEq) at original dims
  offsetY: number  // partPoint.y - evaluate(yEq) at original dims
  xTrack?: 'W' | 'D'  // non-equation coordinate tracks product dimension
  yTrack?: 'W' | 'D'
  mirroredX?: boolean  // part X axis is mirrored (A1=180, R1='Y')
}

/** L-shaped part types that share topology with TopShapeXml. */
const L_SHAPE_TYPES = new Set(['bottom', 'top', 'fixedshelf', 'adjustableshelf'])

/**
 * Propagate TopShapeXml equations to matching part shape points.
 *
 * For each L-shaped part, builds a 1-to-1 mapping from part shape point
 * indices to TopShapeXml point indices using absolute coordinate distance.
 * Then copies equations and computes the manufacturing offset.
 *
 * Returns a map: partIndex → array of PropagatedEq (one per shape point).
 * Only includes parts where mapping succeeded (same point count, good matches).
 */
export function propagateEquations(
  product: MozProduct,
): Map<number, PropagatedEq[]> {
  const result = new Map<number, PropagatedEq[]>()
  const topPts = product.topShapePoints
  if (!topPts || topPts.length < 3) return result

  const ctx = buildEvalContext(product)

  for (let pi = 0; pi < product.parts.length; pi++) {
    const part = product.parts[pi]
    const typeLower = part.type.toLowerCase()
    if (!L_SHAPE_TYPES.has(typeLower)) continue
    if (part.shapePoints.length < 3) continue

    // Must have same point count for topology mapping
    if (part.shapePoints.length !== topPts.length) continue

    // Detect X-mirror: A1=180 rotates around Y, negating part X axis
    const isMirroredX = part.rotation.a1 === 180 && part.rotation.r1 === 'Y'

    // Mirror part shape point X for distance comparison
    const matchPts = isMirroredX
      ? part.shapePoints.map(sp => ({ ...sp, x: part.l - sp.x }))
      : part.shapePoints

    let eqs = mapPartToTopShape(matchPts, topPts, ctx)

    // For mirrored parts: X-mirror reverses winding order for indices 1..N-1
    // (index 0 = arc start stays fixed, rest reverse CW→CCW)
    if (!eqs && isMirroredX && matchPts.length > 2) {
      const remapped = [matchPts[0], ...matchPts.slice(1).reverse()]
      eqs = mapPartToTopShape(remapped, topPts, ctx)
      if (eqs) {
        // Un-remap equations back to original part point indices
        eqs = [eqs[0], ...eqs.slice(1).reverse()]
      }
    }

    if (eqs) {
      if (isMirroredX) eqs.forEach(eq => eq.mirroredX = true)
      result.set(pi, eqs)
    }
  }

  return result
}

/**
 * Map part shape points to TopShapeXml points by absolute coordinate distance.
 *
 * Both point arrays have the same count and typically the same winding order.
 * Uses raw mm distance (not normalized) to avoid artificial divergence when
 * part dimensions differ from product dimensions by panel thickness/margins.
 *
 * For non-equation TopShape coordinates, classifies whether they track W or D
 * (e.g., a point at X=609.6 when W=609.6 → xTrack='W', so on resize X becomes newW).
 */
function mapPartToTopShape(
  partPts: MozShapePoint[],
  topPts: MozShapePoint[],
  ctx: EvalContext,
): PropagatedEq[] | null {
  const n = partPts.length

  // Try index-based mapping: assume same winding order
  let totalDist = 0
  const eqs: PropagatedEq[] = []

  for (let i = 0; i < n; i++) {
    const pp = partPts[i]
    const tp = topPts[i]

    // Absolute mm distance (panel offsets are typically ≤25mm)
    const dist = Math.sqrt((pp.x - tp.x) ** 2 + (pp.y - tp.y) ** 2)
    totalDist += dist

    // Compute offsets from evaluated equations or raw values
    const eqX = tp.xEq ? evaluateShapeEq(tp.xEq, ctx) : tp.x
    const eqY = tp.yEq ? evaluateShapeEq(tp.yEq, ctx) : tp.y

    // Classify non-equation coordinates: do they track W or D?
    const xTrack: 'W' | 'D' | undefined = !tp.xEq
      ? Math.abs(tp.x - ctx.W) < 1 ? 'W' : Math.abs(tp.x - ctx.D) < 1 ? 'D' : undefined
      : undefined
    const yTrack: 'W' | 'D' | undefined = !tp.yEq
      ? Math.abs(tp.y - ctx.D) < 1 ? 'D' : Math.abs(tp.y - ctx.W) < 1 ? 'W' : undefined
      : undefined

    eqs.push({
      xEq: tp.xEq,
      yEq: tp.yEq,
      dataEq: tp.dataEq,
      offsetX: pp.x - eqX,
      offsetY: pp.y - eqY,
      xTrack,
      yTrack,
    })
  }

  const avgDist = totalDist / n

  // Threshold: average absolute distance should be within 50mm
  // Real CRN parts differ from TopShape by panel thickness (~19mm) + margins (~6mm)
  if (avgDist > 50) {
    console.warn(`[ShapeTopology] Part mapping rejected: avgDist=${avgDist.toFixed(1)}mm (too large)`)
    return null
  }

  return eqs
}

/**
 * Apply propagated equations to compute new shape point values at given dimensions.
 *
 * For points with equations: newValue = evaluate(eq, ctx) + offset
 * For points tracking W/D: newValue = ctx[dim] + offset (tracks product dimension)
 * For constant points: keep original value (0 or param-only)
 */
export function applyPropagatedEqs(
  originalPts: MozShapePoint[],
  eqs: PropagatedEq[],
  ctx: EvalContext,
  newL?: number,
): MozShapePoint[] {
  return originalPts.map((pt, i) => {
    const eq = eqs[i]
    if (!eq) return pt

    let x: number
    if (eq.mirroredX && newL !== undefined) {
      // Mirrored: partX = newL - (topXEval + offset)
      const topX = eq.xEq ? evaluateShapeEq(eq.xEq, ctx)
                  : eq.xTrack ? ctx[eq.xTrack]
                  : 0
      x = newL - (topX + eq.offsetX)
    } else {
      x = eq.xEq ? evaluateShapeEq(eq.xEq, ctx) + eq.offsetX
              : eq.xTrack ? ctx[eq.xTrack] + eq.offsetX
              : pt.x
    }

    // Y is not mirrored (A1=180 around Y preserves Y)
    const y = eq.yEq ? evaluateShapeEq(eq.yEq, ctx) + eq.offsetY
            : eq.yTrack ? ctx[eq.yTrack] + eq.offsetY
            : pt.y
    const data = eq.dataEq ? evaluateShapeEq(eq.dataEq, ctx) : pt.data

    return { ...pt, x, y, data }
  })
}
