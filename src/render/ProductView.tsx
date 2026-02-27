import { useMemo } from 'react'
import { Quaternion, Vector3, RepeatWrapping, BoxGeometry, CylinderGeometry, EdgesGeometry } from 'three'
import type { Texture } from 'three'
import type { MozProduct, MozPart, RenderMode } from '../mozaik/types'
import { mozPosToThree, mozQuatToThree } from '../math/basis'
import { mozEulerToQuaternion } from '../math/rotations'
import { DEG2RAD } from '../math/constants'
import { useProductTexture, useTextureByFilename, lookupTexture } from './useProductTexture'
import { useProductModel } from './useProductModel'

interface ProductViewProps {
  product: MozProduct
  worldOffset?: [number, number, number]
  wallAngleDeg?: number
  renderMode?: RenderMode
  showBoundingBox?: boolean
  textureFolder?: FileSystemDirectoryHandle | null
  textureId?: number | null
  textureFilename?: string | null
  modelsFolder?: FileSystemDirectoryHandle | null
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
function panelThickness(type: string, name: string, partW: number): number {
  if (name.toLowerCase().includes('rod')) return partW  // cylindrical cross-section ≈ diameter
  switch (type.toLowerCase()) {
    case 'metal': return 3   // metal brackets/hangers
    default: return 19       // 3/4" standard panel (wood parts, toe, fend, shelves)
  }
}

/** Clone a texture with per-part tiling based on part dimensions and UVW/UVH. */
function usePartTexture(
  baseTexture: Texture | null,
  textureId: number | null,
  partL: number,
  partW: number,
): Texture | null {
  return useMemo(() => {
    if (!baseTexture) return null
    const entry = textureId ? lookupTexture(textureId) : null
    const uvw = entry?.uvw ?? 609.6
    const uvh = entry?.uvh ?? 609.6

    const tex = baseTexture.clone()
    tex.wrapS = RepeatWrapping
    tex.wrapT = RepeatWrapping
    tex.repeat.set(partW / uvw, partL / uvh)
    tex.rotation = Math.PI / 2
    tex.center.set(0.5, 0.5)
    tex.needsUpdate = true
    return tex
  }, [baseTexture, textureId, partL, partW])
}

interface PartMeshProps {
  part: MozPart
  renderMode?: RenderMode
  baseTexture?: Texture | null
  textureId?: number | null
  modelsFolder?: FileSystemDirectoryHandle | null
}

function PartMesh({ part, renderMode = 'ghosted', baseTexture = null, textureId = null, modelsFolder = null }: PartMeshProps) {
  const length = Math.max(part.l, 1)
  const width = Math.max(part.w, 1)
  const isRodPart = part.name.toLowerCase().includes('rod')
  const thick = panelThickness(part.type, part.name, width)
  const glbModel = useProductModel(modelsFolder, part.suPartName)

  const { position, quaternion } = useMemo(() => {
    const mozQuat = mozEulerToQuaternion(part.rotation)

    if (part.name.toLowerCase().includes('pull')) {
      const pullFix = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), -90 * DEG2RAD)
      mozQuat.premultiply(pullFix)
    }

    const centerLocal = new Vector3(length / 2, width / 2, thick / 2)
    const centerOffset = centerLocal.applyQuaternion(mozQuat)

    const pos = mozPosToThree(part.x + centerOffset.x, part.y + centerOffset.y, part.z + centerOffset.z)
    const threeQuat = mozQuatToThree(mozQuat)

    return { position: pos, quaternion: threeQuat }
  }, [part, length, width, thick])

  // All hooks must be called before any early returns (React rules of hooks)
  const edgesGeo = useMemo(() => {
    const geo = isRodPart
      ? new CylinderGeometry(width / 2, width / 2, length, 16)
      : new BoxGeometry(length, thick, width)
    const edges = new EdgesGeometry(geo)
    geo.dispose()
    return edges
  }, [length, thick, width, isRodPart])

  const isMetal = part.type.toLowerCase() === 'metal'
  const partTex = usePartTexture(isMetal ? null : baseTexture, textureId, length, width)
  const color = partColor(part.type)

  // GLB model available — render it instead of box geometry
  if (glbModel) {
    const modelPos = mozPosToThree(part.x, part.y, part.z)
    const mozQuat = mozEulerToQuaternion(part.rotation)
    const modelQuat = mozQuatToThree(mozQuat)
    return (
      <group position={modelPos} quaternion={modelQuat}>
        <primitive object={glbModel} />
      </group>
    )
  }

  if (renderMode === 'wireframe') {
    return isRodPart ? (
      <group position={position} quaternion={quaternion}>
        <lineSegments rotation={[0, 0, Math.PI / 2]} geometry={edgesGeo}>
          <lineBasicMaterial color={color} />
        </lineSegments>
      </group>
    ) : (
      <lineSegments position={position} quaternion={quaternion} geometry={edgesGeo}>
        <lineBasicMaterial color={color} />
      </lineSegments>
    )
  }

  // Rod parts without GLB → cylinder
  if (isRodPart) {
    return (
      <group position={position} quaternion={quaternion}>
        <mesh rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[width / 2, width / 2, length, 16]} />
          {renderMode === 'solid' ? (
            <meshStandardMaterial color={color} roughness={0.7} metalness={0.3} />
          ) : (
            <meshStandardMaterial color={color} transparent opacity={0.8} roughness={0.8} metalness={0.1} />
          )}
        </mesh>
      </group>
    )
  }

  return (
    <mesh position={position} quaternion={quaternion}>
      <boxGeometry args={[length, thick, width]} />
      {renderMode === 'solid' ? (
        partTex ? (
          <meshStandardMaterial key="solid-tex" map={partTex} roughness={0.7} metalness={0.1} />
        ) : (
          <meshStandardMaterial key="solid" color={color} roughness={0.7} metalness={0.1} />
        )
      ) : (
        partTex ? (
          <meshStandardMaterial key="ghosted-tex" map={partTex} transparent opacity={0.8} roughness={0.8} metalness={0} />
        ) : (
          <meshStandardMaterial key="ghosted" color={color} transparent opacity={0.8} roughness={0.8} metalness={0} />
        )
      )}
    </mesh>
  )
}

