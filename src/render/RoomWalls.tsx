import { useMemo } from 'react'
import { DoubleSide, FrontSide, BoxGeometry, EdgesGeometry, RepeatWrapping } from 'three'
import type { Vector3, Texture } from 'three'
import type { MozRoom, RenderMode } from '../mozaik/types'
import { computeWallGeometries, computeWallTrims } from '../math/wallMath'
import { mozPosToThree } from '../math/basis'
import { DEG2RAD } from '../math/constants'
import { useWallTexture } from './useProductTexture'

interface RoomWallsProps {
  room: MozRoom
  doubleSided: boolean
  selectedWall: number | null
  onSelectWall: (wallNumber: number) => void
  renderMode?: RenderMode
  textureFolder: FileSystemDirectoryHandle | null
  selectedWallTexture: string | null
}

function WallMesh({
  renderLen, height, thickness, pos, rotY, color, opacity, doubleSided, renderMode,
  isSelected, onSelect, wallTexture,
}: {
  renderLen: number; height: number; thickness: number
  pos: Vector3; rotY: number
  color: string; opacity: number
  doubleSided: boolean; renderMode: RenderMode
  isSelected: boolean
  onSelect: () => void
  wallTexture: Texture | null
}) {

  // Tile the wall texture to repeat every ~1000mm
  const tiledTex = useMemo(() => {
    if (!wallTexture) return null
    const tex = wallTexture.clone() as Texture
    tex.wrapS = RepeatWrapping
    tex.wrapT = RepeatWrapping
    tex.repeat.set(renderLen / 1000, height / 1000)
    tex.needsUpdate = true
    return tex
  }, [wallTexture, renderLen, height])

  const edgesGeo = useMemo(() => {
    const box = new BoxGeometry(renderLen, height, thickness)
    const edges = new EdgesGeometry(box)
    box.dispose()
    return edges
  }, [renderLen, height, thickness])

  // Slightly larger edges for the accent glow halo on selected walls
  const glowEdgesGeo = useMemo(() => {
    const box = new BoxGeometry(renderLen + 20, height + 10, thickness + 20)
    const edges = new EdgesGeometry(box)
    box.dispose()
    return edges
  }, [renderLen, height, thickness])

  const side = doubleSided ? DoubleSide : FrontSide

  if (renderMode === 'wireframe') {
    return (
      <group position={pos} rotation={[0, rotY, 0]}>
        {/* Invisible mesh for click detection */}
        <mesh onClick={(e) => { e.stopPropagation(); onSelect() }}>
          <boxGeometry args={[renderLen, height, thickness]} />
          <meshBasicMaterial visible={false} />
        </mesh>
        {isSelected && (
          <lineSegments geometry={glowEdgesGeo}>
            <lineBasicMaterial color="#AAFF00" />
          </lineSegments>
        )}
        <lineSegments geometry={edgesGeo}>
          <lineBasicMaterial color="#000000" />
        </lineSegments>
      </group>
    )
  }

  return (
    <>
      <mesh
        position={pos}
        rotation={[0, rotY, 0]}
        onClick={(e) => { e.stopPropagation(); onSelect() }}
      >
        <boxGeometry args={[renderLen, height, thickness]} />
        {renderMode === 'solid' ? (
          <meshStandardMaterial
            key={`solid-${tiledTex?.id ?? 'none'}`}
            map={tiledTex ?? undefined}
            color={tiledTex ? '#ffffff' : color}
            roughness={0.6}
            metalness={0}
            side={side}
          />
        ) : (
          <meshStandardMaterial
            key={`ghosted-${tiledTex?.id ?? 'none'}`}
            map={tiledTex ?? undefined}
            color={tiledTex ? '#ffffff' : color}
            transparent
            opacity={opacity}
            side={side}
            depthWrite={false}
          />
        )}
      </mesh>
      {isSelected && (
        <lineSegments position={pos} rotation={[0, rotY, 0]} geometry={glowEdgesGeo}>
          <lineBasicMaterial color="#AAFF00" />
        </lineSegments>
      )}
      <lineSegments position={pos} rotation={[0, rotY, 0]} geometry={edgesGeo}>
        <lineBasicMaterial color="#000000" />
      </lineSegments>
    </>
  )
}

export default function RoomWalls({ room, doubleSided, selectedWall, onSelectWall, renderMode = 'ghosted', textureFolder, selectedWallTexture }: RoomWallsProps) {
  const wallTex = useWallTexture(textureFolder, selectedWallTexture)
  const geometries = useMemo(
    () => computeWallGeometries(room.walls),
    [room.walls],
  )

  const trims = useMemo(
    () => computeWallTrims(room.walls, room.wallJoints),
    [room.walls, room.wallJoints],
  )

  return (
    <group>
      {geometries.map((g) => {
        const wall = room.walls.find((w) => w.wallNumber === g.wallNumber)!
        const trim = trims.get(g.wallNumber) ?? { trimStart: 0, trimEnd: 0 }

        const renderLen = wall.len - trim.trimStart - trim.trimEnd
        const shiftAlongWall = (trim.trimStart - trim.trimEnd) / 2
        const midX = (g.start[0] + g.end[0]) / 2 + shiftAlongWall * g.tangent[0]
        const midY = (g.start[1] + g.end[1]) / 2 + shiftAlongWall * g.tangent[1]
        const midZ = g.height / 2

        const pos = mozPosToThree(midX, midY, midZ)
        const rotY = wall.ang * DEG2RAD
        const isSelected = selectedWall === g.wallNumber

        return (
          <WallMesh
            key={g.wallNumber}
            renderLen={renderLen}
            height={g.height}
            thickness={g.thickness}
            pos={pos}
            rotY={rotY}
            color="#e8e0d8"
            opacity={0.4}
            doubleSided={doubleSided}
            renderMode={renderMode}
            isSelected={isSelected}
            onSelect={() => onSelectWall(g.wallNumber)}
            wallTexture={wallTex}
          />
        )
      })}
    </group>
  )
}
