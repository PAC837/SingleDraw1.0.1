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

/** Gap between two products: PANEL_THICK if profiles match (shared panel), 2×PANEL_THICK otherwise.
 *  flipOps: when true, share panel if shorter section is contained within taller's vertical range
 *  (regardless of depth difference). flipOps OFF: depth differences also force double panels. */
function profileGap(
  hA: number, hB: number, elevA: number, elevB: number,
  depthA: number, depthB: number, flipOps = false,
): number {
  const sameHeight = Math.abs(hA - hB) < 1
  const sameElev = Math.abs(elevA - elevB) < 1
  const sameDepth = Math.abs(depthA - depthB) < 1
  if (sameHeight && sameElev && sameDepth) return PANEL_THICK

  if (flipOps) {
    const topA = hA + elevA, topB = hB + elevB
    // Share panel if shorter section fits within taller's vertical range (±1mm tolerance)
    const aContainsB = elevB >= elevA - 1 && topB <= topA + 1
    const bContainsA = elevA >= elevB - 1 && topA <= topB + 1
    if (aContainsB || bContainsA) return PANEL_THICK
  }

  return 2 * PANEL_THICK
}

/**
 * Find the next available X position on a wall for a product of given width.
 * Packs from wall start (X=0) so products fill left-to-right when facing
 * the wall from inside the room. Matches Mozaik's convention.
 *
 * Reserves profile-aware panel gaps around products for auto end panels:
 * - PANEL_THICK before the first product (one left panel)
 * - PANEL_THICK between same-profile products (shared panel)
 * - 2×PANEL_THICK between different-profile products (separate panels)
 * - PANEL_THICK after the last product (one right panel)
 */
export function findNextAvailableX(
  products: MozProduct[],
  wallNumber: number,
  productWidth: number,
  productHeight: number,
  productElev: number,
  productDepth: number,
  wallUsableLength: number,
  flipOps = false,
): number | null {
  if (productWidth <= 0) return null

  const wallProducts = productsOnWall(products, wallNumber)

  // No products yet — place after left panel space
  if (wallProducts.length === 0) {
    const needed = PANEL_THICK + productWidth + PANEL_THICK
    return needed <= wallUsableLength ? PANEL_THICK : null
  }

  const sorted = [...wallProducts].sort((a, b) => a.x - b.x)

  // Gap before first product (left wall panel + product + profile gap to first neighbor)
  const rightGap0 = profileGap(sorted[0].height, productHeight, sorted[0].elev, productElev, sorted[0].depth, productDepth, flipOps)
  if (sorted[0].x >= PANEL_THICK + productWidth + rightGap0) return PANEL_THICK

  // Gaps between existing products
  for (let i = 0; i < sorted.length - 1; i++) {
    const gapStart = sorted[i].x + sorted[i].width
    const gapEnd = sorted[i + 1].x
    const lGap = profileGap(sorted[i].height, productHeight, sorted[i].elev, productElev, sorted[i].depth, productDepth, flipOps)
    const rGap = profileGap(sorted[i + 1].height, productHeight, sorted[i + 1].elev, productElev, sorted[i + 1].depth, productDepth, flipOps)
    if (gapEnd - gapStart >= lGap + productWidth + rGap) return gapStart + lGap
  }

  // Gap after last product (profile gap + product + right wall panel)
  const last = sorted[sorted.length - 1]
  const lastEnd = last.x + last.width
  const lGap = profileGap(last.height, productHeight, last.elev, productElev, last.depth, productDepth, flipOps)
  if (wallUsableLength - lastEnd >= lGap + productWidth + PANEL_THICK) return lastEnd + lGap

  return null
}

/**
 * Compute the valid X range for a product, considering wall boundaries
 * and neighboring products. Enforces PANEL_THICK gap from wall edges and
 * profile-aware gaps between adjacent products (PANEL_THICK for same profile,
 * 2×PANEL_THICK for different profile).
 */
export function computeProductXBounds(
  products: MozProduct[],
  productIndex: number,
  walls: MozWall[],
  joints: MozWallJoint[],
  flipOps = false,
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

  const leftGap = leftNeighbor ? profileGap(product.height, leftNeighbor.height, product.elev, leftNeighbor.elev, product.depth, leftNeighbor.depth, flipOps) : 0
  const rightGap = rightNeighbor ? profileGap(product.height, rightNeighbor.height, product.elev, rightNeighbor.elev, product.depth, rightNeighbor.depth, flipOps) : 0

  const minX = leftNeighbor
    ? Math.max(PANEL_THICK, leftNeighbor.x + leftNeighbor.width + leftGap)
    : PANEL_THICK

  const maxX = rightNeighbor
    ? Math.min(usable - product.width - PANEL_THICK, rightNeighbor.x - product.width - rightGap)
    : usable - product.width - PANEL_THICK

  return {
    minX,
    maxX: Math.max(minX, maxX),
  }
}

/**
 * Compute max width a product can grow to without overlapping neighbors.
 * Profile-aware: same-profile neighbors allow PANEL_THICK gap (shared panel),
 * different-profile neighbors require 2×PANEL_THICK gap (separate panels).
 *
 * @param anchor - Which edge is anchored during resize:
 *   'left' = product.x stays (right ball drag), max = rightBound - product.x
 *   'right' = right edge stays (left ball drag), max = rightEdge - leftBound
 *   undefined = total corridor (placement)
 */
