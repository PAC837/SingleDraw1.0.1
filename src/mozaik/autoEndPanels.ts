/**
 * Auto end panel computation — derives vertical panel positions from the
 * product arrangement on each wall. Panels are NOT stored; they're computed
 * on-the-fly for rendering and DES export.
 *
 * Rules:
 * - Panel thickness: always 19mm (3/4" wood)
 * - Height & depth: match the adjacent section
 * - Standalone section → panels on both left and right (if space)
 * - Adjacent same-depth sections → one shared panel
 * - Adjacent different-depth sections → separate panel per edge
 * - No space → panel doesn't appear
 */

import type { MozProduct, MozPart, MozWall, MozWallJoint } from './types'
import { productsOnWall, usableWallLength } from './wallPlacement'
import { floorPanelAttrs, floorPanelInnerXml, wallPanelAttrs, wallPanelInnerXml } from '../export/panelTemplate'

export const PANEL_THICK = 19 // mm (3/4" standard wood panel)

const DEPTH_TOL = 1 // mm — tolerance for "same depth" comparison
const END_TYPES = new Set(['fend', 'uend', 'bend'])

/** Get effective depth for auto panel generation.
 *  Non-rect products (CRN) use CornerEndW params or FEnd part width instead of full bounding box. */
export function getEffectiveDepth(product: MozProduct): number {
  if (product.isRectShape !== false) return product.depth
  // Prefer CornerEndWLeft/Right parameters if available
  const cornerEnd = product.parameters?.find(p =>
    p.name === 'CornerEndWLeft' || p.name === 'CornerEndWRight',
  )
  if (cornerEnd) return parseFloat(cornerEnd.value)
  const fend = product.parts.find(p => END_TYPES.has(p.type.toLowerCase()))
  return fend ? fend.w : product.depth
}

/** Check if a product already has an end panel part on the given side. */
function hasEndPart(product: MozProduct, side: 'left' | 'right'): boolean {
  return product.parts.some(p => {
    if (!END_TYPES.has(p.type.toLowerCase())) return false
    if (side === 'left') return p.x < PANEL_THICK + 1
    return p.x > product.width - PANEL_THICK - 1
  })
}

interface CrnPhantom {
  product: MozProduct
  productIndex: number
}

/** Get CRN phantom at the END of a wall (from next wall's CRN at start). */
function getCrnPhantomAtWallEnd(
  wn: number, products: MozProduct[], walls: MozWall[], joints: MozWallJoint[],
): CrnPhantom | null {
  const wallIdx = walls.findIndex(w => w.wallNumber === wn)
  if (wallIdx < 0) return null
  const nextIdx = (wallIdx + 1) % walls.length
  const nextWall = walls[nextIdx]
  const usable = usableWallLength(wn, walls, joints)
  for (let pi = 0; pi < products.length; pi++) {
    const p = products[pi]
    if (p.isRectShape !== false) continue
    if (parseInt(p.wall.split('_')[0], 10) !== nextWall.wallNumber) continue
    if (p.x > PANEL_THICK) continue
    return {
      product: { ...p, x: usable - p.depth, width: p.depth, depth: getEffectiveDepth(p), wall: `${wn}_1` },
      productIndex: pi,
    }
  }
  return null
}

/** Get CRN phantom at the START of a wall (from prev wall's CRN at end). */
function getCrnPhantomAtWallStart(
  wn: number, products: MozProduct[], walls: MozWall[], joints: MozWallJoint[],
): CrnPhantom | null {
  const wallIdx = walls.findIndex(w => w.wallNumber === wn)
  if (wallIdx < 0) return null
  const prevIdx = (wallIdx - 1 + walls.length) % walls.length
  const prevWall = walls[prevIdx]
  const prevUsable = usableWallLength(prevWall.wallNumber, walls, joints)
  for (let pi = 0; pi < products.length; pi++) {
    const p = products[pi]
    if (p.isRectShape !== false) continue
    if (parseInt(p.wall.split('_')[0], 10) !== prevWall.wallNumber) continue
    if (prevUsable - (p.x + p.width) >= PANEL_THICK) continue
    return {
      product: { ...p, x: 0, width: p.depth, depth: getEffectiveDepth(p), wall: `${wn}_1` },
      productIndex: pi,
    }
  }
  return null
}

