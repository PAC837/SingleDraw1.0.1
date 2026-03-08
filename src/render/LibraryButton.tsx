/**
 * Toolbar button + dropdown for the product library.
 * Shows loaded standalone products as cards with ProductPreview SVGs.
 * Clicking a card auto-places the product on the currently selected wall.
 */
import { useEffect, useRef } from 'react'
import type { MozFile } from '../mozaik/types'
import { formatDim } from '../math/units'
import ToolbarButton from '../ui/ToolbarButton'
import FloatingPanel from '../ui/FloatingPanel'
import ProductPreview from './ProductPreview'

interface LibraryButtonProps {
  open: boolean
  products: MozFile[]
  useInches: boolean
  selectedWall: number | null
  onToggle: () => void
  onPlaceProduct: (productIndex: number) => void
}

export default function LibraryButton({
  open, products, useInches, selectedWall, onToggle, onPlaceProduct,
}: LibraryButtonProps) {
  const ref = useRef<HTMLDivElement>(null)

  // Finalized card proportions
  const cardW = 125
  const cardH = 265
  const secW = 85
  const gapTop = 6
  const gapBot = 10

  useEffect(() => {
    if (!open) return
    const handler = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onToggle()
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [open, onToggle])

  const c = open ? 'var(--accent)' : '#aaa'
  const fmt = (mm: number) => formatDim(mm, useInches)

  return (
    <div ref={ref} className="relative">
      <ToolbarButton active={open} title="Product library" onClick={onToggle}>
        {/* Bookshelf icon */}
        <svg width="40" height="40" viewBox="0 0 20 20" fill="none">
          <rect x="3" y="3" width="14" height="14" rx="1.5" stroke={c} strokeWidth="1.5" fill="none" />
          <line x1="7" y1="3" x2="7" y2="17" stroke={c} strokeWidth="1" />
          <line x1="11" y1="3" x2="11" y2="17" stroke={c} strokeWidth="1" />
          <line x1="14" y1="5" x2="14" y2="15" stroke={c} strokeWidth="1" />
        </svg>
      </ToolbarButton>

      {open && (
        <FloatingPanel
          className="absolute top-[72px] left-0 overflow-y-auto"
          style={{ minWidth: Math.max(200, cardW + 24), maxHeight: 'calc(100vh - 80px)' }}
        >
          <label className="text-[10px] text-gray-400 uppercase tracking-wider">
            Library ({products.length})
          </label>

          {products.length === 0 && (
            <p className="text-xs text-gray-500">No products loaded</p>
          )}

          {selectedWall === null && products.length > 0 && (
            <p className="text-[10px] text-yellow-500">Select a wall to place</p>
          )}

          {products.map((mf, i) => (
            <div
              key={i}
              className="bg-[var(--bg-dark)] rounded p-2 transition-all"
              style={{
                cursor: selectedWall !== null ? 'pointer' : 'not-allowed',
                opacity: selectedWall !== null ? 1 : 0.5,
              }}
              onClick={() => {
                if (selectedWall !== null) onPlaceProduct(i)
              }}
              onMouseEnter={(e) => {
                if (selectedWall !== null) (e.currentTarget as HTMLElement).style.outline = '1px solid var(--accent)'
              }}
              onMouseLeave={(e) => {
                (e.currentTarget as HTMLElement).style.outline = 'none'
              }}
            >
              <p className="text-xs font-medium text-white mb-1 truncate">
                {mf.product.prodName}
              </p>
              <ProductPreview product={mf.product}
                cardWidth={cardW} cardHeight={cardH}
                sectionWidth={secW} gapTop={gapTop} gapBottom={gapBot} />
              <p className="text-[10px] text-gray-400 mt-1">
                {fmt(mf.product.width)} x {fmt(mf.product.height)} x {fmt(mf.product.depth)}
              </p>
            </div>
          ))}
        </FloatingPanel>
      )}
    </div>
  )
}
