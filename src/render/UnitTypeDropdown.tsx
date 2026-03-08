/**
 * Dropdown content for a single unit type pill button.
 * Shows dynamic product groups as single cards and
 * ungrouped products as individual cards.
 */
import type { MozFile, DynamicProductGroup } from '../mozaik/types'
import { getGroupedFiles } from '../mozaik/unitTypes'
import { resolveVariant } from '../mozaik/variantResolver'
import FloatingPanel from '../ui/FloatingPanel'
import ProductPreview from './ProductPreview'

interface UnitTypeDropdownProps {
  unitTypeId: string
  unitTypeLabel: string
  products: MozFile[]                  // all standalone products
  assignments: Record<string, string[]>
  dynamicGroups: DynamicProductGroup[]
  selectedWall: number | null
  unitHeight: number
  wallSectionHeight: number
  onPlaceProduct: (productIndex: number) => void
  onPlaceGroup: (group: DynamicProductGroup) => void
}

const cardW = 125
const cardH = 265
const secW = 85
const gapTop = 6
const gapBot = 10

export default function UnitTypeDropdown({
  unitTypeId, unitTypeLabel, products, assignments, dynamicGroups,
  selectedWall, unitHeight, wallSectionHeight, onPlaceProduct, onPlaceGroup,
}: UnitTypeDropdownProps) {
  // Groups for this unit type
  const groups = dynamicGroups.filter(g => g.unitTypeId === unitTypeId)
  const groupedFiles = getGroupedFiles(dynamicGroups, unitTypeId)

  // Individual (ungrouped) products assigned to this column
  const individualProducts: { mf: MozFile; index: number }[] = []
  products.forEach((mf, i) => {
    const filename = mf.product.prodName + '.moz'
    const cols = assignments[filename]
    if (!cols || !cols.includes(unitTypeId)) return
    if (groupedFiles.has(filename)) return  // part of a group
    individualProducts.push({ mf, index: i })
  })

  const totalItems = groups.length + individualProducts.length

  return (
    <FloatingPanel
      className="absolute top-0 overflow-y-auto"
      style={{
        left: 'calc(100% + 8px)',
        width: `${cardW * 3 + 8 * 2 + 24}px`,
        maxHeight: 'calc(100vh - 80px)',
      }}
    >
      <label className="text-[10px] text-gray-400 uppercase tracking-wider block mb-2">
        {unitTypeLabel} ({totalItems})
      </label>

      {totalItems === 0 && (
        <p className="text-xs text-gray-500">No products assigned</p>
      )}

      {selectedWall === null && totalItems > 0 && (
        <p className="text-[10px] text-yellow-500 mb-2">Select a wall to place</p>
      )}

      <div className="grid grid-cols-3 gap-2">

      {/* Dynamic group cards */}
      {groups.map(group => {
        // Resolve preview to the variant matching current height setting
        const wm = group.unitTypeId === 'wall'
        const targetH = wm ? wallSectionHeight : unitHeight
        const { filename } = resolveVariant(group, targetH)
        const previewFile = products.find(
          mf => (mf.product.prodName + '.moz') === filename
        )
        return (
          <div
            key={`group-${group.groupName}-${group.rootFolderName}`}
            className="bg-[var(--bg-dark)] rounded p-2 transition-all"
            style={{
              cursor: selectedWall !== null ? 'pointer' : 'not-allowed',
              opacity: selectedWall !== null ? 1 : 0.5,
            }}
            onClick={() => {
              if (selectedWall !== null) onPlaceGroup(group)
            }}
            onMouseEnter={e => {
              if (selectedWall !== null) e.currentTarget.style.outline = '1px solid var(--accent)'
            }}
            onMouseLeave={e => { e.currentTarget.style.outline = 'none' }}
          >
            <p className="text-xs font-medium text-white truncate mb-1">{group.groupName}</p>
            {previewFile && (
              <ProductPreview
                product={previewFile.product}
                cardWidth={cardW} cardHeight={cardH}
                sectionWidth={secW} gapTop={gapTop} gapBottom={gapBot}
              />
            )}
          </div>
        )
      })}

      {/* Individual product cards */}
      {individualProducts.map(({ mf, index }) => (
        <div
          key={index}
          className="bg-[var(--bg-dark)] rounded p-2 transition-all"
          style={{
            cursor: selectedWall !== null ? 'pointer' : 'not-allowed',
            opacity: selectedWall !== null ? 1 : 0.5,
          }}
          onClick={() => {
            if (selectedWall !== null) onPlaceProduct(index)
          }}
          onMouseEnter={e => {
            if (selectedWall !== null) e.currentTarget.style.outline = '1px solid var(--accent)'
          }}
          onMouseLeave={e => { e.currentTarget.style.outline = 'none' }}
        >
          <p className="text-xs font-medium text-white mb-1 truncate">
            {mf.product.prodName}
          </p>
          <ProductPreview
            product={mf.product}
            cardWidth={cardW} cardHeight={cardH}
            sectionWidth={secW} gapTop={gapTop} gapBottom={gapBot}
          />
        </div>
      ))}
      </div>
    </FloatingPanel>
  )
}
