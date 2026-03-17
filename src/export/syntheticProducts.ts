/**
 * Create synthetic MozProduct for DES export from an AutoEndPanel.
 */
import type { MozProduct, MozPart } from '../mozaik/types'
import type { AutoEndPanel } from '../mozaik/autoEndPanels'
import { PANEL_THICK } from '../mozaik/autoEndPanels'
import { floorPanelAttrs, floorPanelInnerXml, wallPanelAttrs, wallPanelInnerXml } from './panelTemplate'

export function createSyntheticPanelProduct(
  panel: AutoEndPanel,
  adjacentProduct: MozProduct,
  idTag: number,
  cabNo: number,
): MozProduct {
  const uniqueId = String(Date.now() % 100000000 + Math.floor(Math.random() * 10000))
  const wallRef = `${panel.wallNumber}_1`
  const isWallMount = panel.elev > 0

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
