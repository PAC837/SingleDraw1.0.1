import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from 'react'
import { LinearToneMapping, ACESFilmicToneMapping } from 'three'
import { isWallMount } from './mozaik/types'
import type { AppState, Visibility, RenderMode, MozRoom, MozFile, MozProduct, MozFixture, MozWall, DebugOverlays, DragTarget } from './mozaik/types'
import { updateWallLength, updateWallHeight, moveJoint, splitWallAtCenter, rebuildJoints, toggleFollowAngle, toggleJointMiter } from './math/wallEditor'
import { adjustNeighborGaps } from './mozaik/wallPlacement'
import { resizeProduct } from './mozaik/productResize'
import { snapModularHeight } from './mozaik/modularValues'

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
  unitHeight: snapModularHeight(87 * 25.4),      // 87" → 2196.00mm (modular)
  wallSectionHeight: snapModularHeight(76 * 25.4), // 76" → 1908.00mm (modular)
  wallMountTopAt: snapModularHeight(87 * 25.4),   // auto-syncs with unitHeight
  wallHeight: 2438.4,       // 96 inches in mm
  productConfigOpen: false,
  libraryOpen: false,
  cameraResetKey: 0,
  selectedProduct: null,
  flipOps: false,
  edgeOpacity: 0.5,
  polygonOffsetFactor: 1,
  polygonOffsetUnits: 1,
  renderPreset: 'ghosted-default',
  ambientIntensity: 0.6,
  directionalIntensity: 0.7,
  warmth: 0,
  exposure: 1.0,
  toneMapping: LinearToneMapping,
  bgColor: '#ffffff',
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
  | { type: 'UPDATE_ROOM_PRODUCT'; index: number; field: 'width' | 'depth' | 'height'; value: number }
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
  | { type: 'SET_WALL_SECTION_HEIGHT'; height: number }
  | { type: 'SET_WALL_MOUNT_TOP_AT'; height: number }
  | { type: 'TOGGLE_PRODUCT_CONFIG' }
  | { type: 'SET_WALL_HEIGHT'; height: number }
  | { type: 'ADD_FIXTURE'; fixture: MozFixture }
  | { type: 'REMOVE_FIXTURE'; fixtureIdTag: number }
  | { type: 'SELECT_PRODUCT'; index: number | null }
  | { type: 'UPDATE_ROOM_PRODUCT_ELEV'; index: number; elev: number }
  | { type: 'UPDATE_ROOM_PRODUCT_X'; index: number; x: number }
  | { type: 'MOVE_FIXTURE'; fixtureIdTag: number; x: number }
  | { type: 'UPDATE_FIXTURE'; fixtureIdTag: number; fields: Partial<Pick<MozFixture, 'width' | 'height' | 'elev' | 'x'>> }
  | { type: 'TOGGLE_LIBRARY' }
  | { type: 'TOGGLE_FLIP_OPS' }
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
  | { type: 'UNDO' }

function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'GO_HOME':
      return {
        ...state,
        wallEditorActive: false,
        selectedWall: null,
        selectedProduct: null,
        dragTarget: null,
        visibilityMenuOpen: false,
        productConfigOpen: false,
        libraryOpen: false,
        cameraResetKey: state.cameraResetKey + 1,
      }
    case 'LOAD_ROOM':
      return { ...state, room: action.room, visibility: defaultVisibility, wallHeight: action.room.parms.H_Walls }
    case 'LOAD_MOZ':
      return { ...state, standaloneProducts: [...state.standaloneProducts, action.file] }
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
            i === action.index ? resizeProduct(p, action.field, action.value) : p
          ),
        },
      }
    case 'REMOVE_ROOM_PRODUCT':
      if (!state.room) return state
      return {
        ...state,
        selectedProduct: state.selectedProduct === action.index ? null
          : state.selectedProduct !== null && state.selectedProduct > action.index
            ? state.selectedProduct - 1 : state.selectedProduct,
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
          // Floor product → resize to new floor height
          return resizeProduct(p, 'height', snapped)
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
      return { ...state, selectedProduct: action.index }
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
      const seenWalls = new Set<number>()
      for (const p of products) {
        const wn = parseInt(p.wall.split('_')[0], 10)
        if (seenWalls.has(wn)) continue
        seenWalls.add(wn)
        const idx = products.indexOf(p)
        const adjs = adjustNeighborGaps(products, idx, state.room.walls, state.room.wallJoints, newFlipOps)
        for (const adj of adjs) {
          products = products.map((pr, i) => i === adj.index ? { ...pr, x: adj.x } : pr)
        }
      }
      return { ...state, flipOps: newFlipOps, room: { ...state.room, products } }
    }
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
    default:
      return state
  }
}

// Undo system — wraps reducer with history stack (max 50 snapshots)
const UNDOABLE = new Set([
  'PLACE_PRODUCT', 'REMOVE_ROOM_PRODUCT', 'UPDATE_ROOM_PRODUCT',
  'MOVE_FIXTURE', 'UPDATE_FIXTURE', 'ADD_FIXTURE', 'REMOVE_FIXTURE',
  'MOVE_JOINT', 'SPLIT_WALL', 'UPDATE_WALL', 'CREATE_ROOM', 'CLEAR_ROOM',
])

function undoReducer(
  swh: { current: AppState; undoStack: AppState[] }, action: Action,
): { current: AppState; undoStack: AppState[] } {
  if (action.type === 'UNDO') {
    const prev = swh.undoStack[swh.undoStack.length - 1]
    return prev ? { current: prev, undoStack: swh.undoStack.slice(0, -1) } : swh
  }
  const next = reducer(swh.current, action)
  if (next === swh.current) return swh
  if (UNDOABLE.has(action.type)) {
    return { current: next, undoStack: [...swh.undoStack.slice(-49), swh.current] }
  }
  return { current: next, undoStack: swh.undoStack }
}

const StateCtx = createContext<AppState>(initialState)
const DispatchCtx = createContext<Dispatch<Action>>(() => {})

export function StoreProvider({ children }: { children: ReactNode }) {
  const [swh, dispatch] = useReducer(undoReducer, { current: initialState, undoStack: [] })
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
