import { useMemo } from 'react'
import { DoubleSide, FrontSide, EdgesGeometry, RepeatWrapping, BufferGeometry, Float32BufferAttribute } from 'three'
import type { Vector3, Texture } from 'three'
import RoomOutline from './RoomOutline'
import type { MozRoom, RenderMode } from '../mozaik/types'
import { computeWallGeometries, computeWallTrims, computeWallMiterExtensions } from '../math/wallMath'
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

/** Create a trapezoidal prism for a mitered wall. Both inner and outer faces extend at corners. */
function createMiteredWallGeo(
  renderLen: number, height: number, thickness: number,
  startExt: number, endExt: number,
  innerStartExt: number, innerEndExt: number,
  startHeight?: number, endHeight?: number,
): BufferGeometry {
  const rl2 = renderLen / 2
  const h2 = height / 2
  const t2 = thickness / 2

  // Variable height: bottom stays at -h2 (floor), top varies per-end
  const startTopY = (startHeight ?? height) - h2
  const endTopY = (endHeight ?? height) - h2

  // 8 corners in local space (x=along wall, y=height, z=across wall)
  // Inner face (z=+t2): extends at concave (inside) corners
  // Outer face (z=-t2): extends at convex (outside) corners
  const v: [number, number, number][] = [
    [-rl2 - innerStartExt, -h2,        t2],   // 0: inner start bottom
    [ rl2 + innerEndExt,   -h2,        t2],   // 1: inner end bottom
    [ rl2 + innerEndExt,    endTopY,   t2],   // 2: inner end top
    [-rl2 - innerStartExt,  startTopY, t2],   // 3: inner start top
    [-rl2 - startExt,      -h2,       -t2],   // 4: outer start bottom
    [ rl2 + endExt,        -h2,       -t2],   // 5: outer end bottom
    [ rl2 + endExt,         endTopY,  -t2],   // 6: outer end top
    [-rl2 - startExt,       startTopY,-t2],   // 7: outer start top
  ]

  // 12 triangles (6 quad faces), non-indexed so each face gets flat normals
  const tris: [number, number, number][] = [
    [0,1,2], [0,2,3],   // Inner face (+z)
    [5,4,7], [5,7,6],   // Outer face (-z)
    [3,2,6], [3,6,7],   // Top face (+y)
    [4,5,1], [4,1,0],   // Bottom face (-y)
    [4,0,3], [4,3,7],   // Start miter face
    [1,5,6], [1,6,2],   // End miter face
  ]

  // UVs: simple 0-1 per quad face
  const quadUVs: [number, number][][] = [
    [[0,0],[1,0],[1,1]], [[0,0],[1,1],[0,1]],   // Inner
    [[1,0],[0,0],[0,1]], [[1,0],[0,1],[1,1]],   // Outer
    [[0,1],[1,1],[1,0]], [[0,1],[1,0],[0,0]],   // Top
    [[0,0],[1,0],[1,1]], [[0,0],[1,1],[0,1]],   // Bottom
    [[0,0],[1,0],[1,1]], [[0,0],[1,1],[0,1]],   // Start miter
    [[0,0],[1,0],[1,1]], [[0,0],[1,1],[0,1]],   // End miter
  ]

  const pos: number[] = []
  const uvs: number[] = []
  for (let f = 0; f < tris.length; f++) {
    const [a, b, c] = tris[f]
    pos.push(...v[a], ...v[b], ...v[c])
    uvs.push(...quadUVs[f][0], ...quadUVs[f][1], ...quadUVs[f][2])
  }

  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3))
  geo.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geo.computeVertexNormals()
  return geo
}

