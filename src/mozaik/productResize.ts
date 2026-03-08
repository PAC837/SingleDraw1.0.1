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
import { evaluateTopShape } from './shapeEquations'

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
 * CRN-specific resize: re-evaluate TopShapeXml equations and shift parts
 * based on arm structure instead of proportional scaling.
 *
 * Evidence-based rules (from diffing 4 real MOZ files at 24x24, 36xWidth, 36xDepth):
 * - Width: right-arm parts (X > threshold) shift X += delta. Left-arm WIDTH_SPANNING
 *   parts grow L += delta unconditionally (no tolerance). Full-width parts (L ≈ oldValue)
 *   grow regardless of arm. Right-arm-only parts do NOT grow L.
 * - Part shape points: non-zero X values shift by however much the part's L changed.
 * - Same pattern for depth (swap X↔Y, L↔W).
 */
function resizeCrnProduct(
  product: MozProduct,
  field: 'width' | 'depth',
  newValue: number,
): MozProduct {
  const oldValue = product[field]
  const delta = newValue - oldValue

  // Re-evaluate TopShapeXml with new dimension, passing old dim for static point delta-shift
  const updated = { ...product, [field]: newValue }
  const newTopShape = evaluateTopShape(updated,
    field === 'width' ? oldValue : undefined,
    field === 'depth' ? oldValue : undefined,
  )

  // Determine arm threshold from parameters
  // Parts beyond this threshold on the changing axis belong to the "moving" arm
  const endW = field === 'width'
    ? getParamValue(product, 'CornerEndWRight')
    : getParamValue(product, 'CornerEndWLeft')
  const threshold = endW > 0 ? oldValue - endW : oldValue / 2
  const leftArmW = threshold  // = oldValue - endW

  // Cross-axis threshold: gate shape point shifts so depth-arm points don't shift on width resize (and vice versa)
  const crossEndW = field === 'width'
    ? getParamValue(product, 'CornerEndWLeft')
    : getParamValue(product, 'CornerEndWRight')
  const crossDim = field === 'width' ? product.depth : product.width
  const crossThreshold = crossEndW > 0 ? crossDim - crossEndW : crossDim / 2

  // Resize parts: partition into arms, grow expanding arm's parts
  const newParts = product.parts.map(part => {
    let { x, y, l, w, shapePoints } = part
    const typeLower = part.type.toLowerCase()

    if (field === 'width') {
      const inRightArm = x > threshold

      // Right arm parts: shift position by delta
      if (inRightArm) x += delta

      // Full-width parts (L ≈ product width): grow regardless of arm
      if (WIDTH_SPANNING_TYPES.has(typeLower) && Math.abs(l - oldValue) < TOLERANCE) {
        l += delta
      }
      // Left arm WIDTH_SPANNING parts: always grow L (no tolerance — proven by data)
      else if (!inRightArm && WIDTH_SPANNING_TYPES.has(typeLower)) {
        l += delta
      }
      // Right arm non-full-width parts: L unchanged (arm width is constant)

      // Left arm rods/drawers: grow if they span a significant portion of the arm
      if (!inRightArm) {
        if (isRod(part) && l > leftArmW * 0.5) l += delta
        if (typeLower === 'drawer' && l > leftArmW * 0.5) l += delta
        if (typeLower === 'drawerback' && l > leftArmW * 0.5) l += delta
        if (typeLower === 'drawerbottom' && w > leftArmW * 0.5) w += delta
      }

      // Part shape points: shift non-zero X by however much L changed
      // Only shift points in the width arm (sp.y < crossThreshold) — depth arm points stay fixed
      const lDelta = l - part.l
      if (lDelta !== 0 && shapePoints.length > 0) {
        shapePoints = shapePoints.map(sp => ({
          ...sp, x: sp.x > 0 && sp.y < crossThreshold ? sp.x + lDelta : sp.x,
        }))
      }
    } else {
      const inBackArm = y > threshold

      // Back arm parts: shift position by delta
      if (inBackArm) y += delta

      // Full-depth parts (W ≈ product depth): grow regardless of arm
      if (!isToe(part) && Math.abs(w - oldValue) < TOLERANCE) {
        w += delta
      }
      // Front arm parts: always grow W (no tolerance — proven by data)
      else if (!inBackArm && !isToe(part)) {
        w += delta
      }
      // Back arm non-full-depth parts: W unchanged (arm width is constant)

      // CRN: Toe running along the depth axis — grow L
      // Identified by X position being in the width arm (perpendicular to depth)
      if (isToe(part)) {
        const widthEndW = getParamValue(product, 'CornerEndWRight')
        const widthThreshold = widthEndW > 0 ? product.width - widthEndW : product.width / 2
        if (part.x > widthThreshold) {
          l += delta
        }
      }

      // Part shape points: shift X by lDelta (for parts whose L changed, e.g. depth-axis toe)
      const lDelta = l - part.l
      if (lDelta !== 0 && shapePoints.length > 0) {
        shapePoints = shapePoints.map(sp => ({
          ...sp, x: sp.x > 0 ? sp.x + lDelta : sp.x,
        }))
      }

      // Part shape points: shift non-zero Y by however much W changed
      // Only shift points in the depth arm (sp.x < crossThreshold) — width arm points stay fixed
      const wDelta = w - part.w
      if (wDelta !== 0 && shapePoints.length > 0) {
        shapePoints = shapePoints.map(sp => ({
          ...sp, y: sp.y > 0 && sp.x < crossThreshold ? sp.y + wDelta : sp.y,
        }))
      }
    }

    return { ...part, x, y, l, w, shapePoints }
  })

  return {
    ...product,
    [field]: newValue,
    parts: newParts,
    topShapePoints: newTopShape,
  }
}

/** Get a numeric CabProdParm value by name, or 0 if not found. */
function getParamValue(product: MozProduct, name: string): number {
  const p = product.parameters.find(p => p.name === name)
  return p ? parseFloat(p.value) || 0 : 0
}
