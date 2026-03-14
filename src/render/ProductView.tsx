import { useMemo, useState } from 'react'
import { Quaternion, Vector3, RepeatWrapping, BoxGeometry, CylinderGeometry, EdgesGeometry } from 'three'
import type { Texture } from 'three'
import type { MozProduct, MozPart, RenderMode } from '../mozaik/types'
import { mozPosToThree, mozQuatToThree } from '../math/basis'
import { mozEulerToQuaternion } from '../math/rotations'
import { DEG2RAD } from '../math/constants'
import { useProductTexture, useTextureByFilename, useSingleDrawTexture, lookupTexture } from './useProductTexture'
import { useProductModel } from './useProductModel'
import { buildPartGeometry, panelThickness, computeProductOutline } from './shapeGeometry'
import { generateSystemHoles } from '../mozaik/systemHoles'
import OperationMarkers from './OperationMarkers'
import ProductResizeHandles from './ProductResizeHandles'
import ShapeDebugOverlay from './ShapeDebugOverlay'

interface ProductViewProps {
  product: MozProduct
  productIndex?: number
  worldOffset?: [number, number, number]
  wallAngleDeg?: number
  renderMode?: RenderMode
  showBoundingBox?: boolean
  selected?: boolean
  onSelect?: (index: number, shiftKey?: boolean) => void
  onResize?: (index: number, field: 'width' | 'depth' | 'height', value: number, anchor?: 'left' | 'right') => void
  onResizeWidth?: (index: number, value: number, anchor: 'left' | 'right') => void
  onUpdateElev?: (index: number, elev: number) => void
  onUpdateX?: (index: number, x: number) => void
  onBumpLeft?: (index: number) => void
  onBumpRight?: (index: number) => void
  onRemove?: (index: number) => void
  onDragStart?: () => void
  onDragEnd?: () => void
  textureFolder?: FileSystemDirectoryHandle | null
  textureId?: number | null
  textureFilename?: string | null
  edgeOpacity?: number
  polyFactor?: number
  polyUnits?: number
  showOperations?: boolean
  showShapeDebug?: boolean
  singleDrawBrand?: string | null
  singleDrawTexture?: string | null
  modelsFolder?: FileSystemDirectoryHandle | null
  hoveredPart?: { productIndex: number; partIndex: number } | null
  inspectedPart?: { productIndex: number; partIndex: number } | null
  onInspectPart?: (productIndex: number, partIndex: number) => void
}

/**
 * Product outline drawn as thin bars tracing the 2D footprint at bottom and top,
 * with vertical bars at each vertex. Follows L-shapes for corner products.
 * Outline points are in Mozaik product-local coords (X = width, Y = depth).
 */
function ProductOutline({ outline, height }: { outline: [number, number][]; height: number }) {
  const BAR = 4
  const color = '#AAFF00'

  const bars = useMemo(() => {
    const result: { pos: [number, number, number]; size: [number, number, number]; rotY: number }[] = []
    const n = outline.length

    for (let i = 0; i < n; i++) {
      const [mx1, my1] = outline[i]
      const [mx2, my2] = outline[(i + 1) % n]
      // Three.js coords (inside product group): mozPosToThree(x, y, z) = (x, z, -y)
      const x1 = mx1, z1 = -my1
      const x2 = mx2, z2 = -my2

      const dx = x2 - x1, dz = z2 - z1
      const len = Math.sqrt(dx * dx + dz * dz)
      if (len < 0.1) continue

      const midX = (x1 + x2) / 2, midZ = (z1 + z2) / 2
      // Rotate box (default along X) to align with edge direction in XZ plane
      const rotY = -Math.atan2(dz, dx)

      // Bottom edge (Y = 0)
      result.push({ pos: [midX, 0, midZ], size: [len + BAR, BAR, BAR], rotY })
      // Top edge (Y = height)
      result.push({ pos: [midX, height, midZ], size: [len + BAR, BAR, BAR], rotY })
      // Vertical bar at vertex i
      result.push({ pos: [x1, height / 2, z1], size: [BAR, height + BAR, BAR], rotY: 0 })
    }
    return result
  }, [outline, height])

  return (
    <group>
      {bars.map((b, i) => (
        <mesh key={i} position={b.pos} rotation={[0, b.rotY, 0]} renderOrder={999}>
          <boxGeometry args={b.size} />
          <meshBasicMaterial color={color} depthTest={false} />
        </mesh>
      ))}
    </group>
  )
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
  edgeOpacity?: number
  polyFactor?: number
  polyUnits?: number
  showOperations?: boolean
  highlighted?: boolean
  inspected?: boolean
  onInspect?: () => void
}

