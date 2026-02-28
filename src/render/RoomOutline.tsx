/**
 * Room outline with per-wall coloring for selection.
 * Uses polygon intersection points for all corners (miter and butt alike).
 * The miterBack flag only affects DES export, not visual rendering.
 */

import { useMemo } from 'react'
import { BufferGeometry, Float32BufferAttribute } from 'three'
import type { MozRoom } from '../mozaik/types'
import { computeRoomPolygons, computeWallGeometries, computeWallTrims, computeWallMiterExtensions } from '../math/wallMath'
import { mozPosToThree } from '../math/basis'

interface RoomOutlineProps {
  room: MozRoom
  selectedWall: number | null
}

interface WallEdges {
  wallNumber: number
  geometry: BufferGeometry
}

export default function RoomOutline({ room, selectedWall }: RoomOutlineProps) {
  const wallEdges = useMemo(() => {
    const geos = computeWallGeometries(room.walls)
    if (geos.length < 3) return null

    const { inner, outer } = computeRoomPolygons(room.walls)
    const trims = computeWallTrims(room.walls, room.wallJoints)
    const miters = computeWallMiterExtensions(room.walls, room.wallJoints)

    const result: WallEdges[] = []

    for (let i = 0; i < geos.length; i++) {
      const next = (i + 1) % geos.length
      const g = geos[i]
      const verts: number[] = []

      const addLine = (ax: number, ay: number, az: number, bx: number, by: number, bz: number) => {
        const a = mozPosToThree(ax, ay, az)
        const b = mozPosToThree(bx, by, bz)
        verts.push(a.x, a.y, a.z, b.x, b.y, b.z)
      }

      // Butt joint at this wall's start? Use flat face positions instead of polygon points.
      // Top-of-slope corners always render mitered (no butt visual).
      const wall = room.walls[i]
      const prevWall = room.walls[(i - 1 + geos.length) % geos.length]
      const nextWall = room.walls[(i + 1) % geos.length]

      const startJoint = room.wallJoints[(i - 1 + geos.length) % geos.length]
      const rawButtStart = startJoint ? !startJoint.miterBack : false
      const topAtStart = (wall.followAngle && prevWall.height > wall.height) ||
                         (prevWall.followAngle && wall.height > prevWall.height)
      const buttStart = rawButtStart && !topAtStart

      const miter = miters.get(g.wallNumber) ?? { startExt: 0, endExt: 0, innerStartExt: 0, innerEndExt: 0 }
      let iS: [number, number], oS: [number, number]
      if (buttStart) {
        // Dominant face keeps polygon point (touching), back face uses flat position
        const trim = trims.get(g.wallNumber) ?? { trimStart: 0, trimEnd: 0 }
        const flatInner: [number, number] = [
          g.start[0] + trim.trimStart * g.tangent[0] + (g.thickness / 2) * g.normal[0],
          g.start[1] + trim.trimStart * g.tangent[1] + (g.thickness / 2) * g.normal[1],
        ]
        const flatOuter: [number, number] = [
          g.start[0] + trim.trimStart * g.tangent[0] - (g.thickness / 2) * g.normal[0],
          g.start[1] + trim.trimStart * g.tangent[1] - (g.thickness / 2) * g.normal[1],
        ]
        if (miter.startExt >= miter.innerStartExt) {
          oS = outer[i]; iS = flatInner   // outer dominant: keep outer, flat inner
        } else {
          iS = inner[i]; oS = flatOuter   // inner dominant: keep inner, flat outer
        }
      } else {
        iS = inner[i]
        oS = outer[i]
      }

      // Butt joint at this wall's end? Use flat face positions (open corner).
      const endJoint = room.wallJoints[i]
      const rawButtEnd = endJoint ? !endJoint.miterBack : false
      const topAtEnd = (wall.followAngle && nextWall.height > wall.height) ||
                       (nextWall.followAngle && wall.height > nextWall.height)
      const buttEnd = rawButtEnd && !topAtEnd

      let iE: [number, number], oE: [number, number]
      if (buttEnd) {
        const trim = trims.get(g.wallNumber) ?? { trimStart: 0, trimEnd: 0 }
        const endDist = Math.sqrt((g.end[0] - g.start[0]) ** 2 + (g.end[1] - g.start[1]) ** 2)
        const ex = g.start[0] + (endDist - trim.trimEnd) * g.tangent[0]
        const ey = g.start[1] + (endDist - trim.trimEnd) * g.tangent[1]
        const flatInnerE: [number, number] = [ex + (g.thickness / 2) * g.normal[0], ey + (g.thickness / 2) * g.normal[1]]
        const flatOuterE: [number, number] = [ex - (g.thickness / 2) * g.normal[0], ey - (g.thickness / 2) * g.normal[1]]
        if (miter.endExt >= miter.innerEndExt) {
          oE = outer[next]; iE = flatInnerE  // outer dominant
        } else {
          iE = inner[next]; oE = flatOuterE  // inner dominant
        }
      } else {
        iE = inner[next]
        oE = outer[next]
      }

      const hStart = g.startHeight
      const hEnd = g.endHeight

      // Bottom edges
      addLine(iS[0], iS[1], 0, iE[0], iE[1], 0)
      addLine(oS[0], oS[1], 0, oE[0], oE[1], 0)

      // Top edges (slope from hStart to hEnd)
      addLine(iS[0], iS[1], hStart, iE[0], iE[1], hEnd)
      addLine(oS[0], oS[1], hStart, oE[0], oE[1], hEnd)

      // Start verticals + face line
      addLine(iS[0], iS[1], 0, iS[0], iS[1], hStart)
      addLine(oS[0], oS[1], 0, oS[0], oS[1], hStart)
      addLine(iS[0], iS[1], 0, oS[0], oS[1], 0)
      addLine(iS[0], iS[1], hStart, oS[0], oS[1], hStart)

      // End verticals + face line
      addLine(iE[0], iE[1], 0, iE[0], iE[1], hEnd)
      addLine(oE[0], oE[1], 0, oE[0], oE[1], hEnd)
      addLine(iE[0], iE[1], 0, oE[0], oE[1], 0)
      addLine(iE[0], iE[1], hEnd, oE[0], oE[1], hEnd)

      const geo = new BufferGeometry()
      geo.setAttribute('position', new Float32BufferAttribute(verts, 3))
      result.push({ wallNumber: g.wallNumber, geometry: geo })
    }

    return result
  }, [room.walls, room.wallJoints])

  if (!wallEdges) return null

  return (
    <group>
      {wallEdges.map(({ wallNumber, geometry }) => (
        <lineSegments key={wallNumber} geometry={geometry}>
          <lineBasicMaterial color={wallNumber === selectedWall ? '#AAFF00' : '#000000'} />
        </lineSegments>
      ))}
    </group>
  )
}
