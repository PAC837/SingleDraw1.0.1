/**
 * Custom hook encapsulating product placement, manipulation,
 * collision-clamped movement, and bump callbacks.
 */

import { useCallback, useRef } from 'react'
import { useAppState, useAppDispatch } from '../store'
import { findNextAvailableX, placeProductOnWall, usableWallLength, computeProductXBounds, computeMaxProductWidth, adjustNeighborGaps, computeElevWidthAdjustment } from '../mozaik/wallPlacement'
import { PANEL_THICK } from '../mozaik/autoEndPanels'
import { resizeProduct } from '../mozaik/productResize'
import { isWallMount } from '../mozaik/types'

export function useProductActions() {
  const state = useAppState()
  const dispatch = useAppDispatch()

  // Ref keeps latest state accessible from stale closures (drag handlers
  // capture callbacks at pointerdown but state changes mid-drag)
  const stateRef = useRef(state)
  stateRef.current = state

  const handlePlaceProduct = useCallback(
    (productIndex: number, wallNumber: number) => {
      if (!state.room) return
      const mozFile = state.standaloneProducts[productIndex]
      if (!mozFile) return
      // Auto-detect floor vs wall from product name (PAC Library convention)
      const wm = isWallMount(mozFile.product.prodName)
      const sectionHeight = wm ? state.wallSectionHeight : state.unitHeight
      const resized = resizeProduct(mozFile.product, 'height', sectionHeight)
      const usable = usableWallLength(wallNumber, state.room.walls, state.room.wallJoints)
      const elev = Math.max(0, state.wallMountTopAt - sectionHeight)
      const nextX = findNextAvailableX(state.room.products, wallNumber, resized.width, sectionHeight, elev, resized.depth, usable, state.flipOps)
      if (nextX === null) {
        alert('No space on this wall for that product')
        return
      }
      const placed = placeProductOnWall(resized, wallNumber, nextX, elev)
      dispatch({ type: 'PLACE_PRODUCT', product: placed })
      dispatch({ type: 'SET_PLACEMENT_MODE', mode: wm ? 'wall' : 'floor' })
      console.log(`[ROOM] Placed "${resized.prodName}" (${wm ? 'wall' : 'floor'}) on wall ${wallNumber} at x=${nextX} elev=${elev}`)
    },
    [dispatch, state.room, state.standaloneProducts, state.wallMountTopAt, state.unitHeight, state.wallSectionHeight],
  )

  const handleUpdateProductDimension = useCallback(
    (index: number, field: 'width' | 'depth' | 'height', value: number, anchor?: 'left' | 'right') => {
      const room = stateRef.current.room
      if (field === 'width' && room) {
        const maxW = computeMaxProductWidth(
          room.products, index, room.walls, room.wallJoints, anchor, stateRef.current.flipOps,
        )
        dispatch({ type: 'UPDATE_ROOM_PRODUCT', index, field, value: Math.min(value, maxW) })
      } else if (field === 'height' && room) {
        // Height change: resize + auto-update elevation + adjust neighbor gaps
        dispatch({ type: 'UPDATE_ROOM_PRODUCT', index, field, value })
        // Floor products stay on ground; wall-mount products keep tops aligned
        const product = room.products[index]
        const wm = product ? isWallMount(product.prodName) : false
        const newElev = wm ? product.elev : 0
        dispatch({ type: 'UPDATE_ROOM_PRODUCT_ELEV', index, elev: newElev })
        // Cascade gap adjustments to neighbors
        const tempProducts = room.products.map((p, i) =>
          i === index ? { ...p, height: value } : p
        )
        const adjustments = adjustNeighborGaps(tempProducts, index, room.walls, room.wallJoints, stateRef.current.flipOps)
        for (const adj of adjustments) {
          dispatch({ type: 'UPDATE_ROOM_PRODUCT_X', index: adj.index, x: adj.x })
        }
      } else if (field === 'depth' && room) {
        // Depth change: resize + adjust neighbor gaps (depth affects panel sharing)
        dispatch({ type: 'UPDATE_ROOM_PRODUCT', index, field, value })
        const tempProducts = room.products.map((p, i) =>
          i === index ? { ...p, depth: value } : p
        )
        const adjustments = adjustNeighborGaps(tempProducts, index, room.walls, room.wallJoints, stateRef.current.flipOps)
        for (const adj of adjustments) {
          dispatch({ type: 'UPDATE_ROOM_PRODUCT_X', index: adj.index, x: adj.x })
        }
      } else {
        dispatch({ type: 'UPDATE_ROOM_PRODUCT', index, field, value })
      }
    },
    [dispatch],
  )

  /** Atomic width + X update for resize handles. Clamps width THEN computes X shift from the clamped value. */
  const handleResizeProductWidth = useCallback(
    (index: number, newWidth: number, anchor: 'left' | 'right') => {
      const room = stateRef.current.room
      if (!room) return
      const product = room.products[index]
      if (!product) return
      const maxW = computeMaxProductWidth(
        room.products, index, room.walls, room.wallJoints, anchor, stateRef.current.flipOps,
      )
      const clamped = Math.min(Math.max(203.2, newWidth), maxW)
      dispatch({ type: 'UPDATE_ROOM_PRODUCT', index, field: 'width' as const, value: clamped })
      if (anchor === 'right') {
        // Left ball: right edge stays fixed → shift X by clamped delta
        const widthDelta = clamped - product.width
        dispatch({ type: 'UPDATE_ROOM_PRODUCT_X', index, x: Math.max(0, product.x - widthDelta) })
      }
    },
    [dispatch],
  )

  const handleRemoveProduct = useCallback(
    (index: number) => {
      dispatch({ type: 'REMOVE_ROOM_PRODUCT', index })
    },
    [dispatch],
  )

  const selectProduct = useCallback(
    (index: number, shiftKey?: boolean) => {
      if (shiftKey) {
        dispatch({ type: 'TOGGLE_PRODUCT_SELECTION', index })
      } else {
        dispatch({ type: 'SELECT_PRODUCT', index })
      }
    },
    [dispatch],
  )

  const handleRemoveProducts = useCallback(
    (indices: number[]) => {
      dispatch({ type: 'REMOVE_ROOM_PRODUCTS', indices })
    },
    [dispatch],
  )

  const handleUpdateProductElev = useCallback(
    (index: number, elev: number) => {
      const room = stateRef.current.room
      if (!room) {
        dispatch({ type: 'UPDATE_ROOM_PRODUCT_ELEV', index, elev })
        return
      }
      const product = room.products[index]
      if (!product) return

      // Compute width/x adjustment from panel sharing changes
      const adj = computeElevWidthAdjustment(room.products, index, elev, stateRef.current.flipOps)

      dispatch({ type: 'UPDATE_ROOM_PRODUCT_ELEV', index, elev })

      if (adj.widthDelta !== 0) {
        const newWidth = Math.max(PANEL_THICK, product.width + adj.widthDelta)
        dispatch({ type: 'UPDATE_ROOM_PRODUCT', index, field: 'width' as const, value: newWidth })
      }
      if (adj.xDelta !== 0) {
        dispatch({ type: 'UPDATE_ROOM_PRODUCT_X', index, x: product.x + adj.xDelta })
      }
    },
    [dispatch],
  )

  const handleUpdateProductX = useCallback(
    (index: number, x: number) => {
      const room = stateRef.current.room
      if (!room) return
      const bounds = computeProductXBounds(
        room.products, index, room.walls, room.wallJoints, stateRef.current.flipOps,
      )
      const clamped = Math.min(Math.max(x, bounds.minX), bounds.maxX)
      dispatch({ type: 'UPDATE_ROOM_PRODUCT_X', index, x: clamped })
    },
    [dispatch],
  )

  const handleBumpLeft = useCallback(
    (index: number) => {
      const room = stateRef.current.room
      if (!room) return
      const bounds = computeProductXBounds(
        room.products, index, room.walls, room.wallJoints, stateRef.current.flipOps,
      )
      dispatch({ type: 'UPDATE_ROOM_PRODUCT_X', index, x: bounds.minX })
    },
    [dispatch],
  )

  const handleBumpRight = useCallback(
    (index: number) => {
      const room = stateRef.current.room
      if (!room) return
      const bounds = computeProductXBounds(
        room.products, index, room.walls, room.wallJoints, stateRef.current.flipOps,
      )
      dispatch({ type: 'UPDATE_ROOM_PRODUCT_X', index, x: bounds.maxX })
    },
    [dispatch],
  )

  return {
    handlePlaceProduct,
    handleUpdateProductDimension,
    handleResizeProductWidth,
    handleRemoveProduct,
    handleRemoveProducts,
    selectProduct,
    handleUpdateProductElev,
    handleUpdateProductX,
    handleBumpLeft,
    handleBumpRight,
  }
}