function PartMesh({ part, renderMode = 'ghosted', baseTexture = null, textureId = null, modelsFolder = null, edgeOpacity = 0, polyFactor = 1, polyUnits = 1, showOperations = true, highlighted = false, inspected = false, onInspect }: PartMeshProps) {
  const length = Math.max(part.l, 1)
  const width = Math.max(part.w, 1)
  const isRodPart = part.name.toLowerCase().includes('rod')
  const thick = panelThickness(part.type, part.name, width)
  const glbModel = useProductModel(modelsFolder, part.suPartName)

  // Build geometry from shape points (ExtrudeGeometry for non-rectangular)
  const partGeo = useMemo(() => {
    if (isRodPart) return null // rods use CylinderGeometry
    return buildPartGeometry(part)
  }, [part, isRodPart])

  const { position, quaternion } = useMemo(() => {
    const mozQuat = mozEulerToQuaternion(part.rotation)

    if (part.name.toLowerCase().includes('pull')) {
      const pullFix = new Quaternion().setFromAxisAngle(new Vector3(0, 0, 1), -90 * DEG2RAD)
      mozQuat.premultiply(pullFix)
    }

    // For shaped parts, use shape bounds center; for boxes, use L/2, W/2
    const cx = partGeo ? partGeo.centerX : length / 2
    const cy = partGeo ? partGeo.centerY : width / 2
    const centerLocal = new Vector3(cx, cy, thick / 2)
    const centerOffset = centerLocal.applyQuaternion(mozQuat)

    const pos = mozPosToThree(part.x + centerOffset.x, part.y + centerOffset.y, part.z + centerOffset.z)
    const threeQuat = mozQuatToThree(mozQuat)

    return { position: pos, quaternion: threeQuat }
  }, [part, length, width, thick, partGeo])

  // All hooks must be called before any early returns (React rules of hooks)
  const edgesGeo = useMemo(() => {
    if (partGeo) {
      // Use the actual part geometry for edges
      return new EdgesGeometry(partGeo.geometry, 15)
    }
    const geo = isRodPart
      ? new CylinderGeometry(width / 2, width / 2, length, 16)
      : new BoxGeometry(length, thick, width)
    const edges = new EdgesGeometry(geo)
    geo.dispose()
    return edges
  }, [length, thick, width, isRodPart, partGeo])

  const isMetal = part.type.toLowerCase() === 'metal'
  const partTex = usePartTexture(isMetal ? null : baseTexture, textureId, length, width)
  const color = highlighted ? '#AAFF00' : partColor(part.type)

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

  // Shared operations JSX — used in wireframe and solid/ghosted returns
  const opsJsx = showOperations ? (() => {
    const ops = part.operations.length > 0
      ? part.operations
      : part.type.toLowerCase() === 'fend'
        ? generateSystemHoles(length, width)
        : []
    if (ops.length === 0) return null
    return (
      <group position={position} quaternion={quaternion}>
        <OperationMarkers
          operations={ops}
          centerX={partGeo ? partGeo.centerX : length / 2}
          centerY={partGeo ? partGeo.centerY : width / 2}
          thick={thick}
          isShape={partGeo?.isShape ?? false}
          partL={length}
          partW={width}
        />
      </group>
    )
  })() : null

  const handleDblClick = onInspect ? (e: any) => { e.stopPropagation(); onInspect() } : undefined

  if (renderMode === 'wireframe') {
    return (
      <group onDoubleClick={handleDblClick}>
        {isRodPart ? (
          <group position={position} quaternion={quaternion}>
            <lineSegments rotation={[0, 0, Math.PI / 2]} geometry={edgesGeo}>
              <lineBasicMaterial color={color} />
            </lineSegments>
          </group>
        ) : (
          <lineSegments position={position} quaternion={quaternion} geometry={edgesGeo}>
            <lineBasicMaterial color={color} />
          </lineSegments>
        )}
        {inspected && (
          <lineSegments position={position} quaternion={quaternion} geometry={edgesGeo} renderOrder={998}>
            <lineBasicMaterial color="#ff3333" depthTest={false} />
          </lineSegments>
        )}
        {opsJsx}
      </group>
    )
  }

  // Rod parts without GLB → cylinder
  if (isRodPart) {
    return (
      <group position={position} quaternion={quaternion}>
        <mesh rotation={[0, 0, Math.PI / 2]} onDoubleClick={handleDblClick}>
          <cylinderGeometry args={[width / 2, width / 2, length, 16]} />
          {renderMode === 'solid' ? (
            <meshStandardMaterial color={color} roughness={0.7} metalness={0.3}
polygonOffset polygonOffsetFactor={polyFactor} polygonOffsetUnits={polyUnits} />
          ) : (
            <meshStandardMaterial color={color} transparent opacity={0.8} roughness={0.8} metalness={0.1}
/>
          )}
        </mesh>
        {renderMode === 'solid' && edgeOpacity > 0 && (
          <lineSegments rotation={[0, 0, Math.PI / 2]} geometry={edgesGeo}>
            <lineBasicMaterial color="#000000" transparent opacity={edgeOpacity} />
          </lineSegments>
        )}
        {inspected && (
          <lineSegments rotation={[0, 0, Math.PI / 2]} geometry={edgesGeo} renderOrder={998}>
            <lineBasicMaterial color="#ff3333" depthTest={false} />
          </lineSegments>
        )}
      </group>
    )
  }

  return (
    <group>
      <mesh position={position} quaternion={quaternion}
        geometry={partGeo?.isShape ? partGeo.geometry : undefined}
        onDoubleClick={handleDblClick}
      >
        {!partGeo?.isShape && <boxGeometry args={[length, thick, width]} />}
        {renderMode === 'solid' ? (
          partTex ? (
            <meshStandardMaterial key="solid-tex" map={partTex} roughness={0.7} metalness={0.1}
polygonOffset polygonOffsetFactor={polyFactor} polygonOffsetUnits={polyUnits} />
          ) : (
            <meshStandardMaterial key="solid" color={color} roughness={0.7} metalness={0.1}
polygonOffset polygonOffsetFactor={polyFactor} polygonOffsetUnits={polyUnits} />
          )
        ) : (
          partTex ? (
            <meshStandardMaterial key="ghosted-tex" map={partTex} transparent opacity={0.8} roughness={0.8} metalness={0}
/>
          ) : (
            <meshStandardMaterial key="ghosted" color={color} transparent opacity={0.8} roughness={0.8} metalness={0}
/>
          )
        )}
      </mesh>
      {renderMode === 'solid' && edgeOpacity > 0 && (
        <lineSegments position={position} quaternion={quaternion} geometry={edgesGeo}>
          <lineBasicMaterial color="#000000" transparent opacity={edgeOpacity} />
        </lineSegments>
      )}
      {inspected && (
        <lineSegments position={position} quaternion={quaternion} geometry={edgesGeo} renderOrder={998}>
          <lineBasicMaterial color="#ff3333" depthTest={false} />
        </lineSegments>
      )}
      {opsJsx}
    </group>
  )
}