export default function ProductView({
  product, worldOffset, wallAngleDeg, renderMode = 'ghosted', showBoundingBox = false,
  textureFolder = null, textureId = null, textureFilename = null, modelsFolder = null,
}: ProductViewProps) {
  // Priority: filename-based (user override) → textureId-based (DES default)
  const texById = useProductTexture(textureFilename ? null : textureFolder, textureFilename ? null : textureId)
  const texByFile = useTextureByFilename(textureFilename ? textureFolder : null, textureFilename)
  const baseTexture = texByFile ?? texById

  const groupPos = useMemo(() => {
    if (worldOffset) {
      return mozPosToThree(worldOffset[0], worldOffset[1], worldOffset[2])
    }
    return mozPosToThree(0, 0, product.elev)
  }, [product, worldOffset])

  const groupRotY = ((wallAngleDeg ?? 0) + product.rot) * DEG2RAD

  const bbPos = useMemo(
    () => mozPosToThree(product.width / 2, product.depth / 2, product.height / 2),
    [product],
  )

  return (
    <group position={groupPos} rotation={[0, groupRotY, 0]} scale={[1, 1, -1]}>
      {product.parts.map((part, i) => (
        <PartMesh
          key={`${part.name}-${i}`}
          part={part}
          renderMode={renderMode}
          baseTexture={baseTexture}
          textureId={textureId}
          modelsFolder={modelsFolder}
        />
      ))}

      {showBoundingBox && (
        <mesh position={bbPos}>
          <boxGeometry args={[product.width, product.height, product.depth]} />
          <meshStandardMaterial color="#AAFF00" wireframe transparent opacity={0.2} />
        </mesh>
      )}
    </group>
  )
}
