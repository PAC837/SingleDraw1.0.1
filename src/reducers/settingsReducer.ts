/**
 * Settings reducer — settings file, active template, hardware catalog, room hardware.
 */
import type { AppState } from '../mozaik/types'
import type { Action } from '../store'

export function settingsReducer(state: AppState, action: Action): AppState | null {
  switch (action.type) {
    case 'LOAD_SETTINGS_FILE':
      return { ...state, settingsFile: action.file }
    case 'SET_ACTIVE_TEMPLATE': {
      const tmpl = state.settingsFile?.templates.find(t => t.name === action.name)
      if (!tmpl) return { ...state, activeTemplateName: action.name }
      const roomSettings = JSON.parse(JSON.stringify(tmpl))
      if (state.room) {
        return {
          ...state,
          activeTemplateName: action.name,
          room: { ...state.room, roomSettings, rawText: '' },
        }
      }
      return { ...state, activeTemplateName: action.name }
    }
    case 'SET_HARDWARE_CATALOG':
      return { ...state, hardwareCatalog: action.catalog }
    case 'UPDATE_ROOM_HARDWARE': {
      if (!state.room?.roomSettings) return state
      const hw = { ...state.room.roomSettings.hardware, [action.field]: action.value }
      const rs = { ...state.room.roomSettings, hardware: hw, rawAttributes: { ...state.room.roomSettings.rawAttributes } }
      const attrMap: Record<string, string> = {
        drawerBox: 'DrawerBox', drawerGuide: 'DrawerGuide',
        drawerGuideSlowCloseOn: 'DrawerGuideSlowCloseOn',
        drawerGuideSpacerState: 'DrawerGuideSpacerState',
        roTray: 'ROTray', roTrayGuide: 'ROTrayGuide',
        roTrayGuideSlowCloseOn: 'ROTrayGuideSlowCloseOn',
        roTrayGuideSpacerState: 'ROTrayGuideSpacerState',
        roShelfGuide: 'ROShelfGuide',
        drwPulls: 'DrwPulls', basePulls: 'BasePulls', wallPulls: 'WallPulls',
        baseHinges: 'BaseHinges', wallHinges: 'WallHinges',
        closetRod: 'ClosetRod', shelfPins: 'ShelfPins', locks: 'Locks',
        legs: 'Legs', spotLights: 'SpotLights', linearLights: 'LinearLights',
      }
      const xmlKey = attrMap[action.field]
      if (xmlKey) {
        const v = action.value
        rs.rawAttributes[xmlKey] = typeof v === 'boolean' ? (v ? 'True' : 'False') : String(v)
      }
      return { ...state, room: { ...state.room, roomSettings: rs, rawText: '' } }
    }
    default:
      return null
  }
}
