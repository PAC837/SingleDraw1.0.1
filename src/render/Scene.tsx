import { useRef, useEffect, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls, Environment } from '@react-three/drei'
import { OrthographicCamera, LinearToneMapping } from 'three'
import type { ReactNode } from 'react'
import type { OrbitControls as OrbitControlsType } from 'three-stdlib'
import type { Camera as ThreeCamera, PerspectiveCamera } from 'three'

interface SceneProps {
  children: ReactNode
  orbitTarget?: [number, number, number]
  orthographic?: boolean
  roomWalls?: Array<{ posX: number; posY: number; ang: number; len: number }>
  resetKey?: number
  onPointerMissed?: () => void
  ambientIntensity?: number
  directionalIntensity?: number
  warmth?: number
  exposure?: number
  toneMapping?: number
  bgColor?: string
  hdriEnabled?: boolean
}

/** Inner component so useEffect runs inside the R3F Canvas context. */
function SceneOrbitControls({ target, disableRotate, resetKey }: { target?: [number, number, number]; disableRotate?: boolean; resetKey?: number }) {
  const ref = useRef<OrbitControlsType>(null)
  const applied = useRef(false)
  const { camera } = useThree()

  useEffect(() => {
    applied.current = false
    if (ref.current && target && !disableRotate) {
      ref.current.target.set(target[0], target[1], target[2])
      ref.current.update()
      applied.current = true
    }
  }, [target, disableRotate])

  // Reset camera to default diagonal view when home is clicked
  useEffect(() => {
    if (!resetKey || !ref.current || !target) return
    camera.position.set(target[0] + 5000, 4000, target[2] + 5000)
    camera.up.set(0, 1, 0)
    camera.lookAt(target[0], target[1], target[2])
    camera.updateProjectionMatrix()
    ref.current.target.set(target[0], target[1], target[2])
    ref.current.update()
  }, [resetKey]) // eslint-disable-line react-hooks/exhaustive-deps

  // Fallback: if OrbitControls wasn't ready during useEffect, apply on next frame
  useFrame(() => {
    if (!applied.current && ref.current && target && !disableRotate) {
      ref.current.target.set(target[0], target[1], target[2])
      ref.current.update()
      applied.current = true
    }
  })

  return <OrbitControls ref={ref} makeDefault enableRotate={!disableRotate} target={target} />
}

