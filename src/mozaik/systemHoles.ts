/**
 * Generate system shelf-pin holes for end panels (FEnd parts).
 * Mozaik creates these holes upon entry into the application, but they
 * are not stored in the MOZ file for generic products.
 *
 * Pattern: two columns of 5mm holes at 32mm vertical spacing.
 * - Front column: 68mm from front edge
 * - Back column: panelDepth - 96mm from front edge
 * - First row: 10mm from bottom edge
 * - Last row: panelHeight - 10mm from top edge
 */
import type { MozOperationHole } from './types'

const FRONT_INSET = 68   // mm from front edge to first column
const BACK_INSET = 96    // mm from back edge to last column
const EDGE_INSET = 10    // mm from top/bottom edge to first/last hole
const SPACING = 32       // mm between holes (modular system hole spacing)
const HOLE_DIAMETER = 5  // mm
const HOLE_DEPTH = 12    // mm

/**
 * Generate system shelf-pin holes for an end panel.
 * @param panelHeight Panel height in mm (part.l for FEnd parts)
 * @param panelDepth Panel depth in mm (part.w for FEnd parts)
 * @returns Array of hole operations in part-local coordinates
 */
export function generateSystemHoles(
  panelHeight: number,
  panelDepth: number,
): MozOperationHole[] {
  const holes: MozOperationHole[] = []

  // Two column positions (X = along panel height for FEnd, Y = along depth)
  const colY1 = FRONT_INSET
  const colY2 = panelDepth - BACK_INSET

  // Skip if panel is too small for columns
  if (colY2 <= colY1 || panelHeight < EDGE_INSET * 2 + SPACING) return holes

  // Generate holes along height at 32mm intervals
  const startX = EDGE_INSET
  const endX = panelHeight - EDGE_INSET

  for (let x = startX; x <= endX + 0.01; x += SPACING) {
    // Front column
    holes.push({
      type: 'hole',
      x,
      y: colY1,
      depth: HOLE_DEPTH,
      diameter: HOLE_DIAMETER,
      flipSideOp: false,
    })
    // Back column
    holes.push({
      type: 'hole',
      x,
      y: colY2,
      depth: HOLE_DEPTH,
      diameter: HOLE_DIAMETER,
      flipSideOp: false,
    })
  }

  return holes
}