export interface AutoEndPanel {
  wallNumber: number
  x: number        // position in product.x coordinate space
  width: number    // always PANEL_THICK
  height: number
  depth: number
  elev: number
  adjacentProductIndex: number // index into room.products for texture
  side: 'left' | 'right' | 'shared'
}

/** Compute auto end panels for all walls in a room. */
export function computeAutoEndPanels(
  products: MozProduct[],
  walls: MozWall[],
  joints: MozWallJoint[],
  flipOps = false,
): AutoEndPanel[] {
  const panels: AutoEndPanel[] = []

  for (const wall of walls) {
    const wn = wall.wallNumber
    const wallProds = productsOnWall(products, wn)
    if (wallProds.length === 0) continue

    const sorted = [...wallProds].sort((a, b) => a.x - b.x)
    const usable = usableWallLength(wn, walls, joints)

    // Map sorted products back to their index in the original products array
    const prodIndices = sorted.map(sp =>
      products.findIndex(p => p === sp),
    )

    for (let i = 0; i < sorted.length; i++) {
      const prod = sorted[i]
      const prodIdx = prodIndices[i]
      const leftEdge = prod.x
      const rightEdge = prod.x + prod.width
      const isNonRect = prod.isRectShape === false
      const effDepth = getEffectiveDepth(prod)

      // --- LEFT SIDE ---
      // Non-rect products (CRN): built-in FEnd parts are structural, not end covers — bypass hasEndPart
      const prodHasLeftEnd = !isNonRect && hasEndPart(prod, 'left')
      if (i === 0) {
        const crnStart = getCrnPhantomAtWallStart(wn, products, walls, joints)
        if (crnStart && !(isNonRect && leftEdge <= PANEL_THICK)) {
          // CRN arm at wall start — apply between-products panel logic
          const ph = crnStart.product
          const phDepth = ph.depth
          const phRight = ph.x + ph.width
          const gap = leftEdge - phRight
          const sameProfile = (
            Math.abs(effDepth - phDepth) < DEPTH_TOL
            && Math.abs(prod.height - ph.height) < DEPTH_TOL
            && Math.abs(prod.elev - ph.elev) < DEPTH_TOL
          ) || (flipOps && Math.abs(effDepth - phDepth) < DEPTH_TOL && (
            (ph.elev >= prod.elev - DEPTH_TOL && (ph.height + ph.elev) <= (prod.height + prod.elev) + DEPTH_TOL) ||
            (prod.elev >= ph.elev - DEPTH_TOL && (prod.height + prod.elev) <= (ph.height + ph.elev) + DEPTH_TOL)
          ))
          if (gap >= PANEL_THICK) {
            if (sameProfile && gap < 2 * PANEL_THICK) {
              if (!prodHasLeftEnd) {
                const taller = ph.height >= prod.height ? ph : prod
                const deeper = phDepth >= effDepth ? phDepth : effDepth
                const deeperIdx = phDepth >= effDepth ? crnStart.productIndex : prodIdx
                panels.push({
                  wallNumber: wn, x: phRight, width: PANEL_THICK,
                  height: taller.height, depth: deeper, elev: taller.elev,
                  adjacentProductIndex: deeperIdx, side: 'shared',
                })
              }
            } else if (gap >= 2 * PANEL_THICK) {
              // Room for two separate panels
              panels.push({
                wallNumber: wn, x: phRight, width: PANEL_THICK,
                height: ph.height, depth: phDepth, elev: ph.elev,
                adjacentProductIndex: crnStart.productIndex, side: 'right',
              })
              if (!prodHasLeftEnd) {
                panels.push({
                  wallNumber: wn, x: leftEdge - PANEL_THICK, width: PANEL_THICK,
                  height: prod.height, depth: effDepth, elev: prod.elev,
                  adjacentProductIndex: prodIdx, side: 'left',
                })
              }
            } else {
              // Only room for one — use taller/deeper dimensions
              if (!prodHasLeftEnd) {
                const taller = ph.height >= prod.height ? ph : prod
                const deeper = phDepth >= effDepth ? phDepth : effDepth
                const deeperIdx = phDepth >= effDepth ? crnStart.productIndex : prodIdx
                panels.push({
                  wallNumber: wn, x: phRight, width: PANEL_THICK,
                  height: taller.height, depth: deeper, elev: taller.elev,
                  adjacentProductIndex: deeperIdx, side: 'shared',
                })
              }
            }
          }
        } else if (leftEdge >= PANEL_THICK && !prodHasLeftEnd && !(isNonRect && leftEdge <= PANEL_THICK)) {
          panels.push({
            wallNumber: wn, x: leftEdge - PANEL_THICK, width: PANEL_THICK,
            height: prod.height, depth: effDepth, elev: prod.elev,
            adjacentProductIndex: prodIdx, side: 'left',
          })
        }
      } else {
        const prev = sorted[i - 1]
        const prevEffDepth = getEffectiveDepth(prev)
        const gap = leftEdge - (prev.x + prev.width)
        const sameProfile = (
          Math.abs(effDepth - prevEffDepth) < DEPTH_TOL
          && Math.abs(prod.height - prev.height) < DEPTH_TOL
          && Math.abs(prod.elev - prev.elev) < DEPTH_TOL
        ) || (flipOps && Math.abs(effDepth - prevEffDepth) < DEPTH_TOL && (
          (prev.elev >= prod.elev - DEPTH_TOL && (prev.height + prev.elev) <= (prod.height + prod.elev) + DEPTH_TOL) ||
          (prod.elev >= prev.elev - DEPTH_TOL && (prod.height + prod.elev) <= (prev.height + prev.elev) + DEPTH_TOL)
        ))

        if (!sameProfile && gap >= PANEL_THICK && !prodHasLeftEnd) {
          // Different depth — this product needs its own left panel
          panels.push({
            wallNumber: wn, x: leftEdge - PANEL_THICK, width: PANEL_THICK,
            height: prod.height, depth: effDepth, elev: prod.elev,
            adjacentProductIndex: prodIdx, side: 'left',
          })
        }
        // Same profile: shared panel was already emitted by prev product's right pass
      }

      // --- RIGHT SIDE ---
      const prodHasRightEnd = !isNonRect && hasEndPart(prod, 'right')
      if (i === sorted.length - 1) {
        const crnEnd = getCrnPhantomAtWallEnd(wn, products, walls, joints)
        if (crnEnd) {
          // CRN arm at wall end — apply between-products panel logic
          const ph = crnEnd.product
          const phDepth = ph.depth
          const gap = ph.x - rightEdge
          const sameProfile = (
            Math.abs(effDepth - phDepth) < DEPTH_TOL
            && Math.abs(prod.height - ph.height) < DEPTH_TOL
            && Math.abs(prod.elev - ph.elev) < DEPTH_TOL
          ) || (flipOps && Math.abs(effDepth - phDepth) < DEPTH_TOL && (
            (ph.elev >= prod.elev - DEPTH_TOL && (ph.height + ph.elev) <= (prod.height + prod.elev) + DEPTH_TOL) ||
            (prod.elev >= ph.elev - DEPTH_TOL && (prod.height + prod.elev) <= (ph.height + ph.elev) + DEPTH_TOL)
          ))
          if (gap >= PANEL_THICK) {
            if (sameProfile && gap < 2 * PANEL_THICK) {
              if (!prodHasRightEnd) {
                const taller = prod.height >= ph.height ? prod : ph
                const deeper = effDepth >= phDepth ? effDepth : phDepth
                const deeperIdx = effDepth >= phDepth ? prodIdx : crnEnd.productIndex
                panels.push({
                  wallNumber: wn, x: rightEdge, width: PANEL_THICK,
                  height: taller.height, depth: deeper, elev: taller.elev,
                  adjacentProductIndex: deeperIdx, side: 'shared',
                })
              }
            } else if (gap >= 2 * PANEL_THICK) {
              // Room for two separate panels
              if (!prodHasRightEnd) {
                panels.push({
                  wallNumber: wn, x: rightEdge, width: PANEL_THICK,
                  height: prod.height, depth: effDepth, elev: prod.elev,
                  adjacentProductIndex: prodIdx, side: 'right',
                })
              }
              panels.push({
                wallNumber: wn, x: ph.x - PANEL_THICK, width: PANEL_THICK,
                height: ph.height, depth: phDepth, elev: ph.elev,
                adjacentProductIndex: crnEnd.productIndex, side: 'left',
              })
            } else {
              // Only room for one — use taller/deeper dimensions
              if (!prodHasRightEnd) {
                const taller = prod.height >= ph.height ? prod : ph
                const deeper = effDepth >= phDepth ? effDepth : phDepth
                const deeperIdx = effDepth >= phDepth ? prodIdx : crnEnd.productIndex
                panels.push({
                  wallNumber: wn, x: rightEdge, width: PANEL_THICK,
                  height: taller.height, depth: deeper, elev: taller.elev,
                  adjacentProductIndex: deeperIdx, side: 'shared',
                })
              }
            }
          }
        } else if (usable - rightEdge >= PANEL_THICK && !prodHasRightEnd) {
          panels.push({
            wallNumber: wn, x: rightEdge, width: PANEL_THICK,
            height: prod.height, depth: effDepth, elev: prod.elev,
            adjacentProductIndex: prodIdx, side: 'right',
          })
        }
      } else {
        const next = sorted[i + 1]
        const nextEffDepth = getEffectiveDepth(next)
        const nextIsNonRect = next.isRectShape === false
        const nextHasLeftEnd = !nextIsNonRect && hasEndPart(next, 'left')
        const gap = next.x - rightEdge
        const sameProfile = (
          Math.abs(effDepth - nextEffDepth) < DEPTH_TOL
          && Math.abs(prod.height - next.height) < DEPTH_TOL
          && Math.abs(prod.elev - next.elev) < DEPTH_TOL
        ) || (flipOps && Math.abs(effDepth - nextEffDepth) < DEPTH_TOL && (
          (next.elev >= prod.elev - DEPTH_TOL && (next.height + next.elev) <= (prod.height + prod.elev) + DEPTH_TOL) ||
          (prod.elev >= next.elev - DEPTH_TOL && (prod.height + prod.elev) <= (next.height + next.elev) + DEPTH_TOL)
        ))

        if (gap >= PANEL_THICK) {
          if (sameProfile && gap < 2 * PANEL_THICK) {
            // Shared panel — only when neither side has a built-in end
            if (!prodHasRightEnd && !nextHasLeftEnd) {
              const taller = prod.height >= next.height ? prod : next
              const deeper = effDepth >= nextEffDepth ? effDepth : nextEffDepth
              const deeperIdx = effDepth >= nextEffDepth ? prodIdx : prodIndices[i + 1]
              panels.push({
                wallNumber: wn, x: rightEdge, width: PANEL_THICK,
                height: taller.height,
                depth: deeper,
                elev: taller.elev,
                adjacentProductIndex: deeperIdx, side: 'shared',
              })
            } else if (!prodHasRightEnd) {
              // Next has built-in left end — current still needs right panel
              panels.push({
                wallNumber: wn, x: rightEdge, width: PANEL_THICK,
                height: prod.height, depth: effDepth, elev: prod.elev,
                adjacentProductIndex: prodIdx, side: 'right',
              })
            } else if (!nextHasLeftEnd) {
              // Current has built-in right end — next still needs left panel
              const nextIdx = prodIndices[i + 1]
              panels.push({
                wallNumber: wn, x: next.x - PANEL_THICK, width: PANEL_THICK,
                height: next.height, depth: nextEffDepth, elev: next.elev,
                adjacentProductIndex: nextIdx, side: 'left',
              })
            }
          } else if (sameProfile) {
            // Separated same-depth — each edge gets its own panel
            if (!prodHasRightEnd) {
              panels.push({
                wallNumber: wn, x: rightEdge, width: PANEL_THICK,
                height: prod.height, depth: effDepth, elev: prod.elev,
                adjacentProductIndex: prodIdx, side: 'right',
              })
            }
            if (!nextHasLeftEnd) {
              const nextIdx = prodIndices[i + 1]
              panels.push({
                wallNumber: wn, x: next.x - PANEL_THICK, width: PANEL_THICK,
                height: next.height, depth: nextEffDepth, elev: next.elev,
                adjacentProductIndex: nextIdx, side: 'left',
              })
            }
          } else {
            // Different depth — panel on this product's right edge only
            if (!prodHasRightEnd) {
              panels.push({
                wallNumber: wn, x: rightEdge, width: PANEL_THICK,
                height: prod.height, depth: effDepth, elev: prod.elev,
                adjacentProductIndex: prodIdx, side: 'right',
              })
            }
          }
        }
        // gap < PANEL_THICK: no room, skip
      }
    }
  }

  // --- PERPENDICULAR ARM PANELS for non-rect (CRN) products ---
  // CRN sits in a corner with arms along two walls but is registered on only one.
  // The arm along the registered wall gets panels from the main loop above.
  // The perpendicular arm extends along the ADJACENT wall — generate its panel here.
  for (const prod of products) {
    if (prod.isRectShape !== false) continue
    const effDepth = getEffectiveDepth(prod)
    const wallNumber = parseInt(prod.wall.split('_')[0], 10)
    const wallIdx = walls.findIndex(w => w.wallNumber === wallNumber)
    if (wallIdx < 0) continue
    const usable = usableWallLength(wallNumber, walls, joints)
    const prodIdx = products.indexOf(prod)

    // CRN at wall START → perpendicular arm extends along PREVIOUS wall's end
    if (prod.x <= PANEL_THICK) {
      const prevIdx = (wallIdx - 1 + walls.length) % walls.length
      const prevWall = walls[prevIdx]
      const prevUsable = usableWallLength(prevWall.wallNumber, walls, joints)
      // Arm occupies [prevUsable - prod.depth, prevUsable] on prevWall
      const armOpenEnd = prevUsable - prod.depth
      if (armOpenEnd >= PANEL_THICK) {
        const prevWallProds = productsOnWall(products, prevWall.wallNumber)
          .sort((a, b) => a.x - b.x)
        const neighbor = prevWallProds.filter(p => p.x + p.width <= armOpenEnd + 1).pop()
        if (!neighbor) {
          // No product near arm — standalone panel (main loop handles DH↔arm via phantom)
          panels.push({
            wallNumber: prevWall.wallNumber, x: armOpenEnd - PANEL_THICK, width: PANEL_THICK,
            height: prod.height, depth: effDepth, elev: prod.elev,
            adjacentProductIndex: prodIdx, side: 'left',
          })
        }
      }
    }

    // CRN at wall END → perpendicular arm extends along NEXT wall's start
    if (usable - (prod.x + prod.width) < PANEL_THICK) {
      const nextIdx = (wallIdx + 1) % walls.length
      const nextWall = walls[nextIdx]
      const nextUsable = usableWallLength(nextWall.wallNumber, walls, joints)
      // Arm occupies [0, prod.depth] on nextWall
      const armOpenEnd = prod.depth
      if (nextUsable - armOpenEnd >= PANEL_THICK) {
        const nextWallProds = productsOnWall(products, nextWall.wallNumber)
          .sort((a, b) => a.x - b.x)
        const neighbor = nextWallProds.find(p => p.x >= armOpenEnd - 1)
        if (!neighbor) {
          // No product near arm — standalone panel (main loop handles DH↔arm via phantom)
          panels.push({
            wallNumber: nextWall.wallNumber, x: armOpenEnd, width: PANEL_THICK,
            height: prod.height, depth: effDepth, elev: prod.elev,
            adjacentProductIndex: prodIdx, side: 'right',
          })
        }
      }
    }
  }

  return panels
}

