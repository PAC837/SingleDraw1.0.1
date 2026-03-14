/**
 * Floating mini 3D model that follows the cursor during product drag.
 * Handles drop: places product on hovered wall or cancels.
 */
import { useEffect, useRef, useState } from 'react'
import type { MozProduct, DynamicProductGroup } from '../mozaik/types'
import SpinningProductCard from './SpinningProductCard'

interface DragOverlayProps {
  dragProduct: { product: MozProduct; productIndex: number; group?: DynamicProductGroup }
  dragHoveredWall: number | null
  onDrop: (productIndex: number, wallNumber: number, group?: DynamicProductGroup) => void
  onCancel: () => void
}

export default function DragOverlay({ dragProduct, dragHoveredWall, onDrop, onCancel }: DragOverlayProps) {
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const didMove = useRef(false)

  useEffect(() => {
    const onMove = (e: PointerEvent) => {
      setPos({ x: e.clientX, y: e.clientY })
      didMove.current = true
    }
    const onUp = () => {
      if (!didMove.current) {
        // No movement — cancel (was just a click, not a drag)
        onCancel()
        return
      }
      if (dragHoveredWall !== null) {
        onDrop(dragProduct.productIndex, dragHoveredWall, dragProduct.group)
      } else {
        onCancel()
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }
  }, [dragProduct, dragHoveredWall, onDrop, onCancel])

  return (
    <div
      className="fixed z-50 pointer-events-none"
      style={{
        left: pos.x + 16,
        top: pos.y + 16,
        opacity: didMove.current ? 1 : 0,
      }}
    >
      <div className="rounded-lg border border-[var(--accent)] bg-[var(--bg-panel)] shadow-lg overflow-hidden">
        <SpinningProductCard product={dragProduct.product} width={80} height={100} />
      </div>
    </div>
  )
}
