import { useMemo } from 'react'
import { Quaternion, Vector3 } from 'three'
import type { MozProduct, MozPart } from '../mozaik/types'
import { mozPosToThree, mozQuatToThree } from '../math/basis'
import { mozEulerToQuaternion } from '../math/rotations'
import { DEG2RAD } from '../math/constants'

interface ProductViewProps {
  product: MozProduct
  /** Optional world offset for product positioning (Mozaik space) */
  worldOffset?: [number, number, number]
  /** Wall angle in degrees (Mozaik Z rotation) for wall-placed products */
  wallAngleDeg?: number
}

/** Color by part type for visual differentiation. */
function partColor(type: string): string {
  switch (type.toLowerCase()) {
    case 'metal': return '#888888'
    case 'toe': return '#4a3728'
    case 'bottom': return '#d4c5a9'
    case 'top': return '#d4c5a9'
    case 'fixedshelf': return '#c8b896'
    case 'adjshelf': return '#c8b896'
    case 'fend': return '#d4c5a9'
    default: return '#b8a88a'
  }
}

/** Infer panel thickness (Mozaik local Z) by part type. Parts only store W and L. */
function panelThickness(type: string): number {
  switch (type.toLowerCase()) {
    case 'metal': return 3   // metal brackets/hangers
    default: return 19       // 3/4" standard panel (wood parts, toe, fend, shelves)
  }
}

function PartMesh({ part }: { part: MozPart }) {
  // Part dimensions in Mozaik part-local space:
  //   L along local X, W along local Y, thickness along local Z
  const length = Math.max(part.l, 1)
  const width = Math.max(part.w, 1)
  const thick = panelThickness(part.type)

  const { position, quaternion } = useMemo(() => {
    // Mozaik rotation: part-local → Mozaik world
    const mozQuat = mozEulerToQuaternion(part.rotation)

    // Hardware handles (pulls) need -90° Z rotation
    if (part.name.toLowerCase().includes('pull')) {
      const pullFix = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), -90 * DEG2RAD)
      mozQuat.premultiply(pullFix)
    }

    // Mozaik XYZ is a CORNER position — the part extends (+L, +W, +thick) in local frame.
    // Three.js BoxGeometry is centered, so we must compute the center position.
    // Center offset in part-local: (L/2, W/2, thick/2)
    // Rotate to Mozaik world frame, then add to corner position.
    const centerLocal = new Vector3(length / 2, width / 2, thick / 2)
    const centerOffset = centerLocal.applyQuaternion(mozQuat)

    const centerMozX = part.x + centerOffset.x
    const centerMozY = part.y + centerOffset.y
    const centerMozZ = part.z + centerOffset.z

    const pos = mozPosToThree(centerMozX, centerMozY, centerMozZ)
    const threeQuat = mozQuatToThree(mozQuat)

    return { position: pos, quaternion: threeQuat }
  }, [part, length, width, thick])

  // Box args in Three.js local frame (basis-changed from Mozaik local):
  //   Three.js X = Mozaik X = L
  //   Three.js Y = Mozaik Z = thick
  //   Three.js Z = Mozaik -Y = W (magnitude)
  return (
    <mesh position={position} quaternion={quaternion}>
      <boxGeometry args={[length, thick, width]} />
      <meshStandardMaterial
        color={partColor(part.type)}
        transparent
        opacity={0.8}
      />
    </mesh>
  )
}

export default function ProductView({ product, worldOffset, wallAngleDeg }: ProductViewProps) {
  const groupPos = useMemo(() => {
    if (worldOffset) {
      return mozPosToThree(worldOffset[0], worldOffset[1], worldOffset[2])
    }
    // Standalone product: center at origin, use elevation only
    return mozPosToThree(0, 0, product.elev)
  }, [product, worldOffset])

  // Product-level rotation: wall angle + product.rot around Mozaik Z → Three.js Y
  const groupRotY = ((wallAngleDeg ?? 0) + product.rot) * DEG2RAD

  // Bounding box center offset: Mozaik origin is front-left-bottom of product
  // Center = (W/2, D/2, H/2) in Mozaik space
  const bbPos = useMemo(
    () => mozPosToThree(product.width / 2, product.depth / 2, product.height / 2),
    [product],
  )

  return (
    <group position={groupPos} rotation={[0, groupRotY, 0]}>
      {product.parts.map((part, i) => (
        <PartMesh key={`${part.name}-${i}`} part={part} />
      ))}

      {/* Product bounding box outline */}
      <mesh position={bbPos}>
        <boxGeometry args={[product.width, product.height, product.depth]} />
        <meshStandardMaterial
          color="#FFE500"
          wireframe
          transparent
          opacity={0.2}
        />
      </mesh>
    </group>
  )
}
