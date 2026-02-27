import { useRef, useEffect, useMemo } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { OrthographicCamera } from 'three'
import type { ReactNode } from 'react'
import type { OrbitControls as OrbitControlsType } from 'three-stdlib'
import type { Camera as ThreeCamera, PerspectiveCamera } from 'three'

interface SceneProps {
  children: ReactNode
  orbitTarget?: [number, number, number]
  orthographic?: boolean
}

/** Inner component so useEffect runs inside the R3F Canvas context. */
function SceneOrbitControls({ target, disableRotate }: { target?: [number, number, number]; disableRotate?: boolean }) {
  const ref = useRef<OrbitControlsType>(null)
  const applied = useRef(false)

  useEffect(() => {
    applied.current = false
    if (ref.current && target) {
      ref.current.target.set(target[0], target[1], target[2])
      ref.current.update()
      applied.current = true
    }
  }, [target])

  // Fallback: if OrbitControls wasn't ready during useEffect, apply on next frame
  useFrame(() => {
    if (!applied.current && ref.current && target) {
      ref.current.target.set(target[0], target[1], target[2])
      ref.current.update()
      applied.current = true
    }
  })

  return <OrbitControls ref={ref} makeDefault enableRotate={!disableRotate} />
}

/** Switch to orthographic top-down camera when plan view is active. */
function OrthoCamera({ target }: { target?: [number, number, number] }) {
  const { set, camera: currentCamera, size } = useThree()
  const prevCameraRef = useRef<ThreeCamera>(currentCamera)
  const settleCount = useRef(0)
  const cx = target?.[0] ?? 0
  const cz = target?.[2] ?? 0
  const targetRef = useRef({ cx, cz })
  targetRef.current = { cx, cz }

  const camera = useMemo(() => {
    const aspect = size.width / size.height
    const frustum = 5000
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

  // Resize handling
  useEffect(() => {
    const aspect = size.width / size.height
    const frustum = 5000
    camera.left = -frustum * aspect
    camera.right = frustum * aspect
    camera.top = frustum
    camera.bottom = -frustum
    camera.updateProjectionMatrix()
  }, [camera, size])

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

export default function Scene({ children, orbitTarget, orthographic }: SceneProps) {
  return (
    <Canvas
      camera={{
        position: [5000, 4000, 5000],
        fov: 50,
        near: 1,
        far: 100000,
        up: [0, 1, 0],
      }}
      gl={{ antialias: true }}
      style={{ background: '#ffffff' }}
    >
      <ambientLight intensity={0.6} />
      <hemisphereLight args={['#d4e6f1', '#b0a090', 0.5]} />
      <directionalLight position={[5000, 10000, 5000]} intensity={0.7} />
      <directionalLight position={[-3000, 8000, -3000]} intensity={0.3} />
      {children}
      {orthographic && <OrthoCamera target={orbitTarget} />}
      <SceneOrbitControls key={orthographic ? 'ortho' : 'persp'} target={orbitTarget} disableRotate={orthographic} />
    </Canvas>
  )
}
