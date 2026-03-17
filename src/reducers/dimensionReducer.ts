/**
 * Dimension reducer — height settings, shelf operations, product elev/x, wall height.
 */
import { isWallMount } from '../mozaik/types'
import type { AppState } from '../mozaik/types'
import type { Action } from '../store'
import { resizeProduct } from '../mozaik/productResize'
import { moveShelfGroup, moveAdjShelfGroup, applyFixedShelfHeight, snapToGrid, removePartByIndexFromRawXml, removeFixedShelfSection } from '../mozaik/shelfEditor'
import { snapModularHeight } from '../mozaik/modularValues'
import { updatePartAttrByIndex, upsertCabProdParm } from '../mozaik/xmlMutations'

export function dimensionReducer(state: AppState, action: Action): AppState | null {
  switch (action.type) {
    case 'SET_UNIT_HEIGHT': {
      const snapped = snapModularHeight(action.height)
      if (!state.room || state.room.products.length === 0) {
        return { ...state, unitHeight: snapped, wallMountTopAt: snapped }
      }
      const products = state.room.products.map(p => {
        if (!isWallMount(p.prodName)) {
          let resized = resizeProduct(p, 'height', snapped)
          if (state.fixedShelfHeight > 0) {
            resized = applyFixedShelfHeight(resized, state.fixedShelfHeight)
          }
          return resized
        }
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
        if (!isWallMount(p.prodName)) return p
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
    case 'UPDATE_SHELF_HEIGHT': {
      if (!state.room) return state
      const prod = state.room.products[action.productIndex]
      if (!prod) return state
      const shelfPart = prod.parts[action.shelfPartIndex]
      if (!shelfPart) return state
      const st = shelfPart.type.toLowerCase()
      const isAdj = st === 'adjustableshelf' || st === 'adjustable shelf'
      const updated = isAdj
        ? moveAdjShelfGroup(prod, action.shelfPartIndex, action.newZ)
        : moveShelfGroup(prod, action.shelfPartIndex, action.newZ)
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
      const dt = deletedPart.type.toLowerCase()
      if (dt === 'fixedshelf' || dt === 'fixed shelf' || deletedPart.reportName.includes('F.Shelf')) {
        newRawXml = removeFixedShelfSection(newRawXml)
      }
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
    case 'ALIGN_WALL_TOPS': {
      if (!state.room || state.room.products.length === 0) return state
      const targetTop = state.unitHeight
      const products = state.room.products.map(p => {
        if (!isWallMount(p.prodName)) {
          if (p.height > targetTop + 0.5) {
            return resizeProduct(p, 'height', targetTop)
          }
          return p
        }
        return { ...p, elev: Math.max(0, targetTop - p.height) }
      })
      return { ...state, room: { ...state.room, products } }
    }
    case 'SET_TOE_RECESS': {
      const value = Math.max(0, action.value)
      if (!state.room || state.room.products.length === 0) {
        return { ...state, toeRecess: value }
      }
      const toeProducts = state.room.products.map(p => {
        if (isWallMount(p.prodName)) return p
        const toeIdx = p.parts.findIndex(pt => pt.type.toLowerCase() === 'toe')
        if (toeIdx < 0) return p
        const newParts = p.parts.map((part, i) =>
          i === toeIdx ? { ...part, y: value } : part
        )
        let newRawXml = p.rawInnerXml
        if (newRawXml) {
          newRawXml = updatePartAttrByIndex(newRawXml, toeIdx, [{ attr: 'Y', newValue: value }])
          newRawXml = upsertCabProdParm(newRawXml, 'ToeR', value)
        }
        return { ...p, parts: newParts, rawInnerXml: newRawXml }
      })
      return { ...state, toeRecess: value, room: { ...state.room, products: toeProducts } }
    }
    case 'SET_TOE_HEIGHT': {
      const value = snapToGrid(Math.max(0, action.value))
      if (!state.room || state.room.products.length === 0) {
        return { ...state, toeHeight: value }
      }
      const thProducts = state.room.products.map(p => {
        if (isWallMount(p.prodName)) return p
        const toeIdx = p.parts.findIndex(pt => pt.type.toLowerCase() === 'toe')
        if (toeIdx < 0) return p
        const botIdx = p.parts.findIndex(pt => pt.type.toLowerCase() === 'bottom')
        const newParts = p.parts.map((part, i) => {
          if (i === toeIdx) return { ...part, w: value, z: value }
          if (i === botIdx) return { ...part, z: value }
          return part
        })
        let newRawXml = p.rawInnerXml
        if (newRawXml) {
          newRawXml = updatePartAttrByIndex(newRawXml, toeIdx, [
            { attr: 'W', newValue: value },
            { attr: 'Z', newValue: value },
          ])
          if (botIdx >= 0) {
            newRawXml = updatePartAttrByIndex(newRawXml, botIdx, [{ attr: 'Z', newValue: value }])
          }
          newRawXml = upsertCabProdParm(newRawXml, 'ToeH', value)
        }
        return { ...p, parts: newParts, rawInnerXml: newRawXml }
      })
      return { ...state, toeHeight: value, room: { ...state.room, products: thProducts } }
    }
    case 'SET_FASTENER_LARGE_DIA':
      return { ...state, fastenerLargeDia: Math.max(0, action.value) }
    case 'SET_FASTENER_SMALL_DIA':
      return { ...state, fastenerSmallDia: Math.max(0, action.value) }
    default:
      return null
  }
}
