/**
 * Controlled Library Method — unit type definitions, suffix extraction,
 * and dynamic product group computation.
 */
import type { UnitTypeColumn, ProductAssignments, DynamicProductGroup } from './types'
import type { LibraryFolder } from './libraryNdxParser'
import { collectAllProducts } from './libraryNdxParser'

// ── Built-in unit type IDs ─────────────────────────────────────────

export const BUILTIN_UNIT_TYPE_IDS = [
  'floor', 'wall', 'hutch', 'island', 'upper-stack',
  'bench', 'desk', 'sub-assemblies', 'custom', 'corners',
] as const

export const BUILTIN_LABELS: Record<string, string> = {
  'floor': 'Floor',
  'wall': 'Wall',
  'hutch': 'Hutch',
  'island': 'Island',
  'upper-stack': 'Upper Stack',
  'bench': 'Bench',
  'desk': 'Desk',
  'sub-assemblies': 'Sub Assemblies',
  'custom': 'Custom',
  'corners': 'Corners',
}

/** Short abbreviations for column headers in the admin grid. */
export const COLUMN_ABBREVS: Record<string, string> = {
  'floor': 'Flr',
  'wall': 'Wl',
  'hutch': 'Htch',
  'island': 'Isl',
  'upper-stack': 'Uppr',
  'bench': 'Bnch',
  'desk': 'Dsk',
  'sub-assemblies': 'Sub',
  'custom': 'Cstm',
  'corners': 'Cnr',
}

/** Create the default 15 columns (10 built-in + 5 user). */
export function createDefaultColumns(): UnitTypeColumn[] {
  const builtins: UnitTypeColumn[] = BUILTIN_UNIT_TYPE_IDS.map(id => ({
    id,
    label: BUILTIN_LABELS[id],
    isBuiltin: true,
  }))
  const userCols: UnitTypeColumn[] = Array.from({ length: 5 }, (_, i) => ({
    id: `user-${i + 1}`,
    label: `Type ${i + 1}`,
    isBuiltin: false,
  }))
  return [...builtins, ...userCols]
}

// ── Height resolver ────────────────────────────────────────────────

/**
 * Map a unit type column ID to the correct section height.
 * Used during product placement and variant resolution.
 */
export function heightForUnitType(
  unitTypeId: string,
  heights: { unitHeight: number; wallSectionHeight: number; hutchSectionHeight: number; baseCabHeight: number },
): number {
  switch (unitTypeId) {
    case 'wall': return heights.wallSectionHeight
    case 'hutch':
    case 'upper-stack': return heights.hutchSectionHeight
    default: return heights.unitHeight
  }
}

// ── Suffix extraction ──────────────────────────────────────────────

/**
 * Extract the "suffix" from a product name by stripping the leading
 * numeric height prefix. Only the first number group is stripped.
 *
 *   "96 DH"       → "DH"
 *   "108 DH"      → "DH"
 *   "96 TH 1S"    → "TH 1S"
 *   "87 4S 6DR …" → "4S 6DR …"
 *   "FS 96"       → "FS 96" (no leading digits → full name)
 */
export function extractSuffix(prodName: string): string {
  const match = prodName.match(/^(\d+)\s+(.+)$/)
  return match ? match[2].trim() : prodName
}

/**
 * Extract the height prefix (as inches) from a product name.
 * Returns null if no leading number found.
 */
export function extractHeightPrefix(prodName: string): number | null {
  const match = prodName.match(/^(\d+)\s/)
  return match ? parseInt(match[1], 10) : null
}

// ── Root folder lookup ─────────────────────────────────────────────

/** Find the root folder (parentId=0) that contains a product name. */
export function findRootFolder(
  prodName: string,
  folderTree: LibraryFolder[],
): string | null {
  for (const root of folderTree) {
    const allProds = collectAllProducts(root)
    if (allProds.includes(prodName)) return root.name
  }
  return null
}

// ── Dynamic group computation ──────────────────────────────────────

/**
 * Compute dynamic product groups from assignments + folder tree.
 *
 * Grouping rules:
 * 1. Products checked in the SAME unit type column
 * 2. Products in the SAME root folder (parentId=0 in Library.ndx)
 * 3. Products with MATCHING suffix (after stripping height prefix)
 * 4. At least 2 products must match to form a group
 */
export function computeDynamicGroups(
  assignments: ProductAssignments,
  folderTree: LibraryFolder[],
): DynamicProductGroup[] {
  const groups: DynamicProductGroup[] = []

  // Invert: for each column, collect all assigned products
  const columnProducts = new Map<string, string[]>()
  for (const [filename, columns] of Object.entries(assignments)) {
    if (!columns || columns.length === 0) continue
    for (const col of columns) {
      if (!columnProducts.has(col)) columnProducts.set(col, [])
      columnProducts.get(col)!.push(filename)
    }
  }

  for (const [unitTypeId, filenames] of columnProducts) {
    // Sub-group by (rootFolder, suffix)
    const buckets = new Map<string, {
      files: string[]
      heightMap: Record<number, string>
    }>()

    for (const filename of filenames) {
      const prodName = filename.replace(/\.moz$/i, '')
      const rootFolder = findRootFolder(prodName, folderTree) ?? 'Unknown'
      const suffix = extractSuffix(prodName)
      const heightInches = extractHeightPrefix(prodName)
      const key = `${rootFolder}::${suffix}`

      if (!buckets.has(key)) {
        buckets.set(key, { files: [], heightMap: {} })
      }
      const bucket = buckets.get(key)!
      bucket.files.push(filename)
      if (heightInches !== null) {
        bucket.heightMap[heightInches] = filename
      }
    }

    // Only buckets with 2+ members become groups
    for (const [key, bucket] of buckets) {
      if (bucket.files.length < 2) {
        console.log(`[GROUPS] Singleton "${key}" in ${unitTypeId} (${bucket.files[0]}) — not grouped`)
        continue
      }
      const [rootFolderName, ...suffixParts] = key.split('::')
      const suffix = suffixParts.join('::') // handle any :: in suffix (unlikely)
      groups.push({
        groupName: suffix,
        unitTypeId,
        rootFolderName,
        memberFiles: bucket.files,
        heightMap: bucket.heightMap,
      })
      console.log(`[GROUPS] Group "${suffix}" in ${unitTypeId}: ${bucket.files.length} members`, bucket.heightMap)
    }
  }

  if (groups.length > 0) {
    console.log(`[GROUPS] ${groups.length} dynamic group(s) formed`)
  }
  return groups
}

/**
 * Derive the active products list from assignments.
 * A product is active if assigned to at least one column.
 */
export function deriveActiveProducts(assignments: ProductAssignments): string[] {
  return Object.entries(assignments)
    .filter(([, cols]) => cols && cols.length > 0)
    .map(([filename]) => filename)
}

/**
 * Get the set of products that belong to a dynamic group for a given unit type.
 * Returns a Set of MOZ filenames that are grouped (not shown individually).
 */
export function getGroupedFiles(
  groups: DynamicProductGroup[],
  unitTypeId: string,
): Set<string> {
  const result = new Set<string>()
  for (const g of groups) {
    if (g.unitTypeId === unitTypeId) {
      for (const f of g.memberFiles) result.add(f)
    }
  }
  return result
}
