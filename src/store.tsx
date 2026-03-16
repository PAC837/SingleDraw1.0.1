import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from 'react'
import { LinearToneMapping, ACESFilmicToneMapping } from 'three'
import { isWallMount } from './mozaik/types'
import type { AppState, Visibility, RenderMode, MozRoom, MozFile, MozProduct, MozFixture, MozWall, DebugOverlays, DragTarget, LibraryConfig, DynamicProductGroup } from './mozaik/types'
import type { RoomSettingsFile, RoomSetHardware } from './mozaik/settingsTemplateParser'
import type { HardwareCatalog } from './mozaik/hardwareDatParser'
import { updateWallLength, updateWallHeight, moveJoint, splitWallAtCenter, rebuildJoints, toggleFollowAngle, toggleJointMiter } from './math/wallEditor'
import { adjustNeighborGaps } from './mozaik/wallPlacement'
import { resizeProduct } from './mozaik/productResize'
import { moveShelfGroup, applyFixedShelfHeight, snapToGrid, removePartByIndexFromRawXml, removeFixedShelfSection } from './mozaik/shelfEditor'
import { snapModularHeight } from './mozaik/modularValues'
import { createDefaultColumns } from './mozaik/unitTypes'
import { createWalkInRoom } from './mozaik/roomFactory'

/** Pre-configured render setting combos with lighting. */
export const RENDER_PRESETS: Record<string, {
  label: string; mode: RenderMode; edgeOpacity: number; factor: number; units: number
  ambient: number; directional: number; warmth: number; exposure: number; toneMapping: number; bgColor: string
}> = {
  'ghosted-default': { label: 'Ghosted (Default)', mode: 'ghosted',   edgeOpacity: 0,    factor: 1, units: 1,
    ambient: 0.6, directional: 0.7, warmth: 0,    exposure: 1,   toneMapping: LinearToneMapping,      bgColor: '#ffffff' },
  'clean-solid':     { label: 'Clean Solid',       mode: 'solid',     edgeOpacity: 0,    factor: 1, units: 1,
    ambient: 0.6, directional: 0.7, warmth: 0,    exposure: 1,   toneMapping: LinearToneMapping,      bgColor: '#ffffff' },
  'cad-edges':       { label: 'CAD Edges',         mode: 'solid',     edgeOpacity: 0.8,  factor: 1, units: 1,
    ambient: 0.8, directional: 0.5, warmth: -0.3, exposure: 1,   toneMapping: LinearToneMapping,      bgColor: '#f0f0f0' },
  'warm-studio':     { label: 'Warm Studio',       mode: 'solid',     edgeOpacity: 0.3,  factor: 1, units: 1,
    ambient: 0.5, directional: 0.8, warmth: 0.5,  exposure: 1.2, toneMapping: ACESFilmicToneMapping,  bgColor: '#ffffff' },
  'cool-daylight':   { label: 'Cool Daylight',     mode: 'solid',     edgeOpacity: 0.5,  factor: 1, units: 1,
    ambient: 0.7, directional: 0.6, warmth: -0.5, exposure: 1,   toneMapping: LinearToneMapping,      bgColor: '#ffffff' },
  'blueprint':       { label: 'Blueprint',         mode: 'wireframe', edgeOpacity: 0,    factor: 1, units: 1,
    ambient: 0.6, directional: 0.7, warmth: 0,    exposure: 1,   toneMapping: LinearToneMapping,      bgColor: '#1a1a2e' },
  'x-ray':           { label: 'X-Ray',             mode: 'ghosted',   edgeOpacity: 0.5,  factor: 1, units: 1,
    ambient: 0.6, directional: 0.7, warmth: 0,    exposure: 1,   toneMapping: LinearToneMapping,      bgColor: '#ffffff' },
  'showroom':        { label: 'Showroom',          mode: 'solid',     edgeOpacity: 0.2,  factor: 1, units: 1,
    ambient: 0.4, directional: 0.9, warmth: 0.3,  exposure: 1.1, toneMapping: ACESFilmicToneMapping,  bgColor: '#ffffff' },
  'dramatic':        { label: 'Dramatic',          mode: 'solid',     edgeOpacity: 0.8,  factor: 1, units: 1,
    ambient: 0.2, directional: 1.2, warmth: 0.2,  exposure: 0.9, toneMapping: ACESFilmicToneMapping,  bgColor: '#2a2a2a' },
  'presentation':    { label: 'Presentation',      mode: 'solid',     edgeOpacity: 0.3,  factor: 1, units: 1,
    ambient: 0.6, directional: 0.7, warmth: 0.1,  exposure: 1,   toneMapping: ACESFilmicToneMapping,  bgColor: '#ffffff' },
}

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
  useInches: false,
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
  unitHeight: snapModularHeight(87 * 25.4),      // 87" → 2196.00mm (modular)
  wallSectionHeight: snapModularHeight(76 * 25.4), // 76" → 1908.00mm (modular)
  wallMountTopAt: snapModularHeight(87 * 25.4),   // auto-syncs with unitHeight
  wallHeight: 2438.4,       // 96 inches in mm
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
  fixedShelfHeight: 1632,  // mm — ~64.25" (default for 96" DH), snapped to 32mm grid
  baseCabHeight: 876.3,    // mm — 34.5" (standard base cabinet), from H_BaseCab
  hutchSectionHeight: snapModularHeight(48 * 25.4), // 48" hutch/upper-stack default
  settingsFile: null,
  activeTemplateName: null,
  hardwareCatalog: null,
}