function WallMesh({
  renderLen, height, thickness, pos, rotY, color, opacity, doubleSided, renderMode,
  isSelected, onSelect, wallTexture, startExt, endExt, innerStartExt, innerEndExt,
  startHeight, endHeight,
}: {
  renderLen: number; height: number; thickness: number
  pos: Vector3; rotY: number
  color: string; opacity: number
  doubleSided: boolean; renderMode: RenderMode
  isSelected: boolean
  onSelect: () => void
  wallTexture: Texture | null
  startExt: number; endExt: number
  innerStartExt: number; innerEndExt: number
  startHeight?: number; endHeight?: number
}) {

  // Tile the wall texture to repeat every ~1000mm (based on inner face = renderLen)
  const tiledTex = useMemo(() => {
    if (!wallTexture) return null
    const tex = wallTexture.clone() as Texture
    tex.wrapS = RepeatWrapping
    tex.wrapT = RepeatWrapping
    tex.repeat.set(renderLen / 1000, height / 1000)
    tex.needsUpdate = true
    return tex
  }, [wallTexture, renderLen, height])

  const wallGeo = useMemo(
    () => createMiteredWallGeo(renderLen, height, thickness, startExt, endExt, innerStartExt, innerEndExt, startHeight, endHeight),
    [renderLen, height, thickness, startExt, endExt, innerStartExt, innerEndExt, startHeight, endHeight],
  )

  // Mitered glow halo edges for selected walls (slightly oversized)
  const glowEdgesGeo = useMemo(() => {
    const sh = startHeight !== undefined ? startHeight + 5 : undefined
    const eh = endHeight !== undefined ? endHeight + 5 : undefined
    const glow = createMiteredWallGeo(renderLen + 20, height + 10, thickness + 20, startExt + 10, endExt + 10, innerStartExt + 10, innerEndExt + 10, sh, eh)
    const edges = new EdgesGeometry(glow)
    glow.dispose()
    return edges
  }, [renderLen, height, thickness, startExt, endExt, innerStartExt, innerEndExt, startHeight, endHeight])

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
      </group>
    )
  }

  return (
    <>
      <mesh
        position={pos}
        rotation={[0, rotY, 0]}
        geometry={wallGeo}
        onClick={(e) => { e.stopPropagation(); onSelect() }}
      >
        {renderMode === 'solid' ? (
          <meshStandardMaterial
            key={`solid-${tiledTex?.id ?? 'none'}`}
            map={tiledTex ?? undefined}
            color={tiledTex ? '#ffffff' : color}
            roughness={0.6}
            metalness={0}
            side={side}
            polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1}
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
            polygonOffset polygonOffsetFactor={1} polygonOffsetUnits={1}
          />
        )}
      </mesh>
      {isSelected && (
        <lineSegments position={pos} rotation={[0, rotY, 0]} geometry={glowEdgesGeo}>
          <lineBasicMaterial color="#AAFF00" />
        </lineSegments>
      )}
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

  const miters = useMemo(
    () => computeWallMiterExtensions(room.walls, room.wallJoints),
    [room.walls, room.wallJoints],
  )

  return (
    <group>
      <RoomOutline room={room} />
      {geometries.map((g, gIdx) => {
        const wall = room.walls.find((w) => w.wallNumber === g.wallNumber)!
        const trim = trims.get(g.wallNumber) ?? { trimStart: 0, trimEnd: 0 }
        const miter = miters.get(g.wallNumber) ?? { startExt: 0, endExt: 0, innerStartExt: 0, innerEndExt: 0 }

        // Butt (unjoined) corners: zero extensions so both walls have flat faces (open corner).
        const n = geometries.length
        const startJoint = room.wallJoints[(gIdx - 1 + n) % n]
        const buttStart = startJoint ? !startJoint.miterBack : false
        const endJoint = room.wallJoints[gIdx]
        const buttEnd = endJoint ? !endJoint.miterBack : false

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
            startExt={buttStart ? 0 : miter.startExt}
            endExt={buttEnd ? 0 : miter.endExt}
            innerStartExt={buttStart ? 0 : miter.innerStartExt}
            innerEndExt={buttEnd ? 0 : miter.innerEndExt}
            startHeight={g.startHeight}
            endHeight={g.endHeight}
          />
        )
      })}
    </group>
  )
}