export function computeMaxProductWidth(
  products: MozProduct[],
  productIndex: number,
  walls: MozWall[],
  joints: MozWallJoint[],
  anchor?: 'left' | 'right',
  flipOps = false,
): number {
  const product = products[productIndex]
  if (!product) return Infinity

  const wallNumber = parseInt(product.wall.split('_')[0], 10)
  const usable = usableWallLength(wallNumber, walls, joints)
  const others = productsOnWall(products, wallNumber)
    .filter(p => p !== product)
    .sort((a, b) => a.x - b.x)

  // Left boundary: nearest left neighbor's right edge + gap, or wall start + panel
  const leftNeighbors = others.filter(p => p.x + p.width <= product.x + 1)
  const leftNeighbor = leftNeighbors.length > 0 ? leftNeighbors[leftNeighbors.length - 1] : null
  const leftGap = leftNeighbor ? profileGap(product.height, leftNeighbor.height, product.elev, leftNeighbor.elev, product.depth, leftNeighbor.depth, flipOps) : 0
  const leftBound = leftNeighbor
    ? leftNeighbor.x + leftNeighbor.width + leftGap
    : PANEL_THICK

  // Right boundary: nearest right neighbor's left edge - gap, or wall end - panel
  const rightNeighbor = others.find(p => p.x >= product.x + product.width - 1) ?? null
  const rightGap = rightNeighbor ? profileGap(product.height, rightNeighbor.height, product.elev, rightNeighbor.elev, product.depth, rightNeighbor.depth, flipOps) : 0
  const rightBound = rightNeighbor
    ? rightNeighbor.x - rightGap
    : usable - PANEL_THICK

  if (anchor === 'left') return Math.max(PANEL_THICK, rightBound - product.x)
  if (anchor === 'right') return Math.max(PANEL_THICK, (product.x + product.width) - leftBound)
  return Math.max(PANEL_THICK, rightBound - leftBound)
}

/**
 * After a product's height changes, repack all products on the same wall so
 * every adjacent pair has the correct profile gap. Single left-to-right pass:
 * each product is placed at idealX = prev.x + prev.width + profileGap.
 * Products that were too close get pushed right; products with excess gap
 * get pulled left. Returns array of {index, x} adjustments to apply.
 */
export function adjustNeighborGaps(
  products: MozProduct[],
  changedIndex: number,
  walls: MozWall[],
  joints: MozWallJoint[],
  flipOps = false,
): { index: number; x: number }[] {
  const product = products[changedIndex]
  if (!product) return []

  const wallNumber = parseInt(product.wall.split('_')[0], 10)
  const usable = usableWallLength(wallNumber, walls, joints)

  // All products on this wall with their original indices, sorted by x
  const wallProds = products
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => parseInt(p.wall.split('_')[0], 10) === wallNumber)
    .sort((a, b) => a.p.x - b.p.x)

  if (wallProds.length < 2) return []

  const adjusted = new Map<number, number>() // index → newX

  // Single pass: repack left-to-right, every pair gets the correct gap.
  // Only adjust products that were already adjacent (panel-gap distance).
  // Products with intentional spacing (> 3 panel thicknesses) are left alone.
  for (let k = 0; k < wallProds.length - 1; k++) {
    const curr = wallProds[k]
    const next = wallProds[k + 1]
    const currentGap = next.p.x - (curr.p.x + curr.p.width)
    if (currentGap > 3 * PANEL_THICK) continue
    const gap = profileGap(curr.p.height, next.p.height, curr.p.elev, next.p.elev, curr.p.depth, next.p.depth, flipOps)
    const idealX = curr.p.x + curr.p.width + gap
    const clampedX = Math.min(idealX, usable - next.p.width - PANEL_THICK)

    if (Math.abs(next.p.x - clampedX) > 0.5) {
      wallProds[k + 1] = { ...next, p: { ...next.p, x: clampedX } }
      adjusted.set(next.i, clampedX)
    }
  }

  return Array.from(adjusted, ([index, x]) => ({ index, x }))
}

/**
 * When elevation changes, compute the width and X adjustments needed
 * to compensate for panel sharing changes. Only fires on transitions:
 * shared→separate: shrink width by PANEL_THICK per affected side
 * separate→shared: grow width by PANEL_THICK per affected side
 */
export function computeElevWidthAdjustment(
  products: MozProduct[],
  productIndex: number,
  newElev: number,
  flipOps = false,
): { widthDelta: number; xDelta: number } {
  const product = products[productIndex]
  if (!product) return { widthDelta: 0, xDelta: 0 }

  const wallNumber = parseInt(product.wall.split('_')[0], 10)
  const others = productsOnWall(products, wallNumber)
    .filter(p => p !== product)
    .sort((a, b) => a.x - b.x)

  const leftNeighbor = others.filter(p => p.x < product.x).pop() ?? null
  const rightNeighbor = others.find(p => p.x > product.x) ?? null

  let widthDelta = 0
  let xDelta = 0

  if (leftNeighbor) {
    const oldGap = profileGap(product.height, leftNeighbor.height, product.elev, leftNeighbor.elev, product.depth, leftNeighbor.depth, flipOps)
    const newGap = profileGap(product.height, leftNeighbor.height, newElev, leftNeighbor.elev, product.depth, leftNeighbor.depth, flipOps)
    const delta = newGap - oldGap  // +19 = shared→separate, -19 = separate→shared
    widthDelta -= delta
    xDelta += delta
  }

  if (rightNeighbor) {
    const oldGap = profileGap(product.height, rightNeighbor.height, product.elev, rightNeighbor.elev, product.depth, rightNeighbor.depth, flipOps)
    const newGap = profileGap(product.height, rightNeighbor.height, newElev, rightNeighbor.elev, product.depth, rightNeighbor.depth, flipOps)
    const delta = newGap - oldGap
    widthDelta -= delta
  }

  return { widthDelta, xDelta }
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