export default function ProductView({
  product, productIndex, worldOffset, wallAngleDeg, renderMode = 'ghosted',
  showBoundingBox = false, selected = false, onSelect, onResize, onResizeWidth, onUpdateElev, onUpdateX,
  onBumpLeft, onBumpRight, onRemove, onDragStart, onDragEnd, showOperations = true, showShapeDebug = false,
  edgeOpacity = 0, polyFactor = 1, polyUnits = 1,
  textureFolder = null, textureId = null, textureFilename = null,
  singleDrawBrand = null, singleDrawTexture = null, modelsFolder = null,
  hoveredPart = null,
  inspectedPart = null,
  onInspectPart,
}: ProductViewProps) {
  const [hovered, setHovered] = useState(false)
  // Priority: SingleDraw (brand picker) → filename-based (user override) → textureId-based (DES default)
  const texById = useProductTexture(textureFilename ? null : textureFolder, textureFilename ? null : textureId)
  const texByFile = useTextureByFilename(textureFilename ? textureFolder : null, textureFilename)
  const texSingleDraw = useSingleDrawTexture(textureFolder, singleDrawBrand, singleDrawTexture)
  const baseTexture = texSingleDraw ?? texByFile ?? texById

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

  const outline = useMemo(() => computeProductOutline(product), [product])

  const showBox = showBoundingBox || selected

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
          edgeOpacity={edgeOpacity}
          polyFactor={polyFactor}
          polyUnits={polyUnits}
          showOperations={showOperations}
          highlighted={hoveredPart?.productIndex === productIndex && hoveredPart?.partIndex === i}
          inspected={inspectedPart?.productIndex === productIndex && inspectedPart?.partIndex === i}
          onInspect={productIndex !== undefined && onInspectPart ? () => onInspectPart(productIndex, i) : undefined}
        />
      ))}

      {/* Invisible click target for product selection */}
      {productIndex !== undefined && onSelect && (
        <mesh
          position={bbPos}
          onClick={(e) => { e.stopPropagation(); onSelect(productIndex, e.shiftKey) }}
          onPointerOver={() => setHovered(true)}
          onPointerOut={() => setHovered(false)}
        >
          <boxGeometry args={[product.width, product.height, product.depth]} />
          <meshBasicMaterial visible={false} />
        </mesh>
      )}

      {/* Hover outline when not selected */}
      {hovered && !selected && (
        <ProductOutline outline={outline} height={product.height} />
      )}

      {/* Shaped outline when selected or debug overlay enabled */}
      {showBox && (
        <ProductOutline outline={outline} height={product.height} />
      )}

      {/* CRN shape debug overlay — shows TopShape (green) vs Bottom part (red) */}
      {showShapeDebug && selected && !product.isRectShape && (
        <ShapeDebugOverlay product={product} />
      )}

      {/* Resize handles only when selected */}
      {selected && productIndex !== undefined && onResize && onResizeWidth && onUpdateElev && onUpdateX && (
        <ProductResizeHandles
          product={product}
          productIndex={productIndex}
          wallAngleDeg={wallAngleDeg}
          onResize={onResize}
          onResizeWidth={onResizeWidth}
          onUpdateElev={onUpdateElev}
          onUpdateX={onUpdateX}
          onBumpLeft={onBumpLeft}
          onBumpRight={onBumpRight}
          onRemove={onRemove}
          onDragStart={onDragStart}
          onDragEnd={onDragEnd}
        />
      )}
    </group>
  )
}
