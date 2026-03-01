import { useMemo } from 'react'
import { DoubleSide, FrontSide, RepeatWrapping, BufferGeometry, Float32BufferAttribute } from 'three'
import type { Vector3, Texture } from 'three'
import RoomOutline from './RoomOutline'
import type { MozRoom, MozFixture, RenderMode } from '../mozaik/types'
import { computeWallGeometries, computeWallTrims, computeWallMiterExtensions } from '../math/wallMath'
import { mozPosToThree } from '../math/basis'
import { DEG2RAD } from '../math/constants'
import { useWallTexture } from './useProductTexture'

interface RoomWallsProps {
  room: MozRoom
  doubleSided: boolean
  selectedWall: number | null
  hoveredWall?: number | null
  onSelectWall: (wallNumber: number) => void
  renderMode?: RenderMode
  textureFolder: FileSystemDirectoryHandle | null
  selectedWallType: string | null
  selectedWallTexture: string | null
  hiddenWalls?: Record<number, boolean>
}

/** Describes a rectangular section of a wall (used to render around fixture cutouts). */
interface WallSegment {
  width: number; height: number
  /** Offset along wall from trimmed-wall center (mm). */
  alongWall: number
  /** Center elevation in Mozaik Z (mm). */
  centerZ: number
  startExt: number; endExt: number
  innerStartExt: number; innerEndExt: number
  startHeight?: number; endHeight?: number
  /** True if this segment's left edge is the wall's start boundary. */
  isWallStart?: boolean
  /** True if this segment's right edge is the wall's end boundary. */
  isWallEnd?: boolean
}

/** Split a wall into segments around fixture openings. No fixtures → single full-wall segment. */
function computeWallSegments(
  renderLen: number, wallHeight: number, trimStart: number,
  fixtures: MozFixture[],
  startExt: number, endExt: number,
  innerStartExt: number, innerEndExt: number,
  startHeight?: number, endHeight?: number,
): WallSegment[] {
  const sH = startHeight ?? wallHeight
  const eH = endHeight ?? wallHeight
  const lerpH = (x: number) => renderLen > 0 ? sH + (eH - sH) * (x / renderLen) : sH

  if (fixtures.length === 0) {
    return [{
      width: renderLen, height: wallHeight,
      alongWall: 0, centerZ: wallHeight / 2,
      startExt, endExt, innerStartExt, innerEndExt,
      startHeight, endHeight,
      isWallStart: true, isWallEnd: true,
    }]
  }

  const sorted = [...fixtures].sort((a, b) => a.x - b.x)
  const segments: WallSegment[] = []
  const rl2 = renderLen / 2
  let curX = 0

  for (const f of sorted) {
    const fx = Math.max(0, f.x - trimStart)
    const fEnd = Math.min(renderLen, fx + f.width)

    // Left/gap panel (full height, sloped)
    if (fx - curX > 1) {
      const w = fx - curX
      segments.push({
        width: w, height: wallHeight,
        alongWall: -rl2 + curX + w / 2, centerZ: wallHeight / 2,
        startExt: curX < 1 ? startExt : 0, endExt: 0,
        innerStartExt: curX < 1 ? innerStartExt : 0, innerEndExt: 0,
        startHeight: lerpH(curX), endHeight: lerpH(fx),
        isWallStart: curX < 1,
      })
    }

    const fW = fEnd - fx
    // Header above fixture — uses interpolated slope height so slope walls have no gap
    const headerLeftH = lerpH(fx) - (f.elev + f.height)
    const headerRightH = lerpH(fEnd) - (f.elev + f.height)
    const headerH = Math.max(headerLeftH, headerRightH)
    if (headerH > 1 && fW > 1) {
      segments.push({
        width: fW, height: headerH,
        alongWall: -rl2 + fx + fW / 2,
        centerZ: f.elev + f.height + headerH / 2,
        startExt: 0, endExt: 0, innerStartExt: 0, innerEndExt: 0,
        startHeight: headerLeftH, endHeight: headerRightH,
      })
    }

    // Sill below fixture (windows have elev > 0)
    if (f.elev > 1 && fW > 1) {
      segments.push({
        width: fW, height: f.elev,
        alongWall: -rl2 + fx + fW / 2, centerZ: f.elev / 2,
        startExt: 0, endExt: 0, innerStartExt: 0, innerEndExt: 0,
      })
    }

    curX = fEnd
  }

  // Right panel (full height, sloped)
  if (renderLen - curX > 1) {
    const w = renderLen - curX
    segments.push({
      width: w, height: wallHeight,
      alongWall: -rl2 + curX + w / 2, centerZ: wallHeight / 2,
      startExt: 0, endExt: endExt,
      innerStartExt: 0, innerEndExt: innerEndExt,
      startHeight: lerpH(curX), endHeight: lerpH(renderLen),
      isWallEnd: true,
    })
  }

  return segments
}

