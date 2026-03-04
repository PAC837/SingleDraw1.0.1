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
      // Grow L for width-spanning parts
      if (WIDTH_SPANNING_TYPES.has(typeLower) && Math.abs(l - oldValue) < TOLERANCE) {
        l += delta
      }
      // Rods: grow L if they span most of the width
      if (isRod(part) && l > oldValue * 0.8) {
        l += delta
      }
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
 */
export function resizeProduct(
  product: MozProduct,
  field: 'width' | 'depth' | 'height',
  newValue: number,
): MozProduct {
  const oldValue = product[field]
  if (newValue === oldValue || newValue <= 0) return product

  const newParts = product.parts.map(part =>
    resizePart(part, field, oldValue, newValue)
  )

  return {
    ...product,
    [field]: newValue,
    parts: newParts,
  }
}
