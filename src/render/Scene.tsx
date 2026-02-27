import { useRef, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { ReactNode } from 'react'
import type { OrbitControls as OrbitControlsType } from 'three-stdlib'

interface SceneProps {
  children: ReactNode
  orbitTarget?: [number, number, number]
}

/** Inner component so useEffect runs inside the R3F Canvas context. */
function SceneOrbitControls({ target }: { target?: [number, number, number] }) {
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

  return <OrbitControls ref={ref} makeDefault />
}

export default function Scene({ children, orbitTarget }: SceneProps) {
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
      <SceneOrbitControls target={orbitTarget} />
    </Canvas>
  )
}
