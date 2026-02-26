import { Canvas } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { ReactNode } from 'react'

interface SceneProps {
  children: ReactNode
}

export default function Scene({ children }: SceneProps) {
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
    >
      <ambientLight intensity={0.4} />
      <directionalLight position={[5000, 10000, 5000]} intensity={0.7} />
      <directionalLight position={[-3000, 8000, -3000]} intensity={0.3} />
      {children}
      <OrbitControls makeDefault />
    </Canvas>
  )
}
