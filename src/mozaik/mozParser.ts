import type { MozFile, MozProduct, MozPart, MozRotation, MozShapePoint } from './types'
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
    rawAttributes: getAllAttrs(el),
    rawInnerXml,
  }
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

  const shapeEl = getChild(el, 'PartShapeXml')
  const shapePoints: MozShapePoint[] = shapeEl
    ? getChildren(shapeEl, 'ShapePoint').map((sp) => ({
        id: getAttrInt(sp, 'ID'),
        x: getAttrFloat(sp, 'X'),
        y: getAttrFloat(sp, 'Y'),
        edgeType: getAttrInt(sp, 'EdgeType'),
        sideName: getAttrStr(sp, 'SideName'),
      }))
    : []

  return {
    name: getAttrStr(el, 'Name'),
    reportName: getAttrStr(el, 'ReportName', getAttrStr(el, 'Name')),
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
    suPartName: getAttrStr(el, 'SUPartName', ''),
  }
}
