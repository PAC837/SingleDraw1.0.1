import { createContext, useContext, useReducer, type Dispatch, type ReactNode } from 'react'
import type { AppState, MozRoom, MozFile, DebugOverlays } from './mozaik/types'

const defaultOverlays: DebugOverlays = {
  originMarker: true,
  axisGizmo: true,
  floorGrid: true,
  wallNormals: false,
  productForwardArrow: false,
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
}

type Action =
  | { type: 'LOAD_ROOM'; room: MozRoom }
  | { type: 'LOAD_MOZ'; file: MozFile }
  | { type: 'TOGGLE_OVERLAY'; key: keyof DebugOverlays }
  | { type: 'SELECT_WALL'; wallNumber: number | null }
  | { type: 'TOGGLE_UNITS' }
  | { type: 'CLEAR_ROOM' }
  | { type: 'CLEAR_PRODUCTS' }

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
    case 'CLEAR_ROOM':
      return { ...state, room: null }
    case 'CLEAR_PRODUCTS':
      return { ...state, standaloneProducts: [] }
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
