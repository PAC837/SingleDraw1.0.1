/**
 * Elongated pill buttons for each active unit type.
 * Each pill opens a dropdown showing product cards for that unit type.
 */
import { useEffect, useState } from 'react'
import type { MozFile, DynamicProductGroup, UnitTypeColumn, ProductAssignments } from '../mozaik/types'
import UnitTypeDropdown from './UnitTypeDropdown'

interface UnitTypePillsProps {
  columns: UnitTypeColumn[]
  assignments: ProductAssignments
  dynamicGroups: DynamicProductGroup[]
  products: MozFile[]
  selectedWall: number | null
  unitHeight: number
  wallSectionHeight: number
  onPlaceProduct: (productIndex: number) => void
  onPlaceGroup: (group: DynamicProductGroup) => void
}

export default function UnitTypePills({
  columns, assignments, dynamicGroups, products,
  selectedWall, unitHeight, wallSectionHeight, onPlaceProduct, onPlaceGroup,
}: UnitTypePillsProps) {
  const [openId, setOpenId] = useState<string | null>(null)

  // Close only when clicking the 3D canvas background (onPointerMissed)
  useEffect(() => {
    if (!openId) return
    const handler = () => setOpenId(null)
    window.addEventListener('canvas-bg-click', handler)
    return () => window.removeEventListener('canvas-bg-click', handler)
  }, [openId])

  // Only show pills for columns that have at least one assigned product
  const activePills = columns.filter(col => {
    return Object.values(assignments).some(cols => cols?.includes(col.id))
  })

  if (activePills.length === 0) return null

  return (
    <div className="flex flex-col gap-1.5">
      {activePills.map(col => {
        const isOpen = openId === col.id
        return (
          <div key={col.id} className="relative">
            <button
              onClick={() => setOpenId(isOpen ? null : col.id)}
              title={col.label}
              className="h-9 px-4 rounded-full flex items-center justify-center transition-all"
              style={{
                background: isOpen ? 'var(--bg-panel)' : '#1e1e1e',
                border: `2px solid ${isOpen ? 'var(--accent)' : '#555'}`,
                color: isOpen ? 'var(--accent)' : '#aaa',
              }}
            >
              <span className="text-xs font-medium whitespace-nowrap">{col.label}</span>
            </button>

            {isOpen && (
              <UnitTypeDropdown
                unitTypeId={col.id}
                unitTypeLabel={col.label}
                products={products}
                assignments={assignments}
                dynamicGroups={dynamicGroups}
                selectedWall={selectedWall}
                unitHeight={unitHeight}
                wallSectionHeight={wallSectionHeight}
                onPlaceProduct={onPlaceProduct}
                onPlaceGroup={onPlaceGroup}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
