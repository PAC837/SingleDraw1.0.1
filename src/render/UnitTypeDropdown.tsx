/**
 * Dropdown content for a single unit type pill button.
 * Shows dynamic product groups as single cards and
 * ungrouped products as individual cards.
 * Cards are dragged onto walls to place products.
 */
import type { MozFile, MozProduct, DynamicProductGroup } from '../mozaik/types'
import { getGroupedFiles, heightForUnitType } from '../mozaik/unitTypes'
import { resolveVariant } from '../mozaik/variantResolver'
import FloatingPanel from '../ui/FloatingPanel'
import ProductPreview from './ProductPreview'
import SpinningProductCard from './SpinningProductCard'

interface UnitTypeDropdownProps {
  unitTypeId: string
  unitTypeLabel: string
  products: MozFile[]
  assignments: Record<string, string[]>
  dynamicGroups: DynamicProductGroup[]
  unitHeight: number
  wallSectionHeight: number
  hutchSectionHeight: number
  baseCabHeight: number
  spinning3DCards?: boolean
  onStartDrag: (product: MozProduct, productIndex: number, group?: DynamicProductGroup, unitTypeId?: string) => void
}

const cardW = 125
const cardH = 265
const secW = 85
const gapTop = 6
const gapBot = 10

export default function UnitTypeDropdown({
  unitTypeId, unitTypeLabel, products, assignments, dynamicGroups,
  unitHeight, wallSectionHeight, hutchSectionHeight, baseCabHeight, spinning3DCards = false, onStartDrag,
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
    if (groupedFiles.has(filename)) return
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

      <div className="grid grid-cols-3 gap-2">

      {/* Dynamic group cards */}
      {groups.map(group => {
        const targetH = heightForUnitType(group.unitTypeId, { unitHeight, wallSectionHeight, hutchSectionHeight, baseCabHeight })
        const { filename } = resolveVariant(group, targetH)
        const previewFile = products.find(
          mf => (mf.product.prodName + '.moz') === filename
        )
        const previewIdx = previewFile ? products.indexOf(previewFile) : -1
        return (
          <div
            key={`group-${group.groupName}-${group.rootFolderName}`}
            className="bg-[var(--bg-dark)] rounded p-2 transition-all cursor-grab active:cursor-grabbing"
            onPointerDown={() => {
              if (previewFile && previewIdx >= 0) onStartDrag(previewFile.product, previewIdx, group, unitTypeId)
            }}
            onMouseEnter={e => { e.currentTarget.style.outline = '1px solid var(--accent)' }}
            onMouseLeave={e => { e.currentTarget.style.outline = 'none' }}
          >
            <p className="text-xs font-medium text-white truncate mb-1">{group.groupName}</p>
            {previewFile && (
              spinning3DCards ? (
                <SpinningProductCard product={previewFile.product} width={cardW - 8} height={cardH - 24} />
              ) : (
                <ProductPreview
                  product={previewFile.product}
                  cardWidth={cardW} cardHeight={cardH}
                  sectionWidth={secW} gapTop={gapTop} gapBottom={gapBot}
                />
              )
            )}
          </div>
        )
      })}

      {/* Individual product cards */}
      {individualProducts.map(({ mf, index }) => (
        <div
          key={index}
          className="bg-[var(--bg-dark)] rounded p-2 transition-all cursor-grab active:cursor-grabbing"
          onPointerDown={() => onStartDrag(mf.product, index, undefined, unitTypeId)}
          onMouseEnter={e => { e.currentTarget.style.outline = '1px solid var(--accent)' }}
          onMouseLeave={e => { e.currentTarget.style.outline = 'none' }}
        >
          <p className="text-xs font-medium text-white mb-1 truncate">
            {mf.product.prodName}
          </p>
          {spinning3DCards ? (
            <SpinningProductCard product={mf.product} width={cardW - 8} height={cardH - 24} />
          ) : (
            <ProductPreview
              product={mf.product}
              cardWidth={cardW} cardHeight={cardH}
              sectionWidth={secW} gapTop={gapTop} gapBottom={gapBot}
            />
          )}
        </div>
      ))}
      </div>
    </FloatingPanel>
  )
}
