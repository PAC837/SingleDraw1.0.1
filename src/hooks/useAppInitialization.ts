/**
 * App initialization effects — panel-close listener, library config, settings config, auto-load products.
 */
import { useEffect } from 'react'
import { useAppState, useAppDispatch } from '../store'
import { loadLibraryConfig } from '../export/libraryConfigStore'
import { loadSettingsConfig } from '../export/settingsConfigStore'
import { parseHardwareDat } from '../mozaik/hardwareDatParser'

export function useAppInitialization(
  setAdvancedOpen: (v: boolean) => void,
  loadFromLibrary: (filenames: string[]) => void,
) {
  const state = useAppState()
  const dispatch = useAppDispatch()

  // Close all panels when any panel fires 'panel-will-open'
  useEffect(() => {
    const handler = () => {
      dispatch({ type: 'CLOSE_PANELS' })
      setAdvancedOpen(false)
    }
    window.addEventListener('panel-will-open', handler)
    return () => window.removeEventListener('panel-will-open', handler)
  }, [dispatch, setAdvancedOpen])

  // Load persisted library config on startup
  useEffect(() => {
    loadLibraryConfig().then(config => {
      if (config) dispatch({ type: 'SET_LIBRARY_CONFIG', config })
    })
  }, [dispatch])

  // Load persisted settings config (templates + hardware catalog) on startup
  useEffect(() => {
    loadSettingsConfig().then(config => {
      if (!config) return
      if (config.settingsFile) {
        dispatch({ type: 'LOAD_SETTINGS_FILE', file: config.settingsFile })
        if (config.activeTemplateName) {
          dispatch({ type: 'SET_ACTIVE_TEMPLATE', name: config.activeTemplateName })
        }
      }
      if (config.hardwareCatalogRaw) {
        try {
          const catalog = parseHardwareDat(config.hardwareCatalogRaw)
          dispatch({ type: 'SET_HARDWARE_CATALOG', catalog })
        } catch (e) {
          console.warn('[SETTINGS] Failed to parse persisted Hardware.dat:', e)
        }
      }
    })
  }, [dispatch])

  // Auto-load active products from persisted config when library folder is ready
  useEffect(() => {
    if (state.libraryFolder && state.libraryConfig.activeProducts.length > 0) {
      loadFromLibrary(state.libraryConfig.activeProducts)
    }
  }, [state.libraryFolder, state.libraryConfig.activeProducts, loadFromLibrary])
}
