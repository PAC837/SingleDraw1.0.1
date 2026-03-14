import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { MozProduct, MozPart, MozShapePoint } from '../mozaik/types'
import { formatDim } from '../math/units'
import PartFormulaPanel from './PartFormulaPanel'

interface PartShapeInspectorProps {
  product: MozProduct
  part: MozPart
  partIndex: number
  partCount: number
  useInches: boolean
  onClose: () => void
  onCyclePart: (index: number) => void
}

/** Tessellate fillet arcs into SVG-friendly polyline segments. */
function tessellateShape(pts: MozShapePoint[]): [number, number][] {
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

/** Edge side → color map. */
const SIDE_COLORS: Record<string, string> = {
  Front: '#4488ff', Back: '#ff4444', Left: '#ffcc00', Right: '#44ff88',
  Top: '#aa88ff', Bottom: '#ff88aa',
}
const SIDE_ABBR: Record<string, string> = { Front: 'F', Back: 'B', Left: 'L', Right: 'R', Top: 'T', Bottom: 'Bot' }
const EDGE_SIDES = ['Front', 'Back', 'Left', 'Right'] as const
type EdgeSide = typeof EDGE_SIDES[number]
type CoordMode = 'part-local' | 'product-local'

export default function PartShapeInspector({
  product, part, partIndex, partCount, useInches, onClose, onCyclePart,
}: PartShapeInspectorProps) {
  const [coordMode, setCoordMode] = useState<CoordMode>('part-local')
  const [selectedPt, setSelectedPt] = useState<number | null>(null)
  const [showGuide, setShowGuide] = useState(false)
  const [assignMode, setAssignMode] = useState<EdgeSide | null>(null)
  const [edgeLabels, setEdgeLabels] = useState<Map<number, string>>(new Map())
  const [flaggedPts, setFlaggedPts] = useState<Set<number>>(new Set())
  const fmt = (mm: number) => formatDim(mm, useInches)
  const svgRef = useRef<SVGSVGElement>(null)

  // Detect A1=180 X-mirror: part X axis is flipped relative to product/TopShape
  const isMirroredX = part.rotation.a1 === 180 && part.rotation.r1 === 'Y'
  const hasTopShape = !product.isRectShape
    && !!product.topShapePoints && product.topShapePoints.length >= 3
    && part.shapePoints.length === product.topShapePoints.length
  // For SVG display: un-mirror part shape points so they align with TopShape orientation
  const showUnmirrored = isMirroredX && hasTopShape

  // Init edge labels from sideName + reset on part change
  useEffect(() => {
    setSelectedPt(null)
    setFlaggedPts(new Set())
    setAssignMode(null)
    const labels = new Map<number, string>()
    part.shapePoints.forEach((sp, i) => { if (sp.sideName) labels.set(i, sp.sideName) })
    setEdgeLabels(labels)
  }, [partIndex, part])

  const toggleFlag = useCallback((idx: number) => {
    setFlaggedPts(prev => {
      const next = new Set(prev)
      if (next.has(idx)) next.delete(idx); else next.add(idx)
      return next
    })
  }, [])

  // Compute shape data + initial viewBox
  const shapeData = useMemo(() => {
    // Filter out NaN/Infinity shape points to prevent cascade
    const validPts = part.shapePoints.filter(sp => isFinite(sp.x) && isFinite(sp.y))
    const hasShape = validPts.length >= 3
    const safeL = isFinite(part.l) ? part.l : 100
    const safeW = isFinite(part.w) ? part.w : 100
    // Un-mirror X for display when part is A1=180 mirrored alongside TopShape
    const displayPts = showUnmirrored
      ? validPts.map(sp => ({ ...sp, x: safeL - sp.x }))
      : validPts
    const partOutline: [number, number][] = hasShape
      ? tessellateShape(displayPts)
      : [[0, 0], [safeL, 0], [safeL, safeW], [0, safeW]]
    const topShapeOutline = hasTopShape ? tessellateShape(product.topShapePoints!) : null

    const allX = [...partOutline.map(p => p[0]), 0].filter(isFinite)
    const allY = [...partOutline.map(p => p[1]), 0].filter(isFinite)
    if (topShapeOutline) {
      allX.push(...topShapeOutline.map(p => p[0]).filter(isFinite))
      allY.push(...topShapeOutline.map(p => p[1]).filter(isFinite))
    }
    if (coordMode === 'product-local') {
      if (isFinite(part.x)) allX.push(part.x)
      if (isFinite(part.y)) allY.push(part.y)
    }

    const minX = allX.length ? Math.min(...allX) : 0
    const maxX = allX.length ? Math.max(...allX) : 100
    const minY = allY.length ? Math.min(...allY) : 0
    const maxY = allY.length ? Math.max(...allY) : 100
    const range = Math.max(maxX - minX, maxY - minY, 100)
    const pad = range * 0.15 + 30
    const vb = { x: minX - pad, y: -(maxY + pad), w: (maxX - minX) + pad * 2, h: (maxY - minY) + pad * 2 }
    const gridStep = vb.w > 1500 ? 200 : vb.w > 600 ? 100 : 50
    return { partOutline, topShapeOutline, vb, gridStep, minX, maxX, minY, maxY, pad }
  }, [part, product, coordMode, showUnmirrored])

  const { partOutline, topShapeOutline, gridStep, minX, maxX, minY, maxY, pad } = shapeData

  // Pan & zoom state
  const [vb, setVb] = useState(shapeData.vb)
  const [isPanning, setIsPanning] = useState(false)
  const panStart = useRef<{ mx: number; my: number; vbx: number; vby: number } | null>(null)
  useEffect(() => { setVb(shapeData.vb) }, [shapeData.vb])

  const fy = (v: number) => -v

  const handleWheel = useCallback((e: React.WheelEvent) => {
    e.stopPropagation()
    const factor = e.deltaY > 0 ? 1.15 : 1 / 1.15
    setVb(prev => {
      const newW = Math.max(50, Math.min(prev.w * factor, 20000))
      const newH = Math.max(50, Math.min(prev.h * factor, 20000))
      const cx = prev.x + prev.w / 2, cy = prev.y + prev.h / 2
      return { x: cx - newW / 2, y: cy - newH / 2, w: newW, h: newH }
    })
  }, [])

  const handleMouseDown = useCallback((e: React.MouseEvent) => {
    if (e.button !== 0) return
    if (!assignMode) { setIsPanning(true); panStart.current = { mx: e.clientX, my: e.clientY, vbx: vb.x, vby: vb.y } }
  }, [vb, assignMode])

  const handleMouseMove = useCallback((e: React.MouseEvent) => {
    if (!isPanning || !panStart.current || !svgRef.current) return
    const rect = svgRef.current.getBoundingClientRect()
    const scaleX = vb.w / rect.width, scaleY = vb.h / rect.height
    const dx = (e.clientX - panStart.current.mx) * scaleX
    const dy = (e.clientY - panStart.current.my) * scaleY
    const startVbx = panStart.current.vbx
    const startVby = panStart.current.vby
    setVb(prev => ({ ...prev, x: startVbx - dx, y: startVby - dy }))
  }, [isPanning, vb.w, vb.h])

  const handleMouseUp = useCallback(() => { setIsPanning(false); panStart.current = null }, [])
  const handleSvgDblClick = useCallback(() => { setVb(shapeData.vb) }, [shapeData.vb])

  // Edge click handler (assign mode)
  const handleEdgeClick = useCallback((edgeIdx: number, e: React.MouseEvent) => {
    e.stopPropagation()
    if (!assignMode) return
    setEdgeLabels(prev => {
      const next = new Map(prev)
      // Remove existing assignment for this side
      for (const [k, v] of next) { if (v === assignMode) next.delete(k) }
      next.set(edgeIdx, assignMode)
      return next
    })
    setAssignMode(null)
  }, [assignMode])

  // Build edge segments from shape points for per-edge coloring (un-mirror X for display)
  const edgeSegments = useMemo(() => {
    const pts = part.shapePoints.length >= 3 ? part.shapePoints : null
    const corners: [number, number][] = pts
      ? pts.map(sp => [showUnmirrored ? part.l - sp.x : sp.x, sp.y])
      : [[0, 0], [part.l, 0], [part.l, part.w], [0, part.w]]
    const n = corners.length
    return corners.map((_, i) => {
      const x1 = corners[i][0], y1 = corners[i][1]
      const x2 = corners[(i + 1) % n][0], y2 = corners[(i + 1) % n][1]
      const label = edgeLabels.get(i) || ''
      const color = SIDE_COLORS[label] || '#AAFF00'
      const mx = (x1 + x2) / 2, my = (y1 + y2) / 2
      return { x1, y1, x2, y2, color, label, mx, my, idx: i }
    })
  }, [part, edgeLabels, showUnmirrored])

  // Build SVG path for tessellated outline (used for fill only)
  const partPath = useMemo(() => {
    if (partOutline.length === 0) return ''
    let d = `M ${partOutline[0][0].toFixed(2)} ${(-partOutline[0][1]).toFixed(2)}`
    for (let i = 1; i < partOutline.length; i++) d += ` L ${partOutline[i][0].toFixed(2)} ${(-partOutline[i][1]).toFixed(2)}`
    return d + ' Z'
  }, [partOutline])

  const topShapePath = useMemo(() => {
    if (!topShapeOutline || topShapeOutline.length === 0) return null
    let d = `M ${topShapeOutline[0][0].toFixed(2)} ${(-topShapeOutline[0][1]).toFixed(2)}`
    for (let i = 1; i < topShapeOutline.length; i++) d += ` L ${topShapeOutline[i][0].toFixed(2)} ${(-topShapeOutline[i][1]).toFixed(2)}`
    return d + ' Z'
  }, [topShapeOutline])

  const rot = part.rotation
  const crossLen = Math.max(part.l, part.w) * 0.12 + 15
  const ptR = Math.max(4, shapeData.vb.w * 0.007)

  // Point markers (un-mirror X for display when mirrored)
  const pointMarkers = useMemo(() => {
    if (part.shapePoints.length >= 3) {
      return part.shapePoints.map((sp, i) => ({
        x: showUnmirrored ? part.l - sp.x : sp.x,
        y: sp.y, isArc: sp.ptType === 1, idx: i,
      }))
    }
    return [[0, 0], [part.l, 0], [part.l, part.w], [0, part.w]].map(([x, y], i) => ({ x, y, isArc: false, idx: i }))
  }, [part, showUnmirrored])

  // Grid lines
  const gridLines = useMemo(() => {
    const lines: { x1: number; y1: number; x2: number; y2: number; label: string; vert: boolean }[] = []
    const gMinX = Math.floor((minX - pad) / gridStep) * gridStep
    const gMaxX = Math.ceil((maxX + pad) / gridStep) * gridStep
    const gMinY = Math.floor((minY - pad) / gridStep) * gridStep
    const gMaxY = Math.ceil((maxY + pad) / gridStep) * gridStep
    for (let x = gMinX; x <= gMaxX; x += gridStep)
      lines.push({ x1: x, y1: fy(gMinY - pad), x2: x, y2: fy(gMaxY + pad), vert: true, label: `${x}` })
    for (let y = gMinY; y <= gMaxY; y += gridStep)
      lines.push({ x1: gMinX - pad, y1: fy(y), x2: gMaxX + pad, y2: fy(y), vert: false, label: `${y}` })
    return lines
  }, [minX, maxX, minY, maxY, pad, gridStep])

  const viewBoxStr = `${vb.x} ${vb.y} ${vb.w} ${vb.h}`

  // Guard against invalid geometry (NaN cascade from resized parts)
  if (!isFinite(vb.w) || !isFinite(vb.h) || vb.w <= 0 || vb.h <= 0) {
    return (
      <div className="absolute inset-0 z-40 flex items-center justify-center"
        style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
        <div className="bg-[var(--bg-panel)] rounded-lg shadow-lg border border-[#333] p-6">
          <p className="text-xs text-red-400">Invalid part geometry — cannot display shape inspector.</p>
          <button onClick={onClose} className="mt-3 text-xs px-3 py-1 bg-gray-700 rounded text-white hover:bg-gray-600">Close</button>
        </div>
      </div>
    )
  }

  return (
    <div className="absolute inset-0 z-40 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.5)' }} onClick={onClose}>
      <div className="bg-[var(--bg-panel)] rounded-lg shadow-lg border border-[#333] p-4 flex gap-3 overflow-hidden"
        style={{ width: 1020, maxHeight: 'calc(100vh - 60px)' }} onClick={e => e.stopPropagation()}>

        {/* Left column: SVG + controls + table */}
        <div className="flex-1 flex flex-col gap-2 min-w-0 overflow-y-auto">
          {/* Header */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <button className="text-[var(--text-secondary)] hover:text-white px-1"
                onClick={() => onCyclePart((partIndex - 1 + partCount) % partCount)}>&larr;</button>
              <span className="text-sm font-bold text-white">{part.name}</span>
              <span className="text-[10px] px-1.5 py-0.5 rounded bg-[#333] text-[var(--text-secondary)]">{part.type}</span>
              <span className="text-[10px] text-[var(--text-secondary)]">[{partIndex + 1}/{partCount}]</span>
              <button className="text-[var(--text-secondary)] hover:text-white px-1"
                onClick={() => onCyclePart((partIndex + 1) % partCount)}>&rarr;</button>
            </div>
            <div className="flex items-center gap-2">
              <button className={`w-5 h-5 rounded-full text-[10px] font-bold transition-colors ${showGuide ? 'bg-[var(--accent)] text-black' : 'bg-[#333] text-[#aaa]'}`}
                onClick={() => setShowGuide(!showGuide)} title="Coordinate guide">?</button>
              <button onClick={onClose} className="text-[var(--text-secondary)] hover:text-white text-lg leading-none">&times;</button>
            </div>
          </div>

          {/* Guide */}
          {showGuide && (
            <div className="text-[10px] bg-[#111] rounded border border-[#333] p-2 space-y-1">
              <div className="font-semibold text-[var(--accent)] uppercase tracking-wider mb-1">Coordinate Guide</div>
              <div className="text-[var(--text-secondary)]">
                <span className="inline-block w-2 h-2 rounded-full bg-[#AAFF00] mr-1" />
                <b className="text-white">Part Shape</b> — 2D outline from PartShapeXml. Origin = part corner (0,0). Range [0,L] x [0,W].
              </div>
              <div className="text-[var(--text-secondary)]">
                <span className="inline-block w-2 h-2 rounded-full bg-[#ff8844] mr-1" />
                <b className="text-white">Part Position</b> — Where part sits in product space. (part.x, part.y, part.z) from MOZ.
              </div>
              <div className="text-[var(--text-secondary)]">
                <span className="inline-block w-2 h-2 rounded-full bg-[#00ff88] mr-1" />
                <b className="text-white">Product Shape</b> — TopShapeXml outline (CRN only). Origin = product corner (0,0).
              </div>
              <div className="text-[var(--text-secondary)] mt-1 border-t border-[#333] pt-1">
                <b className="text-white">Edge colors:</b>{' '}
                <span style={{ color: '#4488ff' }}>Front</span>{' '}
                <span style={{ color: '#ff4444' }}>Back</span>{' '}
                <span style={{ color: '#ffcc00' }}>Left</span>{' '}
                <span style={{ color: '#44ff88' }}>Right</span>{' '}
                — from MOZ SideName or user-assigned.
              </div>
            </div>
          )}

          {/* Info grid + rotation */}
          <div className="flex gap-4 items-start">
            <div className="grid grid-cols-3 gap-x-3 gap-y-0.5 text-xs flex-1">
              <div className="text-[var(--text-secondary)]">L: <span className="text-white">{fmt(part.l)}</span></div>
              <div className="text-[var(--text-secondary)]">W: <span className="text-white">{fmt(part.w)}</span></div>
              <div className="text-[var(--text-secondary)]">Pts: <span className="text-white">{part.shapePoints.length}</span></div>
              <div className="text-[var(--text-secondary)]">X: <span className="text-white">{fmt(part.x)}</span></div>
              <div className="text-[var(--text-secondary)]">Y: <span className="text-white">{fmt(part.y)}</span></div>
              <div className="text-[var(--text-secondary)]">Z: <span className="text-white">{fmt(part.z)}</span></div>
            </div>
            <div className="flex gap-1 text-[10px] items-center">
              <span className="px-1 py-0.5 rounded bg-[#222] text-[var(--accent)]">{rot.r1}={rot.a1}</span>
              <span className="px-1 py-0.5 rounded bg-[#222] text-[var(--accent)]">{rot.r2}={rot.a2}</span>
              <span className="px-1 py-0.5 rounded bg-[#222] text-[var(--accent)]">{rot.r3}={rot.a3}</span>
              {showUnmirrored && (
                <span className="px-1.5 py-0.5 rounded bg-blue-900/50 text-blue-300 border border-blue-700" title="X coordinates un-mirrored for display to match TopShape orientation">X-flip</span>
              )}
            </div>
          </div>

          {/* Coord mode + edge assign buttons */}
          <div className="flex gap-1 text-[10px] flex-wrap items-center">
            <button className={`px-1.5 py-0.5 rounded transition-colors ${coordMode === 'part-local' ? 'bg-[var(--accent)] text-black font-medium' : 'bg-[#333] text-[#aaa]'}`}
              onClick={() => setCoordMode('part-local')}>Part Local</button>
            <button className={`px-1.5 py-0.5 rounded transition-colors ${coordMode === 'product-local' ? 'bg-[var(--accent)] text-black font-medium' : 'bg-[#333] text-[#aaa]'}`}
              onClick={() => setCoordMode('product-local')}>Product Local</button>
            <span className="mx-1 text-[#333]">|</span>
            {EDGE_SIDES.map(side => (
              <button key={side}
                className={`px-1.5 py-0.5 rounded transition-colors border ${
                  assignMode === side ? 'font-medium border-current' : 'border-transparent'
                }`}
                style={{ color: SIDE_COLORS[side], backgroundColor: assignMode === side ? `${SIDE_COLORS[side]}22` : '#333' }}
                onClick={() => setAssignMode(assignMode === side ? null : side)}
                title={`Assign ${side} edge — click then click an edge line`}
              >{side}</button>
            ))}
            {assignMode && <span className="text-[var(--text-secondary)] ml-1">Click an edge to assign</span>}
          </div>

          {/* SVG */}
          <svg ref={svgRef} viewBox={viewBoxStr} preserveAspectRatio="xMidYMid meet"
            className="bg-[#111] rounded border border-[#333] w-full select-none"
            style={{ height: 340, cursor: assignMode ? 'crosshair' : isPanning ? 'grabbing' : 'grab' }}
            onWheel={handleWheel} onMouseDown={handleMouseDown} onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp} onMouseLeave={handleMouseUp}
            onDoubleClick={(e) => { e.stopPropagation(); handleSvgDblClick() }}
            onClick={() => { if (!assignMode) setSelectedPt(null) }}>

            {/* Grid */}
            {gridLines.map((g, i) => (
              <g key={i}>
                <line x1={g.x1} y1={g.y1} x2={g.x2} y2={g.y2} stroke="#222" strokeWidth={1} />
                {g.vert && <text x={g.x1 + 2} y={fy(minY - pad) + 12} fill="#444" fontSize={10}>{g.label}</text>}
                {!g.vert && <text x={minX - pad + 2} y={g.y1 - 2} fill="#444" fontSize={10}>{g.label}</text>}
              </g>
            ))}

            {/* Origin crosshair */}
            <line x1={-crossLen} y1={fy(0)} x2={crossLen} y2={fy(0)} stroke="#666" strokeWidth={1.5} strokeDasharray="4 2" />
            <line x1={0} y1={fy(-crossLen)} x2={0} y2={fy(crossLen)} stroke="#666" strokeWidth={1.5} strokeDasharray="4 2" />
            <text x={3} y={fy(0) - 4} fill="#888" fontSize={9}>0,0</text>

            {/* Product TopShape (CRN) */}
            {topShapePath && (
              <path d={topShapePath} fill="rgba(0,255,136,0.05)" stroke="#00ff88" strokeWidth={1.5} strokeDasharray="6 3" />
            )}

            {/* Part shape fill (light) */}
            <path d={partPath} fill="rgba(170,255,0,0.06)" stroke="none" />

            {/* Per-edge colored segments */}
            {edgeSegments.map(seg => (
              <g key={seg.idx} style={{ cursor: assignMode ? 'crosshair' : 'pointer' }}
                onClick={(e) => handleEdgeClick(seg.idx, e)}>
                <line x1={seg.x1} y1={fy(seg.y1)} x2={seg.x2} y2={fy(seg.y2)}
                  stroke={seg.color} strokeWidth={2.5} />
                {/* Invisible wider hit area for clicking */}
                <line x1={seg.x1} y1={fy(seg.y1)} x2={seg.x2} y2={fy(seg.y2)}
                  stroke="transparent" strokeWidth={12} />
                {seg.label && (
                  <text x={seg.mx} y={fy(seg.my) - 5} fill={seg.color}
                    fontSize={8} fontWeight="bold" textAnchor="middle">
                    {SIDE_ABBR[seg.label] || seg.label}
                  </text>
                )}
              </g>
            ))}

            {/* Point markers */}
            {pointMarkers.map(({ x, y, isArc, idx }) => {
              const isSel = selectedPt === idx
              const isFlagged = flaggedPts.has(idx)
              const r = isSel ? ptR * 1.8 : isFlagged ? ptR * 1.5 : ptR
              const fill = isFlagged ? '#ff3333' : isSel ? '#ff4444' : isArc ? '#00ddff' : '#fff'
              return (
                <g key={idx} style={{ cursor: 'pointer' }}
                  onClick={(e) => { e.stopPropagation(); setSelectedPt(isSel ? null : idx) }}
                  onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); toggleFlag(idx) }}>
                  <circle cx={x} cy={fy(y)} r={r} fill={fill}
                    stroke={isSel ? '#fff' : isFlagged ? '#ff0000' : '#000'} strokeWidth={isSel || isFlagged ? 1.5 : 0.5} />
                  {isFlagged && (
                    <text x={x} y={fy(y) + 3} fill="#fff" fontSize={7} fontWeight="bold" textAnchor="middle">!</text>
                  )}
                  <text x={x + r + 2} y={fy(y) + 3}
                    fill={isFlagged ? '#ff3333' : isSel ? '#ff4444' : isArc ? '#00ddff' : '#ccc'}
                    fontSize={8} fontWeight="bold">{idx}</text>
                </g>
              )
            })}

            {/* Part position dot */}
            {coordMode === 'product-local' && (
              <g>
                <line x1={0} y1={fy(0)} x2={part.x} y2={fy(part.y)} stroke="#ff8844" strokeWidth={1} strokeDasharray="4 2" />
                <circle cx={part.x} cy={fy(part.y)} r={5} fill="#ff8844" stroke="#fff" strokeWidth={1} />
                <text x={part.x + 8} y={fy(part.y) + 3} fill="#ff8844" fontSize={8}>({fmt(part.x)}, {fmt(part.y)})</text>
              </g>
            )}

            {/* Dimension labels */}
            <text x={part.l / 2} y={fy(-12)} fill="#999" fontSize={9} textAnchor="middle">L={fmt(part.l)}</text>
            <text x={-12} y={fy(part.w / 2)} fill="#999" fontSize={9} textAnchor="middle"
              transform={`rotate(-90, -12, ${fy(part.w / 2)})`}>W={fmt(part.w)}</text>
          </svg>

          {/* Shape points table */}
          {part.shapePoints.length >= 3 && (
            <div className="overflow-auto" style={{ maxHeight: 120 }}>
              <table className="w-full text-[10px] text-left">
                <thead>
                  <tr className="text-[var(--text-secondary)] border-b border-[#333]">
                    <th className="px-1 py-0.5 w-4"></th>
                    <th className="px-1 py-0.5">#</th>
                    <th className="px-1 py-0.5">X{showUnmirrored ? ' (raw)' : ''}</th>
                    <th className="px-1 py-0.5">Y</th>
                    <th className="px-1 py-0.5">Type</th>
                    <th className="px-1 py-0.5">Side</th>
                    <th className="px-1 py-0.5">Eq</th>
                  </tr>
                </thead>
                <tbody>
                  {part.shapePoints.map((sp, i) => {
                    const isFlagged = flaggedPts.has(i)
                    const label = edgeLabels.get(i) || ''
                    return (
                      <tr key={i}
                        className={`border-b border-[#222] cursor-pointer transition-colors ${
                          selectedPt === i ? 'bg-red-500/20 text-white'
                          : isFlagged ? 'bg-red-900/30 text-red-300'
                          : 'text-white hover:bg-gray-800'
                        }`}
                        onClick={() => setSelectedPt(selectedPt === i ? null : i)}>
                        <td className="px-1 py-0.5">
                          <button className={`w-2.5 h-2.5 rounded-full border ${
                            isFlagged ? 'bg-red-500 border-red-400' : 'border-gray-600'
                          }`} onClick={(e) => { e.stopPropagation(); toggleFlag(i) }} />
                        </td>
                        <td className="px-1 py-0.5 text-[var(--text-secondary)]">{i}</td>
                        <td className="px-1 py-0.5 tabular-nums">{fmt(sp.x)}</td>
                        <td className="px-1 py-0.5 tabular-nums">{fmt(sp.y)}</td>
                        <td className="px-1 py-0.5">{sp.ptType === 1 ? 'arc' : 'line'}</td>
                        <td className="px-1 py-0.5" style={{ color: SIDE_COLORS[label] || '#666' }}>
                          {SIDE_ABBR[label] || '—'}
                        </td>
                        <td className="px-1 py-0.5 text-[var(--accent)] truncate max-w-[80px]">{sp.xEq || sp.yEq || '—'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Right column: Formula panel */}
        <PartFormulaPanel
          part={part}
          partIndex={partIndex}
          product={product}
          selectedPt={selectedPt}
          flaggedPts={flaggedPts}
          useInches={useInches}
          onSelectPt={setSelectedPt}
          onToggleFlag={toggleFlag}
        />
      </div>
    </div>
  )
}