/** Create a synthetic MozProduct for DES export from an AutoEndPanel.
 *  Uses full Mozaik-compatible templates (floor vs wall) so the exported
 *  DES file doesn't crash Mozaik. */
export function createSyntheticPanelProduct(
  panel: AutoEndPanel,
  adjacentProduct: MozProduct,
  idTag: number,
  cabNo: number,
): MozProduct {
  const uniqueId = String(Date.now() % 100000000 + Math.floor(Math.random() * 10000))
  const wallRef = `${panel.wallNumber}_1`
  const isWallMount = panel.elev > 0

  // Full Mozaik-compatible attributes and inner XML
  const params = {
    uniqueId, idTag,
    height: panel.height, depth: panel.depth,
    x: panel.x, elev: panel.elev,
    wall: wallRef, cabNo,
    sourceLib: adjacentProduct.sourceLib,
  }
  const rawAttributes = isWallMount
    ? wallPanelAttrs(params)
    : floorPanelAttrs(params)
  const rawInnerXml = isWallMount
    ? wallPanelInnerXml(panel.height, panel.depth)
    : floorPanelInnerXml(panel.height, panel.depth)

  const prodName = isWallMount ? 'Wall Mount Panel' : 'Floor Panel'
  const panelWidth = isWallMount ? 19.05 : PANEL_THICK

  // Minimal part for 3D rendering (the full shape is in rawInnerXml for export)
  const fendPart: MozPart = {
    name: isWallMount ? ' WM Panel' : 'Fin End (L)',
    reportName: isWallMount ? ' WM Panel' : 'FEnd (L)',
    type: 'FEnd',
    x: 0,
    y: panel.depth,
    z: 0,
    w: panel.depth,
    l: panel.height,
    rotation: { a1: -90, a2: 180, a3: 0, r1: 'Y', r2: 'Z', r3: 'X' },
    quan: 1,
    layer: 2,
    shapePoints: [
      { id: 0, x: 0, y: 0, ptType: 0, data: 0, edgeType: 0, sideName: 'Back' },
      { id: 1, x: panel.height, y: 0, ptType: 0, data: 0, edgeType: 0, sideName: 'Top' },
      { id: 2, x: panel.height, y: panel.depth, ptType: 0, data: 0, edgeType: 0, sideName: 'Front' },
      { id: 3, x: 0, y: panel.depth, ptType: 0, data: 0, edgeType: 0, sideName: 'Bottom' },
    ],
    operations: [],
    suPartName: '',
  }

  return {
    uniqueId,
    prodName,
    idTag,
    sourceLib: adjacentProduct.sourceLib,
    width: panelWidth,
    height: panel.height,
    depth: panel.depth,
    x: panel.x,
    elev: panel.elev,
    rot: 0,
    wall: wallRef,
    parts: [fendPart],
    isRectShape: true,
    topShapePoints: [],
    parameters: [],
    rawAttributes,
    rawInnerXml,
  }
}
