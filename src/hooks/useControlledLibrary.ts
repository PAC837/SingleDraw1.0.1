/**
 * Hook for Controlled Library Method state:
 * folder tree, dynamic groups, unit type columns, and group placement.
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAppState } from '../store'
import { parseLibraryNdx } from '../mozaik/libraryNdxParser'
import type { LibraryFolder } from '../mozaik/libraryNdxParser'
import type { DynamicProductGroup } from '../mozaik/types'
import { computeDynamicGroups, createDefaultColumns } from '../mozaik/unitTypes'
import { resolveVariant } from '../mozaik/variantResolver'

export function useControlledLibrary(
  handlePlaceProduct: (productIndex: number, wallNumber: number) => void,
) {
  const state = useAppState()
  const [folderTree, setFolderTree] = useState<LibraryFolder[]>([])

  // Parse Library.ndx folder tree when library folder is available
  useEffect(() => {
    if (!state.libraryFolder || state.availableLibraryFiles.length === 0) {
      setFolderTree([])
      return
    }
    let cancelled = false
    async function loadTree() {
      let tree: LibraryFolder[] = []
      try {
        const ndxHandle = await state.libraryFolder!.getFileHandle('Library.ndx')
        const ndxFile = await ndxHandle.getFile()
        const ndxText = await ndxFile.text()
        tree = parseLibraryNdx(ndxText)
      } catch { /* no Library.ndx — use flat list */ }
      if (tree.length === 0) {
        tree = [{
          name: 'All Products', id: -1, parentId: 0, children: [],
          products: state.availableLibraryFiles.map(f => f.replace(/\.moz$/i, '')),
        }]
      }
      if (!cancelled) setFolderTree(tree)
    }
    loadTree()
    return () => { cancelled = true }
  }, [state.libraryFolder, state.availableLibraryFiles])

  const assignments = state.libraryConfig.productAssignments ?? {}
  const columns = state.libraryConfig.unitTypeColumns ?? createDefaultColumns()

  const dynamicGroups = useMemo<DynamicProductGroup[]>(
    () => computeDynamicGroups(assignments, folderTree),
    [assignments, folderTree],
  )

  // Resolve variant and place a dynamic product group
  const handlePlaceGroup = useCallback(
    (group: DynamicProductGroup) => {
      if (!state.room || state.selectedWall === null) return
      const wm = group.unitTypeId === 'wall'
      const targetHeight = wm ? state.wallSectionHeight : state.unitHeight
      const { filename } = resolveVariant(group, targetHeight)
      const baseName = filename.replace(/\.moz$/i, '')
      const idx = state.standaloneProducts.findIndex(mf => mf.product.prodName === baseName)
      if (idx >= 0) {
        handlePlaceProduct(idx, state.selectedWall)
      } else {
        console.warn(`[LIBRARY] Variant "${filename}" not loaded — check it in the admin panel`)
      }
    },
    [state.room, state.selectedWall, state.wallSectionHeight, state.unitHeight, state.standaloneProducts, handlePlaceProduct],
  )

  return { folderTree, columns, assignments, dynamicGroups, handlePlaceGroup }
}
