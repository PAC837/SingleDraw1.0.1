import { useCallback } from 'react'
import type { MozProduct } from '../mozaik/types'
import { useAppState, useAppDispatch } from '../store'
import { formatDim } from '../math/units'
import SectionHeader from '../ui/SectionHeader'

/** Color dot matching ProductView.partColor() */
function partColorDot(type: string): string {
  switch (type.toLowerCase()) {
    case 'metal': return '#888888'
    case 'toe': return '#4a3728'
    case 'bottom': case 'top': case 'fend': return '#d4c5a9'
    case 'fixedshelf': case 'adjshelf': return '#c8b896'
    default: return '#b8a88a'
  }
}

/** Floating part inspector panel — shown when exactly one product is selected. */
export default function PartInspector() {
  const state = useAppState()
  const dispatch = useAppDispatch()

  const room = state.room
  const sel = state.selectedProducts
  if (!room || sel.length !== 1) return null

  const productIndex = sel[0]
  const product: MozProduct | undefined = room.products[productIndex]
  if (!product) return null

  const useInches = state.useInches
  const fmt = (mm: number) => formatDim(mm, useInches)
  const hoveredPart = state.hoveredPart

  const onHover = useCallback((partIndex: number | null) => {
    dispatch({
      type: 'SET_HOVERED_PART',
      part: partIndex != null ? { productIndex, partIndex } : null,
    })
  }, [dispatch, productIndex])

  // Sort parts: by Z (bottom to top), then X (left to right)
  const sortedParts = product.parts
    .map((p, i) => ({ part: p, index: i }))
    .sort((a, b) => a.part.z - b.part.z || a.part.x - b.part.x)

  return (
    <div
      className="absolute bottom-4 right-4 w-80 max-h-[calc(100vh-120px)] overflow-y-auto bg-[var(--bg-panel)] rounded-lg shadow-lg border border-[#333] z-50"
      onPointerLeave={() => onHover(null)}
    >
      <div className="p-3">
        <SectionHeader>Parts — {product.prodName} ({product.parts.length})</SectionHeader>
        <div className="mt-2 space-y-0.5">
          <div className="flex text-[10px] text-[var(--text-secondary)] font-semibold uppercase tracking-wider px-1 mb-1">
            <span className="w-4" />
            <span className="flex-1">Name</span>
            <span className="w-16 text-right">L</span>
            <span className="w-16 text-right">W</span>
            <span className="w-14 text-right">X</span>
            <span className="w-14 text-right">Y</span>
            <span className="w-14 text-right">Z</span>
          </div>
          {sortedParts.map(({ part, index }) => {
            const isHovered = hoveredPart?.productIndex === productIndex && hoveredPart?.partIndex === index
            return (
              <div
                key={`${part.name}-${index}`}
                className={`flex items-center text-[10px] px-1 py-0.5 rounded cursor-pointer transition-colors ${
                  isHovered ? 'bg-[var(--accent)] bg-opacity-20 text-white' : 'text-[var(--text-secondary)] hover:bg-gray-800'
                }`}
                onPointerEnter={() => onHover(index)}
                onClick={() => {
                  console.log(`[Part] ${part.name}`, {
                    type: part.type, name: part.name, reportName: part.reportName,
                    L: part.l, W: part.w, X: part.x, Y: part.y, Z: part.z,
                    rotation: part.rotation, quan: part.quan, layer: part.layer,
                    shapePoints: part.shapePoints, operations: part.operations.length,
                  })
                }}
              >
                <span
                  className="w-2.5 h-2.5 rounded-full mr-1.5 flex-shrink-0"
                  style={{ backgroundColor: partColorDot(part.type) }}
                />
                <span className="flex-1 truncate font-medium" title={`${part.name} (${part.type})`}>
                  {part.name}
                </span>
                <span className="w-16 text-right tabular-nums">{fmt(part.l)}</span>
                <span className="w-16 text-right tabular-nums">{fmt(part.w)}</span>
                <span className="w-14 text-right tabular-nums">{fmt(part.x)}</span>
                <span className="w-14 text-right tabular-nums">{fmt(part.y)}</span>
                <span className="w-14 text-right tabular-nums">{fmt(part.z)}</span>
              </div>
            )
          })}
        </div>
        {product.topShapePoints && product.topShapePoints.length > 0 && (
          <div className="mt-3">
            <div className="text-[10px] text-[var(--text-secondary)] font-semibold uppercase tracking-wider mb-1">
              TopShape ({product.topShapePoints.length} pts)
            </div>
            {product.topShapePoints.map((pt, i) => (
              <div key={i} className="text-[10px] text-[var(--text-secondary)] px-1">
                {i}: ({fmt(pt.x)}, {fmt(pt.y)}) {pt.xEq && <span className="text-[var(--accent)]">X:{pt.xEq}</span>} {pt.yEq && <span className="text-[var(--accent)]">Y:{pt.yEq}</span>}
              </div>
            ))}
          </div>
        )}
        {product.parameters && product.parameters.length > 0 && (
          <div className="mt-3">
            <div className="text-[10px] text-[var(--text-secondary)] font-semibold uppercase tracking-wider mb-1">
              Parameters ({product.parameters.length})
            </div>
            {product.parameters.map((p, i) => (
              <div key={i} className="text-[10px] text-[var(--text-secondary)] px-1">
                {p.name}: <span className="text-white">{p.value}</span>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