/**
 * Create a single BufferGeometry for an entire wall with fixture cutouts.
 * Segments are merged into one mesh to eliminate transparent-mode seams.
 * Fixture jamb/soffit faces fill the cutout "walls" through the wall thickness.
 */
function createMergedWallGeo(
  segments: WallSegment[],
  fixtures: MozFixture[],
  thickness: number,
  renderLen: number,
  trimStart: number,
): BufferGeometry {
  const t2 = thickness / 2
  const pos: number[] = []
  const uvs: number[] = []
  const rl2 = renderLen / 2

  /** Add a quad (two triangles) with CCW winding from the face's outward normal. */
  const addQuad = (
    a: [number, number, number], b: [number, number, number],
    c: [number, number, number], d: [number, number, number],
    ua: [number, number], ub: [number, number],
    uc: [number, number], ud: [number, number],
  ) => {
    pos.push(...a, ...b, ...c, ...a, ...c, ...d)
    uvs.push(...ua, ...ub, ...uc, ...ua, ...uc, ...ud)
  }

  // --- Segment faces ---
  for (const seg of segments) {
    const sw2 = seg.width / 2
    const sh2 = seg.height / 2
    const botY = seg.centerZ - sh2
    const startTopY = ((seg.startHeight ?? seg.height) - sh2) + seg.centerZ
    const endTopY = ((seg.endHeight ?? seg.height) - sh2) + seg.centerZ
    const sx = seg.alongWall - sw2
    const ex = seg.alongWall + sw2

    // 8 corners in wall-local space (X=along wall, Y=height from floor, Z=across wall)
    const v: [number, number, number][] = [
      [sx - seg.innerStartExt, botY,      t2],  // 0: inner start bottom
      [ex + seg.innerEndExt,   botY,      t2],  // 1: inner end bottom
      [ex + seg.innerEndExt,   endTopY,   t2],  // 2: inner end top
      [sx - seg.innerStartExt, startTopY, t2],  // 3: inner start top
      [sx - seg.startExt,      botY,     -t2],  // 4: outer start bottom
      [ex + seg.endExt,        botY,     -t2],  // 5: outer end bottom
      [ex + seg.endExt,        endTopY,  -t2],  // 6: outer end top
      [sx - seg.startExt,      startTopY,-t2],  // 7: outer start top
    ]

    // Position-based UVs for inner/outer faces (tiles every 1000mm via RepeatWrapping)
    const iu = (vt: [number, number, number]): [number, number] => [(vt[0] + rl2) / 1000, vt[1] / 1000]

    // Inner face (+z)
    addQuad(v[0], v[1], v[2], v[3], iu(v[0]), iu(v[1]), iu(v[2]), iu(v[3]))
    // Outer face (-z) — reversed winding, mirrored UVs
    addQuad(v[5], v[4], v[7], v[6], iu(v[5]), iu(v[4]), iu(v[7]), iu(v[6]))
    // Top face
    addQuad(v[3], v[2], v[6], v[7], [0, 1], [1, 1], [1, 0], [0, 0])
    // Bottom face
    addQuad(v[4], v[5], v[1], v[0], [0, 0], [1, 0], [1, 1], [0, 1])

    // Start cap (only at wall boundary)
    if (seg.isWallStart) {
      addQuad(v[4], v[0], v[3], v[7], [0, 0], [1, 0], [1, 1], [0, 1])
    }
    // End cap (only at wall boundary)
    if (seg.isWallEnd) {
      addQuad(v[1], v[5], v[6], v[2], [0, 0], [1, 0], [1, 1], [0, 1])
    }
  }

  // --- Fixture jamb/soffit faces (the "walls" of each cutout) ---
  for (const f of fixtures) {
    const fx = Math.max(0, f.x - trimStart)
    const fEnd = Math.min(renderLen, fx + f.width)
    const lx = -rl2 + fx
    const rx = -rl2 + fEnd
    const bot = f.elev
    const top = f.elev + f.height

    // Left jamb (normal = +x, into the opening)
    addQuad(
      [lx, bot, t2], [lx, bot, -t2], [lx, top, -t2], [lx, top, t2],
      [0, 0], [1, 0], [1, 1], [0, 1],
    )
    // Right jamb (normal = -x)
    addQuad(
      [rx, bot, -t2], [rx, bot, t2], [rx, top, t2], [rx, top, -t2],
      [0, 0], [1, 0], [1, 1], [0, 1],
    )
    // Header soffit (normal = -y, facing down into opening)
    addQuad(
      [lx, top, -t2], [rx, top, -t2], [rx, top, t2], [lx, top, t2],
      [0, 0], [1, 0], [1, 1], [0, 1],
    )
    // Sill top (normal = +y, facing up — only for windows)
    if (f.elev > 0) {
      addQuad(
        [lx, bot, t2], [rx, bot, t2], [rx, bot, -t2], [lx, bot, -t2],
        [0, 0], [1, 0], [1, 1], [0, 1],
      )
    }
  }

  const geo = new BufferGeometry()
  geo.setAttribute('position', new Float32BufferAttribute(pos, 3))
  geo.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geo.computeVertexNormals()
  return geo
}

