/**
 * IndexedDB persistence for library configuration.
 * Stores active products, variant mappings, and controlled library
 * assignments across sessions.
 */
import type { LibraryConfig } from '../mozaik/types'
import { createDefaultColumns } from '../mozaik/unitTypes'

const DB_NAME = 'singledraw-library-config'
const STORE_NAME = 'config'
const DB_VERSION = 1
const KEY = 'libraryConfig'

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION)
    req.onupgradeneeded = () => {
      req.result.createObjectStore(STORE_NAME)
    }
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

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
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(config, KEY)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

export async function loadLibraryConfig(): Promise<LibraryConfig | null> {
  try {
    const db = await openDb()
    const raw = await new Promise<any>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(KEY)
      req.onsuccess = () => { db.close(); resolve(req.result) }
      req.onerror = () => { db.close(); reject(req.error) }
    })
    if (!raw) return null
    return migrateConfig(raw)
  } catch {
    return null
  }
}
