/**
 * IndexedDB persistence for settings template configuration.
 * Stores loaded templates, active selection, and Hardware.dat raw text.
 */

import type { RoomSettingsFile } from '../mozaik/settingsTemplateParser'
import { createStore } from './indexedDbHelper'

export interface SettingsConfig {
  settingsFile: RoomSettingsFile | null
  activeTemplateName: string | null
  hardwareCatalogRaw: string | null
}

const { save, load } = createStore('singledraw-settings', 'config')
const KEY = 'settingsConfig'

export async function saveSettingsConfig(config: SettingsConfig): Promise<void> {
  await save(KEY, config)
}

export async function loadSettingsConfig(): Promise<SettingsConfig | null> {
  return await load<SettingsConfig>(KEY)
}
