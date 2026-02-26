import { useMemo } from 'react'
import { DoubleSide } from 'three'
import type { MozRoom } from '../mozaik/types'
import { computeWallGeometries } from '../math/wallMath'
import { mozPosToThree } from '../math/basis'
import { DEG2RAD } from '../math/constants'

interface WallOpeningsProps {
  room: MozRoom
}

export default function WallOpenings({ room }: WallOpeningsProps) {
  const geometries = useMemo(
    () => computeWallGeometries(room.walls),
    [room.walls],
  )

  // Filter to opening fixtures only
  const openings = room.fixtures.filter(
    (f) => f.name === 'Opening' || f.name.toLowerCase().includes('opening'),
  )

  if (openings.length === 0) return null

  return (
    <group>
      {openings.map((fixture) => {
        const wallGeom = geometries.find((g) => g.wallNumber === fixture.wall)
        if (!wallGeom) return null

        const wall = room.walls.find((w) => w.wallNumber === fixture.wall)
        if (!wall) return null

        // Opening center position in Mozaik space:
        // Start at wall start, move fixture.x along wall tangent,
        // then center the opening (fixture.x is distance to opening start)
        const centerAlongWall = fixture.x + fixture.width / 2
        const centerElev = fixture.elev + fixture.height / 2

        // Position in Mozaik XY
        const mx = wall.posX + centerAlongWall * wallGeom.tangent[0]
        const my = wall.posY + centerAlongWall * wallGeom.tangent[1]
        const mz = centerElev

        // Slight offset along wall normal so opening sits on wall face
        const offset = wall.thickness / 2 + 1 // 1mm in front of wall
        const ox = mx + offset * wallGeom.normal[0]
        const oy = my + offset * wallGeom.normal[1]

        const pos = mozPosToThree(ox, oy, mz)
        const rotY = wall.ang * DEG2RAD

        return (
          <mesh
            key={fixture.idTag}
            position={pos}
            rotation={[0, rotY, 0]}
          >
            <planeGeometry args={[fixture.width, fixture.height]} />
            <meshStandardMaterial
              color="#FFE500"
              transparent
              opacity={0.3}
              side={DoubleSide}
              depthWrite={false}
            />
          </mesh>
        )
      })}
    </group>
  )
}
