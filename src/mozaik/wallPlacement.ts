/**
 * Pure functions for placing products on walls.
 * Handles auto-placement left-to-right with no-overlap constraint.
 */

import type { MozWall, MozWallJoint, MozProduct } from './types'
import { computeWallTrims } from '../math/wallMath'

/** Get usable wall length after joint trims. */
export function usableWallLength(
  wallNumber: number,
  walls: MozWall[],
  joints: MozWallJoint[],
): number {
  const wall = walls.find((w) => w.wallNumber === wallNumber)
  if (!wall) return 0
  const trims = computeWallTrims(walls, joints)
  const trim = trims.get(wallNumber) ?? { trimStart: 0, trimEnd: 0 }
  return wall.len - trim.trimStart - trim.trimEnd
}

/** Get products currently placed on a specific wall. */
export function productsOnWall(products: MozProduct[], wallNumber: number): MozProduct[] {
  return products.filter((p) => {
    const ref = parseInt(p.wall.split('_')[0], 10)
    return ref === wallNumber
  })
}

/**
 * Find the next available X position on a wall for a product of given width.
 * Packs against the wall END (highest x first) so products fill visually
 * left-to-right when facing the wall from inside a CCW room.
 */
export function findNextAvailableX(
  products: MozProduct[],
  wallNumber: number,
  productWidth: number,
  wallUsableLength: number,
): number | null {
  if (productWidth <= 0) return null

  const wallProducts = productsOnWall(products, wallNumber)
  const intervals = wallProducts
    .map((p) => [p.x, p.x + p.width] as [number, number])
    .sort((a, b) => a[0] - b[0])

  // No products yet — place at far end
  if (intervals.length === 0) {
    return productWidth <= wallUsableLength ? wallUsableLength - productWidth : null
  }

  // Gap after last product (nearest to wall end)
  const lastEnd = intervals[intervals.length - 1][1]
  if (wallUsableLength - lastEnd >= productWidth) return wallUsableLength - productWidth

  // Gaps between products (scan from far end toward start)
  for (let i = intervals.length - 1; i > 0; i--) {
    const gapStart = intervals[i - 1][1]
    const gapEnd = intervals[i][0]
    if (gapEnd - gapStart >= productWidth) return gapEnd - productWidth
  }

  // Gap before first product (nearest to wall start)
  if (intervals[0][0] >= productWidth) return intervals[0][0] - productWidth

  return null
}

/** Clone a product for wall placement. Sets wall ref, x position, elev=0, rot=0. */
export function placeProductOnWall(
  sourceProduct: MozProduct,
  wallNumber: number,
  xPosition: number,
): MozProduct {
  return {
    ...sourceProduct,
    uniqueId: `placed-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
    wall: `${wallNumber}_1`,
    x: xPosition,
    elev: 0,
    rot: 0,
  }
}