/** Renders a single wall as one merged mesh (segments + fixture cutouts). */
function WallWithCutouts({
  segments, fixtures, thickness, renderLen, trimStart, wallHeight,
  pos, rotY, color, opacity, doubleSided, renderMode, onSelect, wallTexture,
}: {
  segments: WallSegment[]
  fixtures: MozFixture[]
  thickness: number
  renderLen: number
  trimStart: number
  wallHeight: number
  pos: Vector3
  rotY: number
  color: string
  opacity: number
  doubleSided: boolean
  renderMode: RenderMode
  onSelect: () => void
  wallTexture: Texture | null
}) {
  const mergedGeo = useMemo(
    () => createMergedWallGeo(segments, fixtures, thickness, renderLen, trimStart),
    [segments, fixtures, thickness, renderLen, trimStart],
  )

  const tiledTex = useMemo(() => {
    if (!wallTexture) return null
    const tex = wallTexture.clone() as Texture
    tex.wrapS = RepeatWrapping
    tex.wrapT = RepeatWrapping
    tex.repeat.set(1, 1)
    tex.needsUpdate = true
    return tex
  }, [wallTexture])

  const side = doubleSided ? DoubleSide : FrontSide

  if (renderMode === 'wireframe') {
    return (
      <group position={pos} rotation={[0, rotY, 0]}>
        <mesh position={[0, wallHeight / 2, 0]} onClick={(e) => { e.stopPropagation(); onSelect() }}>
          <boxGeometry args={[renderLen, wallHeight, thickness]} />
          <meshBasicMaterial visible={false} />
        </mesh>
      </group>
    )
  }

  return (
    <mesh
      position={pos}
      rotation={[0, rotY, 0]}
      geometry={mergedGeo}
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
  )
}

