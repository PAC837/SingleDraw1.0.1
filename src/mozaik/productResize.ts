/**
 * Parametric product resizing — adjusts part dimensions and positions
 * when product width, depth, or height changes.
 *
 * Rules:
 * - Width: horizontal parts (Top, Bottom, Shelf, Toe, Rod) grow L by delta.
 *          End panels (FEnd, UEnd) do NOT change L.
 *          All part X positions scale proportionally.
 * - Depth: horizontal parts grow W by delta (except Toe whose W is toe height).
 *          All part Y positions scale proportionally.
 * - Height: end panels (FEnd, UEnd) grow L by delta.
 *           All part Z positions scale proportionally.
 */

import type { MozProduct, MozPart } from './types'
import { evaluateTopShape, buildEvalContext } from './shapeEquations'
import { inferDependency, getDimPref } from './formulaInference'
import { applyPropagatedEqs, propagateEquations } from './shapeTopology'

const TOLERANCE = 20  // mm — how close part.l must be to product dimension to be considered "spanning"

/** Types whose L spans the product width (horizontal parts). */
const WIDTH_SPANNING_TYPES = new Set(['top', 'bottom', 'fixedshelf', 'adjustableshelf', 'toe'])

/** Types whose L spans the product height (vertical end panels). */
const HEIGHT_SPANNING_TYPES = new Set(['fend', 'uend'])

function isRod(part: MozPart): boolean {
  return part.name.toLowerCase().includes('rod')
}

function isToe(part: MozPart): boolean {
  return part.type.toLowerCase() === 'toe'
}

function resizePart(
  part: MozPart,
  field: 'width' | 'depth' | 'height',
  oldValue: number,
  newValue: number,
): MozPart {
  const ratio = oldValue > 0 ? newValue / oldValue : 1
  const delta = newValue - oldValue
  const typeLower = part.type.toLowerCase()
  let { x, y, z, l, w, shapePoints } = part

  switch (field) {
    case 'width':
      // Scale X position proportionally
      x = x * ratio
      // Grow L for width-spanning parts (tight tolerance)
      if (WIDTH_SPANNING_TYPES.has(typeLower) && Math.abs(l - oldValue) < TOLERANCE) {
        l += delta
      }
      // Rods: grow L if they span most of the width
      if (isRod(part) && l > oldValue * 0.8) {
        l += delta
      }
      // Drawer faces: L spans width (includes overlay overhang beyond product width)
      if (typeLower === 'drawer' && l > oldValue * 0.7) {
        l += delta
      }
      // Drawer backs: L spans width (slightly narrower than product)
      if (typeLower === 'drawerback' && l > oldValue * 0.7) {
        l += delta
      }
      // Drawer bottoms: W spans width (rotated part — L is depth, W is width)
      if (typeLower === 'drawerbottom' && w > oldValue * 0.7) {
        w += delta
      }
      // Metal (drawer slides): L is depth — do NOT grow
      // Scale shape points X coordinates
      if (shapePoints.length > 0) {
        shapePoints = shapePoints.map(sp => ({
          ...sp,
          x: sp.x * ratio,
        }))
      }
      break

    case 'depth':
      // Scale Y position proportionally
      y = y * ratio
      // Grow W for depth-spanning parts (but NOT toe — toe W is toe height)
      if (!isToe(part) && Math.abs(w - oldValue) < TOLERANCE) {
        w += delta
      }
      // Scale shape points Y coordinates
      if (shapePoints.length > 0) {
        shapePoints = shapePoints.map(sp => ({
          ...sp,
          y: sp.y * ratio,
        }))
      }
      break

    case 'height':
      // Scale Z position proportionally
      z = z * ratio
      // Grow L for height-spanning end panels
      if (HEIGHT_SPANNING_TYPES.has(typeLower) && Math.abs(l - oldValue) < TOLERANCE) {
        l += delta
      }
      break
  }

  return { ...part, x, y, z, l, w, shapePoints }
}

/**
 * Resize a product and all its parts parametrically.
 * Returns a new MozProduct with updated dimensions and parts.
 *
 * For CRN (non-rect) products with TopShapeXml equations:
 * - Width: left arm stays fixed, right arm shifts. Equations re-evaluated.
 * - Depth: top arm stays fixed, bottom arm shifts. Equations re-evaluated.
 */
