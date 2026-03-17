/**
 * Render reducer — render mode, edge/polygon offsets, presets, lighting, HDRI, toggles.
 */
import type { AppState } from '../mozaik/types'
import type { Action } from '../store'
import { RENDER_PRESETS } from '../constants/renderPresets'

export function renderReducer(state: AppState, action: Action): AppState | null {
  switch (action.type) {
    case 'SET_RENDER_MODE':
      return { ...state, renderMode: action.mode, renderPreset: null }
    case 'SET_EDGE_OPACITY':
      return { ...state, edgeOpacity: action.value, renderPreset: null }
    case 'SET_POLYGON_OFFSET_FACTOR':
      return { ...state, polygonOffsetFactor: action.value, renderPreset: null }
    case 'SET_POLYGON_OFFSET_UNITS':
      return { ...state, polygonOffsetUnits: action.value, renderPreset: null }
    case 'SET_RENDER_PRESET': {
      const p = RENDER_PRESETS[action.preset]
      if (!p) return state
      return {
        ...state, renderPreset: action.preset, renderMode: p.mode, edgeOpacity: p.edgeOpacity,
        polygonOffsetFactor: p.factor, polygonOffsetUnits: p.units,
        ambientIntensity: p.ambient, directionalIntensity: p.directional,
        warmth: p.warmth, exposure: p.exposure, toneMapping: p.toneMapping, bgColor: p.bgColor,
      }
    }
    case 'SET_AMBIENT_INTENSITY':
      return { ...state, ambientIntensity: action.value, renderPreset: null }
    case 'SET_DIRECTIONAL_INTENSITY':
      return { ...state, directionalIntensity: action.value, renderPreset: null }
    case 'SET_WARMTH':
      return { ...state, warmth: action.value, renderPreset: null }
    case 'SET_EXPOSURE':
      return { ...state, exposure: action.value, renderPreset: null }
    case 'SET_TONE_MAPPING':
      return { ...state, toneMapping: action.value, renderPreset: null }
    case 'SET_BG_COLOR':
      return { ...state, bgColor: action.value, renderPreset: null }
    case 'TOGGLE_HDRI':
      return { ...state, hdriEnabled: !state.hdriEnabled }
    case 'SET_HDRI_INTENSITY':
      return { ...state, hdriIntensity: action.value }
    case 'TOGGLE_UNITS':
      return { ...state, useInches: !state.useInches }
    case 'TOGGLE_SHOW_OPERATIONS':
      return { ...state, showOperations: !state.showOperations }
    case 'TOGGLE_SHAPE_DEBUG':
      return { ...state, showShapeDebug: !state.showShapeDebug }
    case 'TOGGLE_SPINNING_3D_CARDS':
      return { ...state, spinning3DCards: !state.spinning3DCards }
    default:
      return null
  }
}
