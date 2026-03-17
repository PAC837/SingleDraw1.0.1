/**
 * IndexedDB persistence for library configuration.
 * Stores active products, variant mappings, and controlled library
 * assignments across sessions.
 */
import type { LibraryConfig } from '../mozaik/types'
import { createDefaultColumns } from '../mozaik/unitTypes'
import { createStore } from './indexedDbHelper'

const { save, load } = createStore('singledraw-library-config', 'config')
const KEY = 'libraryConfig'

/** Migrate v1 config (flat activeProducts) → v2 (controlled library). */
export function migrateConfig(raw: any): LibraryConfig {
  // Already v2?
  if (raw.version === 2 && raw.unitTypeColumns && raw.productAssignments) {
    return raw as LibraryConfig
  }
  // v1 → v2: existing activeProducts default to 'floor' column
  const v1 = raw as { activeProducts?: string[]; variantMappings?: any[] }
  const assignments: Record<string, string[]> = {}
  for (const filename of v1.activeProducts ?? []) {
    assignments[filename] = ['floor']
  }
  return {
    activeProducts: v1.activeProducts ?? [],
    variantMappings: v1.variantMappings ?? [],
    unitTypeColumns: createDefaultColumns(),
    productAssignments: assignments,
    version: 2,
  }
}

export async function saveLibraryConfig(config: LibraryConfig): Promise<void> {
  await save(KEY, config)
}

export async function loadLibraryConfig(): Promise<LibraryConfig | null> {
  const raw = await load<any>(KEY)
  if (!raw) return null
  return migrateConfig(raw)
}
