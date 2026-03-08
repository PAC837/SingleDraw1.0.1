/**
 * Admin panel table body — recursive folder tree with 15 unit type
 * checkbox columns per product row, plus expandable parameter display.
 */
import { useCallback, useState } from 'react'
import type { UnitTypeColumn, ProductAssignments, CabProdParm } from '../mozaik/types'
import type { LibraryFolder } from '../mozaik/libraryNdxParser'
import { countProducts } from '../mozaik/libraryNdxParser'

interface AdminProductTableProps {
  folderTree: LibraryFolder[]
  columns: UnitTypeColumn[]
  assignments: ProductAssignments
  fileSet: Set<string>           // available .moz filenames
  expandedFolders: Set<string>
  productParams: Record<string, CabProdParm[]>
  onToggleExpand: (folderId: string) => void
  onToggleAssignment: (filename: string, columnId: string) => void
}

export default function AdminProductTable({
  folderTree, columns, assignments, fileSet, expandedFolders, productParams,
  onToggleExpand, onToggleAssignment,
}: AdminProductTableProps) {
  return (
    <>
      {folderTree.map(folder => (
        <FolderRow
          key={`folder-${folder.id}`}
          folder={folder}
          depth={0}
          columns={columns}
          assignments={assignments}
          fileSet={fileSet}
          expandedFolders={expandedFolders}
          productParams={productParams}
          onToggleExpand={onToggleExpand}
          onToggleAssignment={onToggleAssignment}
        />
      ))}
    </>
  )
}

// ── Folder row ─────────────────────────────────────────────────────

interface FolderRowProps {
  folder: LibraryFolder
  depth: number
  columns: UnitTypeColumn[]
  assignments: ProductAssignments
  fileSet: Set<string>
  expandedFolders: Set<string>
  productParams: Record<string, CabProdParm[]>
  onToggleExpand: (folderId: string) => void
  onToggleAssignment: (filename: string, columnId: string) => void
}

function FolderRow({
  folder, depth, columns, assignments, fileSet, expandedFolders, productParams,
  onToggleExpand, onToggleAssignment,
}: FolderRowProps) {
  const folderId = `folder-${folder.id}`
  const isExpanded = expandedFolders.has(folderId)
  const productCount = countProducts(folder)
  const hasChildren = folder.children.length > 0 || folder.products.length > 0

  return (
    <div>
      {/* Folder header row */}
      <div
        className="flex items-center border-b cursor-pointer transition-colors"
        style={{
          borderColor: '#222',
          paddingLeft: `${12 + depth * 20}px`,
        }}
        onClick={() => hasChildren && onToggleExpand(folderId)}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(170, 255, 0, 0.06)' }}
        onMouseLeave={e => { e.currentTarget.style.background = 'transparent' }}
      >
        <div className="flex-1 min-w-[200px] flex items-center py-2 px-1">
          {hasChildren && (
            <span className="text-[10px] text-[var(--text-secondary)] w-4 mr-1">
              {isExpanded ? '▾' : '▸'}
            </span>
          )}
          <span className={`text-sm font-medium ${depth === 0 ? 'text-white' : 'text-gray-300'}`}>
            {folder.name}
          </span>
          {productCount > 0 && (
            <span
              className="ml-2 inline-flex items-center justify-center px-2 py-0.5 rounded-full text-[10px] font-medium"
              style={{ background: 'rgba(170, 255, 0, 0.1)', color: 'var(--accent)' }}
            >
              {productCount}
            </span>
          )}
        </div>
        {/* Empty cells to align with columns */}
        {columns.map(col => (
          <div key={col.id} className="w-[44px] flex-shrink-0" />
        ))}
      </div>

      {/* Expanded content */}
      {isExpanded && (
        <>
          {folder.children.map(child => (
            <FolderRow
              key={`folder-${child.id}`}
              folder={child}
              depth={depth + 1}
              columns={columns}
              assignments={assignments}
              fileSet={fileSet}
              expandedFolders={expandedFolders}
              productParams={productParams}
              onToggleExpand={onToggleExpand}
              onToggleAssignment={onToggleAssignment}
            />
          ))}
          {folder.products.map(prodName => {
            const filename = prodName + '.moz'
            if (!fileSet.has(filename)) return null
            return (
              <ProductRow
                key={filename}
                prodName={prodName}
                filename={filename}
                depth={depth}
                columns={columns}
                assignments={assignments}
                params={productParams[filename]}
                onToggleAssignment={onToggleAssignment}
              />
            )
          })}
        </>
      )}
    </div>
  )
}

