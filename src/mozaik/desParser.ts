import type {
  MozRoom, MozRoomParms, MozWall, MozWallJoint,
  MozFixture, MozProduct, MozPart, MozRotation, MozShapePoint,
} from './types'
import {
  parseXmlString, getAttrFloat, getAttrStr, getAttrBool,
  getAttrInt, getChildren, getChild, getAllAttrs,
} from './xmlUtils'

/** Parse a DES file text into a MozRoom. */
export function parseDes(fileText: string): MozRoom {
  // DES files have a numeric first line (e.g., "15") before the XML
  const xmlStart = fileText.indexOf('<?xml')
  if (xmlStart === -1) throw new Error('No XML declaration found in DES file')
  const xml = fileText.slice(xmlStart)
  const doc = parseXmlString(xml)
  const root = doc.documentElement // <Room>

  const { primaryTextureId, wallTextureId } = parseTextureIds(root)
  console.log(`[DES] Texture IDs — primary: ${primaryTextureId}, walls: ${wallTextureId}`)

  return {
    uniqueId: getAttrStr(root, 'UniqueID'),
    name: getAttrStr(root, 'Name'),
    roomType: getAttrInt(root, 'RoomType'),
    parms: parseRoomParms(root),
    walls: parseWalls(root),
    wallJoints: parseWallJoints(root),
    fixtures: parseFixtures(root),
    products: parseProducts(root),
    primaryTextureId,
    wallTextureId,
    rawText: fileText,
  }
}

function parseRoomParms(root: Element): MozRoomParms {
  const el = getChild(root, 'RoomParms')
  if (!el) {
    return {
      H_Walls: 0, WallThickness: 0, H_Soffit: 0,
      H_BaseCab: 0, H_WallCab: 0, D_Wall: 0,
      D_Base: 0, D_Tall: 0, StartingCabNo: 0,
    }
  }
  // Collect all numeric attributes
  const parms: MozRoomParms = {
    H_Walls: getAttrFloat(el, 'H_Walls'),
    WallThickness: getAttrFloat(el, 'WallThickness'),
    H_Soffit: getAttrFloat(el, 'H_Soffit'),
    H_BaseCab: getAttrFloat(el, 'H_BaseCab'),
    H_WallCab: getAttrFloat(el, 'H_WallCab'),
    D_Wall: getAttrFloat(el, 'D_Wall'),
    D_Base: getAttrFloat(el, 'D_Base'),
    D_Tall: getAttrFloat(el, 'D_Tall'),
    StartingCabNo: getAttrFloat(el, 'StartingCabNo'),
  }
  return parms
}

function parseWalls(root: Element): MozWall[] {
  const wallsEl = getChild(root, 'Walls')
  if (!wallsEl) return []
  return getChildren(wallsEl, 'Wall').map(parseWall)
}

function parseWall(el: Element): MozWall {
  return {
    idTag: getAttrInt(el, 'IDTag'),
    wallNumber: getAttrInt(el, 'WallNumber'),
    posX: getAttrFloat(el, 'PosX'),
    posY: getAttrFloat(el, 'PosY'),
    ang: getAttrFloat(el, 'Ang'),
    len: getAttrFloat(el, 'Len'),
    height: getAttrFloat(el, 'Height'),
    thickness: getAttrFloat(el, 'Thickness'),
    invisible: getAttrBool(el, 'Invisible'),
    bulge: getAttrFloat(el, 'Bulge'),
    shapeType: getAttrInt(el, 'ShapeType'),
    cathedralHeight: getAttrFloat(el, 'CathedralHeight'),
  }
}

function parseWallJoints(root: Element): MozWallJoint[] {
  const jointsEl = getChild(root, 'WallJoints')
  if (!jointsEl) return []
  return getChildren(jointsEl, 'WallJoint').map((el) => ({
    wall1: getAttrInt(el, 'Wall1'),
    wall2: getAttrInt(el, 'Wall2'),
    wall1Corner: getAttrInt(el, 'Wall1Corner'),
    wall2Corner: getAttrInt(el, 'Wall2Corner'),
    isInterior: getAttrBool(el, 'IsInterior'),
    miterBack: getAttrBool(el, 'MiterBack'),
  }))
}

