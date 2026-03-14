/**
 * Mini 3D spinning preview of a MozProduct for use in product cards.
 * Each card gets its own lightweight R3F Canvas with auto-rotation.
 */
import { useRef, useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Quaternion, Vector3 } from 'three'
import type { Group } from 'three'
import type { MozProduct, MozPart } from '../mozaik/types'
import { mozPosToThree, mozQuatToThree } from '../math/basis'
import { mozEulerToQuaternion } from '../math/rotations'
import { DEG2RAD } from '../math/constants'
import { buildPartGeometry, panelThickness } from './shapeGeometry'

/** Color by part type — simplified from ProductView. */
function partColor(type: string): string {
  switch (type.toLowerCase()) {
    case 'metal': return '#888888'
    case 'toe': return '#4a3728'
    case 'bottom': case 'top': return '#d4c5a9'
    case 'fixedshelf': case 'adjshelf': return '#c8b896'
    case 'fend': return '#d4c5a9'
    default: return '#b8a88a'
  }
}

/** Compute Three.js position for a part. */
function partPosition(part: MozPart): { pos: Vector3; quat: Quaternion; threeQuat: Quaternion; thick: number } {
  const length = Math.max(part.l, 1)
  const width = Math.max(part.w, 1)
  const isRod = part.name.toLowerCase().includes('rod')
  const thick = panelThickness(part.type, part.name, width)
  const partGeo = !isRod ? buildPartGeometry(part) : null
  const cx = partGeo ? partGeo.centerX : length / 2
  const cy = partGeo ? partGeo.centerY : width / 2
  const mozQuat = mozEulerToQuaternion(part.rotation)
  if (part.name.toLowerCase().includes('pull')) {
    const pullFix = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), -90 * DEG2RAD)
    mozQuat.premultiply(pullFix)
  }
  const centerLocal = new Vector3(cx, cy, thick / 2).applyQuaternion(mozQuat)
  const pos = mozPosToThree(
    part.x + centerLocal.x,
    part.y + centerLocal.y,
    part.z + centerLocal.z,
  )
  return { pos, quat: mozQuat, threeQuat: mozQuatToThree(mozQuat), thick }
}

/** Slowly spinning product group. */
function SpinningGroup({ product }: { product: MozProduct }) {
  const groupRef = useRef<Group>(null)

  useFrame((_, delta) => {
    if (groupRef.current) groupRef.current.rotation.y += delta * 0.4
  })

  // Center on product width/depth/height midpoint (converted to Three.js space)
  const centerOffset = useMemo(() => {
    const c = mozPosToThree(product.width / 2, product.depth / 2, product.height / 2)
    return [-c.x, -c.y, -c.z] as [number, number, number]
  }, [product])

  return (
    <group ref={groupRef}>
      <group position={centerOffset}>
        {product.parts.map((part, i) => {
          const length = Math.max(part.l, 1)
          const width = Math.max(part.w, 1)
          const isRod = part.name.toLowerCase().includes('rod')
          const { pos, threeQuat, thick } = partPosition(part)
          const partGeo = !isRod ? buildPartGeometry(part) : null
          const color = partColor(part.type)

          if (isRod) {
            return (
              <mesh key={i} position={pos} quaternion={threeQuat} rotation={[0, 0, Math.PI / 2]}>
                <cylinderGeometry args={[width / 2, width / 2, length, 8]} />
                <meshStandardMaterial color={color} roughness={0.7} metalness={0.3} />
              </mesh>
            )
          }

          return (
            <mesh
              key={i}
              position={pos}
              quaternion={threeQuat}
              geometry={partGeo?.isShape ? partGeo.geometry : undefined}
            >
              {!partGeo?.isShape && <boxGeometry args={[length, thick, width]} />}
              <meshStandardMaterial color={color} roughness={0.7} metalness={0.1} />
            </mesh>
          )
        })}
      </group>
    </group>
  )
}

interface SpinningProductCardProps {
  product: MozProduct
  width: number
  height: number
}

export default function SpinningProductCard({ product, width, height }: SpinningProductCardProps) {
  // Camera distance from product bounding diagonal
  const camDist = useMemo(() => {
    const diag = Math.sqrt(product.width ** 2 + product.depth ** 2 + product.height ** 2)
    return Math.max(diag / 2, 100) * 3.5
  }, [product])

  return (
    <Canvas
      style={{ width, height, background: 'transparent' }}
      camera={{
        position: [camDist * 0.55, camDist * 0.4, camDist * 0.55],
        fov: 40,
        near: 1,
        far: camDist * 10,
      }}
      gl={{ antialias: true, alpha: true }}
      frameloop="always"
    >
      <ambientLight intensity={0.8} />
      <directionalLight position={[1, 2, 1.5]} intensity={0.7} />
      <SpinningGroup product={product} />
    </Canvas>
  )
}