// ── Product row ────────────────────────────────────────────────────

interface ProductRowProps {
  prodName: string
  filename: string
  depth: number
  columns: UnitTypeColumn[]
  assignments: ProductAssignments
  params?: CabProdParm[]
  onToggleAssignment: (filename: string, columnId: string) => void
}

function ProductRow({
  prodName, filename, depth, columns, assignments, params, onToggleAssignment,
}: ProductRowProps) {
  const [showParams, setShowParams] = useState(false)
  const productCols = assignments[filename] ?? []
  const hasAny = productCols.length > 0
  const hasParams = params && params.length > 0

  const handleToggle = useCallback((columnId: string) => {
    onToggleAssignment(filename, columnId)
  }, [filename, onToggleAssignment])

  return (
    <div>
      <div
        className="flex items-center border-b transition-colors"
        style={{
          borderColor: '#1a1a1a',
          paddingLeft: `${32 + depth * 20}px`,
          background: hasAny ? 'rgba(170, 255, 0, 0.02)' : 'transparent',
        }}
        onMouseEnter={e => { e.currentTarget.style.background = 'rgba(170, 255, 0, 0.05)' }}
        onMouseLeave={e => {
          e.currentTarget.style.background = hasAny ? 'rgba(170, 255, 0, 0.02)' : 'transparent'
        }}
      >
        {/* Product name + param toggle */}
        <div className="flex-1 min-w-[200px] py-1.5 px-1 flex items-center gap-1">
          <span className="text-xs text-white">{prodName}</span>
          {hasParams && (
            <button
              onClick={e => { e.stopPropagation(); setShowParams(!showParams) }}
              className="text-[10px] px-1.5 py-0.5 rounded transition-colors"
              style={{
                background: showParams ? 'rgba(170, 255, 0, 0.15)' : 'rgba(170, 255, 0, 0.06)',
                color: 'var(--accent)',
              }}
              title="Show parameters"
            >
              {showParams ? '▾' : '▸'} {params!.length}P
            </button>
          )}
        </div>

        {/* Checkbox cells */}
        {columns.map(col => {
          const isChecked = productCols.includes(col.id)
          return (
            <div
              key={col.id}
              className="w-[44px] flex-shrink-0 flex items-center justify-center py-1.5"
              style={{
                background: isChecked ? 'rgba(170, 255, 0, 0.05)' : 'transparent',
              }}
            >
              <input
                type="checkbox"
                checked={isChecked}
                onChange={() => handleToggle(col.id)}
                className="accent-[var(--accent)] cursor-pointer w-3 h-3"
              />
            </div>
          )
        })}
      </div>

      {/* Parameter sub-rows */}
      {showParams && hasParams && (
        <div
          className="border-b"
          style={{
            borderColor: '#1a1a1a',
            paddingLeft: `${48 + depth * 20}px`,
            background: 'rgba(170, 255, 0, 0.02)',
          }}
        >
          {params!.map(p => (
            <div key={p.name} className="flex items-center gap-3 py-1 px-2">
              <input
                type="checkbox"
                checked={true}
                readOnly
                className="accent-[var(--accent)] cursor-pointer w-3 h-3"
              />
              <span className="text-[10px] text-[var(--accent)] font-medium w-[140px]">{p.name}</span>
              <span className="text-[10px] text-white">
                {p.type === 1 ? (p.value === '0' ? 'Off' : 'On') : p.value}
              </span>
              {p.desc && (
                <span className="text-[10px] text-[var(--text-secondary)] ml-2">{p.desc}</span>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
