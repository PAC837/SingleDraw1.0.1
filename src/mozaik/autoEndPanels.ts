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

export const PANEL_THICK = 19 // mm (3/4" standard wood panel)

const DEPTH_TOL = 1 // mm — tolerance for "same depth" comparison

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

      // --- LEFT SIDE ---
      if (i === 0) {
        // First product — left panel if room before it
        if (leftEdge >= PANEL_THICK) {
          panels.push({
            wallNumber: wn, x: leftEdge - PANEL_THICK, width: PANEL_THICK,
            height: prod.height, depth: prod.depth, elev: prod.elev,
            adjacentProductIndex: prodIdx, side: 'left',
          })
        }
      } else {
        const prev = sorted[i - 1]
        const gap = leftEdge - (prev.x + prev.width)
        const sameDepth = Math.abs(prod.depth - prev.depth) < DEPTH_TOL

        if (!sameDepth && gap >= PANEL_THICK) {
          // Different depth — this product needs its own left panel
          panels.push({
            wallNumber: wn, x: leftEdge - PANEL_THICK, width: PANEL_THICK,
            height: prod.height, depth: prod.depth, elev: prod.elev,
            adjacentProductIndex: prodIdx, side: 'left',
          })
        }
        // Same depth: shared panel was already emitted by prev product's right pass
      }

      // --- RIGHT SIDE ---
      if (i === sorted.length - 1) {
        // Last product — right panel if room after it
        if (usable - rightEdge >= PANEL_THICK) {
          panels.push({
            wallNumber: wn, x: rightEdge, width: PANEL_THICK,
            height: prod.height, depth: prod.depth, elev: prod.elev,
            adjacentProductIndex: prodIdx, side: 'right',
          })
        }
      } else {
        const next = sorted[i + 1]
        const gap = next.x - rightEdge
        const sameDepth = Math.abs(prod.depth - next.depth) < DEPTH_TOL

        if (gap >= PANEL_THICK) {
          if (sameDepth && gap < 2 * PANEL_THICK) {
            // Shared panel — one panel between touching same-depth sections
            panels.push({
              wallNumber: wn, x: rightEdge, width: PANEL_THICK,
              height: Math.max(prod.height, next.height),
              depth: prod.depth,
              elev: Math.min(prod.elev, next.elev),
              adjacentProductIndex: prodIdx, side: 'shared',
            })
          } else if (sameDepth) {
            // Separated same-depth — each edge gets its own panel
            panels.push({
              wallNumber: wn, x: rightEdge, width: PANEL_THICK,
              height: prod.height, depth: prod.depth, elev: prod.elev,
              adjacentProductIndex: prodIdx, side: 'right',
            })
            const nextIdx = prodIndices[i + 1]
            panels.push({
              wallNumber: wn, x: next.x - PANEL_THICK, width: PANEL_THICK,
              height: next.height, depth: next.depth, elev: next.elev,
              adjacentProductIndex: nextIdx, side: 'left',
            })
          } else {
            // Different depth — panel on this product's right edge only
            panels.push({
              wallNumber: wn, x: rightEdge, width: PANEL_THICK,
              height: prod.height, depth: prod.depth, elev: prod.elev,
              adjacentProductIndex: prodIdx, side: 'right',
            })
          }
        }
        // gap < PANEL_THICK: no room, skip
      }
    }
  }

  return panels
}

/** Create a synthetic MozProduct for DES export from an AutoEndPanel. */
export function createSyntheticPanelProduct(
  panel: AutoEndPanel,
  adjacentProduct: MozProduct,
  idTag: number,
): MozProduct {
  const uniqueId = String(Date.now() % 100000000 + Math.floor(Math.random() * 10000))

  const fendPart: MozPart = {
    name: 'End Panel',
    reportName: 'FEnd',
    type: 'FEnd',
    x: 0,
    y: 0,
    z: 0,
    w: panel.depth,
    l: panel.height,
    rotation: { a1: -90, a2: 180, a3: 0, r1: 'Y', r2: 'Z', r3: 'X' },
    quan: 1,
    layer: 0,
    shapePoints: [
      { id: 0, x: 0, y: 0, edgeType: 0, sideName: '' },
      { id: 1, x: panel.height, y: 0, edgeType: 0, sideName: '' },
      { id: 2, x: panel.height, y: panel.depth, edgeType: 0, sideName: '' },
      { id: 3, x: 0, y: panel.depth, edgeType: 0, sideName: '' },
    ],
    suPartName: '',
  }

  return {
    uniqueId,
    prodName: 'End Panel',
    idTag,
    sourceLib: adjacentProduct.sourceLib,
    width: PANEL_THICK,
    height: panel.height,
    depth: panel.depth,
    x: panel.x,
    elev: panel.elev,
    rot: 0,
    wall: `${panel.wallNumber}_1`,
    parts: [fendPart],
    rawAttributes: {
      UniqueID: uniqueId,
      ProdName: 'End Panel',
      IDTag: String(idTag),
      SourceLib: adjacentProduct.sourceLib,
      Width: String(PANEL_THICK),
      Height: String(panel.height),
      Depth: String(panel.depth),
      X: String(panel.x),
      Elev: String(panel.elev),
      Rot: '0',
      Wall: `${panel.wallNumber}_1`,
      SUDirty: 'True',
      Quan: '1',
      ExtEnds: '0',
    },
    rawInnerXml: '',
  }
}
