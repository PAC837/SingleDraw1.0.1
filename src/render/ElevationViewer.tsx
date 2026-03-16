/**
 * Elevation Viewer overlay — full-screen modal for editing DH section internals.
 *
 * Left panel: 2D SVG front elevation (ElevationSVG) with draggable shelves.
 * Right panel: Live 3D preview (ElevationPreview) with orbit controls.
 *
 * Opens on double-click of a product in the 3D scene.
 * Closes on Escape or clicking the close button.
 */

import { useCallback, useEffect, useState } from 'react'
import type { MozProduct } from '../mozaik/types'
import type { AutoEndPanel } from '../mozaik/autoEndPanels'
import { formatDim } from '../math/units'
import { findFixedShelves } from '../mozaik/shelfEditor'
import ElevationSVG, { type PartCategory } from './ElevationSVG'
import ElevationPreview from './ElevationPreview'

interface ElevationViewerProps {
  product: MozProduct
  productIndex: number
  useInches: boolean
  adjacentPanels?: AutoEndPanel[]
  onClose: () => void
  onMoveShelf: (shelfPartIndex: number, newZ: number) => void
  onDeletePart: (partIndex: number) => void
  onDragStart: () => void
  onDragEnd: () => void
}

export default function ElevationViewer({
  product, productIndex, useInches, adjacentPanels,
  onClose, onMoveShelf, onDeletePart, onDragStart, onDragEnd,
}: ElevationViewerProps) {
  const [selectedPart, setSelectedPart] = useState<{ index: number; category: PartCategory } | null>(null)

  // Escape key closes the viewer, Delete key deletes selected part
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        e.stopPropagation()
        onClose()
      }
      if (e.key === 'Delete' && selectedPart) {
        e.preventDefault()
        e.stopPropagation()
        onDeletePart(selectedPart.index)
        setSelectedPart(null)
      }
    }
    window.addEventListener('keydown', handler, true)
    return () => window.removeEventListener('keydown', handler, true)
  }, [onClose, selectedPart, onDeletePart])

  const shelfCount = findFixedShelves(product).length

  // Prevent clicks from reaching the 3D scene behind
  const handleBackdropClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
    onClose()
  }, [onClose])

  const handlePanelClick = useCallback((e: React.MouseEvent) => {
    e.stopPropagation()
  }, [])

  return (
    <div
      className="absolute inset-0 z-40 flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.7)' }}
      onClick={handleBackdropClick}
    >
      <div
        className="flex flex-col rounded-lg overflow-hidden"
        style={{
          width: '90vw',
          maxWidth: 1400,
          height: 'calc(100vh - 80px)',
          background: '#1e1e1e',
          border: '1px solid var(--accent)',
        }}
        onClick={handlePanelClick}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b" style={{ borderColor: '#333' }}>
          <div className="flex items-center gap-3">
            <span
              className="text-xs font-semibold uppercase tracking-wider"
              style={{ color: 'var(--accent)' }}
            >
              Elevation Viewer
            </span>
            <span className="text-sm font-medium text-white">{product.prodName}</span>
            <span className="text-[10px] text-gray-400">
              {shelfCount} fixed {shelfCount === 1 ? 'shelf' : 'shelves'}
            </span>
          </div>

          <button
            onClick={onClose}
            className="flex items-center justify-center rounded transition-colors"
            style={{ width: 28, height: 28 }}
            title="Close (Esc)"
          >
            <svg width={16} height={16} viewBox="0 0 16 16" fill="none">
              <line x1="3" y1="3" x2="13" y2="13" stroke="#888" strokeWidth={1.5} className="hover:stroke-white" />
              <line x1="13" y1="3" x2="3" y2="13" stroke="#888" strokeWidth={1.5} className="hover:stroke-white" />
            </svg>
          </button>
        </div>

        {/* Content: SVG left, 3D right */}
        <div className="flex flex-1 min-h-0">
          {/* Left panel: SVG elevation */}
          <div className="flex-[3] min-w-0 p-2" style={{ borderRight: '1px solid #333' }}>
            <ElevationSVG
              product={product}
              useInches={useInches}
              selectedPart={selectedPart}
              onMoveShelf={onMoveShelf}
              onSelectPart={setSelectedPart}
              onDragStart={onDragStart}
              onDragEnd={onDragEnd}
            />
          </div>

          {/* Right panel: 3D preview */}
          <div className="flex-[2] min-w-0 p-2">
            <ElevationPreview product={product} adjacentPanels={adjacentPanels} />
          </div>
        </div>

        {/* Footer info bar */}
        <div
          className="flex items-center gap-4 px-4 py-1.5 text-[10px] uppercase tracking-wider"
          style={{ borderTop: '1px solid #333', color: '#888' }}
        >
          <span>
            Width: <span className="text-white">{formatDim(product.width, useInches)}</span>
          </span>
          <span>
            Height: <span className="text-white">{formatDim(product.height, useInches)}</span>
          </span>
          <span>
            Depth: <span className="text-white">{formatDim(product.depth, useInches)}</span>
          </span>
          <span className="ml-auto text-gray-500">
            Drag shelf to move &bull; Click rod/shelf to select &bull; Delete to remove
          </span>
        </div>
      </div>
    </div>
  )
}
