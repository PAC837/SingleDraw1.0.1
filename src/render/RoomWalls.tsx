import { useMemo } from 'react'
import { DoubleSide, FrontSide, BoxGeometry, EdgesGeometry } from 'three'
import type { Vector3 } from 'three'
import type { MozRoom, RenderMode } from '../mozaik/types'
import { computeWallGeometries, computeWallTrims } from '../math/wallMath'
import { mozPosToThree } from '../math/basis'
import { DEG2RAD } from '../math/constants'

interface RoomWallsProps {
  room: MozRoom
  doubleSided: boolean
  selectedWall: number | null
  onSelectWall: (wallNumber: number) => void
  renderMode?: RenderMode
}

function WallMesh({
  renderLen, height, thickness, pos, rotY, color, opacity, doubleSided, renderMode, onSelect,
}: {
  renderLen: number; height: number; thickness: number
  pos: Vector3; rotY: number
  color: string; opacity: number
  doubleSided: boolean; renderMode: RenderMode
  onSelect: () => void
}) {
  const edgesGeo = useMemo(() => {
    const box = new BoxGeometry(renderLen, height, thickness)
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
        <lineSegments geometry={edgesGeo}>
          <lineBasicMaterial color={color} />
        </lineSegments>
      </group>
    )
  }

  return (
    <mesh
      position={pos}
      rotation={[0, rotY, 0]}
      onClick={(e) => { e.stopPropagation(); onSelect() }}
    >
      <boxGeometry args={[renderLen, height, thickness]} />
      {renderMode === 'solid' ? (
        <meshStandardMaterial
          key="solid"
          color={color}
          roughness={0.6}
          metalness={0}
          side={side}
        />
      ) : (
        <meshStandardMaterial
          key="ghosted"
          color={color}
          transparent
          opacity={opacity}
          side={side}
          depthWrite={false}
        />
      )}
    </mesh>
  )
}

export default function RoomWalls({ room, doubleSided, selectedWall, onSelectWall, renderMode = 'ghosted' }: RoomWallsProps) {
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
        const color = isSelected ? '#FFE500' : '#555555'
        const opacity = isSelected ? 0.7 : 0.4

        return (
          <WallMesh
            key={g.wallNumber}
            renderLen={renderLen}
            height={g.height}
            thickness={g.thickness}
            pos={pos}
            rotY={rotY}
            color={color}
            opacity={opacity}
            doubleSided={doubleSided}
            renderMode={renderMode}
            onSelect={() => onSelectWall(g.wallNumber)}
          />
        )
      })}
    </group>
  )
}
