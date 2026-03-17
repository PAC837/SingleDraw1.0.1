/**
 * Product placement reducer — create room, place/remove products, drag, flip ops.
 */
import type { AppState, Visibility } from '../mozaik/types'
import type { Action } from '../store'
import { adjustNeighborGaps } from '../mozaik/wallPlacement'
import { resizeProduct } from '../mozaik/productResize'

const defaultVisibility: Visibility = {
  walls: {},
  allWalls: true,
  floor: true,
  products: true,
  inserts: true,
}

export function productReducer(state: AppState, action: Action): AppState | null {
  switch (action.type) {
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
    case 'TOGGLE_FLIP_OPS': {
      const newFlipOps = !state.flipOps
      if (!state.room || state.room.products.length < 2) {
        return { ...state, flipOps: newFlipOps }
      }
      let products = [...state.room.products]
      for (let i = 0; i < products.length; i++) {
        const adjs = adjustNeighborGaps(products, i, state.room.walls, state.room.wallJoints, newFlipOps)
        for (const adj of adjs) {
          products = products.map((pr, j) => j === adj.index ? { ...pr, x: adj.x } : pr)
        }
      }
      return { ...state, flipOps: newFlipOps, room: { ...state.room, products } }
    }
    case 'START_PRODUCT_DRAG':
      return { ...state, dragProduct: { product: action.product, productIndex: action.productIndex, group: action.group, unitTypeId: action.unitTypeId }, dragHoveredWall: null }
    case 'SET_DRAG_HOVERED_WALL':
      return { ...state, dragHoveredWall: action.wallNumber }
    case 'END_PRODUCT_DRAG':
      return { ...state, dragProduct: null, dragHoveredWall: null }
    default:
      return null
  }
}
