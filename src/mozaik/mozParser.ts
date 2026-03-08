import type { MozFile, MozProduct, MozPart, MozRotation, MozShapePoint, MozOperation, CabProdParm } from './types'
import {
  parseXmlString, getAttrFloat, getAttrStr, getAttrInt,
  getChildren, getChild, getAllAttrs,
} from './xmlUtils'

/**
 * Parse a MOZ file content string into a MozFile.
 *
 * MOZ files have a 3-line binary header:
 *   Line 1: "2" (version)
 *   Line 2: "11"
 *   Line 3: "Mozaik Product Properties File"
 * Followed by XML starting with <?xml ...?>
 */
export function parseMoz(fileContent: string): MozFile {
  const xmlStart = fileContent.indexOf('<?xml')
  if (xmlStart === -1) throw new Error('No XML declaration found in MOZ file')

  // Extract header lines (everything before the XML)
  const headerText = fileContent.slice(0, xmlStart)
  const headerLines = headerText.split(/\r?\n/).filter((l) => l.trim() !== '')

  const rawXml = fileContent.slice(xmlStart)
  const doc = parseXmlString(rawXml)
  const root = doc.documentElement // <Product>

  // Extract inner XML: everything between <Product ...> and </Product>
  const productStart = rawXml.indexOf('<Product')
  const openTagEnd = rawXml.indexOf('>', productStart) + 1
  const closeTagStart = rawXml.lastIndexOf('</Product>')
  const rawInnerXml = closeTagStart > openTagEnd ? rawXml.slice(openTagEnd, closeTagStart) : ''

  const product = parseProduct(root, rawInnerXml)

  console.log(`[MOZ] Product: "${product.prodName}" (ID: ${product.uniqueId})`)
  console.log(`[MOZ] Dimensions: W=${product.width} H=${product.height} D=${product.depth}`)
  console.log(`[MOZ] Parts: ${product.parts.length}`)

  // Log distinct rotation patterns
  const rotPatterns = new Map<string, number>()
  for (const p of product.parts) {
    const key = `${p.rotation.r1},${p.rotation.r2},${p.rotation.r3}`
    rotPatterns.set(key, (rotPatterns.get(key) ?? 0) + 1)
  }
  for (const [pattern, count] of rotPatterns) {
    console.log(`[MOZ] Rotation axis order ${pattern}: ${count} parts`)
  }

  return {
    headerLine1: headerLines[0] ?? '2',
    headerLine2: headerLines[1] ?? '11',
    headerLine3: headerLines[2] ?? 'Mozaik Product Properties File',
    product,
    rawXml,
  }
}

function parseProduct(el: Element, rawInnerXml: string = ''): MozProduct {
  const partsEl = getChild(el, 'CabProdParts')
  const parts = partsEl ? getChildren(partsEl, 'CabProdPart').map(parsePart) : []

  const parmsEl = getChild(el, 'CabProdParms')
  const parameters = parmsEl
    ? getChildren(parmsEl, 'CabProdParm').map(p => ({
        name: getAttrStr(p, 'Name'),
        type: getAttrInt(p, 'Type'),
        value: getAttrStr(p, 'Value'),
        desc: getAttrStr(p, 'Desc', ''),
        category: getAttrInt(p, 'Category'),
        options: getAttrStr(p, 'Options', ''),
        maxVal: getAttrFloat(p, 'MaxVal'),
        minVal: getAttrFloat(p, 'MinVal'),
      }))
    : []

  if (parameters.length > 0) {
    console.log(`[MOZ] Parameters: ${parameters.map(p => `${p.name}=${p.value}`).join(', ')}`)
  }

  // Parse TopShapeXml — product-level outline shape (L-shape for CRN products)
  const topShapePoints = parseShapePoints(getChild(el, 'TopShapeXml'))
  if (topShapePoints.length > 0) {
    console.log(`[MOZ] TopShape: ${topShapePoints.length} points`)
  }

  return {
    uniqueId: getAttrStr(el, 'UniqueID'),
    prodName: getAttrStr(el, 'ProdName'),
    idTag: getAttrInt(el, 'IDTag'),
    sourceLib: getAttrStr(el, 'SourceLib'),
    width: getAttrFloat(el, 'Width'),
    height: getAttrFloat(el, 'Height'),
    depth: getAttrFloat(el, 'Depth'),
    x: getAttrFloat(el, 'X'),
    elev: getAttrFloat(el, 'Elev'),
    rot: getAttrFloat(el, 'Rot'),
    wall: getAttrStr(el, 'Wall', '0'),
    parts,
    isRectShape: getAttrStr(el, 'IsRectShape', 'True') !== 'False',
    topShapePoints,
    parameters,
    rawAttributes: getAllAttrs(el),
    rawInnerXml,
  }
}

