import { useState } from 'react'
import type { MozFile, MozProduct, MozWall, MozWallJoint } from '../mozaik/types'
import { formatDim } from '../math/units'
import { usableWallLength, productsOnWall } from '../mozaik/wallPlacement'
import SectionHeader from '../ui/SectionHeader'
import Input from '../ui/Input'
import Button from '../ui/Button'

interface PlaceProductPanelProps {
  standaloneProducts: MozFile[]
  roomProducts: MozProduct[]
  walls: MozWall[]
  joints: MozWallJoint[]
  selectedWall: number | null
  useInches: boolean
  onPlaceProduct: (productIndex: number, wallNumber: number) => void
  onUpdateProductDimension: (productIndex: number, field: 'width' | 'depth' | 'height', value: number, anchor?: 'left' | 'right') => void
  onRemoveProduct: (productIndex: number) => void
}

export default function PlaceProductPanel({
  standaloneProducts, roomProducts, walls, joints, selectedWall, useInches,
  onPlaceProduct, onUpdateProductDimension, onRemoveProduct,
}: PlaceProductPanelProps) {
  const [selectedProductIdx, setSelectedProductIdx] = useState(0)
  const fmt = (mm: number) => formatDim(mm, useInches)

  const wallLen = selectedWall !== null ? usableWallLength(selectedWall, walls, joints) : 0
  const wallProducts = selectedWall !== null ? productsOnWall(roomProducts, selectedWall) : []

  // Find indices in the full roomProducts array for wall-specific products
  const wallProductIndices = selectedWall !== null
    ? roomProducts
        .map((p, i) => ({ product: p, index: i }))
        .filter(({ product }) => parseInt(product.wall.split('_')[0], 10) === selectedWall)
    : []

  return (
    <>
      <SectionHeader>Place Products</SectionHeader>

      {/* Product selector */}
      {standaloneProducts.length > 0 && (
        <div className="space-y-2 mb-3">
          <select
            value={selectedProductIdx}
            onChange={(e) => setSelectedProductIdx(Number(e.target.value))}
            className="w-full text-xs px-3 py-2 bg-gray-800 rounded border border-[var(--accent)] text-blue-400"
          >
            {standaloneProducts.map((mf, i) => (
              <option key={i} value={i}>
                {mf.product.prodName} ({fmt(mf.product.width)} x {fmt(mf.product.depth)})
              </option>
            ))}
          </select>

          {selectedWall !== null ? (
            <Button
              variant="primary"
              onClick={() => onPlaceProduct(selectedProductIdx, selectedWall)}
              className="w-full"
            >
              Add to Wall {selectedWall}
            </Button>
          ) : (
            <p className="text-xs text-[var(--text-secondary)]">Click a wall to select it</p>
          )}

          {selectedWall !== null && (
            <p className="text-xs text-[var(--text-secondary)]">
              Wall {selectedWall}: {fmt(wallLen)} usable | {wallProducts.length} products
            </p>
          )}
        </div>
      )}

      {/* Products on selected wall */}
      {wallProductIndices.length > 0 && (
        <div className="space-y-2">
          <h3 className="text-xs font-semibold text-[var(--text-secondary)]">
            On Wall {selectedWall}
          </h3>
          {wallProductIndices.map(({ product, index }) => (
            <div key={index} className="text-sm bg-[var(--bg-dark)] rounded p-2">
              <div className="flex justify-between items-start">
                <p className="font-medium text-xs">{product.prodName}</p>
                <button
                  onClick={() => onRemoveProduct(index)}
                  className="text-xs text-red-400 hover:text-red-300 px-1"
                >
                  x
                </button>
              </div>
              <p className="text-xs text-[var(--text-secondary)] mb-1">
                X: {fmt(product.x)}
              </p>
              <div className="flex gap-2">
                <label className="flex-1">
                  <span className="text-[10px] text-[var(--text-secondary)]">W</span>
                  <Input
                    type="number"
                    value={Math.round(product.width)}
                    onChange={(e) => onUpdateProductDimension(index, 'width', Number(e.target.value))}
                    className="w-full px-1 py-0.5"
                  />
                </label>
                <label className="flex-1">
                  <span className="text-[10px] text-[var(--text-secondary)]">D</span>
                  <Input
                    type="number"
                    value={Math.round(product.depth)}
                    onChange={(e) => onUpdateProductDimension(index, 'depth', Number(e.target.value))}
                    className="w-full px-1 py-0.5"
                  />
                </label>
                <label className="flex-1">
                  <span className="text-[10px] text-[var(--text-secondary)]">H</span>
                  <Input
                    type="number"
                    value={Math.round(product.height)}
                    onChange={(e) => onUpdateProductDimension(index, 'height', Number(e.target.value))}
                    className="w-full px-1 py-0.5"
                  />
                </label>
              </div>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
