import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from 'react'
import type { AppState, RenderMode, MozRoom, MozFile, MozProduct, DebugOverlays } from './mozaik/types'

const defaultOverlays: DebugOverlays = {
  originMarker: true,
  axisGizmo: true,
  floorGrid: false,
  wallNormals: false,
  boundingBoxes: false,
  doubleSidedWalls: false,
  probeScene: false,
}

const initialState: AppState = {
  room: null,
  standaloneProducts: [],
  overlays: defaultOverlays,
  selectedWall: null,
  useInches: false,
  renderMode: 'ghosted',
  jobFolder: null,
  textureFolder: null,
  availableTextures: [],
  selectedTexture: null,
  availableFloorTextures: [],
  selectedFloorTexture: null,
  availableWallTextures: [],
  selectedWallTexture: null,
  libraryFolder: null,
  availableLibraryFiles: [],
  sketchUpFolder: null,
  modelsFolder: null,
}

type Action =
  | { type: 'LOAD_ROOM'; room: MozRoom }
  | { type: 'LOAD_MOZ'; file: MozFile }
  | { type: 'TOGGLE_OVERLAY'; key: keyof DebugOverlays }
  | { type: 'SELECT_WALL'; wallNumber: number | null }
  | { type: 'TOGGLE_UNITS' }
  | { type: 'SET_RENDER_MODE'; mode: RenderMode }
  | { type: 'SET_JOB_FOLDER'; folder: FileSystemDirectoryHandle }
  | { type: 'SET_TEXTURE_FOLDER'; folder: FileSystemDirectoryHandle }
  | { type: 'SET_AVAILABLE_TEXTURES'; filenames: string[] }
  | { type: 'SET_SELECTED_TEXTURE'; filename: string | null }
  | { type: 'SET_AVAILABLE_FLOOR_TEXTURES'; filenames: string[] }
  | { type: 'SET_SELECTED_FLOOR_TEXTURE'; filename: string | null }
  | { type: 'SET_AVAILABLE_WALL_TEXTURES'; filenames: string[] }
  | { type: 'SET_SELECTED_WALL_TEXTURE'; filename: string | null }
  | { type: 'CREATE_ROOM'; room: MozRoom }
  | { type: 'PLACE_PRODUCT'; product: MozProduct }
  | { type: 'UPDATE_ROOM_PRODUCT'; index: number; field: 'width' | 'depth'; value: number }
  | { type: 'REMOVE_ROOM_PRODUCT'; index: number }
  | { type: 'CLEAR_ROOM' }
  | { type: 'CLEAR_PRODUCTS' }
  | { type: 'SET_LIBRARY_FOLDER'; folder: FileSystemDirectoryHandle }
  | { type: 'SET_AVAILABLE_LIBRARY_FILES'; filenames: string[] }
  | { type: 'SET_SKETCHUP_FOLDER'; folder: FileSystemDirectoryHandle }
  | { type: 'SET_MODELS_FOLDER'; folder: FileSystemDirectoryHandle }

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'LOAD_ROOM':
      return { ...state, room: action.room }
    case 'LOAD_MOZ':
      return { ...state, standaloneProducts: [...state.standaloneProducts, action.file] }
    case 'TOGGLE_OVERLAY':
      return {
        ...state,
        overlays: { ...state.overlays, [action.key]: !state.overlays[action.key] },
      }
    case 'SELECT_WALL':
      return { ...state, selectedWall: action.wallNumber }
    case 'TOGGLE_UNITS':
      return { ...state, useInches: !state.useInches }
    case 'SET_RENDER_MODE':
      return { ...state, renderMode: action.mode }
    case 'SET_JOB_FOLDER':
      return { ...state, jobFolder: action.folder }
    case 'SET_TEXTURE_FOLDER':
      return { ...state, textureFolder: action.folder }
    case 'SET_AVAILABLE_TEXTURES':
      return { ...state, availableTextures: action.filenames }
    case 'SET_SELECTED_TEXTURE':
      return { ...state, selectedTexture: action.filename }
    case 'SET_AVAILABLE_FLOOR_TEXTURES':
      return { ...state, availableFloorTextures: action.filenames }
    case 'SET_SELECTED_FLOOR_TEXTURE':
      return { ...state, selectedFloorTexture: action.filename }
    case 'SET_AVAILABLE_WALL_TEXTURES':
      return { ...state, availableWallTextures: action.filenames }
    case 'SET_SELECTED_WALL_TEXTURE':
      return { ...state, selectedWallTexture: action.filename }
    case 'CREATE_ROOM':
      return { ...state, room: action.room, selectedWall: null }
    case 'PLACE_PRODUCT':
      if (!state.room) return state
      return {
        ...state,
        room: { ...state.room, products: [...state.room.products, action.product] },
      }
    case 'UPDATE_ROOM_PRODUCT':
      if (!state.room) return state
      return {
        ...state,
        room: {
          ...state.room,
          products: state.room.products.map((p, i) =>
            i === action.index ? { ...p, [action.field]: action.value } : p
          ),
        },
      }
    case 'REMOVE_ROOM_PRODUCT':
      if (!state.room) return state
      return {
        ...state,
        room: {
          ...state.room,
          products: state.room.products.filter((_, i) => i !== action.index),
        },
      }
    case 'CLEAR_ROOM':
      return { ...state, room: null }
    case 'CLEAR_PRODUCTS':
      return { ...state, standaloneProducts: [] }
    case 'SET_LIBRARY_FOLDER':
      return { ...state, libraryFolder: action.folder }
    case 'SET_AVAILABLE_LIBRARY_FILES':
      return { ...state, availableLibraryFiles: action.filenames }
    case 'SET_SKETCHUP_FOLDER':
      return { ...state, sketchUpFolder: action.folder }
    case 'SET_MODELS_FOLDER':
      return { ...state, modelsFolder: action.folder }
    default:
      return state
  }
}

const StateCtx = createContext<AppState>(initialState)
const DispatchCtx = createContext<Dispatch<Action>>(() => {})

export function StoreProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState)
  return (
    <StateCtx.Provider value={state}>
      <DispatchCtx.Provider value={dispatch}>
        {children}
      </DispatchCtx.Provider>
    </StateCtx.Provider>
  )
}

export function useAppState() { return useContext(StateCtx) }
export function useAppDispatch() { return useContext(DispatchCtx) }
