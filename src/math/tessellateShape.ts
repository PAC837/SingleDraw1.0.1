/**
 * Tessellate fillet arcs into SVG-friendly polyline segments.
 */
import type { MozShapePoint } from '../mozaik/types'

export function tessellateShape(pts: MozShapePoint[]): [number, number][] {
  const n = pts.length
  if (n < 3) return pts.map(p => [p.x, p.y])

  const fillets = pts.map((pt, i) => {
    if (pt.ptType !== 1 || pt.data === 0) {
      return { has: false, start: [pt.x, pt.y], end: [pt.x, pt.y], center: [0, 0], r: 0, cw: false }
    }
    const prev = pts[(i - 1 + n) % n]
    const next = pts[(i + 1) % n]
    const r = Math.abs(pt.data)
    const vInX = pt.x - prev.x, vInY = pt.y - prev.y
    const vInLen = Math.sqrt(vInX * vInX + vInY * vInY) || 1
    const inX = vInX / vInLen, inY = vInY / vInLen
    const vOutX = next.x - pt.x, vOutY = next.y - pt.y
    const vOutLen = Math.sqrt(vOutX * vOutX + vOutY * vOutY) || 1
    const outX = vOutX / vOutLen, outY = vOutY / vOutLen
    const cross = inX * outY - inY * outX
    const filletStart = [pt.x - inX * r, pt.y - inY * r]
    const filletEnd = [pt.x + outX * r, pt.y + outY * r]
    const px = cross < 0 ? inY : -inY
    const py = cross < 0 ? -inX : inX
    const center = [filletStart[0] + px * r, filletStart[1] + py * r]
    return { has: true, start: filletStart, end: filletEnd, center, r, cw: cross < 0 }
  })

  const result: [number, number][] = []
  result.push([fillets[0].end[0], fillets[0].end[1]])
  for (let k = 1; k <= n; k++) {
    const i = k % n
    const f = fillets[i]
    result.push([f.start[0], f.start[1]])
    if (f.has) {
      const sa = Math.atan2(f.start[1] - f.center[1], f.start[0] - f.center[0])
      const ea = Math.atan2(f.end[1] - f.center[1], f.end[0] - f.center[0])
      let sweep = ea - sa
      if (f.cw) { if (sweep > 0) sweep -= Math.PI * 2 }
      else { if (sweep < 0) sweep += Math.PI * 2 }
      const segs = Math.max(8, Math.ceil(Math.abs(sweep) / (Math.PI / 16)))
      for (let s = 1; s <= segs; s++) {
        const angle = sa + sweep * (s / segs)
        result.push([f.center[0] + f.r * Math.cos(angle), f.center[1] + f.r * Math.sin(angle)])
      }
    }
  }
  return result
}
