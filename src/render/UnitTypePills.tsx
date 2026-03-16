/**
 * Elongated pill buttons for each active unit type.
 * Each pill opens a dropdown showing product cards for that unit type.
 */
import { useEffect, useState } from 'react'
import type { MozFile, MozProduct, DynamicProductGroup, UnitTypeColumn, ProductAssignments } from '../mozaik/types'
import UnitTypeDropdown from './UnitTypeDropdown'

interface UnitTypePillsProps {
  columns: UnitTypeColumn[]
  assignments: ProductAssignments
  dynamicGroups: DynamicProductGroup[]
  products: MozFile[]
  unitHeight: number
  wallSectionHeight: number
  hutchSectionHeight: number
  baseCabHeight: number
  spinning3DCards?: boolean
  onStartDrag: (product: MozProduct, productIndex: number, group?: DynamicProductGroup, unitTypeId?: string) => void
}

export default function UnitTypePills({
  columns, assignments, dynamicGroups, products,
  unitHeight, wallSectionHeight, hutchSectionHeight, baseCabHeight, spinning3DCards = false, onStartDrag,
}: UnitTypePillsProps) {
  const [openId, setOpenId] = useState<string | null>(null)

  // Close when clicking 3D canvas background or when another panel opens
  useEffect(() => {
    if (!openId) return
    const handler = () => setOpenId(null)
    window.addEventListener('canvas-bg-click', handler)
    return () => window.removeEventListener('canvas-bg-click', handler)
  }, [openId])

  useEffect(() => {
    const handler = () => setOpenId(null)
    window.addEventListener('panel-will-open', handler)
    return () => window.removeEventListener('panel-will-open', handler)
  }, [])

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
              onClick={() => {
                if (!isOpen) window.dispatchEvent(new Event('panel-will-open'))
                setOpenId(isOpen ? null : col.id)
              }}
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
                unitHeight={unitHeight}
                wallSectionHeight={wallSectionHeight}
                hutchSectionHeight={hutchSectionHeight}
                baseCabHeight={baseCabHeight}
                spinning3DCards={spinning3DCards}
                onStartDrag={onStartDrag}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
