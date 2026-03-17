import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from 'react'
import { LinearToneMapping } from 'three'
import type { AppState, Visibility, RenderMode, MozRoom, MozFile, MozProduct, MozFixture, MozWall, DebugOverlays, DragTarget, LibraryConfig, DynamicProductGroup } from './mozaik/types'
import type { RoomSettingsFile, RoomSetHardware } from './mozaik/settingsTemplateParser'
import type { HardwareCatalog } from './mozaik/hardwareDatParser'
import { snapModularHeight } from './mozaik/modularValues'
import { createDefaultColumns } from './mozaik/unitTypes'
import { createWalkInRoom } from './mozaik/roomFactory'
import { uiReducer } from './reducers/uiReducer'
import { productReducer } from './reducers/productReducer'
import { dimensionReducer } from './reducers/dimensionReducer'
import { wallReducer } from './reducers/wallReducer'
import { renderReducer } from './reducers/renderReducer'
import { settingsReducer } from './reducers/settingsReducer'
import { textureReducer } from './reducers/textureReducer'
import { fixtureReducer } from './reducers/fixtureReducer'
import { roomReducer } from './reducers/roomReducer'

// Re-export for consumers that imported from store
export { RENDER_PRESETS } from './constants/renderPresets'

const defaultOverlays: DebugOverlays = {
  originMarker: true,
  axisGizmo: true,
  floorGrid: false,
  wallNormals: false,
  boundingBoxes: false,
  doubleSidedWalls: false,
  probeScene: false,
}

const defaultVisibility: Visibility = {
  walls: {},
  allWalls: true,
  floor: true,
  products: true,
  inserts: true,
}

const initialState: AppState = {
  room: createWalkInRoom(2438.4),
  standaloneProducts: [],
  overlays: defaultOverlays,
  selectedWall: null,
  wallEditorActive: false,
  dragTarget: null,
  useInches: true,
  renderMode: 'solid',
  jobFolder: null,
  textureFolder: null,
  availableTextures: [],
  selectedTexture: null,
  singleDrawFloorTextures: {},
  selectedFloorType: null,
  selectedFloorTexture: null,
  singleDrawWallTextures: {},
  selectedWallType: null,
  selectedWallTexture: null,
  singleDrawTextures: {},
  selectedSingleDrawBrand: null,
  selectedSingleDrawTexture: null,
  libraryFolder: null,
  availableLibraryFiles: [],
  sketchUpFolder: null,
  modelsFolder: null,
  visibility: defaultVisibility,
  visibilityMenuOpen: false,
  placementMode: 'floor',
  unitHeight: snapModularHeight(87 * 25.4),
  wallSectionHeight: snapModularHeight(76 * 25.4),
  wallMountTopAt: snapModularHeight(87 * 25.4),
  wallHeight: 2438.4,
  productConfigOpen: false,
  libraryOpen: false,
  cameraResetKey: 0,
  selectedProducts: [],
  flipOps: false,
  edgeOpacity: 0.5,
  polygonOffsetFactor: 1,
  polygonOffsetUnits: 1,
  renderPreset: 'clean-solid',
  ambientIntensity: 0.6,
  directionalIntensity: 0.7,
  warmth: 0,
  exposure: 1.0,
  toneMapping: LinearToneMapping,
  bgColor: '#ffffff',
  hdriEnabled: true,
  hdriIntensity: 0.5,
  adminOpen: false,
  showOperations: true,
  showShapeDebug: false,
  spinning3DCards: true,
  dragProduct: null,
  dragHoveredWall: null,
  libraryConfig: { activeProducts: [], variantMappings: [], unitTypeColumns: createDefaultColumns(), productAssignments: {}, version: 2 },
  hoveredPart: null,
  inspectedPart: null,
  elevationViewerProduct: null,
  fixedShelfHeight: 1632,
  baseCabHeight: 876.3,
  hutchSectionHeight: snapModularHeight(48 * 25.4),
  settingsFile: null,
  activeTemplateName: null,
  hardwareCatalog: null,
  toeRecess: 50.8,          // 2 inches in mm
  toeHeight: 96,            // mm — toe kick height (32mm grid)
  fastenerLargeDia: 20,     // mm — large fastener hole diameter
  fastenerSmallDia: 10,     // mm — small fastener hole diameter
}

