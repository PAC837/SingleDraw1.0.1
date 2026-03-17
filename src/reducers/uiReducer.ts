/**
 * UI reducer — panels, visibility, selection, admin, inspection, elevation viewer.
 */
import type { AppState } from '../mozaik/types'
import type { Action } from '../store'

export function uiReducer(state: AppState, action: Action): AppState | null {
  switch (action.type) {
    case 'GO_HOME':
      return {
        ...state,
        wallEditorActive: false,
        selectedWall: null,
        selectedProducts: [],
        inspectedPart: null,
        elevationViewerProduct: null,
        dragTarget: null,
        visibilityMenuOpen: false,
        productConfigOpen: false,
        libraryOpen: false,
        adminOpen: false,
        cameraResetKey: state.cameraResetKey + 1,
      }
    case 'CLOSE_PANELS':
      return { ...state, productConfigOpen: false, visibilityMenuOpen: false, adminOpen: false, wallEditorActive: false, selectedWall: null, elevationViewerProduct: null }
    case 'TOGGLE_VISIBILITY': {
      const newVis = { ...state.visibility, [action.key]: !state.visibility[action.key] }
      if (action.key === 'allWalls') {
        if (newVis.allWalls) {
          newVis.walls = {}
        } else if (state.room) {
          const wallMap: Record<number, boolean> = {}
          state.room.walls.forEach(w => { wallMap[w.wallNumber] = false })
          newVis.walls = wallMap
        }
      }
      const deselect = action.key === 'allWalls' && !newVis.allWalls && state.selectedWall !== null
      return { ...state, visibility: newVis, ...(deselect ? { selectedWall: null } : {}) }
    }
    case 'TOGGLE_WALL_VISIBILITY': {
      const cur = state.visibility.walls[action.wallNumber] !== false
      const walls = { ...state.visibility.walls, [action.wallNumber]: !cur }
      return { ...state, visibility: { ...state.visibility, walls }, ...(cur && state.selectedWall === action.wallNumber ? { selectedWall: null } : {}) }
    }
    case 'TOGGLE_VISIBILITY_MENU':
      return { ...state, visibilityMenuOpen: !state.visibilityMenuOpen }
    case 'SET_PLACEMENT_MODE':
      return { ...state, placementMode: action.mode }
    case 'TOGGLE_PRODUCT_CONFIG':
      return { ...state, productConfigOpen: !state.productConfigOpen }
    case 'TOGGLE_LIBRARY':
      return { ...state, libraryOpen: !state.libraryOpen }
    case 'TOGGLE_ADMIN':
      return { ...state, adminOpen: !state.adminOpen }
    case 'SELECT_WALL':
      return { ...state, selectedWall: action.wallNumber }
    case 'SELECT_PRODUCT':
      return { ...state, selectedProducts: action.index !== null ? [action.index] : [], inspectedPart: null }
    case 'TOGGLE_PRODUCT_SELECTION': {
      const idx = action.index
      const has = state.selectedProducts.includes(idx)
      return { ...state, selectedProducts: has ? state.selectedProducts.filter(i => i !== idx) : [...state.selectedProducts, idx] }
    }
    case 'CLEAR_SELECTION':
      return { ...state, selectedProducts: [], inspectedPart: null }
    case 'SET_HOVERED_PART':
      return { ...state, hoveredPart: action.part }
    case 'INSPECT_PART': {
      const sel = state.selectedProducts.includes(action.part.productIndex)
        ? state.selectedProducts
        : [action.part.productIndex]
      return { ...state, inspectedPart: action.part, selectedProducts: sel }
    }
    case 'CLEAR_INSPECTION':
      return { ...state, inspectedPart: null }
    case 'OPEN_ELEVATION_VIEWER':
      return { ...state, elevationViewerProduct: action.productIndex, selectedProducts: [action.productIndex] }
    case 'CLOSE_ELEVATION_VIEWER':
      return { ...state, elevationViewerProduct: null }
    default:
      return null
  }
}
