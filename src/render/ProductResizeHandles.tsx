/**
 * 5 draggable handle balls in a cross pattern on the front face of a product.
 *
 *          [Height]
 *             ●
 *             |
 *  [Width] ●──●──● [Width]
 *           (Move)
 *             |
 *             ●
 *          [Elev]
 *
 * Each ball has a single job. Simple pixel-to-mm drag (no NDC projection).
 * OrbitControls disabled during drag to prevent camera zoom/pan.
 * Snapping: width = 1" increments, height = modular, elev = 1".
 */

import { useRef, useState, useCallback } from 'react'
import { useThree } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { Vector3 } from 'three'
import type { MozProduct } from '../mozaik/types'
import { mozPosToThree } from '../math/basis'
import { MODULAR_HEIGHTS, MODULAR_DEPTHS } from '../mozaik/modularValues'

const INCH = 25.4
const BALL_R = 30
const LOCK_THRESHOLD = 5 // pixels before move ball locks to an axis

type HandleRole = 'width' | 'height' | 'elev' | 'move'

function snapValue(raw: number, field: 'width' | 'depth' | 'height' | 'elev'): number {
  if (raw <= 0) return raw
  switch (field) {
    case 'width':
      return Math.round(raw / INCH) * INCH
    case 'depth': {
      let best = MODULAR_DEPTHS[0]
      let bestDist = Math.abs(raw - best)
      for (const d of MODULAR_DEPTHS) {
        const dist = Math.abs(raw - d)
        if (dist < bestDist) { best = d; bestDist = dist }
      }
      return best
    }
    case 'height': {
      let best = MODULAR_HEIGHTS[0]
      let bestDist = Math.abs(raw - best)
      for (const h of MODULAR_HEIGHTS) {
        const dist = Math.abs(raw - h)
        if (dist < bestDist) { best = h; bestDist = dist }
      }
      return best
    }
    case 'elev':
      return Math.round(raw / INCH) * INCH
  }
}

/** Snap elevation so that (elev + productHeight) lands on a modular height. */
function snapElevToModular(rawElev: number, productHeight: number): number {
  let bestElev = 0
  let bestDist = Math.abs(rawElev)
  for (const h of MODULAR_HEIGHTS) {
    const candidate = h - productHeight
    if (candidate < -0.5) continue
    const e = Math.max(0, candidate)
    const dist = Math.abs(rawElev - e)
    if (dist < bestDist) { bestElev = e; bestDist = dist }
  }
  return bestElev
}

interface HandleBallProps {
  mozPos: [number, number, number]
  role: HandleRole
  sign: number
  wallAngleDeg?: number
  product: MozProduct
  productIndex: number
  onResize: (index: number, field: 'width' | 'depth' | 'height', value: number, anchor?: 'left' | 'right') => void
  onResizeWidth: (index: number, value: number, anchor: 'left' | 'right') => void
  onUpdateElev: (index: number, elev: number) => void
  onUpdateX: (index: number, x: number) => void
}

