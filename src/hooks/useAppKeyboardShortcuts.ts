/**
 * App keyboard shortcuts — Ctrl+Z undo, Delete batch-remove, Escape clear selection, arrow key part cycling.
 */
import { useEffect } from 'react'
import { useAppState, useAppDispatch } from '../store'

export function useAppKeyboardShortcuts(
  handleRemoveProducts: (indices: number[]) => void,
) {
  const state = useAppState()
  const dispatch = useAppDispatch()

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        dispatch({ type: 'UNDO' })
      }
      if (e.key === 'Delete' && state.selectedProducts.length > 0 && state.elevationViewerProduct === null) {
        e.preventDefault()
        handleRemoveProducts([...state.selectedProducts])
      }
      if (e.key === 'Escape') {
        if (state.elevationViewerProduct !== null) {
          e.preventDefault()
          dispatch({ type: 'CLOSE_ELEVATION_VIEWER' })
        } else if (state.inspectedPart) {
          e.preventDefault()
          dispatch({ type: 'CLEAR_INSPECTION' })
        } else if (state.selectedProducts.length > 0) {
          e.preventDefault()
          dispatch({ type: 'CLEAR_SELECTION' })
        }
      }
      // Arrow keys cycle parts while inspector is open
      if (state.inspectedPart && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
        e.preventDefault()
        const { productIndex, partIndex } = state.inspectedPart
        const product = state.room?.products[productIndex] ?? state.standaloneProducts[productIndex]?.product
        if (product) {
          const count = product.parts.length
          const next = e.key === 'ArrowLeft'
            ? (partIndex - 1 + count) % count
            : (partIndex + 1) % count
          dispatch({ type: 'INSPECT_PART', part: { productIndex, partIndex: next } })
        }
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [dispatch, state.selectedProducts, state.inspectedPart, state.elevationViewerProduct, state.room, state.standaloneProducts, handleRemoveProducts])
}
