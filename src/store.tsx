import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from 'react'
import type { AppState, Visibility, RenderMode, MozRoom, MozFile, MozProduct, MozFixture, MozWall, DebugOverlays, DragTarget } from './mozaik/types'
import { updateWallLength, updateWallHeight, moveJoint, splitWallAtCenter, rebuildJoints, toggleFollowAngle, toggleJointMiter } from './math/wallEditor'

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
  room: null,
  standaloneProducts: [],
  overlays: defaultOverlays,
  selectedWall: null,
  wallEditorActive: false,
  dragTarget: null,
  useInches: false,
  renderMode: 'ghosted',
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
  unitHeight: 2209.8,       // 87 inches in mm
  wallMountTopAt: 2133.6,   // 84 inches in mm
  wallHeight: 2438.4,       // 96 inches in mm
  productConfigOpen: false,
  cameraResetKey: 0,
}

type Action =
  | { type: 'GO_HOME' }
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
  | { type: 'UPDATE_ROOM_PRODUCT'; index: number; field: 'width' | 'depth'; value: number }
  | { type: 'REMOVE_ROOM_PRODUCT'; index: number }
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
  | { type: 'SET_WALL_MOUNT_TOP_AT'; height: number }
  | { type: 'TOGGLE_PRODUCT_CONFIG' }
  | { type: 'SET_WALL_HEIGHT'; height: number }
  | { type: 'ADD_FIXTURE'; fixture: MozFixture }
  | { type: 'REMOVE_FIXTURE'; fixtureIdTag: number }

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'GO_HOME':
      return {
        ...state,
        wallEditorActive: false,
        selectedWall: null,
        dragTarget: null,
        visibilityMenuOpen: false,
        productConfigOpen: false,
        cameraResetKey: state.cameraResetKey + 1,
      }
    case 'LOAD_ROOM':
      return { ...state, room: action.room, visibility: defaultVisibility, wallHeight: action.room.parms.H_Walls }
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
    case 'CREATE_ROOM':
      return { ...state, room: action.room, selectedWall: null, visibility: defaultVisibility, wallHeight: action.room.parms.H_Walls }
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
    case 'TOGGLE_WALL_EDITOR':
      return { ...state, wallEditorActive: !state.wallEditorActive, selectedWall: null, dragTarget: null, visibilityMenuOpen: false }
    case 'SET_DRAG_TARGET':
      return { ...state, dragTarget: action.target }
    case 'UPDATE_WALL': {
      if (!state.room) return state
      let newWalls = state.room.walls
      if (action.fields.len !== undefined) {
        newWalls = updateWallLength(newWalls, action.wallNumber, action.fields.len)
      }
      if (action.fields.height !== undefined) {
        newWalls = updateWallHeight(newWalls, action.wallNumber, action.fields.height)
      }
      // Direct field updates (posX, posY, ang) — apply to the specific wall
      const directFields: Partial<Pick<MozWall, 'posX' | 'posY' | 'ang'>> = {}
      if (action.fields.posX !== undefined) directFields.posX = action.fields.posX
      if (action.fields.posY !== undefined) directFields.posY = action.fields.posY
      if (action.fields.ang !== undefined) directFields.ang = action.fields.ang
      if (Object.keys(directFields).length > 0) {
        newWalls = newWalls.map(w =>
          w.wallNumber === action.wallNumber ? { ...w, ...directFields } : w
        )
      }
      const newJoints = rebuildJoints(newWalls, state.room.wallJoints)
      return {
        ...state,
        room: { ...state.room, walls: newWalls, wallJoints: newJoints, rawText: '' },
      }
    }
    case 'SPLIT_WALL': {
      if (!state.room) return state
      const result = splitWallAtCenter(
        state.room.walls, state.room.wallJoints, state.room.products, action.wallNumber,
      )
      return {
        ...state,
        room: { ...state.room, walls: result.walls, wallJoints: result.joints, products: result.products, rawText: '' },
        selectedWall: null,
      }
    }
    case 'MOVE_JOINT': {
      if (!state.room) return state
      const movedWalls = moveJoint(
        state.room.walls, state.room.wallJoints, action.jointIndex, action.newX, action.newY,
      )
      const movedJoints = rebuildJoints(movedWalls, state.room.wallJoints)
      return {
        ...state,
        room: { ...state.room, walls: movedWalls, wallJoints: movedJoints, rawText: '' },
      }
    }
    case 'TOGGLE_FOLLOW_ANGLE': {
      if (!state.room) return state
      const faWalls = toggleFollowAngle(state.room.walls, action.wallNumber)
      return {
        ...state,
        room: { ...state.room, walls: faWalls, rawText: '' },
      }
    }
    case 'TOGGLE_JOINT_MITER': {
      if (!state.room) return state
      const mjJoint = state.room.wallJoints[action.jointIndex]
      if (!mjJoint) return state
      const mjJoints = toggleJointMiter(state.room.wallJoints, action.jointIndex)
      return {
        ...state,
        room: { ...state.room, wallJoints: mjJoints, rawText: '' },
      }
    }
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
      const newWalls = { ...state.visibility.walls, [action.wallNumber]: !cur }
      const deselect = cur && state.selectedWall === action.wallNumber
      return {
        ...state,
        visibility: { ...state.visibility, walls: newWalls },
        ...(deselect ? { selectedWall: null } : {}),
      }
    }
    case 'TOGGLE_VISIBILITY_MENU':
      return { ...state, visibilityMenuOpen: !state.visibilityMenuOpen }
    case 'SET_PLACEMENT_MODE':
      return { ...state, placementMode: action.mode }
    case 'SET_UNIT_HEIGHT':
      return { ...state, unitHeight: action.height }
    case 'SET_WALL_MOUNT_TOP_AT':
      return { ...state, wallMountTopAt: action.height }
    case 'TOGGLE_PRODUCT_CONFIG':
      return { ...state, productConfigOpen: !state.productConfigOpen }
    case 'SET_WALL_HEIGHT': {
      const wh = action.height
      if (!state.room) return { ...state, wallHeight: wh }
      const newWalls = state.room.walls.map(w => ({ ...w, height: wh }))
      const newParms = { ...state.room.parms, H_Walls: wh }
      return {
        ...state,
        wallHeight: wh,
        room: { ...state.room, walls: newWalls, parms: newParms, rawText: '' },
      }
    }
    case 'ADD_FIXTURE': {
      if (!state.room) return state
      return {
        ...state,
        room: { ...state.room, fixtures: [...state.room.fixtures, action.fixture], rawText: '' },
      }
    }
    case 'REMOVE_FIXTURE': {
      if (!state.room) return state
      return {
        ...state,
        room: {
          ...state.room,
          fixtures: state.room.fixtures.filter(f => f.idTag !== action.fixtureIdTag),
          rawText: '',
        },
      }
    }
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
