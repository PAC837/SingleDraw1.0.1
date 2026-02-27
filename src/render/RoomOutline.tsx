/**
 * Single room outline with deduped inner edges and mitered outer corners.
 * Replaces per-wall EdgesGeometry to prevent z-fighting at inner corners
 * and creates clean mitered joints at outer corners.
 */

import { useMemo } from 'react'
import { BufferGeometry, Float32BufferAttribute } from 'three'
import type { MozRoom } from '../mozaik/types'
import { computeRoomPolygons, computeWallGeometries } from '../math/wallMath'
import { mozPosToThree } from '../math/basis'

interface RoomOutlineProps {
  room: MozRoom
}

export default function RoomOutline({ room }: RoomOutlineProps) {
  const geometry = useMemo(() => {
    const geos = computeWallGeometries(room.walls)
    if (geos.length < 3) return null

    const { inner, outer } = computeRoomPolygons(room.walls)
    const height = geos[0].height
    const verts: number[] = []

    // Helper: push a line segment (two 3D points) in Three.js coords
    const addLine = (ax: number, ay: number, az: number, bx: number, by: number, bz: number) => {
      const a = mozPosToThree(ax, ay, az)
      const b = mozPosToThree(bx, by, bz)
      verts.push(a.x, a.y, a.z, b.x, b.y, b.z)
    }

    for (let i = 0; i < inner.length; i++) {
      const next = (i + 1) % inner.length

      // Inner perimeter: bottom and top horizontal edges
      addLine(inner[i][0], inner[i][1], 0, inner[next][0], inner[next][1], 0)
      addLine(inner[i][0], inner[i][1], height, inner[next][0], inner[next][1], height)

      // Outer perimeter: bottom and top horizontal edges (mitered corners)
      addLine(outer[i][0], outer[i][1], 0, outer[next][0], outer[next][1], 0)
      addLine(outer[i][0], outer[i][1], height, outer[next][0], outer[next][1], height)

      // Vertical edges at each corner (inner and outer)
      addLine(inner[i][0], inner[i][1], 0, inner[i][0], inner[i][1], height)
      addLine(outer[i][0], outer[i][1], 0, outer[i][0], outer[i][1], height)

      // Miter diagonal on top and bottom faces (inner corner to outer miter point)
      addLine(inner[i][0], inner[i][1], 0, outer[i][0], outer[i][1], 0)
      addLine(inner[i][0], inner[i][1], height, outer[i][0], outer[i][1], height)
    }

    const geo = new BufferGeometry()
    geo.setAttribute('position', new Float32BufferAttribute(verts, 3))
    return geo
  }, [room.walls])

  if (!geometry) return null

  return (
    <lineSegments geometry={geometry}>
      <lineBasicMaterial color="#000000" />
    </lineSegments>
  )
}
