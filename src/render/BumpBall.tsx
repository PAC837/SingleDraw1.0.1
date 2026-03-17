/**
 * BumpBall (snap-to-edge cone) and DepthDragBall (depth resize arrows).
 */
import { useRef, useState, useCallback } from 'react'
import { useThree } from '@react-three/fiber'
import { Vector3 } from 'three'
import type { MozProduct } from '../mozaik/types'
import { mozPosToThree } from '../math/basis'
import { MODULAR_DEPTHS } from '../mozaik/modularValues'
import { DepthArrows } from './ArrowIndicators'

const BALL_R = 30
const PI = Math.PI
const INCH = 25.4

function snapDepth(raw: number, isNonRect: boolean): number {
  if (isNonRect) return Math.round(Math.max(MODULAR_DEPTHS[0], raw) / INCH) * INCH
  let best = MODULAR_DEPTHS[0], bestDist = Math.abs(raw - best)
  for (const d of MODULAR_DEPTHS) { const dist = Math.abs(raw - d); if (dist < bestDist) { best = d; bestDist = dist } }
  return best
}

/** 3D arrow cone — bumps section left or right. */
export function BumpBall({
  mozPos, productIndex, direction, onBump,
}: {
  mozPos: [number, number, number]
  productIndex: number
  direction: 'left' | 'right'
  onBump: (index: number) => void
}) {
  const [hovered, setHovered] = useState(false)
  const pos = mozPosToThree(mozPos[0], mozPos[1], mozPos[2])
  const rotZ = direction === 'left' ? PI / 2 : -PI / 2
  const s = hovered ? 1.3 : 1.0

  return (
    <mesh
      position={pos}
      rotation={[0, 0, rotZ]}
      scale={[s, s, s]}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = '' }}
      onClick={(e) => { e.stopPropagation(); onBump(productIndex) }}
      renderOrder={1000}
    >
      <coneGeometry args={[BALL_R * 1.0, BALL_R * 2.2, 12]} />
      <meshBasicMaterial color={hovered ? '#ff4444' : '#cc0000'} depthTest={false} depthWrite={false} toneMapped={false} />
    </mesh>
  )
}

/** Red forward/backward arrows — drag to resize depth. */
export function DepthDragBall({
  mozPos, productIndex, product, onResize, onDragStart, onDragEnd,
}: {
  mozPos: [number, number, number]
  productIndex: number
  product: MozProduct
  onResize: (index: number, field: 'width' | 'depth' | 'height', value: number) => void
  onDragStart?: () => void
  onDragEnd?: () => void
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
    onDragStart?.()
    startMouse.current = e.clientY ?? e.nativeEvent?.clientY ?? 0
    startDepth.current = product.depth

    const ctrl = controls as any
    if (ctrl) ctrl.enabled = false
    const scale = mmPerPixel()

    const onMove = (ev: PointerEvent) => {
      if (!dragging.current) return
      const dy = ev.clientY - startMouse.current
      const dyMm = dy * scale
      const raw = startDepth.current + dyMm
      const snapped = snapDepth(raw, product.isRectShape === false)
      onResize(productIndex, 'depth', snapped)
    }

    const onUp = () => {
      dragging.current = false
      setActive(false)
      document.body.style.cursor = ''
      if (ctrl) ctrl.enabled = true
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      onDragEnd?.()
    }

    document.body.style.cursor = 'ns-resize'
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [product, productIndex, onResize, controls, mmPerPixel, onDragStart, onDragEnd])

  const redColor = active ? '#FF6666' : hovered ? '#FF4444' : '#CC0000'
  const s = active ? 1.2 : hovered ? 1.3 : 1.0

  return (
    <group
      position={pos}
      scale={[s, s, s]}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'ns-resize' }}
      onPointerOut={() => { setHovered(false); if (!dragging.current) document.body.style.cursor = '' }}
      onPointerDown={onPointerDown}
      renderOrder={1000}
    >
      <mesh>
        <sphereGeometry args={[BALL_R * 2, 8, 6]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <DepthArrows color={redColor} />
    </group>
  )
}
