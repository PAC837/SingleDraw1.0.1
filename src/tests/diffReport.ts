import type { MozRoom, MozProduct, MozFile } from '../mozaik/types'
import { wallChainReport } from '../math/wallMath'

/** Generate a full parse report for a DES room. */
export function desParseReport(room: MozRoom): string {
  const lines: string[] = []

  lines.push(`=== DES Parse Report: "${room.name}" (ID: ${room.uniqueId}) ===`)
  lines.push(`Room type: ${room.roomType}`)
  lines.push(`Wall height: ${room.parms.H_Walls}mm`)
  lines.push(`Wall thickness: ${room.parms.WallThickness}mm`)
  lines.push('')

  if (room.walls.length > 0) {
    lines.push(wallChainReport(room.walls))
    lines.push('')
  } else {
    lines.push('No walls defined.')
    lines.push('')
  }

  lines.push(`Fixtures: ${room.fixtures.length}`)
  for (const f of room.fixtures) {
    lines.push(`  ${f.name} (IDTag=${f.idTag}) on Wall ${f.wall}: ` +
      `width=${f.width}mm height=${f.height}mm x=${f.x}mm elev=${f.elev}mm`)
  }

  lines.push(`Products in room: ${room.products.length}`)
  for (const p of room.products) {
    lines.push(`  "${p.prodName}" on Wall ${p.wall}: ` +
      `${p.width}×${p.height}×${p.depth}mm, parts=${p.parts.length}`)
  }

  return lines.join('\n')
}

/** Generate a parse report for a MOZ file. */
export function mozParseReport(mozFile: MozFile): string {
  const p = mozFile.product
  const lines: string[] = []

  lines.push(`=== MOZ Parse Report: "${p.prodName}" (ID: ${p.uniqueId}) ===`)
  lines.push(`Dimensions: W=${p.width} H=${p.height} D=${p.depth}`)
  lines.push(`Position: X=${p.x} Elev=${p.elev} Rot=${p.rot} Wall=${p.wall}`)
  lines.push(`Parts: ${p.parts.length}`)
  lines.push('')

  // Group by rotation pattern
  const patterns = new Map<string, string[]>()
  for (const part of p.parts) {
    const key = `${part.rotation.r1},${part.rotation.r2},${part.rotation.r3}`
    const info = `${part.name} (A1=${part.rotation.a1}, A2=${part.rotation.a2}, A3=${part.rotation.a3})`
    if (!patterns.has(key)) patterns.set(key, [])
    patterns.get(key)!.push(info)
  }

  lines.push('Rotation patterns:')
  for (const [pattern, parts] of patterns) {
    lines.push(`  ${pattern}: ${parts.length} parts`)
    for (const info of parts) {
      lines.push(`    - ${info}`)
    }
  }

  lines.push('')
  lines.push(`Header: "${mozFile.headerLine1}" / "${mozFile.headerLine2}" / "${mozFile.headerLine3}"`)
  lines.push(`Raw XML size: ${mozFile.rawXml.length} bytes`)

  return lines.join('\n')
}

/** Compare two products for numeric differences. */
export function compareProducts(a: MozProduct, b: MozProduct): string[] {
  const diffs: string[] = []

  function check(field: string, va: number, vb: number) {
    if (va !== vb) {
      diffs.push(`${field}: ${va} → ${vb} (delta=${Math.abs(va - vb)})`)
    }
  }

  check('width', a.width, b.width)
  check('height', a.height, b.height)
  check('depth', a.depth, b.depth)
  check('x', a.x, b.x)
  check('elev', a.elev, b.elev)
  check('rot', a.rot, b.rot)

  if (a.parts.length !== b.parts.length) {
    diffs.push(`Part count: ${a.parts.length} → ${b.parts.length}`)
  } else {
    for (let i = 0; i < a.parts.length; i++) {
      const pa = a.parts[i], pb = b.parts[i]
      const prefix = `Part[${i}] "${pa.name}"`
      check(`${prefix}.x`, pa.x, pb.x)
      check(`${prefix}.y`, pa.y, pb.y)
      check(`${prefix}.z`, pa.z, pb.z)
      check(`${prefix}.w`, pa.w, pb.w)
      check(`${prefix}.l`, pa.l, pb.l)
      check(`${prefix}.a1`, pa.rotation.a1, pb.rotation.a1)
      check(`${prefix}.a2`, pa.rotation.a2, pb.rotation.a2)
      check(`${prefix}.a3`, pa.rotation.a3, pb.rotation.a3)
    }
  }

  return diffs
}
