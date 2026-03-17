/**
 * Texture reducer — texture folder, available textures, selected texture, floor/wall/singledraw textures.
 */
import type { AppState } from '../mozaik/types'
import type { Action } from '../store'

export function textureReducer(state: AppState, action: Action): AppState | null {
  switch (action.type) {
    case 'SET_TEXTURE_FOLDER':
      return { ...state, textureFolder: action.folder }
    case 'SET_AVAILABLE_TEXTURES':
      return { ...state, availableTextures: action.filenames }
    case 'SET_SELECTED_TEXTURE':
      return { ...state, selectedTexture: action.filename }
    case 'SET_SINGLEDRAW_FLOOR_TEXTURES':
      return { ...state, singleDrawFloorTextures: action.textures }
    case 'SET_FLOOR_TYPE':
      return { ...state, selectedFloorType: action.floorType, selectedFloorTexture: null }
    case 'SET_SELECTED_FLOOR_TEXTURE':
      return { ...state, selectedFloorTexture: action.filename }
    case 'SET_SINGLEDRAW_WALL_TEXTURES':
      return { ...state, singleDrawWallTextures: action.textures }
    case 'SET_WALL_TYPE':
      return { ...state, selectedWallType: action.wallType, selectedWallTexture: null }
    case 'SET_SELECTED_WALL_TEXTURE':
      return { ...state, selectedWallTexture: action.filename }
    case 'SET_SINGLEDRAW_TEXTURES':
      return { ...state, singleDrawTextures: action.textures }
    case 'SET_SINGLEDRAW_BRAND':
      return { ...state, selectedSingleDrawBrand: action.brand, selectedSingleDrawTexture: null }
    case 'SET_SINGLEDRAW_TEXTURE':
      return { ...state, selectedSingleDrawTexture: action.filename }
    default:
      return null
  }
}
