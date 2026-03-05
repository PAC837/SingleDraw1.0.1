/**
 * Renders auto-generated end panels alongside products on walls.
 * Panels are computed (not stored) from the product arrangement.
 */

import { useMemo } from 'react'
import { BoxGeometry, EdgesGeometry } from 'three'
import type { Texture } from 'three'
import type { MozRoom, MozProduct, RenderMode } from '../mozaik/types'
import { computeAutoEndPanels, PANEL_THICK, type AutoEndPanel } from '../mozaik/autoEndPanels'
import { computeProductWorldOffset } from '../math/wallMath'
import { mozPosToThree } from '../math/basis'
import { DEG2RAD } from '../math/constants'
import { useProductTexture, useTextureByFilename, useSingleDrawTexture } from './useProductTexture'

interface AutoEndPanelsProps {
  room: MozRoom
  renderMode: RenderMode
  flipOps?: boolean
  edgeOpacity?: number
  textureFolder?: FileSystemDirectoryHandle | null
  textureId?: number | null
  textureFilename?: string | null
  singleDrawBrand?: string | null
  singleDrawTexture?: string | null
}

const PANEL_COLOR = '#d4c5a9' // matches FEnd color from ProductView
const NO_CLIP: never[] = []

function EndPanelMesh({
  panel, room, renderMode, baseTexture, edgeOpacity = 0,
}: {
  panel: AutoEndPanel
  room: MozRoom
  renderMode: RenderMode
  baseTexture: Texture | null
  edgeOpacity?: number
}) {
  const offset = useMemo(() => {
    // Create a pseudo-product to compute world position via existing wall math
    const pseudo = {
      wall: `${panel.wallNumber}_1`,
      x: panel.x,
      width: PANEL_THICK,
      depth: panel.depth,
      elev: panel.elev,
    } as MozProduct
    return computeProductWorldOffset(pseudo, room.walls, room.wallJoints)
  }, [panel, room.walls, room.wallJoints])

  const edgesGeo = useMemo(() => {
    const geo = new BoxGeometry(PANEL_THICK, panel.height, panel.depth)
    const edges = new EdgesGeometry(geo)
    geo.dispose()
    return edges
  }, [panel.height, panel.depth])

  if (!offset) return null

  const pos = mozPosToThree(offset.position[0], offset.position[1], offset.position[2])
  const rotY = offset.wallAngleDeg * DEG2RAD
  const bbPos = mozPosToThree(PANEL_THICK / 2, panel.depth / 2, panel.height / 2)

  return (
    <group position={pos} rotation={[0, rotY, 0]} scale={[1, 1, -1]}>
      <mesh position={bbPos}>
        <boxGeometry args={[PANEL_THICK, panel.height, panel.depth]} />
        {renderMode === 'wireframe' ? (
          <meshBasicMaterial color={PANEL_COLOR} wireframe />
        ) : renderMode === 'solid' ? (
          baseTexture ? (
            <meshStandardMaterial map={baseTexture} roughness={0.7} metalness={0.1}
              clippingPlanes={NO_CLIP} polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
          ) : (
            <meshStandardMaterial color={PANEL_COLOR} roughness={0.7} metalness={0.1}
              clippingPlanes={NO_CLIP} polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1} />
          )
        ) : (
          baseTexture ? (
            <meshStandardMaterial map={baseTexture} transparent opacity={0.8} roughness={0.8} metalness={0}
              clippingPlanes={NO_CLIP} />
          ) : (
            <meshStandardMaterial color={PANEL_COLOR} transparent opacity={0.8} roughness={0.8} metalness={0}
              clippingPlanes={NO_CLIP} />
          )
        )}
      </mesh>
      {renderMode === 'solid' && edgeOpacity > 0 && (
        <lineSegments position={bbPos} geometry={edgesGeo}>
          <lineBasicMaterial color="#000000" transparent opacity={edgeOpacity} />
        </lineSegments>
      )}
    </group>
  )
}

export default function AutoEndPanels({
  room, renderMode, flipOps = false, edgeOpacity = 0,
  textureFolder = null, textureId = null, textureFilename = null,
  singleDrawBrand = null, singleDrawTexture = null,
}: AutoEndPanelsProps) {
  const panels = useMemo(
    () => computeAutoEndPanels(room.products, room.walls, room.wallJoints, flipOps),
    [room.products, room.walls, room.wallJoints, flipOps],
  )

  // Same texture priority chain as ProductView
  const texById = useProductTexture(textureFilename ? null : textureFolder, textureFilename ? null : textureId)
  const texByFile = useTextureByFilename(textureFilename ? textureFolder : null, textureFilename)
  const texSingleDraw = useSingleDrawTexture(textureFolder, singleDrawBrand, singleDrawTexture)
  const baseTexture = texSingleDraw ?? texByFile ?? texById

  if (panels.length === 0) return null

  return (
    <group>
      {panels.map((panel, i) => (
        <EndPanelMesh
          key={`ep-${panel.wallNumber}-${panel.x}-${i}`}
          panel={panel}
          room={room}
          renderMode={renderMode}
          baseTexture={baseTexture}
          edgeOpacity={edgeOpacity}
        />
      ))}
    </group>
  )
}
