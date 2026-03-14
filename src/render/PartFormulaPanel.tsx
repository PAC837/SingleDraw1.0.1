import type { MozProduct, MozPart } from '../mozaik/types'
import { formatDim } from '../math/units'

interface PartFormulaPanelProps {
  part: MozPart
  partIndex: number
  product: MozProduct
  selectedPt: number | null
  flaggedPts: Set<number>
  useInches: boolean
  onSelectPt: (idx: number | null) => void
  onToggleFlag: (idx: number) => void
}

const SIDE_ABBR: Record<string, string> = { Front: 'F', Back: 'B', Left: 'L', Right: 'R', Top: 'T', Bottom: 'Bot' }

/** Right-side formula panel for the Part Shape Inspector. */
export default function PartFormulaPanel({
  part, partIndex, product, selectedPt, flaggedPts, useInches, onSelectPt, onToggleFlag,
}: PartFormulaPanelProps) {
  const fmt = (mm: number) => formatDim(mm, useInches)
  const eqMap = product._shapeEqMap?.get(partIndex)
  const pts = part.shapePoints

  const handleCopyFlagged = () => {
    const flagged = [...flaggedPts].sort((a, b) => a - b).map(i => {
      const sp = pts[i]
      if (!sp) return null
      return { pt: i, x: +sp.x.toFixed(2), y: +sp.y.toFixed(2), sideName: sp.sideName || '', xEq: sp.xEq || '', yEq: sp.yEq || '' }
    }).filter(Boolean)
    const json = JSON.stringify({ part: part.name, partIndex, flagged }, null, 2)
    navigator.clipboard.writeText(json)
  }

  return (
    <div className="w-80 border-l border-[#333] pl-3 overflow-y-auto flex flex-col gap-1" style={{ maxHeight: 'calc(100vh - 120px)' }}>
      <div className="flex items-center justify-between">
        <span className="text-[10px] font-semibold uppercase tracking-wider text-[var(--accent)]">Formulas</span>
        {flaggedPts.size > 0 && (
          <button
            className="text-[9px] px-1.5 py-0.5 rounded bg-red-900 text-red-300 hover:bg-red-800 transition-colors"
            onClick={handleCopyFlagged}
            title="Copy flagged points as JSON"
          >
            Copy Flagged ({flaggedPts.size})
          </button>
        )}
      </div>

      {pts.length < 3 ? (
        <div className="text-[10px] text-[var(--text-secondary)]">
          Rect part — no shape equations. 4 axis-aligned corners at (0,0) → (L,W).
        </div>
      ) : (
        <div className="space-y-0.5">
          {pts.map((sp, i) => {
            const eq = eqMap?.[i]
            const isSel = selectedPt === i
            const isFlagged = flaggedPts.has(i)
            const hasAnyEq = sp.xEq || sp.yEq || sp.dataEq || eq?.xEq || eq?.yEq
            return (
              <div
                key={i}
                className={`text-[9px] p-1 rounded cursor-pointer transition-colors ${
                  isSel ? 'bg-red-500/20 border border-red-500/40'
                  : 'border border-transparent hover:bg-gray-800'
                }`}
                onClick={() => onSelectPt(isSel ? null : i)}
              >
                {/* Point header */}
                <div className="flex items-center gap-1">
                  <span className="text-[var(--text-secondary)] w-4">{i}</span>
                  <span className="text-white tabular-nums">({fmt(sp.x)}, {fmt(sp.y)})</span>
                  {sp.sideName && (
                    <span className="px-0.5 rounded bg-[#222] text-[var(--text-secondary)]">
                      {SIDE_ABBR[sp.sideName] || sp.sideName}
                    </span>
                  )}
                  {sp.ptType === 1 && <span className="text-[#00ddff]">arc r={fmt(sp.data)}</span>}
                  <span className="ml-auto flex items-center gap-1">
                    {!hasAnyEq && <span className="text-gray-600">const</span>}
                    <button
                      className={`w-3 h-3 rounded-full border transition-colors ${
                        isFlagged ? 'bg-red-500 border-red-400' : 'bg-transparent border-gray-600 hover:border-red-400'
                      }`}
                      onClick={(e) => { e.stopPropagation(); onToggleFlag(i) }}
                      title={isFlagged ? 'Unflag point' : 'Flag as wrong'}
                    />
                  </span>
                </div>

                {/* Direct equations (from PartShapeXml) */}
                {(sp.xEq || sp.yEq || sp.dataEq) && (
                  <div className="ml-4 mt-0.5 space-y-0">
                    <div className="text-[var(--text-secondary)]">Direct:</div>
                    {sp.xEq && <div className="text-[var(--accent)]">X: {sp.xEq}</div>}
                    {sp.yEq && <div className="text-[var(--accent)]">Y: {sp.yEq}</div>}
                    {sp.dataEq && <div className="text-[var(--accent)]">Data: {sp.dataEq}</div>}
                  </div>
                )}

                {/* Propagated equations (from TopShapeXml via topology mapper) */}
                {eq && (
                  <div className="ml-4 mt-0.5 space-y-0">
                    <div className="text-[var(--text-secondary)]">Propagated:</div>
                    {eq.xEq ? (
                      <div className="text-[#00ff88]">
                        X: {eq.xEq}
                        {Math.abs(eq.offsetX) > 0.01 && <span className="text-gray-500"> off={eq.offsetX.toFixed(1)}</span>}
                        {eq.mirroredX && <span className="text-[#ff8844]"> mirX</span>}
                      </div>
                    ) : eq.xTrack ? (
                      <div className="text-[#ffdd00]">X tracks {eq.xTrack} <span className="text-gray-500">off={eq.offsetX.toFixed(1)}</span></div>
                    ) : null}
                    {eq.yEq ? (
                      <div className="text-[#00ff88]">
                        Y: {eq.yEq}
                        {Math.abs(eq.offsetY) > 0.01 && <span className="text-gray-500"> off={eq.offsetY.toFixed(1)}</span>}
                      </div>
                    ) : eq.yTrack ? (
                      <div className="text-[#ffdd00]">Y tracks {eq.yTrack} <span className="text-gray-500">off={eq.offsetY.toFixed(1)}</span></div>
                    ) : null}
                    {eq.dataEq && <div className="text-[#00ff88]">Data: {eq.dataEq}</div>}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