export type Action =
  | { type: 'GO_HOME' }
  | { type: 'LOAD_ROOM'; room: MozRoom }
  | { type: 'LOAD_MOZ'; file: MozFile }
  | { type: 'REMOVE_MOZ'; filename: string }
  | { type: 'TOGGLE_OVERLAY'; key: keyof DebugOverlays }
  | { type: 'SELECT_WALL'; wallNumber: number | null }
  | { type: 'TOGGLE_UNITS' }
  | { type: 'SET_RENDER_MODE'; mode: RenderMode }
  | { type: 'SET_JOB_FOLDER'; folder: FileSystemDirectoryHandle }
  | { type: 'SET_TEXTURE_FOLDER'; folder: FileSystemDirectoryHandle }
  | { type: 'SET_AVAILABLE_TEXTURES'; filenames: string[] }
  | { type: 'SET_SELECTED_TEXTURE'; filename: string | null }
  | { type: 'SET_SINGLEDRAW_FLOOR_TEXTURES'; textures: Record<string, string[]> }
  | { type: 'SET_FLOOR_TYPE'; floorType: string | null }
  | { type: 'SET_SELECTED_FLOOR_TEXTURE'; filename: string | null }
  | { type: 'SET_SINGLEDRAW_WALL_TEXTURES'; textures: Record<string, string[]> }
  | { type: 'SET_WALL_TYPE'; wallType: string | null }
  | { type: 'SET_SELECTED_WALL_TEXTURE'; filename: string | null }
  | { type: 'SET_SINGLEDRAW_TEXTURES'; textures: Record<string, string[]> }
  | { type: 'SET_SINGLEDRAW_BRAND'; brand: string | null }
  | { type: 'SET_SINGLEDRAW_TEXTURE'; filename: string | null }
  | { type: 'CREATE_ROOM'; room: MozRoom }
  | { type: 'PLACE_PRODUCT'; product: MozProduct }
  | { type: 'UPDATE_ROOM_PRODUCT'; index: number; field: 'width' | 'depth' | 'height'; value: number }
  | { type: 'REMOVE_ROOM_PRODUCT'; index: number }
  | { type: 'REMOVE_ROOM_PRODUCTS'; indices: number[] }
  | { type: 'CLEAR_ROOM' }
  | { type: 'CLEAR_PRODUCTS' }
  | { type: 'SET_LIBRARY_FOLDER'; folder: FileSystemDirectoryHandle }
  | { type: 'SET_AVAILABLE_LIBRARY_FILES'; filenames: string[] }
  | { type: 'SET_SKETCHUP_FOLDER'; folder: FileSystemDirectoryHandle }
  | { type: 'SET_MODELS_FOLDER'; folder: FileSystemDirectoryHandle }
  | { type: 'TOGGLE_WALL_EDITOR' }
  | { type: 'SET_DRAG_TARGET'; target: DragTarget | null }
  | { type: 'UPDATE_WALL'; wallNumber: number; fields: Partial<Pick<MozWall, 'len' | 'height' | 'posX' | 'posY' | 'ang'>> }
  | { type: 'SPLIT_WALL'; wallNumber: number }
  | { type: 'MOVE_JOINT'; jointIndex: number; newX: number; newY: number }
  | { type: 'TOGGLE_FOLLOW_ANGLE'; wallNumber: number }
  | { type: 'TOGGLE_JOINT_MITER'; jointIndex: number }
  | { type: 'TOGGLE_VISIBILITY'; key: 'allWalls' | 'floor' | 'products' | 'inserts' }
  | { type: 'TOGGLE_WALL_VISIBILITY'; wallNumber: number }
  | { type: 'TOGGLE_VISIBILITY_MENU' }
  | { type: 'SET_PLACEMENT_MODE'; mode: 'floor' | 'wall' }
  | { type: 'SET_UNIT_HEIGHT'; height: number }
  | { type: 'SET_FIXED_SHELF_HEIGHT'; height: number }
  | { type: 'SET_BASE_CAB_HEIGHT'; height: number }
  | { type: 'SET_HUTCH_SECTION_HEIGHT'; height: number }
  | { type: 'SET_WALL_SECTION_HEIGHT'; height: number }
  | { type: 'SET_WALL_MOUNT_TOP_AT'; height: number }
  | { type: 'TOGGLE_PRODUCT_CONFIG' }
  | { type: 'SET_WALL_HEIGHT'; height: number }
  | { type: 'ADD_FIXTURE'; fixture: MozFixture }
  | { type: 'REMOVE_FIXTURE'; fixtureIdTag: number }
  | { type: 'SELECT_PRODUCT'; index: number | null }
  | { type: 'TOGGLE_PRODUCT_SELECTION'; index: number }
  | { type: 'CLEAR_SELECTION' }
  | { type: 'UPDATE_ROOM_PRODUCT_ELEV'; index: number; elev: number }
  | { type: 'UPDATE_ROOM_PRODUCT_X'; index: number; x: number }
  | { type: 'MOVE_FIXTURE'; fixtureIdTag: number; x: number }
  | { type: 'UPDATE_FIXTURE'; fixtureIdTag: number; fields: Partial<Pick<MozFixture, 'width' | 'height' | 'elev' | 'x'>> }
  | { type: 'TOGGLE_LIBRARY' }
  | { type: 'TOGGLE_FLIP_OPS' }
  | { type: 'TOGGLE_SHOW_OPERATIONS' }
  | { type: 'TOGGLE_SHAPE_DEBUG' }
  | { type: 'TOGGLE_SPINNING_3D_CARDS' }
  | { type: 'SET_EDGE_OPACITY'; value: number }
  | { type: 'SET_POLYGON_OFFSET_FACTOR'; value: number }
  | { type: 'SET_POLYGON_OFFSET_UNITS'; value: number }
  | { type: 'SET_RENDER_PRESET'; preset: string }
  | { type: 'SET_AMBIENT_INTENSITY'; value: number }
  | { type: 'SET_DIRECTIONAL_INTENSITY'; value: number }
  | { type: 'SET_WARMTH'; value: number }
  | { type: 'SET_EXPOSURE'; value: number }
  | { type: 'SET_TONE_MAPPING'; value: number }
  | { type: 'SET_BG_COLOR'; value: string }
  | { type: 'ALIGN_WALL_TOPS' }
  | { type: 'TOGGLE_HDRI' }
  | { type: 'SET_HDRI_INTENSITY'; value: number }
  | { type: 'CLOSE_PANELS' }
  | { type: 'TOGGLE_ADMIN' }
  | { type: 'SET_LIBRARY_CONFIG'; config: LibraryConfig }
  | { type: 'SET_HOVERED_PART'; part: { productIndex: number; partIndex: number } | null }
  | { type: 'INSPECT_PART'; part: { productIndex: number; partIndex: number } }
  | { type: 'CLEAR_INSPECTION' }
  | { type: 'OPEN_ELEVATION_VIEWER'; productIndex: number }
  | { type: 'CLOSE_ELEVATION_VIEWER' }
  | { type: 'UPDATE_SHELF_HEIGHT'; productIndex: number; shelfPartIndex: number; newZ: number }
  | { type: 'DELETE_PRODUCT_PART'; productIndex: number; partIndex: number }
  | { type: 'START_PRODUCT_DRAG'; product: MozProduct; productIndex: number; group?: DynamicProductGroup; unitTypeId?: string }
  | { type: 'SET_DRAG_HOVERED_WALL'; wallNumber: number | null }
  | { type: 'END_PRODUCT_DRAG' }
  | { type: 'BEGIN_DRAG' }
  | { type: 'END_DRAG' }
  | { type: 'UNDO' }
  | { type: 'LOAD_SETTINGS_FILE'; file: RoomSettingsFile }
  | { type: 'SET_ACTIVE_TEMPLATE'; name: string }
  | { type: 'SET_HARDWARE_CATALOG'; catalog: HardwareCatalog }
  | { type: 'UPDATE_ROOM_HARDWARE'; field: keyof RoomSetHardware; value: string | boolean | number }
  | { type: 'SET_TOE_RECESS'; value: number }
  | { type: 'SET_TOE_HEIGHT'; value: number }
  | { type: 'SET_FASTENER_LARGE_DIA'; value: number }
  | { type: 'SET_FASTENER_SMALL_DIA'; value: number }

