import type { MozRoom, MozWall, MozWallJoint, MozFixture, MozProduct, MozPart } from '../mozaik/types'
import { roomParmsXml, ROOM_SET_XML } from './desTemplate'

/**
 * Serialize a MozRoom back to the DES file format.
 *
 * For loaded rooms (rawText non-empty): preserve original text unchanged (round-trip fidelity).
 * For created rooms (rawText empty): generate valid DES XML from parsed structure.
 */
export function writeDes(room: MozRoom): string {
  if (room.rawText) return room.rawText
  return generateDesXml(room)
}

/** Escape XML special characters in attribute values. */
function esc(value: string | number | boolean): string {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Format a number for DES output — max 4 decimal places, strip trailing zeros. */
function num(n: number): string {
  if (Number.isInteger(n)) return String(n)
  return parseFloat(n.toFixed(4)).toString()
}

/** Mozaik uses PascalCase booleans: "True" / "False". */
function bool(b: boolean): string {
  return b ? 'True' : 'False'
}

/** Renumber walls sequentially (1, 2, 3...) and update all references. */
function renumberForExport(room: MozRoom): MozRoom {
  const wallMap = new Map<number, number>()
  room.walls.forEach((w, i) => wallMap.set(w.wallNumber, i + 1))

  const walls = room.walls.map((w, i) => ({
    ...w,
    wallNumber: i + 1,
    idTag: i + 1,
  }))

  const wallJoints = room.wallJoints.map(j => ({
    ...j,
    wall1: wallMap.get(j.wall1) ?? j.wall1,
    wall2: wallMap.get(j.wall2) ?? j.wall2,
  }))

  const products = room.products.map(p => {
    if (!p.wall || p.wall === '0') return p
    const [wn, ...rest] = p.wall.split('_')
    const oldNum = parseInt(wn, 10)
    const newNum = wallMap.get(oldNum)
    if (newNum == null) return p
    return { ...p, wall: [String(newNum), ...rest].join('_') }
  })

  const fixtures = room.fixtures.map(f => ({
    ...f,
    wall: wallMap.get(f.wall) ?? f.wall,
  }))

  return { ...room, walls, wallJoints, products, fixtures }
}

/** Generate complete DES file content from a MozRoom. */
function generateDesXml(inputRoom: MozRoom): string {
  const room = renumberForExport(inputRoom)
  const lines: string[] = []

  // DES files start with a version number line before the XML
  lines.push('15')
  lines.push('<?xml version="1.0" encoding="utf-8" standalone="yes"?>')

  // <Room> root element
  const idTagCount = Math.max(
    ...room.walls.map(w => w.idTag),
    ...room.products.map(p => p.idTag),
    ...room.fixtures.map(f => f.idTag),
    4,
  )
  lines.push(`<Room UniqueID="${esc(room.uniqueId)}" RoomType="${room.roomType}" Name="${esc(room.name)}" RoomNosDirty="True" IdTagCount="${idTagCount}" Quan="1" FloorDirty="0">`)

  // <RoomParms> — full attribute set from template, with room-specific values substituted
  lines.push(roomParmsXml(room.parms))

  // <RoomSet> — required by Mozaik (door settings, material templates, hardware, textures)
  lines.push(ROOM_SET_XML)

  // <Walls>
  if (room.walls.length === 0) {
    lines.push('  <Walls />')
  } else {
    lines.push('  <Walls>')
    for (const w of room.walls) {
      lines.push(`    ${serializeWall(w)}`)
    }
    lines.push('  </Walls>')
  }

  // <WallJoints>
  if (room.wallJoints.length === 0) {
    lines.push('  <WallJoints />')
  } else {
    lines.push('  <WallJoints>')
    for (const j of room.wallJoints) {
      lines.push(`    ${serializeWallJoint(j)}`)
    }
    lines.push('  </WallJoints>')
  }

  // <Appls /> (no appliances support yet)
  lines.push('  <Appls />')

  // <Fixts>
  if (room.fixtures.length === 0) {
    lines.push('  <Fixts />')
  } else {
    lines.push('  <Fixts>')
    for (const f of room.fixtures) {
      lines.push(`    ${serializeFixture(f)}`)
    }
    lines.push('  </Fixts>')
  }

  // <Products>
  if (room.products.length === 0) {
    lines.push('  <Products />')
  } else {
    lines.push('  <Products>')
    for (const prod of room.products) {
      lines.push(serializeProduct(prod))
    }
    lines.push('  </Products>')
  }

  // Room trailing elements — Mozaik requires these sections
  lines.push('  <Tops />')
  lines.push('  <Moldings />')
  lines.push('  <ToeSkins />')
  lines.push('  <Notes />')
  lines.push('  <RenderSettings Version="1" AmbientLight="0" DirectionalLight="0.5" EnvironmentLight="0.5" Exposure="1" TonemappingAmount="1" AutoExpose="True" EnvHdriFile="DefaultHDRI.hdr" EnvHdriExposure="1" EnvHdriSpecScale="1" EnvHdriSphereScale="1" EnvHdriYaw="0" AlwaysFillSkpModels="False" LineWidth="2" LineOpacity="1" AoIntensity="0.7" AoRadius="2" AoCurve="-0.5" />')
  lines.push('  <Annotations Version="1">')
  lines.push('    <AnnotationSet>')
  lines.push('      <AnnotationLocator IsFP="True" ElevationWallId="-1" ProductSpaceType="-1" RoomMode="0" />')
  lines.push('    </AnnotationSet>')
  lines.push('  </Annotations>')
  lines.push('  <RoomNotes />')
  lines.push('</Room>')

  return lines.join('\n')
}

function serializeWall(w: MozWall): string {
  return `<Wall IDTag="${w.idTag}" Len="${num(w.len)}" Height="${num(w.height)}" PosX="${num(w.posX)}" PosY="${num(w.posY)}" Ang="${num(w.ang)}" Invisible="${bool(w.invisible)}" SUDirty="True" Bulge="${num(w.bulge)}" WallNumber="${w.wallNumber}" Thickness="${num(w.thickness)}" HasLeftEndCap="False" HasRightEndCap="False" HasBackSpace="False" HasLeftSpace="False" HasRightSpace="False" LeftSpaceLength="1371.6" RightSpaceLength="1371.6" ShapeType="${w.shapeType}" CathedralHeight="${num(w.cathedralHeight)}">` +
    '\n      <LabelDimensionOverrideMap />' +
    '\n    </Wall>'
}

function serializeWallJoint(j: MozWallJoint): string {
  return `<WallJoint Wall1="${j.wall1}" Wall2="${j.wall2}" IsInterior="${bool(j.isInterior)}" Wall1Corner="${j.wall1Corner}" Wall2Corner="${j.wall2Corner}" Wall2Along="0" Wall2Front="False" MiterBack="${bool(j.miterBack)}" />`
}

function serializeFixture(f: MozFixture): string {
  return `<Fixt Name="${esc(f.name)}" IDTag="${f.idTag}" Type="${f.type}" SubType="${f.subType}" Wall="${f.wall}" OnWallFront="${f.onWallFront}" Width="${num(f.width)}" Height="${num(f.height)}" Depth="${num(f.depth)}" X="${num(f.x)}" Elev="${num(f.elev)}" Rot="${num(f.rot)}" />`
}

function serializeProduct(prod: MozProduct): string {
  // Start with rawAttributes (preserves all Mozaik-specific fields),
  // then override placement fields with current values
  const attrs: Record<string, string> = { ...prod.rawAttributes }
  attrs['UniqueID'] = prod.uniqueId
  attrs['ProdName'] = prod.prodName
  attrs['IDTag'] = String(prod.idTag)
  attrs['SourceLib'] = prod.sourceLib
  attrs['Width'] = num(prod.width)
  attrs['Height'] = num(prod.height)
  attrs['Depth'] = num(prod.depth)
  attrs['X'] = num(prod.x)
  attrs['Elev'] = num(prod.elev)
  attrs['Rot'] = num(prod.rot)
  attrs['Wall'] = prod.wall

  const attrStr = Object.entries(attrs)
    .map(([k, v]) => `${k}="${esc(v)}"`)
    .join(' ')

  const lines: string[] = []
  lines.push(`    <Product ${attrStr}>`)

  if (prod.rawInnerXml) {
    // Use verbatim inner XML from MOZ file — preserves all child elements
    // (CabProdParts, CabProdParms, ProductDoors, Faces, ProductType, etc.)
    lines.push(prod.rawInnerXml)
  } else {
    // Fallback: generate from parsed data (minimal structure)
    lines.push('      <ProductOptions />')
    if (prod.parts.length === 0) {
      lines.push('      <CabProdParts />')
    } else {
      lines.push('      <CabProdParts>')
      for (const part of prod.parts) {
        lines.push(serializePart(part))
      }
      lines.push('      </CabProdParts>')
    }
  }

  lines.push('    </Product>')
  return lines.join('\n')
}

function serializePart(part: MozPart): string {
  const r = part.rotation
  const partAttrs = `Name="${esc(part.name)}" ReportName="${esc(part.reportName)}" UsageType="0" Comment="" CommentLocked="False" Quan="${part.quan}" W="${num(part.w)}" L="${num(part.l)}" Color="None" ColorLocked="False" Type="${esc(part.type)}" Q_EQ="" W_EQ="" L_EQ="" Layer="${part.layer}" X="${num(part.x)}" Y="${num(part.y)}" Z="${num(part.z)}" X_EQ="" Y_EQ="" Z_EQ="" A1="${num(r.a1)}" A2="${num(r.a2)}" A3="${num(r.a3)}" R1="${r.r1}" R2="${r.r2}" R3="${r.r3}" Face="0" A1_EQ="" A2_EQ="" A3_EQ="" Radius="0" RadAxis="0" SUPartName="${esc(part.suPartName)}" SUPartD="0"`

  if (part.shapePoints.length === 0) {
    return `        <CabProdPart ${partAttrs} />`
  }

  const lines: string[] = []
  lines.push(`        <CabProdPart ${partAttrs}>`)
  lines.push('          <PartShapeXml Version="2" Name="" Type="0" RadiusX="0" RadiusY="0" Source="0" Data1="0" Data2="0" RotAng="0" DoNotTranslateTo00="False">')
  for (const sp of part.shapePoints) {
    lines.push(`            <ShapePoint ID="${sp.id}" X="${num(sp.x)}" Y="${num(sp.y)}" PtType="0" Data="0" EdgeType="${sp.edgeType}" Anchor="" EBand="0" X_Eq="" Y_Eq="" Data_Eq="" LAdj="0" RAdj="0" TAdj="0" BAdj="0" Scribe="0" Source="0" BoreHoles="0" EBandLock="False" SideName="${esc(sp.sideName)}" />`)
  }
  lines.push('          </PartShapeXml>')
  lines.push('        </CabProdPart>')
  return lines.join('\n')
}
