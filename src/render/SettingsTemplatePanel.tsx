/**
 * Settings Template panel — tab within the Admin Panel.
 * Loads RoomSettingsTemplates.dat and Hardware.dat, shows template selector
 * and hardware dropdowns (starting with DrawerGuide + DrawerBox).
 */

import { useState, useMemo, useCallback } from 'react'
import { useAppState, useAppDispatch } from '../store'
import { parseSettingsFile } from '../mozaik/settingsTemplateParser'
import { parseHardwareDat } from '../mozaik/hardwareDatParser'
import { saveSettingsConfig } from '../export/settingsConfigStore'
import type { RoomSetHardware } from '../mozaik/settingsTemplateParser'

/** Pick a file using the File System Access API. */
async function pickFile(description: string, extensions: string[]): Promise<string | null> {
  try {
    const [handle] = await (window as any).showOpenFilePicker({
      types: [{ description, accept: { 'application/octet-stream': extensions } }],
    })
    const file = await handle.getFile()
    return await file.text()
  } catch {
    return null // user cancelled
  }
}

export default function SettingsTemplatePanel() {
  const state = useAppState()
  const dispatch = useAppDispatch()
  const [hardwareRaw, setHardwareRaw] = useState<string | null>(null)

  const settingsFile = state.settingsFile
  const catalog = state.hardwareCatalog
  const activeTemplate = state.activeTemplateName
  const roomSettings = state.room?.roomSettings

  // Collect unique DrawerBox values from all loaded templates
  const drawerBoxOptions = useMemo(() => {
    if (!settingsFile) return []
    const set = new Set<string>()
    for (const t of settingsFile.templates) {
      if (t.hardware.drawerBox) set.add(t.hardware.drawerBox)
    }
    return Array.from(set).sort()
  }, [settingsFile])

  const handleLoadSettings = useCallback(async () => {
    const text = await pickFile('Mozaik Settings Templates', ['.dat', '.mzkrst'])
    if (!text) return
    try {
      const file = parseSettingsFile(text)
      dispatch({ type: 'LOAD_SETTINGS_FILE', file })
      // Auto-select first template if none active
      if (!activeTemplate && file.templates.length > 0) {
        dispatch({ type: 'SET_ACTIVE_TEMPLATE', name: file.templates[0].name })
      }
      // Persist
      saveSettingsConfig({
        settingsFile: file,
        activeTemplateName: activeTemplate ?? file.templates[0]?.name ?? null,
        hardwareCatalogRaw: hardwareRaw,
      })
    } catch (e) {
      console.error('[SETTINGS] Failed to parse settings file:', e)
      alert(`Failed to parse settings file: ${(e as Error).message}`)
    }
  }, [dispatch, activeTemplate, hardwareRaw])

  const handleLoadHardware = useCallback(async () => {
    const text = await pickFile('Mozaik Hardware', ['.dat'])
    if (!text) return
    try {
      const cat = parseHardwareDat(text)
      dispatch({ type: 'SET_HARDWARE_CATALOG', catalog: cat })
      setHardwareRaw(text)
      // Persist
      saveSettingsConfig({
        settingsFile: settingsFile,
        activeTemplateName: activeTemplate,
        hardwareCatalogRaw: text,
      })
    } catch (e) {
      console.error('[HARDWARE] Failed to parse hardware file:', e)
      alert(`Failed to parse hardware file: ${(e as Error).message}`)
    }
  }, [dispatch, settingsFile, activeTemplate])

  const handleSelectTemplate = useCallback((name: string) => {
    dispatch({ type: 'SET_ACTIVE_TEMPLATE', name })
    saveSettingsConfig({
      settingsFile: settingsFile,
      activeTemplateName: name,
      hardwareCatalogRaw: hardwareRaw,
    })
  }, [dispatch, settingsFile, hardwareRaw])

  const handleHardwareChange = useCallback((field: keyof RoomSetHardware, value: string) => {
    dispatch({ type: 'UPDATE_ROOM_HARDWARE', field, value })
    // Persist after change
    saveSettingsConfig({
      settingsFile: settingsFile,
      activeTemplateName: activeTemplate,
      hardwareCatalogRaw: hardwareRaw,
    })
  }, [dispatch, settingsFile, activeTemplate, hardwareRaw])

  return (
    <div className="p-4 space-y-6 overflow-y-auto" style={{ maxHeight: 'calc(100vh - 140px)' }}>
      {/* Fastener Holes Section */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)] border-b border-[var(--accent)] pb-1 mb-3">
          Fasteners
        </h3>
        <p className="text-[10px] text-[#666] mb-2">Synthetic fastener holes on Toe / Bottom / Top parts (not exported)</p>
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <label className="text-xs text-[#999] w-28 shrink-0">Large Hole (mm)</label>
            <input
              type="number"
              value={state.fastenerLargeDia}
              onChange={e => dispatch({ type: 'SET_FASTENER_LARGE_DIA', value: parseFloat(e.target.value) || 0 })}
              min={0}
              step={1}
              className="text-xs px-2 py-1 bg-gray-800 border border-[var(--accent)] text-white rounded w-20"
            />
            <span className="text-[10px] text-[#666]">0 = hidden</span>
          </div>
          <div className="flex items-center gap-3">
            <label className="text-xs text-[#999] w-28 shrink-0">Small Hole (mm)</label>
            <input
              type="number"
              value={state.fastenerSmallDia}
              onChange={e => dispatch({ type: 'SET_FASTENER_SMALL_DIA', value: parseFloat(e.target.value) || 0 })}
              min={0}
              step={1}
              className="text-xs px-2 py-1 bg-gray-800 border border-[var(--accent)] text-white rounded w-20"
            />
            <span className="text-[10px] text-[#666]">0 = hidden</span>
          </div>
        </div>
      </section>

      {/* Data Files Section */}
      <section>
        <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)] border-b border-[var(--accent)] pb-1 mb-3">
          Data Files
        </h3>
        <div className="space-y-2">
          <div className="flex items-center gap-3">
            <button onClick={handleLoadSettings}
              className="bg-gray-800 text-white border border-gray-600 px-3 py-1.5 rounded hover:bg-gray-700 transition-colors text-xs whitespace-nowrap">
              Load Templates
            </button>
            <span className="text-xs text-[#999]">
              {settingsFile
                ? `${settingsFile.templates.length} templates loaded`
                : 'No RoomSettingsTemplates.dat loaded'}
            </span>
          </div>
          <div className="flex items-center gap-3">
            <button onClick={handleLoadHardware}
              className="bg-gray-800 text-white border border-gray-600 px-3 py-1.5 rounded hover:bg-gray-700 transition-colors text-xs whitespace-nowrap">
              Load Hardware
            </button>
            <span className="text-xs text-[#999]">
              {catalog
                ? `${catalog.guides.length} guides, ${catalog.pulls.length} pulls, ${catalog.hinges.length} hinges`
                : 'No Hardware.dat loaded'}
            </span>
          </div>
        </div>
      </section>

      {/* Template Selector */}
      {settingsFile && settingsFile.templates.length > 0 && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)] border-b border-[var(--accent)] pb-1 mb-3">
            Active Template
          </h3>
          <select
            value={activeTemplate ?? ''}
            onChange={e => handleSelectTemplate(e.target.value)}
            className="w-full text-xs px-2 py-1.5 bg-gray-800 border border-[var(--accent)] text-white rounded"
          >
            {settingsFile.templates.map(t => (
              <option key={t.name} value={t.name}>{t.name}</option>
            ))}
          </select>
        </section>
      )}

      {/* Drawer Hardware Section */}
      {roomSettings && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)] border-b border-[var(--accent)] pb-1 mb-3">
            Drawer Hardware
          </h3>
          <div className="space-y-3">
            {/* Drawer Guide */}
            <div>
              <label className="text-xs text-[#999] block mb-1">Drawer Guide</label>
              {catalog ? (
                <select
                  value={roomSettings.hardware.drawerGuide}
                  onChange={e => handleHardwareChange('drawerGuide', e.target.value)}
                  className="w-full text-xs px-2 py-1.5 bg-gray-800 border border-[var(--accent)] text-white rounded"
                >
                  {/* Include current value in case it's not in Hardware.dat */}
                  {!catalog.guides.some(g => g.name === roomSettings.hardware.drawerGuide) && (
                    <option value={roomSettings.hardware.drawerGuide}>
                      {roomSettings.hardware.drawerGuide} (current)
                    </option>
                  )}
                  {catalog.guides.map(g => (
                    <option key={g.name} value={g.name}>{g.name}</option>
                  ))}
                </select>
              ) : (
                <div className="text-xs px-2 py-1.5 bg-gray-800 border border-[#333] text-white rounded">
                  {roomSettings.hardware.drawerGuide || '(none)'}
                </div>
              )}
            </div>

            {/* Drawer Box */}
            <div>
              <label className="text-xs text-[#999] block mb-1">Drawer Box</label>
              {drawerBoxOptions.length > 0 ? (
                <select
                  value={roomSettings.hardware.drawerBox}
                  onChange={e => handleHardwareChange('drawerBox', e.target.value)}
                  className="w-full text-xs px-2 py-1.5 bg-gray-800 border border-[var(--accent)] text-white rounded"
                >
                  {!drawerBoxOptions.includes(roomSettings.hardware.drawerBox) && (
                    <option value={roomSettings.hardware.drawerBox}>
                      {roomSettings.hardware.drawerBox} (current)
                    </option>
                  )}
                  {drawerBoxOptions.map(name => (
                    <option key={name} value={name}>{name}</option>
                  ))}
                </select>
              ) : (
                <div className="text-xs px-2 py-1.5 bg-gray-800 border border-[#333] text-white rounded">
                  {roomSettings.hardware.drawerBox || '(none)'}
                </div>
              )}
            </div>
          </div>
        </section>
      )}

      {/* Other Hardware (read-only for now) */}
      {roomSettings && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)] border-b border-[var(--accent)] pb-1 mb-3">
            Other Hardware
          </h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <HwField label="Pulls (Drawer)" value={roomSettings.hardware.drwPulls} />
            <HwField label="Pulls (Base)" value={roomSettings.hardware.basePulls} />
            <HwField label="Pulls (Wall)" value={roomSettings.hardware.wallPulls} />
            <HwField label="Hinges (Base)" value={roomSettings.hardware.baseHinges} />
            <HwField label="Hinges (Wall)" value={roomSettings.hardware.wallHinges} />
            <HwField label="Closet Rod" value={roomSettings.hardware.closetRod} />
            <HwField label="Shelf Pins" value={roomSettings.hardware.shelfPins} />
            <HwField label="Legs" value={roomSettings.hardware.legs} />
            <HwField label="RO Tray Guide" value={roomSettings.hardware.roTrayGuide} />
            <HwField label="RO Shelf Guide" value={roomSettings.hardware.roShelfGuide} />
          </div>
        </section>
      )}

      {/* Door Types (read-only for now) */}
      {roomSettings && (
        <section>
          <h3 className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)] border-b border-[var(--accent)] pb-1 mb-3">
            Door Types
          </h3>
          <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
            <HwField label="Base Door" value={roomSettings.doors.nonColumnBaseDoor} />
            <HwField label="Wall Door" value={roomSettings.doors.nonColumnWallDoor} />
            <HwField label="Top Drawer" value={roomSettings.doors.nonColumnTopDrawer} />
            <HwField label="Mid Drawer" value={roomSettings.doors.nonColumnMidDrawer} />
            <HwField label="Bot Drawer" value={roomSettings.doors.nonColumnBotDrawer} />
            <HwField label="End Door W" value={roomSettings.doors.endDoorW} />
            <HwField label="End Door B" value={roomSettings.doors.endDoorB} />
            <HwField label="End Door T" value={roomSettings.doors.endDoorT} />
            <HwField label="Back Door" value={roomSettings.doors.backDoor} />
          </div>
        </section>
      )}

      {!roomSettings && !settingsFile && (
        <div className="text-xs text-[#666] text-center py-8">
          Load a RoomSettingsTemplates.dat file to configure hardware selections.
        </div>
      )}
    </div>
  )
}

/** Read-only hardware field display. */
function HwField({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0">
      <span className="text-[#666] block truncate">{label}</span>
      <span className="text-white block truncate" title={value}>{value || '—'}</span>
    </div>
  )
}