type Action =
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

function reducer(state: AppState, action: Action): AppState {
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
    case 'TOGGLE_OVERLAY':
      return { ...state, overlays: { ...state.overlays, [action.key]: !state.overlays[action.key] } }
    case 'SELECT_WALL':
      return { ...state, selectedWall: action.wallNumber }
    case 'TOGGLE_UNITS':
      return { ...state, useInches: !state.useInches }
    case 'SET_RENDER_MODE':
      return { ...state, renderMode: action.mode, renderPreset: null }
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
    case 'CREATE_ROOM': {
      const newRoom = { ...action.room }
      // Auto-apply active settings template to new room
      if (!newRoom.roomSettings && state.activeTemplateName && state.settingsFile) {
        const tmpl = state.settingsFile.templates.find(t => t.name === state.activeTemplateName)
        if (tmpl) newRoom.roomSettings = JSON.parse(JSON.stringify(tmpl))
      }
      return { ...state, room: newRoom, selectedWall: null, visibility: defaultVisibility, wallHeight: newRoom.parms.H_Walls }
    }
    case 'PLACE_PRODUCT': {
      if (!state.room) return state
      let products = [...state.room.products, action.product]

      // If placed product is CRN, repack adjacent walls affected by its phantom arms
      if (action.product.isRectShape === false) {
        const wn = parseInt(action.product.wall.split('_')[0], 10)
        const wallIdx = state.room.walls.findIndex(w => w.wallNumber === wn)
        if (wallIdx >= 0) {
          const adjWalls = new Set<number>()
          const prevWall = state.room.walls[(wallIdx - 1 + state.room.walls.length) % state.room.walls.length]
          const nextWall = state.room.walls[(wallIdx + 1) % state.room.walls.length]
          adjWalls.add(prevWall.wallNumber)
          adjWalls.add(nextWall.wallNumber)
          for (const adjWn of adjWalls) {
            const idx = products.findIndex(p => parseInt(p.wall.split('_')[0], 10) === adjWn)
            if (idx >= 0) {
              const adjs = adjustNeighborGaps(products, idx, state.room.walls, state.room.wallJoints, state.flipOps)
              for (const adj of adjs) {
                products = products.map((pr, i) => i === adj.index ? { ...pr, x: adj.x } : pr)
              }
            }
          }
        }
      }
      return { ...state, room: { ...state.room, products } }
    }
    case 'UPDATE_ROOM_PRODUCT':
      if (!state.room) return state
      return {
        ...state,
        room: {
          ...state.room,
          products: state.room.products.map((p, i) =>
            i === action.index ? resizeProduct(p, action.field, action.value) : p
          ),
        },
      }
    case 'REMOVE_ROOM_PRODUCT':
      if (!state.room) return state
      return {
        ...state,
        selectedProducts: state.selectedProducts
          .filter(si => si !== action.index)
          .map(si => si > action.index ? si - 1 : si),
        room: {
          ...state.room,
          products: state.room.products.filter((_, i) => i !== action.index),
        },
      }
    case 'REMOVE_ROOM_PRODUCTS': {
      if (!state.room) return state
      const removeSet = new Set(action.indices)
      return {
        ...state,
        selectedProducts: [],
        room: {
          ...state.room,
          products: state.room.products.filter((_, i) => !removeSet.has(i)),
        },
      }
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
      const walls = { ...state.visibility.walls, [action.wallNumber]: !cur }
      return { ...state, visibility: { ...state.visibility, walls }, ...(cur && state.selectedWall === action.wallNumber ? { selectedWall: null } : {}) }
    }
    case 'TOGGLE_VISIBILITY_MENU':
      return { ...state, visibilityMenuOpen: !state.visibilityMenuOpen }
    case 'SET_PLACEMENT_MODE':
      return { ...state, placementMode: action.mode }
    case 'SET_UNIT_HEIGHT': {
      const snapped = snapModularHeight(action.height)
      if (!state.room || state.room.products.length === 0) {
        return { ...state, unitHeight: snapped, wallMountTopAt: snapped }
      }
      const products = state.room.products.map(p => {
        if (!isWallMount(p.prodName)) {
          // Floor product → resize to new floor height, then apply shelf preference
          let resized = resizeProduct(p, 'height', snapped)
          if (state.fixedShelfHeight > 0) {
            resized = applyFixedShelfHeight(resized, state.fixedShelfHeight)
          }
          return resized
        }
        // Wall product → reposition so top aligns to new unitHeight
        return { ...p, elev: Math.max(0, snapped - p.height) }
      })
      return {
        ...state,
        unitHeight: snapped,
        wallMountTopAt: snapped,
        room: { ...state.room, products },
      }
    }
    case 'SET_FIXED_SHELF_HEIGHT': {
      const snapped = snapToGrid(action.height)
      console.log(`[SHELF] SET_FIXED_SHELF_HEIGHT: raw=${action.height.toFixed(1)}mm → snapped=${snapped}mm`)
      if (!state.room || state.room.products.length === 0) {
        return { ...state, fixedShelfHeight: snapped }
      }
      const shelfProducts = state.room.products.map(p => {
        if (!isWallMount(p.prodName)) {
          return applyFixedShelfHeight(p, snapped)
        }
        return p
      })
      return {
        ...state,
        fixedShelfHeight: snapped,
        room: { ...state.room, products: shelfProducts, rawText: '' },
      }
    }
    case 'SET_BASE_CAB_HEIGHT': {
      const rounded = Math.round(action.height)
      const newState = { ...state, baseCabHeight: rounded }
      if (state.room) {
        newState.room = {
          ...state.room,
          parms: { ...state.room.parms, H_BaseCab: rounded },
          rawText: '',
        }
      }
      return newState
    }
    case 'SET_HUTCH_SECTION_HEIGHT': {
      const snapped = snapModularHeight(action.height)
      return { ...state, hutchSectionHeight: snapped }
    }
    case 'SET_WALL_SECTION_HEIGHT': {
      const snapped = snapModularHeight(action.height)
      if (!state.room || state.room.products.length === 0) {
        return { ...state, wallSectionHeight: snapped }
      }
      const products = state.room.products.map(p => {
        if (!isWallMount(p.prodName)) return p // floor products unchanged
        // Wall product → resize height + recompute elev
        const resized = resizeProduct(p, 'height', snapped)
        return { ...resized, elev: Math.max(0, state.wallMountTopAt - snapped) }
      })
      return {
        ...state,
        wallSectionHeight: snapped,
        room: { ...state.room, products },
      }
    }
    case 'SET_WALL_MOUNT_TOP_AT':
      return { ...state, wallMountTopAt: action.height }
    case 'CLOSE_PANELS':
      return { ...state, productConfigOpen: false, visibilityMenuOpen: false, adminOpen: false, wallEditorActive: false, selectedWall: null, elevationViewerProduct: null }
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
    case 'MOVE_FIXTURE': {
      if (!state.room) return state
      const fixtures = state.room.fixtures.map(f => f.idTag === action.fixtureIdTag ? { ...f, x: action.x } : f)
      return { ...state, room: { ...state.room, fixtures, rawText: '' } }
    }
    case 'UPDATE_FIXTURE': {
      if (!state.room) return state
      const uf = state.room.fixtures.map(f => f.idTag === action.fixtureIdTag ? { ...f, ...action.fields } : f)
      return { ...state, room: { ...state.room, fixtures: uf, rawText: '' } }
    }
    case 'TOGGLE_LIBRARY':
      return { ...state, libraryOpen: !state.libraryOpen }
    case 'SELECT_PRODUCT':
      return { ...state, selectedProducts: action.index !== null ? [action.index] : [], inspectedPart: null }
    case 'TOGGLE_PRODUCT_SELECTION': {
      const idx = action.index
      const has = state.selectedProducts.includes(idx)
      return { ...state, selectedProducts: has ? state.selectedProducts.filter(i => i !== idx) : [...state.selectedProducts, idx] }
    }
    case 'CLEAR_SELECTION':
      return { ...state, selectedProducts: [], inspectedPart: null }
    case 'UPDATE_ROOM_PRODUCT_ELEV': {
      if (!state.room) return state
      return {
        ...state,
        room: {
          ...state.room,
          products: state.room.products.map((p, i) =>
            i === action.index ? { ...p, elev: action.elev } : p
          ),
        },
      }
    }
    case 'UPDATE_ROOM_PRODUCT_X': {
      if (!state.room) return state
      return {
        ...state,
        room: {
          ...state.room,
          products: state.room.products.map((p, i) =>
            i === action.index ? { ...p, x: Math.max(0, action.x) } : p
          ),
        },
      }
    }
    case 'TOGGLE_FLIP_OPS': {
      const newFlipOps = !state.flipOps
      if (!state.room || state.room.products.length < 2) {
        return { ...state, flipOps: newFlipOps }
      }
      // Repack all walls so gaps match the new panel sharing mode
      let products = [...state.room.products]
      for (let i = 0; i < products.length; i++) {
        const adjs = adjustNeighborGaps(products, i, state.room.walls, state.room.wallJoints, newFlipOps)
        for (const adj of adjs) {
          products = products.map((pr, j) => j === adj.index ? { ...pr, x: adj.x } : pr)
        }
      }
      return { ...state, flipOps: newFlipOps, room: { ...state.room, products } }
    }
    case 'TOGGLE_SHOW_OPERATIONS':
      return { ...state, showOperations: !state.showOperations }
    case 'TOGGLE_SHAPE_DEBUG':
      return { ...state, showShapeDebug: !state.showShapeDebug }
    case 'TOGGLE_SPINNING_3D_CARDS':
      return { ...state, spinning3DCards: !state.spinning3DCards }
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
    case 'TOGGLE_ADMIN':
      return { ...state, adminOpen: !state.adminOpen }
    case 'SET_LIBRARY_CONFIG':
      return { ...state, libraryConfig: action.config }
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
    case 'UPDATE_SHELF_HEIGHT': {
      if (!state.room) return state
      const prod = state.room.products[action.productIndex]
      if (!prod) return state
      const updated = moveShelfGroup(prod, action.shelfPartIndex, action.newZ)
      if (updated === prod) return state
      return {
        ...state,
        room: {
          ...state.room,
          products: state.room.products.map((p, i) => i === action.productIndex ? updated : p),
          rawText: '',
        },
      }
    }
    case 'DELETE_PRODUCT_PART': {
      if (!state.room) return state
      const dProd = state.room.products[action.productIndex]
      if (!dProd || !dProd.parts[action.partIndex]) return state
      const deletedPart = dProd.parts[action.partIndex]
      const newParts = dProd.parts.filter((_, i) => i !== action.partIndex)
      let newRawXml = removePartByIndexFromRawXml(dProd.rawInnerXml, action.partIndex)
      // If deleted part is a FixedShelf, also remove the FS section from ProductInterior
      // so Mozaik doesn't regenerate the shelf on import
      const dt = deletedPart.type.toLowerCase()
      if (dt === 'fixedshelf' || dt === 'fixed shelf' || deletedPart.reportName.includes('F.Shelf')) {
        newRawXml = removeFixedShelfSection(newRawXml)
      }
      console.log(`[DELETE] Removed part "${deletedPart.name}" (index ${action.partIndex}), rawXml: ${dProd.rawInnerXml.length} → ${newRawXml.length}`)
      return {
        ...state,
        room: {
          ...state.room,
          products: state.room.products.map((p, i) =>
            i === action.productIndex ? { ...p, parts: newParts, rawInnerXml: newRawXml } : p
          ),
          rawText: '',
        },
      }
    }
    case 'START_PRODUCT_DRAG':
      return { ...state, dragProduct: { product: action.product, productIndex: action.productIndex, group: action.group, unitTypeId: action.unitTypeId }, dragHoveredWall: null }
    case 'SET_DRAG_HOVERED_WALL':
      return { ...state, dragHoveredWall: action.wallNumber }
    case 'END_PRODUCT_DRAG':
      return { ...state, dragProduct: null, dragHoveredWall: null }
    case 'ALIGN_WALL_TOPS': {
      if (!state.room || state.room.products.length === 0) return state
      const targetTop = state.unitHeight
      const products = state.room.products.map(p => {
        if (!isWallMount(p.prodName)) {
          // Floor section taller than unitHeight → shrink it
          if (p.height > targetTop + 0.5) {
            return resizeProduct(p, 'height', targetTop)
          }
          return p
        }
        // Wall section → reposition so top = unitHeight
        return { ...p, elev: Math.max(0, targetTop - p.height) }
      })
      return { ...state, room: { ...state.room, products } }
    }
    case 'LOAD_SETTINGS_FILE':
      return { ...state, settingsFile: action.file }
    case 'SET_ACTIVE_TEMPLATE': {
      const tmpl = state.settingsFile?.templates.find(t => t.name === action.name)
      if (!tmpl) return { ...state, activeTemplateName: action.name }
      // Deep-copy template settings into current room
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
      // Also update the rawAttributes record so serialization picks up the change
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
      return state
  }
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
