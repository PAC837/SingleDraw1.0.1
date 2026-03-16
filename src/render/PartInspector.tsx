import { useCallback, useState } from 'react'
import type { MozProduct, MozPart } from '../mozaik/types'
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

/** Dependency color: green = equation, yellow = inference, gray = constant */
function depColor(hasEq: boolean): string {
  return hasEq ? '#00ff88' : '#ffdd00'
}

/** Inline shape point detail for CRN parts. */
function ShapePointDetail({
  part,
  partIndex,
  product,
  fmt,
}: {
  part: MozPart
  partIndex: number
  product: MozProduct
  fmt: (mm: number) => string
}) {
  if (part.shapePoints.length < 3) return null
  const eqMap = product._shapeEqMap?.get(partIndex)

  return (
    <div className="mt-1 ml-4 border-l border-[#333] pl-2">
      <div className="text-[9px] text-[var(--text-secondary)] font-semibold uppercase tracking-wider mb-0.5">
        Shape ({part.shapePoints.length} pts) {eqMap && <span className="text-[#00ff88]">EQ</span>}
      </div>
      {part.shapePoints.map((sp, j) => {
        const eq = eqMap?.[j]
        return (
          <div key={j} className="text-[9px] text-[var(--text-secondary)] leading-tight">
            <span className="text-gray-500">{j}:</span>{' '}
            <span className="tabular-nums">({fmt(sp.x)}, {fmt(sp.y)})</span>
            {eq?.xEq && (
              <span className="ml-1" style={{ color: depColor(true) }}>
                X:{eq.xEq}
                {Math.abs(eq.offsetX) > 0.01 && <span className="text-gray-500">+{eq.offsetX.toFixed(1)}</span>}
              </span>
            )}
            {eq?.yEq && (
              <span className="ml-1" style={{ color: depColor(true) }}>
                Y:{eq.yEq}
                {Math.abs(eq.offsetY) > 0.01 && <span className="text-gray-500">+{eq.offsetY.toFixed(1)}</span>}
              </span>
            )}
            {sp.ptType === 1 && (
              <span className="ml-1 text-gray-500">arc r={fmt(sp.data)}</span>
            )}
          </div>
        )
      })}
    </div>
  )
}

/** Floating part inspector panel — shown when exactly one product is selected. */
export default function PartInspector() {
  const state = useAppState()
  const dispatch = useAppDispatch()
  const [expandedPart, setExpandedPart] = useState<number | null>(null)

  const room = state.room
  const sel = state.selectedProducts
  const productIndex = sel.length === 1 ? sel[0] : 0

  const onHover = useCallback((partIndex: number | null) => {
    dispatch({
      type: 'SET_HOVERED_PART',
      part: partIndex != null ? { productIndex, partIndex } : null,
    })
  }, [dispatch, productIndex])

  if (!room || sel.length !== 1 || state.elevationViewerProduct !== null) return null

  const product: MozProduct | undefined = room.products[productIndex]
  if (!product) return null

  const useInches = state.useInches
  const fmt = (mm: number) => formatDim(mm, useInches)
  const hoveredPart = state.hoveredPart
  const inspectedPart = state.inspectedPart
  const isCRN = !product.isRectShape

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
        <SectionHeader>
          Parts — {product.prodName} ({product.parts.length})
          {isCRN && <span className="ml-1 text-[#00ff88]">CRN</span>}
        </SectionHeader>

        {/* CRN dependency summary */}
        {isCRN && product._shapeEqMap && (
          <div className="text-[9px] text-[var(--text-secondary)] mt-1 mb-2">
            Eq-mapped parts: {product._shapeEqMap.size}/{product.parts.length}
            <span className="ml-2 text-[#00ff88]">Click part for shape details</span>
          </div>
        )}

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
            const isInspected = inspectedPart?.productIndex === productIndex && inspectedPart?.partIndex === index
            const isExpanded = expandedPart === index
            const hasEqs = product._shapeEqMap?.has(index)
            return (
              <div key={`${part.name}-${index}`}>
                <div
                  className={`flex items-center text-[10px] px-1 py-0.5 rounded cursor-pointer transition-colors ${
                    isInspected ? 'border-l-2 border-red-500 bg-red-500/10 text-white'
                    : isHovered ? 'bg-[var(--accent)] bg-opacity-20 text-white'
                    : 'text-[var(--text-secondary)] hover:bg-gray-800'
                  }`}
                  onPointerEnter={() => onHover(index)}
                  onClick={() => {
                    if (isCRN && part.shapePoints.length >= 3) {
                      setExpandedPart(isExpanded ? null : index)
                    }
                    console.log(`[Part] ${part.name}`, {
                      type: part.type, name: part.name, reportName: part.reportName,
                      L: part.l, W: part.w, X: part.x, Y: part.y, Z: part.z,
                      rotation: part.rotation, quan: part.quan, layer: part.layer,
                      shapePoints: part.shapePoints, operations: part.operations.length,
                      hasEqs,
                    })
                  }}
                >
                  <span
                    className="w-2.5 h-2.5 rounded-full mr-1.5 flex-shrink-0"
                    style={{ backgroundColor: hasEqs ? '#00ff88' : partColorDot(part.type) }}
                  />
                  <span className="flex-1 truncate font-medium" title={`${part.name} (${part.type})`}>
                    {part.name}
                  </span>
                  <span className="w-16 text-right tabular-nums">{fmt(part.l)}</span>
                  <span className="w-16 text-right tabular-nums">{fmt(part.w)}</span>
                  <span className="w-14 text-right tabular-nums">{fmt(part.x)}</span>
                  <span className="w-14 text-right tabular-nums">{fmt(part.y)}</span>
                  <span className="w-14 text-right tabular-nums">{fmt(part.z)}</span>
                  <button
                    className="ml-1 px-1 text-[9px] rounded bg-[#333] text-[var(--accent)] hover:bg-[var(--accent)] hover:text-black transition-colors"
                    onClick={(e) => {
                      e.stopPropagation()
                      dispatch({ type: 'INSPECT_PART', part: { productIndex, partIndex: index } })
                    }}
                    title="Inspect shape (or double-click part in 3D)"
                  >
                    View
                  </button>
                </div>
                {isExpanded && (
                  <ShapePointDetail part={part} partIndex={index} product={product} fmt={fmt} />
                )}
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