function reducer(state: AppState, action: Action): AppState {
  return uiReducer(state, action)
    ?? wallReducer(state, action)
    ?? productReducer(state, action)
    ?? dimensionReducer(state, action)
    ?? renderReducer(state, action)
    ?? settingsReducer(state, action)
    ?? textureReducer(state, action)
    ?? fixtureReducer(state, action)
    ?? roomReducer(state, action)
    ?? state
}

// Undo system — wraps reducer with history stack (max 50 snapshots)
const UNDOABLE = new Set([
  'PLACE_PRODUCT', 'REMOVE_ROOM_PRODUCT', 'REMOVE_ROOM_PRODUCTS', 'UPDATE_ROOM_PRODUCT',
  'MOVE_FIXTURE', 'UPDATE_FIXTURE', 'ADD_FIXTURE', 'REMOVE_FIXTURE',
  'MOVE_JOINT', 'SPLIT_WALL', 'UPDATE_WALL', 'CREATE_ROOM', 'CLEAR_ROOM',
  'UPDATE_SHELF_HEIGHT',
])

function undoReducer(
  swh: { current: AppState; undoStack: AppState[]; dragSnapshot: AppState | null }, action: Action,
): { current: AppState; undoStack: AppState[]; dragSnapshot: AppState | null } {
  if (action.type === 'UNDO') {
    const prev = swh.undoStack[swh.undoStack.length - 1]
    return prev ? { current: prev, undoStack: swh.undoStack.slice(0, -1), dragSnapshot: null } : swh
  }
  if (action.type === 'BEGIN_DRAG') {
    return { ...swh, dragSnapshot: swh.current }
  }
  if (action.type === 'END_DRAG') {
    if (!swh.dragSnapshot) return swh
    return { current: swh.current, undoStack: [...swh.undoStack.slice(-49), swh.dragSnapshot], dragSnapshot: null }
  }
  const next = reducer(swh.current, action)
  if (next === swh.current) return swh
  if (swh.dragSnapshot !== null) {
    return { ...swh, current: next }
  }
  if (UNDOABLE.has(action.type)) {
    return { current: next, undoStack: [...swh.undoStack.slice(-49), swh.current], dragSnapshot: null }
  }
  return { ...swh, current: next }
}

const StateCtx = createContext<AppState>(initialState)
const DispatchCtx = createContext<Dispatch<Action>>(() => {})

export function StoreProvider({ children }: { children: ReactNode }) {
  const [swh, dispatch] = useReducer(undoReducer, { current: initialState, undoStack: [], dragSnapshot: null })
  return (
    <StateCtx.Provider value={swh.current}>
      <DispatchCtx.Provider value={dispatch}>
        {children}
      </DispatchCtx.Provider>
    </StateCtx.Provider>
  )
}

export function useAppState() { return useContext(StateCtx) }
export function useAppDispatch() { return useContext(DispatchCtx) }
