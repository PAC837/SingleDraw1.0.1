/**
 * Pure functions for placing products on walls.
 * Handles auto-placement left-to-right with no-overlap constraint.
 */

import type { MozWall, MozWallJoint, MozProduct } from './types'
import { computeWallTrims } from '../math/wallMath'
import { PANEL_THICK } from './autoEndPanels'

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
 * Packs from wall start (X=0) so products fill left-to-right when facing
 * the wall from inside the room. Matches Mozaik's convention.
 *
 * Reserves PANEL_THICK (19mm) gaps around products for auto end panels:
 * - Left panel before the first product
 * - Shared panel between adjacent products
 * - Right panel after the last product
 */
export function findNextAvailableX(
  products: MozProduct[],
  wallNumber: number,
  productWidth: number,
  wallUsableLength: number,
): number | null {
  if (productWidth <= 0) return null

  const wallProducts = productsOnWall(products, wallNumber)

  // No products yet — place after left panel space
  if (wallProducts.length === 0) {
    const needed = PANEL_THICK + productWidth + PANEL_THICK
    return needed <= wallUsableLength ? PANEL_THICK : null
  }

  // Raw intervals (no padding) — panel gaps counted once explicitly
  const sorted = [...wallProducts].sort((a, b) => a.x - b.x)
  const intervals = sorted.map(p => [p.x, p.x + p.width] as [number, number])

  // Merge overlapping raw intervals
  const merged: [number, number][] = [intervals[0]]
  for (let i = 1; i < intervals.length; i++) {
    const last = merged[merged.length - 1]
    if (intervals[i][0] <= last[1]) {
      last[1] = Math.max(last[1], intervals[i][1])
    } else {
      merged.push(intervals[i])
    }
  }

  // Space needed: shared panel + product + right panel
  const needed = PANEL_THICK + productWidth + PANEL_THICK

  // Gap before first product group
  if (merged[0][0] >= needed) return PANEL_THICK

  // Gaps between product groups
  for (let i = 0; i < merged.length - 1; i++) {
    const gapStart = merged[i][1]
    const gapEnd = merged[i + 1][0]
    if (gapEnd - gapStart >= needed) return gapStart + PANEL_THICK
  }

  // Gap after last product group
  const lastEnd = merged[merged.length - 1][1]
  if (wallUsableLength - lastEnd >= needed) return lastEnd + PANEL_THICK

  return null
}

/**
 * Compute the valid X range for a product, considering wall boundaries
 * and neighboring products. Enforces PANEL_THICK gap from wall edges and
 * between adjacent products (room for end panels).
 */
export function computeProductXBounds(
  products: MozProduct[],
  productIndex: number,
  walls: MozWall[],
  joints: MozWallJoint[],
): { minX: number; maxX: number } {
  const product = products[productIndex]
  if (!product) return { minX: PANEL_THICK, maxX: PANEL_THICK }

  const wallNumber = parseInt(product.wall.split('_')[0], 10)
  const usable = usableWallLength(wallNumber, walls, joints)

  // Other products on the same wall, excluding the one being moved
  const others = productsOnWall(products, wallNumber)
    .filter(p => p !== product)
    .sort((a, b) => a.x - b.x)

  // Left neighbor: rightmost product starting before this one
  const leftNeighbors = others.filter(p => p.x < product.x)
  const leftNeighbor = leftNeighbors.length > 0 ? leftNeighbors[leftNeighbors.length - 1] : null

  // Right neighbor: leftmost product starting after this one
  const rightNeighbor = others.find(p => p.x > product.x) ?? null

  const minX = leftNeighbor
    ? Math.max(PANEL_THICK, leftNeighbor.x + leftNeighbor.width + PANEL_THICK)
    : PANEL_THICK

  const maxX = rightNeighbor
    ? Math.min(usable - product.width - PANEL_THICK, rightNeighbor.x - product.width - PANEL_THICK)
    : usable - product.width - PANEL_THICK

  return {
    minX,
    maxX: Math.max(minX, maxX),
  }
}

/** Clone a product for wall placement. Sets wall ref, x position, elevation, rot=0. */
export function placeProductOnWall(
  sourceProduct: MozProduct,
  wallNumber: number,
  xPosition: number,
  elev = 0,
): MozProduct {
  return {
    ...sourceProduct,
    uniqueId: String(Date.now() % 100000000 + Math.floor(Math.random() * 1000)),
    wall: `${wallNumber}_1`,
    x: xPosition,
    elev,
    rot: 0,
  }
}
