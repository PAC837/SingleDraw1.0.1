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
        const sameProfile = (
          Math.abs(prod.depth - prev.depth) < DEPTH_TOL
          && Math.abs(prod.height - prev.height) < DEPTH_TOL
          && Math.abs(prod.elev - prev.elev) < DEPTH_TOL
        ) || (flipOps && (
          (prev.elev >= prod.elev - DEPTH_TOL && (prev.height + prev.elev) <= (prod.height + prod.elev) + DEPTH_TOL) ||
          (prod.elev >= prev.elev - DEPTH_TOL && (prod.height + prod.elev) <= (prev.height + prev.elev) + DEPTH_TOL)
        ))

        if (!sameProfile && gap >= PANEL_THICK) {
          // Different depth — this product needs its own left panel
          panels.push({
            wallNumber: wn, x: leftEdge - PANEL_THICK, width: PANEL_THICK,
            height: prod.height, depth: prod.depth, elev: prod.elev,
            adjacentProductIndex: prodIdx, side: 'left',
          })
        }
        // Same profile: shared panel was already emitted by prev product's right pass
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
        const sameProfile = (
          Math.abs(prod.depth - next.depth) < DEPTH_TOL
          && Math.abs(prod.height - next.height) < DEPTH_TOL
          && Math.abs(prod.elev - next.elev) < DEPTH_TOL
        ) || (flipOps && (
          (next.elev >= prod.elev - DEPTH_TOL && (next.height + next.elev) <= (prod.height + prod.elev) + DEPTH_TOL) ||
          (prod.elev >= next.elev - DEPTH_TOL && (prod.height + prod.elev) <= (next.height + next.elev) + DEPTH_TOL)
        ))

        if (gap >= PANEL_THICK) {
          if (sameProfile && gap <= 2 * PANEL_THICK) {
            // Shared panel — taller defines height/elev, deeper defines depth/texture
            const taller = prod.height >= next.height ? prod : next
            const deeper = prod.depth >= next.depth ? prod : next
            const deeperIdx = prod.depth >= next.depth ? prodIdx : prodIndices[i + 1]
            panels.push({
              wallNumber: wn, x: rightEdge, width: PANEL_THICK,
              height: taller.height,
              depth: deeper.depth,
              elev: taller.elev,
              adjacentProductIndex: deeperIdx, side: 'shared',
            })
          } else if (sameProfile) {
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
      { id: 0, x: 0, y: 0, edgeType: 0, sideName: 'Back' },
      { id: 1, x: panel.height, y: 0, edgeType: 0, sideName: 'Top' },
      { id: 2, x: panel.height, y: panel.depth, edgeType: 0, sideName: 'Front' },
      { id: 3, x: 0, y: panel.depth, edgeType: 0, sideName: 'Bottom' },
    ],
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
    rawAttributes,
    rawInnerXml,
  }
}