function parseFixtures(root: Element): MozFixture[] {
  const fixtsEl = getChild(root, 'Fixts')
  if (!fixtsEl) return []
  const fixtures = getChildren(fixtsEl, 'Fixt').map((el) => ({
    name: getAttrStr(el, 'Name'),
    idTag: getAttrInt(el, 'IDTag'),
    type: getAttrInt(el, 'Type'),
    subType: getAttrInt(el, 'SubType'),
    wall: getAttrInt(el, 'Wall'),
    onWallFront: getAttrBool(el, 'OnWallFront'),
    width: getAttrFloat(el, 'Width'),
    height: getAttrFloat(el, 'Height'),
    depth: getAttrFloat(el, 'Depth'),
    x: getAttrFloat(el, 'X'),
    elev: getAttrFloat(el, 'Elev'),
    rot: getAttrFloat(el, 'Rot'),
  }))

  // Log openings and scan for door/window variants
  for (const f of fixtures) {
    if (f.name === 'Opening') {
      console.log(`[DES] Opening on Wall ${f.wall}: width=${f.width}mm, height=${f.height}mm, x=${f.x}mm`)
    } else {
      console.log(`[DES] Fixture "${f.name}" (type=${f.type}) on Wall ${f.wall} — non-Opening variant detected`)
    }
  }

  return fixtures
}

function parseProducts(root: Element): MozProduct[] {
  const prodsEl = getChild(root, 'Products')
  if (!prodsEl) return []
  return getChildren(prodsEl, 'Product').map(parseProduct)
}

function parseProduct(el: Element): MozProduct {
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
  }
}

function parsePart(el: Element): MozPart {
  const rotation = parseRotation(el)
  const shapeEl = getChild(el, 'PartShapeXml')
  const shapePoints = shapeEl ? parseShapePoints(shapeEl) : []

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
  }
}

function parseRotation(el: Element): MozRotation {
  return {
    a1: getAttrFloat(el, 'A1'),
    a2: getAttrFloat(el, 'A2'),
    a3: getAttrFloat(el, 'A3'),
    r1: (getAttrStr(el, 'R1', 'X') as 'X' | 'Y' | 'Z'),
    r2: (getAttrStr(el, 'R2', 'Y') as 'X' | 'Y' | 'Z'),
    r3: (getAttrStr(el, 'R3', 'Z') as 'X' | 'Y' | 'Z'),
  }
}

function parseShapePoints(shapeEl: Element): MozShapePoint[] {
  return getChildren(shapeEl, 'ShapePoint').map((el) => ({
    id: getAttrInt(el, 'ID'),
    x: getAttrFloat(el, 'X'),
    y: getAttrFloat(el, 'Y'),
    edgeType: getAttrInt(el, 'EdgeType'),
    sideName: getAttrStr(el, 'SideName'),
  }))
}

/** Extract texture IDs from RoomSet and first MaterialTemplateSelection. */
function parseTextureIds(root: Element): { primaryTextureId: number | null; wallTextureId: number | null } {
  let wallTextureId: number | null = null
  let primaryTextureId: number | null = null

  // RoomSet has WallsTextureId attribute
  const roomSet = getChild(root, 'RoomSet')
  if (roomSet) {
    const wId = getAttrInt(roomSet, 'WallsTextureId')
    if (wId) wallTextureId = wId
  }

  // First MaterialTemplateSelection with TextureIdOverrideByPartType entries
  // Find the most common texture ID across part type overrides
  const matSels = root.querySelectorAll('MaterialTemplateSelection')
  for (const sel of matSels) {
    const overrides = getChildren(sel, 'TextureIdOverrideByPartType')
    if (overrides.length === 0) continue

    // Count texture IDs to find the primary one
    const counts = new Map<number, number>()
    for (const ov of overrides) {
      const id = getAttrInt(ov, 'Id')
      if (id) counts.set(id, (counts.get(id) ?? 0) + 1)
    }

    // Most frequent = primary texture
    let maxCount = 0
    for (const [id, count] of counts) {
      if (count > maxCount) {
        maxCount = count
        primaryTextureId = id
      }
    }
    break // use first MaterialTemplateSelection block
  }

  return { primaryTextureId, wallTextureId }
}