function HandleBall({
  mozPos, role, sign, wallAngleDeg, product, productIndex, onResize, onResizeWidth, onUpdateElev, onUpdateX,
}: HandleBallProps) {
  // Compute whether local X axis is flipped relative to screen-right
  const groupRotY = ((wallAngleDeg ?? 0) + product.rot) * Math.PI / 180
  const screenSign = Math.cos(groupRotY) < 0 ? -1 : 1
  const { camera, gl, controls } = useThree()
  const [hovered, setHovered] = useState(false)
  const [active, setActive] = useState(false)
  const dragging = useRef(false)
  const startMouse = useRef({ x: 0, y: 0 })
  const startVals = useRef({ width: 0, height: 0, elev: 0, x: 0 })
  const moveAxis = useRef<'x' | 'y' | null>(null)

  const pos = mozPosToThree(mozPos[0], mozPos[1], mozPos[2])

  const mmPerPixel = useCallback(() => {
    const camDist = camera.position.distanceTo(new Vector3(0, 0, 0))
    if ('fov' in camera && typeof camera.fov === 'number') {
      const fovRad = (camera.fov * Math.PI) / 180
      return (2 * camDist * Math.tan(fovRad / 2)) / gl.domElement.clientHeight
    }
    return 1
  }, [camera, gl])

  const onPointerDown = useCallback((e: any) => {
    e.stopPropagation()
    dragging.current = true
    moveAxis.current = null
    setActive(true)
    startMouse.current = {
      x: e.clientX ?? e.nativeEvent?.clientX ?? 0,
      y: e.clientY ?? e.nativeEvent?.clientY ?? 0,
    }
    startVals.current = {
      width: product.width,
      height: product.height,
      elev: product.elev,
      x: product.x,
    }

    // Disable OrbitControls to prevent camera zoom/pan during drag
    const ctrl = controls as any
    if (ctrl) ctrl.enabled = false

    const scale = mmPerPixel()

    const onMove = (ev: PointerEvent) => {
      if (!dragging.current) return
      const dx = ev.clientX - startMouse.current.x
      const dy = ev.clientY - startMouse.current.y
      const dxMm = dx * scale
      const dyMm = -dy * scale  // screen Y is inverted

      switch (role) {
        case 'width': {
          const raw = startVals.current.width + dxMm * sign * screenSign
          const snapped = snapValue(Math.max(INCH, raw), 'width')
          // Left ball (sign<0) anchors left side; right ball (sign>0) anchors right side
          const anchor: 'left' | 'right' = sign < 0 ? 'left' : 'right'
          onResizeWidth(productIndex, snapped, anchor)
          break
        }
        case 'height': {
          const raw = startVals.current.height + dyMm
          const snapped = snapValue(Math.max(MODULAR_HEIGHTS[0], raw), 'height')
          onResize(productIndex, 'height', snapped)
          break
        }
        case 'elev': {
          const raw = startVals.current.elev + dyMm
          const snapped = snapElevToModular(Math.max(0, raw), product.height)
          onUpdateElev(productIndex, snapped)
          break
        }
        case 'move': {
          // Lock to dominant axis on first significant movement
          if (!moveAxis.current) {
            if (Math.abs(dx) > LOCK_THRESHOLD) moveAxis.current = 'x'
            else if (Math.abs(dy) > LOCK_THRESHOLD) moveAxis.current = 'y'
            else break // not enough movement yet
          }
          if (moveAxis.current === 'x') {
            const newX = snapValue(Math.max(0, startVals.current.x + dxMm), 'width')
            onUpdateX(productIndex, newX)
          } else {
            const newElev = snapElevToModular(Math.max(0, startVals.current.elev + dyMm), product.height)
            onUpdateElev(productIndex, newElev)
          }
          break
        }
      }
    }

    const onUp = () => {
      dragging.current = false
      moveAxis.current = null
      setActive(false)
      document.body.style.cursor = ''
      // Re-enable OrbitControls
      if (ctrl) ctrl.enabled = true
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    document.body.style.cursor = 'grabbing'
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [role, sign, screenSign, product, productIndex, onResize, onResizeWidth, onUpdateElev, onUpdateX, gl, controls, mmPerPixel])

  const color = active ? '#FFFF00' : hovered ? '#CCFF44' : '#AAFF00'
  const s = active ? 1.2 : hovered ? 1.4 : 1.0

  return (
    <mesh
      position={pos}
      scale={[s, s, s]}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'grab' }}
      onPointerOut={() => { setHovered(false); if (!dragging.current) document.body.style.cursor = '' }}
      onPointerDown={onPointerDown}
      renderOrder={1000}
    >
      <sphereGeometry args={[BALL_R, 16, 12]} />
      <meshBasicMaterial color={color} depthTest={false} transparent opacity={0.85} />
    </mesh>
  )
}

/** Red click-only ball at a product corner — bumps section left or right. */
function BumpBall({
  mozPos, productIndex, onBump,
}: {
  mozPos: [number, number, number]
  productIndex: number
  onBump: (index: number) => void
}) {
  const [hovered, setHovered] = useState(false)
  const { controls } = useThree()
  const pos = mozPosToThree(mozPos[0], mozPos[1], mozPos[2])

  const onPointerDown = useCallback((e: any) => {
    e.stopPropagation()
    const ctrl = controls as any
    if (ctrl) ctrl.enabled = false
    const restore = () => {
      if (ctrl) ctrl.enabled = true
      window.removeEventListener('pointerup', restore)
    }
    window.addEventListener('pointerup', restore)
  }, [controls])

  const onClick = useCallback((e: any) => {
    e.stopPropagation()
    onBump(productIndex)
  }, [productIndex, onBump])

  const s = hovered ? 1.3 : 1.0

  return (
    <mesh
      position={pos}
      scale={[s, s, s]}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = '' }}
      onPointerDown={onPointerDown}
      onClick={onClick}
      renderOrder={1000}
    >
      <sphereGeometry args={[BALL_R * 0.75, 16, 12]} />
      <meshBasicMaterial color={hovered ? '#FF4444' : '#CC0000'} depthTest={false} transparent opacity={0.85} />
    </mesh>
  )
}