/** Switch to orthographic top-down camera when plan view is active. */
function OrthoCamera({ target, walls }: { target?: [number, number, number]; walls?: Array<{ posX: number; posY: number; ang: number; len: number }> }) {
  const { set, camera: currentCamera, size } = useThree()
  const prevCameraRef = useRef<ThreeCamera>(currentCamera)
  const settleCount = useRef(0)
  const cx = target?.[0] ?? 0
  const cz = target?.[2] ?? 0
  const targetRef = useRef({ cx, cz })
  targetRef.current = { cx, cz }

  // Compute frustum from room bounding box (or fallback to 5000)
  const frustum = useMemo(() => {
    if (!walls || walls.length === 0) return 5000
    let minX = Infinity, maxX = -Infinity, minY = Infinity, maxY = -Infinity
    for (const w of walls) {
      const endX = w.posX + w.len * Math.cos(w.ang * Math.PI / 180)
      const endY = w.posY + w.len * Math.sin(w.ang * Math.PI / 180)
      minX = Math.min(minX, w.posX, endX)
      maxX = Math.max(maxX, w.posX, endX)
      minY = Math.min(minY, w.posY, endY)
      maxY = Math.max(maxY, w.posY, endY)
    }
    const maxSpan = Math.max(maxX - minX, maxY - minY)
    return Math.max(1000, maxSpan * 0.65) // half-span + 30% padding, min 1000
  }, [walls])

  const camera = useMemo(() => {
    const aspect = size.width / size.height
    const cam = new OrthographicCamera(
      -frustum * aspect, frustum * aspect, frustum, -frustum, 1, 100000,
    )
    cam.position.set(cx, 20000, cz)
    cam.up.set(0, 0, -1)
    cam.lookAt(cx, 0, cz)
    cam.updateProjectionMatrix()
    cam.updateMatrixWorld(true)
    return cam
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Resize + frustum change handling
  useEffect(() => {
    const aspect = size.width / size.height
    camera.left = -frustum * aspect
    camera.right = frustum * aspect
    camera.top = frustum
    camera.bottom = -frustum
    camera.updateProjectionMatrix()
  }, [camera, size, frustum])

  // Reposition when target changes
  useEffect(() => {
    camera.position.set(cx, 20000, cz)
    camera.up.set(0, 0, -1)
    camera.lookAt(cx, 0, cz)
    camera.updateProjectionMatrix()
    camera.updateMatrixWorld(true)
    settleCount.current = 0
  }, [camera, cx, cz])

  // Force camera straight down for a few frames after mount/reposition
  // (OrbitControls may fight with orientation during its first update cycle)
  useFrame(() => {
    if (settleCount.current < 3) {
      camera.position.set(cx, 20000, cz)
      camera.up.set(0, 0, -1)
      camera.lookAt(cx, 0, cz)
      camera.updateProjectionMatrix()
      camera.updateMatrixWorld(true)
      settleCount.current++
    }
  })

  // Activate ortho camera on mount, restore perspective on unmount
  useEffect(() => {
    prevCameraRef.current = currentCamera
    set({ camera })
    return () => {
      // Reset perspective camera centered on room (use ref for latest values)
      const { cx: rcx, cz: rcz } = targetRef.current
      const prev = prevCameraRef.current as PerspectiveCamera
      prev.position.set(rcx + 5000, 4000, rcz + 5000)
      prev.up.set(0, 1, 0)
      prev.lookAt(rcx, 0, rcz)
      prev.updateProjectionMatrix()
      set({ camera: prev })
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return null
}

/** Reactively updates WebGL renderer tone mapping settings. */
function RendererSettings({ toneMapping, exposure }: { toneMapping: number; exposure: number }) {
  const { gl } = useThree()
  useEffect(() => {
    gl.toneMapping = toneMapping as import('three').ToneMapping
    gl.toneMappingExposure = exposure
  }, [gl, toneMapping, exposure])
  return null
}

/** Compute hemisphere light colors from warmth parameter (-1 to 1). */
function warmthToColors(warmth: number): { sky: string; ground: string } {
  const cool    = { sky: [0xa0, 0xc4, 0xe8], ground: [0x90, 0xa0, 0xb0] }
  const neutral = { sky: [0xd4, 0xe6, 0xf1], ground: [0xb0, 0xa0, 0x90] }
  const warm    = { sky: [0xf0, 0xd4, 0xa0], ground: [0xc0, 0xa0, 0x70] }

  const [from, to, t] = warmth <= 0
    ? [cool, neutral, warmth + 1]
    : [neutral, warm, warmth]

  const lerp = (a: number[], b: number[]) =>
    '#' + a.map((v, i) => Math.round(v + (b[i] - v) * t).toString(16).padStart(2, '0')).join('')

  return { sky: lerp(from.sky, to.sky), ground: lerp(from.ground, to.ground) }
}

/** Module-level ref for canvas capture from outside the R3F tree. */
let canvasElement: HTMLCanvasElement | null = null

function CanvasCapture() {
  const { gl } = useThree()
  canvasElement = gl.domElement
  return null
}

/** Capture current viewport as a PNG data URL. */
export function captureCanvas(): string | null {
  if (!canvasElement) return null
  return canvasElement.toDataURL('image/png')
}

export default function Scene({
  children, orbitTarget, orthographic, roomWalls, resetKey, onPointerMissed,
  ambientIntensity = 0.6, directionalIntensity = 0.7, warmth = 0,
  exposure = 1.0, toneMapping = LinearToneMapping, bgColor = '#ffffff',
  hdriEnabled = true,
}: SceneProps) {
  const hemiColors = useMemo(() => warmthToColors(warmth), [warmth])

  return (
    <Canvas
      camera={{
        position: [5000, 4000, 5000],
        fov: 50,
        near: 1,
        far: 100000,
        up: [0, 1, 0],
      }}
      gl={{ antialias: true, preserveDrawingBuffer: true }}
      style={{ background: bgColor }}
      onPointerMissed={onPointerMissed}
    >
      <CanvasCapture />
      <RendererSettings toneMapping={toneMapping} exposure={exposure} />
      <ambientLight intensity={ambientIntensity} />
      <hemisphereLight args={[hemiColors.sky, hemiColors.ground, 0.5]} />
      <directionalLight position={[5000, 10000, 5000]} intensity={directionalIntensity} />
      <directionalLight position={[-3000, 8000, -3000]} intensity={directionalIntensity * 0.43} />
      {hdriEnabled && <Environment preset="apartment" background={false} />}
      {children}
      {orthographic && <OrthoCamera target={orbitTarget} walls={roomWalls} />}
      <SceneOrbitControls key={orthographic ? 'ortho' : 'persp'} target={orbitTarget} disableRotate={orthographic} resetKey={resetKey} />
    </Canvas>
  )
}
