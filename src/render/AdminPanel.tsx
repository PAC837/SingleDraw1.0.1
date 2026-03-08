/**
 * Admin panel — Library Manager dashboard.
 * Displays all MOZ products from the library folder organized by
 * the Library.ndx folder hierarchy, with a 15-column unit type
 * checkbox grid (Controlled Library Method).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import type { LibraryFolder } from '../mozaik/libraryNdxParser'
import type { LibraryConfig, ProductAssignments, CabProdParm } from '../mozaik/types'
import { saveLibraryConfig } from '../export/libraryConfigStore'
import { createDefaultColumns, deriveActiveProducts } from '../mozaik/unitTypes'
import { parseMozParams } from '../mozaik/mozParser'
import AdminColumnHeaders from './AdminColumnHeaders'
import AdminProductTable from './AdminProductTable'

interface AdminPanelProps {
  folderTree: LibraryFolder[]
  availableLibraryFiles: string[]
  libraryConfig: LibraryConfig
  productParams: Record<string, CabProdParm[]>  // filename → parameters (loaded products)
  libraryFolder: FileSystemDirectoryHandle | null
  onUpdateConfig: (config: LibraryConfig) => void
  onRemoveProduct: (filename: string) => void
  onLoadProducts: (filenames: string[]) => void
  onClose: () => void
}

export default function AdminPanel({
  folderTree, availableLibraryFiles, libraryConfig, productParams, libraryFolder,
  onUpdateConfig, onRemoveProduct, onLoadProducts, onClose,
}: AdminPanelProps) {
  const [search, setSearch] = useState('')
  const [expandedFolders, setExpandedFolders] = useState<Set<string>>(new Set())

  // Scan all MOZ files for CabProdParms when admin panel opens
  const [scannedParams, setScannedParams] = useState<Record<string, CabProdParm[]>>({})
  useEffect(() => {
    if (!libraryFolder) return
    let cancelled = false
    async function scanParams() {
      const productsDir = await libraryFolder!.getDirectoryHandle('Products').catch(() => null)
      if (!productsDir || cancelled) return
      const map: Record<string, CabProdParm[]> = {}
      for await (const entry of (productsDir as any).values()) {
        if (cancelled) break
        if (entry.kind !== 'file' || !entry.name.endsWith('.moz')) continue
        try {
          const file = await (entry as FileSystemFileHandle).getFile()
          const text = await file.text()
          const params = parseMozParams(text)
          if (params.length > 0) map[entry.name] = params
        } catch { /* skip unreadable files */ }
      }
      if (!cancelled) setScannedParams(map)
    }
    scanParams()
    return () => { cancelled = true }
  }, [libraryFolder])

  // Merge: loaded product params (from standaloneProducts) override scanned results
  const mergedParams = useMemo(
    () => ({ ...scannedParams, ...productParams }),
    [scannedParams, productParams],
  )

  const columns = libraryConfig.unitTypeColumns ?? createDefaultColumns()
  const assignments = libraryConfig.productAssignments ?? {}

  const activeSet = useMemo(() => new Set(libraryConfig.activeProducts), [libraryConfig.activeProducts])
  const fileSet = useMemo(() => new Set(availableLibraryFiles), [availableLibraryFiles])

  // Filter folder tree by search query
  const filteredTree = useMemo(() => {
    if (!search.trim()) return folderTree
    const q = search.toLowerCase()

    function filterFolder(folder: LibraryFolder): LibraryFolder | null {
      const matchedProducts = folder.products.filter(p => p.toLowerCase().includes(q))
      const matchedChildren = folder.children
        .map(c => filterFolder(c))
        .filter((c): c is LibraryFolder => c !== null)
      if (folder.name.toLowerCase().includes(q)) return folder
      if (matchedProducts.length > 0 || matchedChildren.length > 0) {
        return { ...folder, products: matchedProducts, children: matchedChildren }
      }
      return null
    }

    return folderTree
      .map(f => filterFolder(f))
      .filter((f): f is LibraryFolder => f !== null)
  }, [folderTree, search])

  // Toggle a single product's assignment to a column
  const toggleAssignment = useCallback((filename: string, columnId: string) => {
    const current = assignments[filename] ?? []
    const wasChecked = current.includes(columnId)
    const next: ProductAssignments = { ...assignments }

    if (wasChecked) {
      next[filename] = current.filter(c => c !== columnId)
      if (next[filename].length === 0) delete next[filename]
    } else {
      next[filename] = [...current, columnId]
    }

    // Derive activeProducts from assignments
    const newActive = deriveActiveProducts(next)
    const oldActive = new Set(libraryConfig.activeProducts)

    // Load/unload products as needed
    const toLoad = newActive.filter(f => !oldActive.has(f))
    const toRemove = libraryConfig.activeProducts.filter(f => !newActive.includes(f))

    const updated: LibraryConfig = {
      ...libraryConfig,
      activeProducts: newActive,
      productAssignments: next,
      unitTypeColumns: columns,
      version: 2,
    }
    onUpdateConfig(updated)
    saveLibraryConfig(updated)

    for (const f of toRemove) onRemoveProduct(f)
    if (toLoad.length > 0) onLoadProducts(toLoad)
  }, [assignments, columns, libraryConfig, onUpdateConfig, onRemoveProduct, onLoadProducts])

  // Rename a user column
  const renameColumn = useCallback((columnId: string, newLabel: string) => {
    const updatedColumns = columns.map(c =>
      c.id === columnId ? { ...c, label: newLabel } : c
    )
    const updated: LibraryConfig = {
      ...libraryConfig,
      unitTypeColumns: updatedColumns,
      version: 2,
    }
    onUpdateConfig(updated)
    saveLibraryConfig(updated)
  }, [columns, libraryConfig, onUpdateConfig])

  const toggleExpand = useCallback((folderId: string) => {
    setExpandedFolders(prev => {
      const next = new Set(prev)
      if (next.has(folderId)) next.delete(folderId)
      else next.add(folderId)
      return next
    })
  }, [])

  const activeCount = activeSet.size
  const totalCount = availableLibraryFiles.length

  return (
    <div
      className="absolute inset-0 z-30 flex flex-col"
      style={{ background: 'var(--bg-dark)' }}
    >
      {/* Header */}
      <div
        className="flex items-center justify-between px-6 py-4 border-b"
        style={{ borderColor: '#333' }}
      >
        <div className="flex items-center gap-4">
          <h1 className="text-xl font-bold text-white">Library Manager</h1>
          <span className="text-xs text-[var(--text-secondary)]">
            {activeCount} / {totalCount} active
          </span>
        </div>
        <button
          onClick={onClose}
          className="px-3 py-1.5 rounded text-xs font-medium transition-colors"
          style={{ background: '#333', color: '#aaa' }}
          onMouseEnter={e => { e.currentTarget.style.background = '#555' }}
          onMouseLeave={e => { e.currentTarget.style.background = '#333' }}
        >
          Close
        </button>
      </div>

      {/* Search bar */}
      <div className="px-6 py-3 border-b" style={{ borderColor: '#333' }}>
        <input
          type="text"
          value={search}
          onChange={e => setSearch(e.target.value)}
          placeholder="Search products..."
          className="w-full text-sm px-3 py-2 bg-gray-800 border border-gray-600 text-white rounded focus:border-[var(--accent)] focus:outline-none transition-colors"
        />
      </div>

      {/* Column headers + folder tree */}
      <div className="flex-1 overflow-y-auto overflow-x-auto px-6 py-0">
        {folderTree.length === 0 && (
          <div className="text-center py-12 text-[var(--text-secondary)] text-sm">
            No library folder linked. Link a library folder from the sidebar first.
          </div>
        )}

        {folderTree.length > 0 && filteredTree.length === 0 && (
          <div className="text-center py-12 text-[var(--text-secondary)] text-sm">
            {search ? 'No products match your search.' : 'No MOZ files found in library folder.'}
          </div>
        )}

        {filteredTree.length > 0 && (
          <div style={{ minWidth: `${200 + columns.length * 44 + 48}px` }}>
            <AdminColumnHeaders
              columns={columns}
              onRenameColumn={renameColumn}
            />
            <AdminProductTable
              folderTree={filteredTree}
              columns={columns}
              assignments={assignments}
              fileSet={fileSet}
              expandedFolders={expandedFolders}
              productParams={mergedParams}
              onToggleExpand={toggleExpand}
              onToggleAssignment={toggleAssignment}
            />
          </div>
        )}
      </div>

      {/* Footer status bar */}
      <div
        className="flex items-center justify-between px-6 py-3 border-t text-xs text-[var(--text-secondary)]"
        style={{ borderColor: '#333' }}
      >
        <span>
          {filteredTree.length} top-level folder{filteredTree.length !== 1 ? 's' : ''} · {totalCount} product{totalCount !== 1 ? 's' : ''} total
        </span>
        <span>
          Selections auto-saved · Double-click user column headers to rename
        </span>
      </div>
    </div>
  )
}