export function resizeProduct(
  product: MozProduct,
  field: 'width' | 'depth' | 'height',
  newValue: number,
): MozProduct {
  const oldValue = product[field]
  if (newValue === oldValue || newValue <= 0) return product

  // CRN equation-based resize for width/depth
  if (product.isRectShape === false && product.topShapePoints?.length > 0
      && (field === 'width' || field === 'depth')) {
    return resizeCrnProduct(product, field, newValue)
  }

  const newParts = product.parts.map(part =>
    resizePart(part, field, oldValue, newValue)
  )

  return {
    ...product,
    [field]: newValue,
    parts: newParts,
  }
}

/**
 * CRN-specific resize with cached dependency map.
 *
 * On first resize, infers which dimension (W/D/null) each part value depends on
 * using the ORIGINAL product dimensions, then caches the result. Subsequent
 * resizes reuse the cache and apply cumulative deltas from original values.
 * This ensures resize is idempotent and fully reversible.
 */
function resizeCrnProduct(
  product: MozProduct,
  field: 'width' | 'depth',
  newValue: number,
): MozProduct {
  // Get or compute dependency cache from original product state
  type DepEntry = { dep: 'W' | 'D' | null; orig: number }
  const clampDep = (d: 'W' | 'D' | 'H' | null): 'W' | 'D' | null => d === 'H' ? null : d
  let deps = product._crnDeps
  let shapeEqMap = product._shapeEqMap
  if (!deps || !deps.originalTopShapePoints) {
    // Regenerate _shapeEqMap alongside deps (old caches lack xTrack/yTrack)
    shapeEqMap = propagateEquations(product)
    const ctx = buildEvalContext(product)
    deps = {
      originalW: product.width,
      originalD: product.depth,
      originalTopShapePoints: product.topShapePoints ?? [],
      parts: product.parts.map(part => {
        const a2 = part.rotation.a2
        return {
          x: { dep: clampDep(inferDependency(part.x, ctx, getDimPref('x', a2))), orig: part.x },
          y: { dep: clampDep(inferDependency(part.y, ctx, getDimPref('y', a2))), orig: part.y },
          l: { dep: clampDep(inferDependency(part.l, ctx, getDimPref('l', a2))), orig: part.l },
          w: { dep: clampDep(inferDependency(part.w, ctx, getDimPref('w', a2))), orig: part.w },
          sp: part.shapePoints.map(sp => ({
            x: { dep: clampDep(inferDependency(sp.x, ctx, getDimPref('spX', a2))), orig: sp.x },
            y: { dep: clampDep(inferDependency(sp.y, ctx, getDimPref('spY', a2))), orig: sp.y },
          })),
        }
      }),
    }
  }

  // Cumulative deltas from original dimensions
  const newW = field === 'width' ? newValue : product.width
  const newD = field === 'depth' ? newValue : product.depth
  const wDelta = newW - deps!.originalW
  const dDelta = newD - deps!.originalD

  // Re-evaluate TopShapeXml equations at new dimensions (from cached originals to avoid compounding)
  const updated = { ...product, width: newW, depth: newD }
  const newTopShape = evaluateTopShape(updated, deps!.originalW, deps!.originalD, deps!.originalTopShapePoints)

  // Helper: compute value from original + appropriate delta
  const apply = (entry: DepEntry) =>
    entry.orig + (entry.dep === 'W' ? wDelta : entry.dep === 'D' ? dDelta : 0)

  // Build eval context at new dimensions for equation-based shape point evaluation
  const eqCtx = buildEvalContext(updated)

  // Rebuild each part from original values + cumulative deltas
  const newParts = product.parts.map((part, i) => {
    const pd = deps!.parts[i]
    const propagatedEqs = shapeEqMap?.get(i)
    const newL = apply(pd.l)

    // For shape points: use propagated equations if available, else inference
    const newShapePoints = propagatedEqs
      ? applyPropagatedEqs(part.shapePoints, propagatedEqs, eqCtx, newL)
      : part.shapePoints.map((sp, j) => ({
          ...sp,
          x: apply(pd.sp[j].x),
          y: apply(pd.sp[j].y),
        }))

    return {
      ...part,
      x: apply(pd.x),
      y: apply(pd.y),
      l: newL,
      w: apply(pd.w),
      shapePoints: newShapePoints,
    }
  })

  return {
    ...product,
    width: newW,
    depth: newD,
    parts: newParts,
    topShapePoints: newTopShape,
    _crnDeps: deps,
    _shapeEqMap: shapeEqMap,
  }
}
