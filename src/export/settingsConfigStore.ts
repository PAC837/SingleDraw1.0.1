/**
 * IndexedDB persistence for settings template configuration.
 * Stores loaded templates, active selection, and Hardware.dat raw text.
 */

import type { RoomSettingsFile } from '../mozaik/settingsTemplateParser'

export interface SettingsConfig {
  settingsFile: RoomSettingsFile | null
  activeTemplateName: string | null
  hardwareCatalogRaw: string | null
}

const DB_NAME = 'singledraw-settings'
const STORE_NAME = 'config'
const DB_VERSION = 1
const KEY = 'settingsConfig'

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

export async function saveSettingsConfig(config: SettingsConfig): Promise<void> {
  const db = await openDb()
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, 'readwrite')
    tx.objectStore(STORE_NAME).put(config, KEY)
    tx.oncomplete = () => { db.close(); resolve() }
    tx.onerror = () => { db.close(); reject(tx.error) }
  })
}

export async function loadSettingsConfig(): Promise<SettingsConfig | null> {
  try {
    const db = await openDb()
    const raw = await new Promise<any>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, 'readonly')
      const req = tx.objectStore(STORE_NAME).get(KEY)
      req.onsuccess = () => { db.close(); resolve(req.result) }
      req.onerror = () => { db.close(); reject(req.error) }
    })
    if (!raw) return null
    return raw as SettingsConfig
  } catch {
    return null
  }
}
