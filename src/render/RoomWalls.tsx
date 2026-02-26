import { useMemo } from 'react'
import { DoubleSide, FrontSide } from 'three'
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

        // Trimmed render length and adjusted midpoint
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
          <mesh
            key={g.wallNumber}
            position={pos}
            rotation={[0, rotY, 0]}
            onClick={(e) => {
              e.stopPropagation()
              onSelectWall(g.wallNumber)
            }}
          >
            <boxGeometry args={[renderLen, g.height, g.thickness]} />
            {renderMode === 'wireframe' ? (
              <meshStandardMaterial
                color={color}
                wireframe
                side={doubleSided ? DoubleSide : FrontSide}
              />
            ) : renderMode === 'solid' ? (
              <meshStandardMaterial
                color={color}
                transparent
                opacity={isSelected ? 0.9 : 0.85}
                side={doubleSided ? DoubleSide : FrontSide}
              />
            ) : (
              <meshStandardMaterial
                color={color}
                transparent
                opacity={opacity}
                side={doubleSided ? DoubleSide : FrontSide}
                depthWrite={false}
              />
            )}
          </mesh>
        )
      })}
    </group>
  )
}
