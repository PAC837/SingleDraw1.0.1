/**
 * Toolbar button + dropdown for the product library.
 * Shows loaded standalone products as cards with ProductPreview SVGs.
 * Clicking a card auto-places the product on the currently selected wall.
 */
import { useEffect, useRef } from 'react'
import type { MozFile } from '../mozaik/types'
import { formatDim } from '../math/units'
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
      <button
        onClick={onToggle}
        title="Product library"
        className="w-10 h-10 rounded-full flex items-center justify-center transition-all"
        style={{
          background: open ? 'var(--bg-panel)' : '#1e1e1e',
          border: `2px solid ${open ? 'var(--accent)' : '#555'}`,
        }}
      >
        {/* Bookshelf icon */}
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
          <rect x="3" y="3" width="14" height="14" rx="1.5" stroke={c} strokeWidth="1.5" fill="none" />
          <line x1="7" y1="3" x2="7" y2="17" stroke={c} strokeWidth="1" />
          <line x1="11" y1="3" x2="11" y2="17" stroke={c} strokeWidth="1" />
          <line x1="14" y1="5" x2="14" y2="15" stroke={c} strokeWidth="1" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute top-12 left-0 z-20 rounded-lg p-3 space-y-2 overflow-y-auto"
          style={{
            background: '#1e1e1e',
            border: '1px solid var(--accent)',
            minWidth: 200,
            maxHeight: 'calc(100vh - 80px)',
          }}
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
              <ProductPreview product={mf.product} />
              <p className="text-[10px] text-gray-400 mt-1">
                {fmt(mf.product.width)} x {fmt(mf.product.height)} x {fmt(mf.product.depth)}
              </p>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
