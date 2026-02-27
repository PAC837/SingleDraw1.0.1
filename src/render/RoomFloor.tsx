/**
 * Textured floor polygon that matches the room's wall outline.
 * Uses wall start points to build a Shape, then applies the selected floor texture.
 */

import { useMemo } from 'react'
import { Shape, ShapeGeometry, RepeatWrapping, DoubleSide } from 'three'
import type { Texture } from 'three'
import type { MozRoom } from '../mozaik/types'
import { computeWallGeometries } from '../math/wallMath'
import { useFloorTexture } from './useProductTexture'

interface RoomFloorProps {
  room: MozRoom
  textureFolder: FileSystemDirectoryHandle | null
  selectedFloorTexture: string | null
}

export default function RoomFloor({ room, textureFolder, selectedFloorTexture }: RoomFloorProps) {
  const floorTex = useFloorTexture(textureFolder, selectedFloorTexture)

  const geometry = useMemo(() => {
    const geos = computeWallGeometries(room.walls)
    if (geos.length < 3) return null

    // Use raw Mozaik XY coords for the Shape. The -π/2 X rotation transforms
    // Shape(x, y) → World(x, -y) which matches mozPosToThree(mx, my, 0) = (mx, 0, -my).
    const shape = new Shape()
    shape.moveTo(geos[0].start[0], geos[0].start[1])
    for (let i = 1; i < geos.length; i++) {
      shape.lineTo(geos[i].start[0], geos[i].start[1])
    }
    shape.closePath()

    return new ShapeGeometry(shape)
  }, [room.walls])

  // Tile floor texture — ShapeGeometry UVs are in raw mm, so 1/1000 = one tile per 1000mm
  const tiledTex = useMemo(() => {
    if (!floorTex || !geometry) return null

    const tex = floorTex.clone() as Texture
    tex.wrapS = RepeatWrapping
    tex.wrapT = RepeatWrapping
    tex.repeat.set(1 / 1000, 1 / 1000)
    tex.needsUpdate = true
    return tex
  }, [floorTex, geometry])

  if (!geometry) return null

  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 2, 0]}>
      <primitive object={geometry} attach="geometry" />
      <meshStandardMaterial
        key={`floor-${tiledTex?.id ?? 'none'}`}
        map={tiledTex ?? undefined}
        color={tiledTex ? '#ffffff' : '#f0f0f0'}
        roughness={0.9}
        side={DoubleSide}
      />
    </mesh>
  )
}
