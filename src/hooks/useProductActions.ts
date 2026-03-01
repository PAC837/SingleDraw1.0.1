/**
 * Custom hook encapsulating product placement, manipulation,
 * collision-clamped movement, and bump callbacks.
 */

import { useCallback } from 'react'
import { useAppState, useAppDispatch } from '../store'
import { findNextAvailableX, placeProductOnWall, usableWallLength, computeProductXBounds } from '../mozaik/wallPlacement'

export function useProductActions() {
  const state = useAppState()
  const dispatch = useAppDispatch()

  const handlePlaceProduct = useCallback(
    (productIndex: number, wallNumber: number) => {
      if (!state.room) return
      const mozFile = state.standaloneProducts[productIndex]
      if (!mozFile) return
      const usable = usableWallLength(wallNumber, state.room.walls, state.room.wallJoints)
      const nextX = findNextAvailableX(state.room.products, wallNumber, mozFile.product.width, usable)
      if (nextX === null) {
        alert('No space on this wall for that product')
        return
      }
      const elev = state.placementMode === 'floor' ? 0
        : Math.max(0, state.wallMountTopAt - state.unitHeight)
      const placed = placeProductOnWall(mozFile.product, wallNumber, nextX, elev)
      dispatch({ type: 'PLACE_PRODUCT', product: placed })
      console.log(`[ROOM] Placed "${mozFile.product.prodName}" on wall ${wallNumber} at x=${nextX} elev=${elev}`)
    },
    [dispatch, state.room, state.standaloneProducts, state.placementMode, state.wallMountTopAt, state.unitHeight],
  )

  const handleUpdateProductDimension = useCallback(
    (index: number, field: 'width' | 'depth' | 'height', value: number) => {
      dispatch({ type: 'UPDATE_ROOM_PRODUCT', index, field, value })
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
    (index: number) => dispatch({ type: 'SELECT_PRODUCT', index }),
    [dispatch],
  )

  const handleUpdateProductElev = useCallback(
    (index: number, elev: number) => dispatch({ type: 'UPDATE_ROOM_PRODUCT_ELEV', index, elev }),
    [dispatch],
  )

  const handleUpdateProductX = useCallback(
    (index: number, x: number) => {
      if (!state.room) return
      const bounds = computeProductXBounds(
        state.room.products, index, state.room.walls, state.room.wallJoints,
      )
      const clamped = Math.min(Math.max(x, bounds.minX), bounds.maxX)
      dispatch({ type: 'UPDATE_ROOM_PRODUCT_X', index, x: clamped })
    },
    [dispatch, state.room],
  )

  const handleBumpLeft = useCallback(
    (index: number) => {
      if (!state.room) return
      const bounds = computeProductXBounds(
        state.room.products, index, state.room.walls, state.room.wallJoints,
      )
      dispatch({ type: 'UPDATE_ROOM_PRODUCT_X', index, x: bounds.minX })
    },
    [dispatch, state.room],
  )

  const handleBumpRight = useCallback(
    (index: number) => {
      if (!state.room) return
      const bounds = computeProductXBounds(
        state.room.products, index, state.room.walls, state.room.wallJoints,
      )
      dispatch({ type: 'UPDATE_ROOM_PRODUCT_X', index, x: bounds.maxX })
    },
    [dispatch, state.room],
  )

  return {
    handlePlaceProduct,
    handleUpdateProductDimension,
    handleRemoveProduct,
    selectProduct,
    handleUpdateProductElev,
    handleUpdateProductX,
    handleBumpLeft,
    handleBumpRight,
  }
}