/** Parse ShapePoints from a shape XML element (PartShapeXml or TopShapeXml). */
function parseShapePoints(shapeEl: Element | null): MozShapePoint[] {
  if (!shapeEl) return []
  return getChildren(shapeEl, 'ShapePoint').map((sp) => {
    const pt: MozShapePoint = {
      id: getAttrInt(sp, 'ID'),
      x: getAttrFloat(sp, 'X'),
      y: getAttrFloat(sp, 'Y'),
      ptType: getAttrInt(sp, 'PtType'),
      data: getAttrFloat(sp, 'Data'),
      edgeType: getAttrInt(sp, 'EdgeType'),
      sideName: getAttrStr(sp, 'SideName'),
    }
    // Capture parametric equations if present
    const xEq = getAttrStr(sp, 'X_Eq', '')
    const yEq = getAttrStr(sp, 'Y_Eq', '')
    const dataEq = getAttrStr(sp, 'Data_Eq', '')
    if (xEq) pt.xEq = xEq
    if (yEq) pt.yEq = yEq
    if (dataEq) pt.dataEq = dataEq
    return pt
  })
}

function parsePart(el: Element): MozPart {
  const rotation: MozRotation = {
    a1: getAttrFloat(el, 'A1'),
    a2: getAttrFloat(el, 'A2'),
    a3: getAttrFloat(el, 'A3'),
    r1: (getAttrStr(el, 'R1', 'X') as 'X' | 'Y' | 'Z'),
    r2: (getAttrStr(el, 'R2', 'Y') as 'X' | 'Y' | 'Z'),
    r3: (getAttrStr(el, 'R3', 'Z') as 'X' | 'Y' | 'Z'),
  }

  const shapePoints = parseShapePoints(getChild(el, 'PartShapeXml'))

  const operations = parseOperations(el)

  const partName = getAttrStr(el, 'Name')
  if (operations.length > 0) {
    const holes = operations.filter(o => o.type === 'hole').length
    const bores = operations.filter(o => o.type === 'linebore').length
    const pockets = operations.filter(o => o.type === 'pocket').length
    console.log(`[MOZ] Part "${partName}": ${operations.length} ops (${holes} holes, ${bores} linebores, ${pockets} pockets)`)
  }

  return {
    name: partName,
    reportName: getAttrStr(el, 'ReportName', partName),
    type: getAttrStr(el, 'Type'),
    x: getAttrFloat(el, 'X'),
    y: getAttrFloat(el, 'Y'),
    z: getAttrFloat(el, 'Z'),
    w: getAttrFloat(el, 'W'),
    l: getAttrFloat(el, 'L'),
    rotation,
    quan: getAttrInt(el, 'Quan', 1),
    layer: getAttrInt(el, 'Layer'),
    shapePoints,
    operations,
    suPartName: getAttrStr(el, 'SUPartName', ''),
  }
}

/** Parse <PartOpsXml> child operations. */
function parseOperations(partEl: Element): MozOperation[] {
  const opsEl = getChild(partEl, 'PartOpsXml')
  if (!opsEl) return []
  const ops: MozOperation[] = []

  for (const hole of getChildren(opsEl, 'OperationHole')) {
    if (getAttrStr(hole, 'Hide') === 'True') continue
    ops.push({
      type: 'hole',
      x: getAttrFloat(hole, 'X'),
      y: getAttrFloat(hole, 'Y'),
      depth: getAttrFloat(hole, 'Depth'),
      diameter: getAttrFloat(hole, 'Diameter'),
      flipSideOp: getAttrStr(hole, 'FlipSideOp') === 'True',
    })
  }

  for (const bore of getChildren(opsEl, 'OperationLineBore')) {
    if (getAttrStr(bore, 'Hide') === 'True') continue
    ops.push({
      type: 'linebore',
      x: getAttrFloat(bore, 'X'),
      y: getAttrFloat(bore, 'Y'),
      depth: getAttrFloat(bore, 'Depth'),
      diameter: getAttrFloat(bore, 'Diameter'),
      quan: getAttrInt(bore, 'Quan'),
      ang: getAttrFloat(bore, 'Ang'),
      flipSideOp: getAttrStr(bore, 'FlipSideOp') === 'True',
    })
  }

  for (const pocket of getChildren(opsEl, 'OperationPocket')) {
    if (getAttrStr(pocket, 'Hide') === 'True') continue
    const nodes = getChildren(pocket, 'OperationToolPathNode').map(n => ({
      x: getAttrFloat(n, 'X'),
      y: getAttrFloat(n, 'Y'),
    }))
    ops.push({
      type: 'pocket',
      x: getAttrFloat(pocket, 'X'),
      y: getAttrFloat(pocket, 'Y'),
      depth: getAttrFloat(pocket, 'Depth'),
      closedShape: getAttrStr(pocket, 'ClosedShape') === 'True',
      toolPathNodes: nodes,
    })
  }

  return ops
}

/** Quick-parse just CabProdParms from a MOZ file (no parts/shapes). */
export function parseMozParams(fileContent: string): CabProdParm[] {
  const xmlStart = fileContent.indexOf('<?xml')
  if (xmlStart === -1) return []
  const doc = parseXmlString(fileContent.slice(xmlStart))
  const root = doc.documentElement
  const parmsEl = getChild(root, 'CabProdParms')
  if (!parmsEl) return []
  return getChildren(parmsEl, 'CabProdParm').map(p => ({
    name: getAttrStr(p, 'Name'),
    type: getAttrInt(p, 'Type'),
    value: getAttrStr(p, 'Value'),
    desc: getAttrStr(p, 'Desc', ''),
    category: getAttrInt(p, 'Category'),
    options: getAttrStr(p, 'Options', ''),
    maxVal: getAttrFloat(p, 'MaxVal'),
    minVal: getAttrFloat(p, 'MinVal'),
  }))
}