/** Red draggable ball that resizes depth — snaps to modular depths. */
function DepthDragBall({
  mozPos, productIndex, product, onResize,
}: {
  mozPos: [number, number, number]
  productIndex: number
  product: MozProduct
  onResize: (index: number, field: 'width' | 'depth' | 'height', value: number) => void
}) {
  const [hovered, setHovered] = useState(false)
  const [active, setActive] = useState(false)
  const { camera, gl, controls } = useThree()
  const dragging = useRef(false)
  const startMouse = useRef(0)
  const startDepth = useRef(0)
  const pos = mozPosToThree(mozPos[0], mozPos[1], mozPos[2])

  const mmPerPixel = useCallback(() => {
    const camDist = camera.position.distanceTo(new Vector3(0, 0, 0))
    if ('fov' in camera && typeof camera.fov === 'number') {
      const fovRad = (camera.fov * Math.PI) / 180
      return (2 * camDist * Math.tan(fovRad / 2)) / gl.domElement.clientHeight
    }
    return 1
  }, [camera, gl])

  const onPointerDown = useCallback((e: any) => {
    e.stopPropagation()
    dragging.current = true
    setActive(true)
    startMouse.current = e.clientY ?? e.nativeEvent?.clientY ?? 0
    startDepth.current = product.depth

    const ctrl = controls as any
    if (ctrl) ctrl.enabled = false
    const scale = mmPerPixel()

    const onMove = (ev: PointerEvent) => {
      if (!dragging.current) return
      const dy = ev.clientY - startMouse.current
      const dyMm = -dy * scale // drag up = increase depth
      const raw = startDepth.current + dyMm
      const snapped = snapValue(Math.max(MODULAR_DEPTHS[0], raw), 'depth')
      onResize(productIndex, 'depth', snapped)
    }

    const onUp = () => {
      dragging.current = false
      setActive(false)
      document.body.style.cursor = ''
      if (ctrl) ctrl.enabled = true
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    document.body.style.cursor = 'ns-resize'
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [product, productIndex, onResize, controls, mmPerPixel])

  const color = active ? '#FF6666' : hovered ? '#FF4444' : '#CC0000'
  const s = active ? 1.2 : hovered ? 1.3 : 1.0

  return (
    <mesh
      position={pos}
      scale={[s, s, s]}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'ns-resize' }}
      onPointerOut={() => { setHovered(false); if (!dragging.current) document.body.style.cursor = '' }}
      onPointerDown={onPointerDown}
      renderOrder={1000}
    >
      <sphereGeometry args={[BALL_R * 0.75, 16, 12]} />
      <meshBasicMaterial color={color} depthTest={false} transparent opacity={0.85} />
    </mesh>
  )
}

interface ProductResizeHandlesProps {
  product: MozProduct
  productIndex: number
  wallAngleDeg?: number
  onResize: (index: number, field: 'width' | 'depth' | 'height', value: number, anchor?: 'left' | 'right') => void
  onResizeWidth: (index: number, value: number, anchor: 'left' | 'right') => void
  onUpdateElev: (index: number, elev: number) => void
  onUpdateX: (index: number, x: number) => void
  onBumpLeft?: (index: number) => void
  onBumpRight?: (index: number) => void
  onRemove?: (index: number) => void
}

export default function ProductResizeHandles({
  product, productIndex, wallAngleDeg, onResize, onResizeWidth, onUpdateElev, onUpdateX,
  onBumpLeft, onBumpRight, onRemove,
}: ProductResizeHandlesProps) {
  const w = product.width, h = product.height

  // 5 balls on the front face (Mozaik Y=0), cross pattern
  const handles: { id: string; mozPos: [number, number, number]; role: HandleRole; sign: number }[] = [
    { id: 'top',    mozPos: [w / 2, 0, h],     role: 'height', sign: 1 },
    { id: 'bottom', mozPos: [w / 2, 0, 0],     role: 'elev',   sign: 1 },
    { id: 'left',   mozPos: [0,     0, h / 2],  role: 'width',  sign: -1 },
    { id: 'right',  mozPos: [w,     0, h / 2],  role: 'width',  sign: 1 },
    { id: 'center', mozPos: [w / 2, 0, h / 2],  role: 'move',   sign: 1 },
  ]

  return (
    <group>
      {handles.map((def) => (
        <HandleBall
          key={def.id}
          mozPos={def.mozPos}
          role={def.role}
          sign={def.sign}
          wallAngleDeg={wallAngleDeg}
          product={product}
          productIndex={productIndex}
          onResize={onResize}
          onResizeWidth={onResizeWidth}
          onUpdateElev={onUpdateElev}
          onUpdateX={onUpdateX}
        />
      ))}
      {onBumpLeft && (
        <BumpBall mozPos={[0, 0, h]}
          productIndex={productIndex} onBump={onBumpLeft} />
      )}
      {onBumpRight && (
        <BumpBall mozPos={[w, 0, h]}
          productIndex={productIndex} onBump={onBumpRight} />
      )}
      {/* Depth drag balls at bottom corners */}
      <DepthDragBall mozPos={[0, 0, 0]} productIndex={productIndex}
        product={product} onResize={onResize} />
      <DepthDragBall mozPos={[w, 0, 0]} productIndex={productIndex}
        product={product} onResize={onResize} />

      {/* Red X delete button at top-right corner */}
      {onRemove && (
        <Html position={mozPosToThree(w, 0, h)} center style={{ pointerEvents: 'auto' }}>
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(productIndex) }}
            title="Delete product"
            style={{
              width: 22, height: 22, borderRadius: '50%',
              background: '#cc2222', border: '2px solid #ff4444',
              color: 'white', fontSize: 13, fontWeight: 'bold', lineHeight: '16px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transform: 'translate(8px, -8px)',
            }}
          >
            ×
          </button>
        </Html>
      )}
    </group>
  )
}
