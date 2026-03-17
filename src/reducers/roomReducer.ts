/**
 * Room reducer — load room, load/remove MOZ, clear room/products, set folders, library config, overlays.
 */
import type { AppState, Visibility } from '../mozaik/types'
import type { Action } from '../store'

const defaultVisibility: Visibility = {
  walls: {},
  allWalls: true,
  floor: true,
  products: true,
  inserts: true,
}

export function roomReducer(state: AppState, action: Action): AppState | null {
  switch (action.type) {
    case 'LOAD_ROOM':
      return { ...state, room: action.room, visibility: defaultVisibility, wallHeight: action.room.parms.H_Walls }
    case 'LOAD_MOZ':
      return { ...state, standaloneProducts: [...state.standaloneProducts, action.file] }
    case 'REMOVE_MOZ': {
      const baseName = action.filename.replace(/\.moz$/i, '')
      return {
        ...state,
        standaloneProducts: state.standaloneProducts.filter(
          mf => mf.product.prodName !== baseName
        ),
      }
    }
    case 'CLEAR_ROOM':
      return { ...state, room: null }
    case 'CLEAR_PRODUCTS':
      return { ...state, standaloneProducts: [] }
    case 'SET_JOB_FOLDER':
      return { ...state, jobFolder: action.folder }
    case 'SET_LIBRARY_FOLDER':
      return { ...state, libraryFolder: action.folder }
    case 'SET_AVAILABLE_LIBRARY_FILES':
      return { ...state, availableLibraryFiles: action.filenames }
    case 'SET_SKETCHUP_FOLDER':
      return { ...state, sketchUpFolder: action.folder }
    case 'SET_MODELS_FOLDER':
      return { ...state, modelsFolder: action.folder }
    case 'SET_LIBRARY_CONFIG':
      return { ...state, libraryConfig: action.config }
    case 'TOGGLE_OVERLAY':
      return { ...state, overlays: { ...state.overlays, [action.key]: !state.overlays[action.key] } }
    default:
      return null
  }
}