export default function RoomWalls({ room, doubleSided, selectedWall, hoveredWall, onSelectWall, renderMode = 'ghosted', textureFolder, selectedWallType, selectedWallTexture, hiddenWalls }: RoomWallsProps) {
  const wallTex = useWallTexture(textureFolder, selectedWallType, selectedWallTexture)
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
      <RoomOutline room={room} selectedWall={selectedWall} hoveredWall={hoveredWall} hiddenWalls={hiddenWalls} />
      {geometries.map((g, gIdx) => {
        if (hiddenWalls && hiddenWalls[g.wallNumber] === false) return null
        const wall = room.walls.find((w) => w.wallNumber === g.wallNumber)!
        const trim = trims.get(g.wallNumber) ?? { trimStart: 0, trimEnd: 0 }
        const miter = miters.get(g.wallNumber) ?? { startExt: 0, endExt: 0, innerStartExt: 0, innerEndExt: 0 }

        // Butt (unjoined) corners: zero extensions for flat faces (open corner).
        // Top-of-slope corners always render mitered (no butt visual).
        const n = geometries.length
        const wallIdx = room.walls.findIndex(w => w.wallNumber === g.wallNumber)
        const prevWall = room.walls[(wallIdx - 1 + n) % n]
        const nextWall = room.walls[(wallIdx + 1) % n]

        const startJoint = room.wallJoints[(gIdx - 1 + n) % n]
        const rawButtStart = startJoint ? !startJoint.miterBack : false
        const topAtStart = (wall.followAngle && prevWall.height > wall.height) ||
                           (prevWall.followAngle && wall.height > prevWall.height)
        const buttStart = rawButtStart && !topAtStart

        const endJoint = room.wallJoints[gIdx]
        const rawButtEnd = endJoint ? !endJoint.miterBack : false
        const topAtEnd = (wall.followAngle && nextWall.height > wall.height) ||
                         (nextWall.followAngle && wall.height > nextWall.height)
        const buttEnd = rawButtEnd && !topAtEnd

        const renderLen = wall.len - trim.trimStart - trim.trimEnd
        const shiftAlongWall = (trim.trimStart - trim.trimEnd) / 2
        const midX = (g.start[0] + g.end[0]) / 2 + shiftAlongWall * g.tangent[0]
        const midY = (g.start[1] + g.end[1]) / 2 + shiftAlongWall * g.tangent[1]

        const rotY = wall.ang * DEG2RAD

        const sE = buttStart ? (miter.startExt >= miter.innerStartExt ? miter.startExt : 0) : miter.startExt
        const eE = buttEnd ? (miter.endExt >= miter.innerEndExt ? miter.endExt : 0) : miter.endExt
        const isE = buttStart ? (miter.innerStartExt > miter.startExt ? miter.innerStartExt : 0) : miter.innerStartExt
        const ieE = buttEnd ? (miter.innerEndExt > miter.endExt ? miter.innerEndExt : 0) : miter.innerEndExt

        const wallFixtures = room.fixtures.filter(f => f.wall === g.wallNumber)
        const segments = computeWallSegments(renderLen, g.height, trim.trimStart, wallFixtures, sE, eE, isE, ieE, g.startHeight, g.endHeight)

        // Merged wall position at floor level (Y=0 in wall-local space = floor)
        const wallPos = mozPosToThree(midX, midY, 0)

        return (
          <WallWithCutouts
            key={g.wallNumber}
            segments={segments}
            fixtures={wallFixtures}
            thickness={g.thickness}
            renderLen={renderLen}
            trimStart={trim.trimStart}
            wallHeight={g.height}
            pos={wallPos}
            rotY={rotY}
            color="#e8e0d8"
            opacity={0.4}
            doubleSided={doubleSided}
            renderMode={renderMode}
            onSelect={() => onSelectWall(g.wallNumber)}
            wallTexture={wallTex}
          />
        )
      })}
    </group>
  )
}
