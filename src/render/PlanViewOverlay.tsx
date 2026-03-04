/**
 * Plan view overlay rendered inside the R3F Canvas when wall editor is active.
 * Adds dimension labels, wall numbers, draggable joint handles, and
 * draggable fixture rectangles (doors/windows/openings) with live edge dimensions.
 * Single-click a fixture → edit popup; hold+drag → move along wall.
 */

import { useMemo, useRef, useState, useCallback } from 'react'
import { Html } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { CircleGeometry, Plane, Vector3, Raycaster, Vector2, BufferGeometry, Float32BufferAttribute } from 'three'
import type { MozRoom, MozFixture, DragTarget } from '../mozaik/types'
import { computeWallGeometries, wallEndpoint, signedArea } from '../math/wallMath'
import { mozPosToThree } from '../math/basis'
import { formatDim, mmToInches, inchesToMm } from '../math/units'
import { DEG2RAD } from '../math/constants'

interface PlanViewOverlayProps {
  room: MozRoom
  useInches: boolean
  dragTarget: DragTarget | null
  onSetDragTarget: (target: DragTarget | null) => void
  onMoveJoint: (jointIndex: number, newX: number, newY: number) => void
  onMoveFixture: (fixtureIdTag: number, newX: number) => void
  onUpdateFixture: (fixtureIdTag: number, fields: Partial<Pick<MozFixture, 'width' | 'height' | 'elev' | 'x'>>) => void
}

const handleGeo = new CircleGeometry(80, 24)
const fixtureHandleGeo = new CircleGeometry(60, 16)
const dragPlane = new Plane(new Vector3(0, 1, 0), 0) // XZ plane at y=0

/** Color by fixture type. */
function fixtureColor(name: string): string {
  const n = name.toLowerCase()
  if (n.includes('window')) return '#4488FF'
  if (n.includes('door')) return '#AA6633'
  return '#AAFF00'
}

/** Inline popup for editing fixture properties (width, elevation, distance from L/R). */
function FixtureEditPopup({ fixture, wallLen, useInches, position, onUpdate, onClose }: {
  fixture: MozFixture; wallLen: number; useInches: boolean
  position: Vector3; onUpdate: (fields: Partial<Pick<MozFixture, 'width' | 'height' | 'elev' | 'x'>>) => void
  onClose: () => void
}) {
  const display = (mm: number) => useInches ? mmToInches(mm).toFixed(2) : String(Math.round(mm))
  const parse = (s: string) => { const v = parseFloat(s); return useInches ? inchesToMm(v) : v }
  const isWindow = fixture.name.toLowerCase().includes('window')
  const distRight = wallLen - fixture.x - fixture.width
  const unit = useInches ? 'in' : 'mm'
  const iCls = 'w-16 text-[10px] px-1 py-0.5 bg-gray-800 rounded border border-gray-600 text-white text-center'
  const lCls = 'text-[9px] text-gray-400 w-10'

  const commit = (field: string, value: string) => {
    const v = parse(value)
    if (isNaN(v) || v < 0) return
    if (field === 'width') {
      const clamped = Math.min(Math.max(50, v), wallLen)
      onUpdate({ width: clamped, x: Math.min(fixture.x, wallLen - clamped) })
    } else if (field === 'elev') {
      onUpdate({ elev: Math.max(0, v) })
    } else if (field === 'fromL') {
      const x = Math.max(0, Math.min(v, wallLen - fixture.width))
      onUpdate({ x })
    } else if (field === 'fromR') {
      const x = Math.max(0, wallLen - fixture.width - Math.max(0, v))
      onUpdate({ x })
    }
  }

  return (
    <Html position={position} center style={{ pointerEvents: 'auto' }}>
      <div
        onClick={(e) => e.stopPropagation()}
        onPointerDown={(e) => e.stopPropagation()}
        style={{
          background: '#1e1e1e', border: '1px solid var(--accent)', borderRadius: 6,
          padding: '6px 8px', display: 'flex', flexDirection: 'column', gap: 3,
          minWidth: 140, transform: 'translateY(-60px)',
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span style={{ color: 'var(--accent)', fontSize: 10, fontWeight: 600 }}>{fixture.name}</span>
          <button onClick={onClose} style={{
            background: 'none', border: 'none', color: '#888', fontSize: 12, cursor: 'pointer', padding: '0 2px',
          }}>x</button>
        </div>
        <Row label={`W (${unit})`} defaultValue={display(fixture.width)} onCommit={(v) => commit('width', v)} iCls={iCls} lCls={lCls} />
        {isWindow && (
          <Row label={`Elev (${unit})`} defaultValue={display(fixture.elev)} onCommit={(v) => commit('elev', v)} iCls={iCls} lCls={lCls} />
        )}
        <Row label={`From L (${unit})`} defaultValue={display(fixture.x)} onCommit={(v) => commit('fromL', v)} iCls={iCls} lCls={lCls} />
        <Row label={`From R (${unit})`} defaultValue={display(distRight)} onCommit={(v) => commit('fromR', v)} iCls={iCls} lCls={lCls} />
      </div>
    </Html>
  )
}

/** Single label + input row for the fixture edit popup. */
function Row({ label, defaultValue, onCommit, iCls, lCls }: {
  label: string; defaultValue: string; onCommit: (v: string) => void; iCls: string; lCls: string
}) {
  const [val, setVal] = useState(defaultValue)
  const doCommit = () => onCommit(val)
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
      <span className={lCls}>{label}</span>
      <input
        className={iCls}
        type="number"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onBlur={doCommit}
        onKeyDown={(e) => e.key === 'Enter' && doCommit()}
      />
    </div>
  )
}

export default function PlanViewOverlay({
  room, useInches, dragTarget, onSetDragTarget, onMoveJoint, onMoveFixture, onUpdateFixture,
}: PlanViewOverlayProps) {
  const { camera, gl } = useThree()
  const [hoveredHandle, setHoveredHandle] = useState<number | null>(null)
  const [hoveredFixture, setHoveredFixture] = useState<number | null>(null)
  const [editingFixture, setEditingFixture] = useState<number | null>(null)
  const isDragging = useRef(false)
  const pointerDownPos = useRef<{ x: number; y: number; idTag: number } | null>(null)
  const didDrag = useRef(false)

  const geos = useMemo(
    () => computeWallGeometries(room.walls),
    [room.walls],
  )

  // Joint corner positions: joint[i] connects wall[i].end to wall[i+1].start
  const jointPositions = useMemo(() => {
    return room.walls.map(w => {
      const end = wallEndpoint(w)
      return { mozX: end[0], mozY: end[1] }
    })
  }, [room.walls])

  // Unproject mouse position to the XZ drag plane
  const unprojectToPlane = useCallback((clientX: number, clientY: number): [number, number] | null => {
    const rect = gl.domElement.getBoundingClientRect()
    const ndc = new Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1,
    )
    const raycaster = new Raycaster()
    raycaster.setFromCamera(ndc, camera)
    const hit = new Vector3()
    const intersected = raycaster.ray.intersectPlane(dragPlane, hit)
    if (!intersected) return null
    // Three.js (X, Y, Z) → Mozaik (X, -Z) since mozPosToThree maps (mx, my, mz) → (mx, mz, -my)
    return [hit.x, -hit.z]
  }, [camera, gl])

  const handlePointerDown = useCallback((jointIndex: number, nativeEvent: PointerEvent) => {
    isDragging.current = true
    onSetDragTarget({ type: 'joint', jointIndex })
    gl.domElement.setPointerCapture(nativeEvent.pointerId)
  }, [onSetDragTarget, gl])

  const handleFixturePointerDown = useCallback((fixtureIdTag: number, nativeEvent: PointerEvent) => {
    isDragging.current = true
    didDrag.current = false
    pointerDownPos.current = { x: nativeEvent.clientX, y: nativeEvent.clientY, idTag: fixtureIdTag }
    onSetDragTarget({ type: 'fixture', fixtureIdTag })
    gl.domElement.setPointerCapture(nativeEvent.pointerId)
  }, [onSetDragTarget, gl])

  const handlePointerMove = useCallback((nativeEvent: PointerEvent) => {
    if (!isDragging.current || !dragTarget) return

    // Detect if pointer moved enough to count as a drag (5px threshold)
    if (pointerDownPos.current && !didDrag.current) {
      const dx = nativeEvent.clientX - pointerDownPos.current.x
      const dy = nativeEvent.clientY - pointerDownPos.current.y
      if (Math.sqrt(dx * dx + dy * dy) > 5) didDrag.current = true
      else return // don't move fixture until threshold is exceeded
    }

    if (dragTarget.type === 'joint') {
      const pos = unprojectToPlane(nativeEvent.clientX, nativeEvent.clientY)
      if (pos) onMoveJoint(dragTarget.jointIndex, pos[0], pos[1])
    } else if (dragTarget.type === 'fixture') {
      const pos = unprojectToPlane(nativeEvent.clientX, nativeEvent.clientY)
      if (!pos) return
      const fixture = room.fixtures.find(f => f.idTag === dragTarget.fixtureIdTag)
      if (!fixture) return
      const geo = geos.find(g => g.wallNumber === fixture.wall)
      if (!geo) return
      const wall = room.walls.find(w => w.wallNumber === fixture.wall)
      if (!wall) return
      // Project mouse onto wall line: dot((mousePos - wallStart), tangent)
      const dx = pos[0] - geo.start[0]
      const dy = pos[1] - geo.start[1]
      const distAlongWall = dx * geo.tangent[0] + dy * geo.tangent[1]
      // Convert from center to left edge
      const newX = distAlongWall - fixture.width / 2
      const maxX = wall.len - fixture.width
      onMoveFixture(fixture.idTag, Math.max(0, Math.min(maxX, newX)))
    }
  }, [dragTarget, unprojectToPlane, onMoveJoint, onMoveFixture, room.fixtures, room.walls, geos])

  const handlePointerUp = useCallback((nativeEvent: PointerEvent) => {
    // Click vs drag: if pointer didn't move > 5px, it's a single click → open edit popup
    if (pointerDownPos.current && !didDrag.current) {
      const idTag = pointerDownPos.current.idTag
      setEditingFixture(prev => prev === idTag ? null : idTag)
    }
    isDragging.current = false
    didDrag.current = false
    pointerDownPos.current = null
    onSetDragTarget(null)
    gl.domElement.releasePointerCapture(nativeEvent.pointerId)
  }, [onSetDragTarget, gl])

  const wallHeight = room.walls[0]?.height ?? 2438

  // Interior angle arcs at each joint corner
  const arcData = useMemo(() => {
    const n = room.walls.length
    if (n < 3) return { geometry: null, labels: [] as { pos: Vector3; degrees: number }[] }

    const isCCW = signedArea(room.walls) > 0
    const sweepDir = isCCW ? -1 : 1
    const verts: number[] = []
    const labels: { pos: Vector3; degrees: number }[] = []
    const R = 300
    const segs = 24

    for (let i = 0; i < n; i++) {
      const wall = room.walls[i]
      const nextWall = room.walls[(i + 1) % n]
      const end = wallEndpoint(wall)
      const jx = end[0], jy = end[1]

      const a1Deg = (wall.ang + 180) % 360
      const a2Deg = nextWall.ang
      const interiorDeg = isCCW
        ? ((a1Deg - a2Deg + 360) % 360)
        : ((a2Deg - a1Deg + 360) % 360)

      if (interiorDeg < 0.1 || interiorDeg > 359.9) continue

      const a1Rad = a1Deg * DEG2RAD
      const sweepRad = interiorDeg * DEG2RAD

      for (let s = 0; s < segs; s++) {
        const t0 = s / segs
        const t1 = (s + 1) / segs
        const ang0 = a1Rad + sweepDir * t0 * sweepRad
        const ang1 = a1Rad + sweepDir * t1 * sweepRad
        const p0 = mozPosToThree(jx + R * Math.cos(ang0), jy + R * Math.sin(ang0), wallHeight + 100)
        const p1 = mozPosToThree(jx + R * Math.cos(ang1), jy + R * Math.sin(ang1), wallHeight + 100)
        verts.push(p0.x, p0.y, p0.z, p1.x, p1.y, p1.z)
      }

      const midAng = a1Rad + sweepDir * 0.5 * sweepRad
      const labelR = R + 150
      const labelPos = mozPosToThree(jx + labelR * Math.cos(midAng), jy + labelR * Math.sin(midAng), wallHeight + 100)
      labels.push({ pos: labelPos, degrees: Math.round(interiorDeg) })
    }

    if (verts.length === 0) return { geometry: null, labels }
    const geo = new BufferGeometry()
    geo.setAttribute('position', new Float32BufferAttribute(verts, 3))
    return { geometry: geo, labels }
  }, [room.walls, wallHeight])

  // Precompute fixture rendering data
  const fixtureData = useMemo(() => {
    return room.fixtures.map(f => {
      const geo = geos.find(g => g.wallNumber === f.wall)
      if (!geo) return null
      const wall = room.walls.find(w => w.wallNumber === f.wall)
      if (!wall) return null
      const centerAlong = f.x + f.width / 2
      const mx = geo.start[0] + centerAlong * geo.tangent[0]
      const my = geo.start[1] + centerAlong * geo.tangent[1]
      const wallAngleRad = Math.atan2(geo.tangent[1], geo.tangent[0])
      return { fixture: f, wall, geo, mx, my, wallAngleRad }
    }).filter(Boolean) as {
      fixture: typeof room.fixtures[0]; wall: typeof room.walls[0]
      geo: ReturnType<typeof computeWallGeometries>[0]; mx: number; my: number; wallAngleRad: number
    }[]
  }, [room.fixtures, room.walls, geos])

  const dimStyle: React.CSSProperties = {
    background: 'rgba(30,30,30,0.85)',
    color: '#fff',
    fontSize: '10px',
    padding: '1px 5px',
    borderRadius: '3px',
    whiteSpace: 'nowrap',
    border: '1px solid #555',
  }

  return (
    <group>
      {/* Invisible drag capture plane */}
      <mesh
        position={[0, wallHeight + 100, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        onPointerMove={(e) => { e.stopPropagation(); handlePointerMove(e.nativeEvent) }}
        onPointerUp={(e) => { e.stopPropagation(); handlePointerUp(e.nativeEvent) }}
      >
        <planeGeometry args={[200000, 200000]} />
        <meshBasicMaterial visible={false} />
      </mesh>

      {/* Dimension labels at wall midpoints */}
      {geos.map(g => {
        const wall = room.walls.find(w => w.wallNumber === g.wallNumber)!
        const midMozX = (g.start[0] + g.end[0]) / 2
        const midMozY = (g.start[1] + g.end[1]) / 2
        const pos = mozPosToThree(midMozX, midMozY, wallHeight + 200)

        return (
          <Html key={`dim-${g.wallNumber}`} position={pos} center style={{ pointerEvents: 'none' }}>
            <div style={{
              background: 'rgba(30,30,30,0.85)',
              color: '#fff',
              fontSize: '11px',
              padding: '2px 6px',
              borderRadius: '3px',
              whiteSpace: 'nowrap',
              border: '1px solid #555',
            }}>
              <span style={{ color: '#AAFF00', fontWeight: 600 }}>W{wall.wallNumber}</span>
              {' '}{formatDim(wall.len, useInches)}
            </div>
          </Html>
        )
      })}

      {/* Angle arcs at joint corners */}
      {arcData.geometry && (
        <lineSegments geometry={arcData.geometry}>
          <lineBasicMaterial color="#888888" depthTest={false} />
        </lineSegments>
      )}
      {arcData.labels.map((label, i) => (
        <Html key={`angle-${i}`} position={label.pos} center style={{ pointerEvents: 'none' }}>
          <div style={{
            color: '#888',
            fontSize: '10px',
            whiteSpace: 'nowrap',
          }}>
            {label.degrees}°
          </div>
        </Html>
      ))}

      {/* Fixture rectangles + drag handles + dimension labels */}
      {fixtureData.map(({ fixture, wall, geo, mx, my, wallAngleRad }) => {
        const pos = mozPosToThree(mx, my, wallHeight + 100)
        const isDragged = dragTarget?.type === 'fixture' && dragTarget.fixtureIdTag === fixture.idTag
        const isHovered = hoveredFixture === fixture.idTag
        const active = isDragged || isHovered
        const color = fixtureColor(fixture.name)
        const rectW = fixture.width
        const rectD = geo.thickness + 40

        // Dimension distances
        const distLeft = fixture.x
        const distRight = wall.len - fixture.x - fixture.width

        // Label positions: midpoints offset along inward normal
        const labelOffset = geo.thickness / 2 + 200
        const leftEdgeX = geo.start[0] + fixture.x * geo.tangent[0]
        const leftEdgeY = geo.start[1] + fixture.x * geo.tangent[1]
        const rightEdgeX = geo.start[0] + (fixture.x + fixture.width) * geo.tangent[0]
        const rightEdgeY = geo.start[1] + (fixture.x + fixture.width) * geo.tangent[1]
        const leftLabelPos = mozPosToThree(
          (geo.start[0] + leftEdgeX) / 2 + labelOffset * geo.normal[0],
          (geo.start[1] + leftEdgeY) / 2 + labelOffset * geo.normal[1],
          wallHeight + 200,
        )
        const rightLabelPos = mozPosToThree(
          (rightEdgeX + geo.end[0]) / 2 + labelOffset * geo.normal[0],
          (rightEdgeY + geo.end[1]) / 2 + labelOffset * geo.normal[1],
          wallHeight + 200,
        )

        return (
          <group key={`fixture-${fixture.idTag}`}>
            {/* Colored rectangle aligned with wall — captures pointer events */}
            <mesh
              position={pos}
              rotation={[-Math.PI / 2, 0, -wallAngleRad]}
              onPointerDown={(e) => { e.stopPropagation(); handleFixturePointerDown(fixture.idTag, e.nativeEvent) }}
              onPointerEnter={() => setHoveredFixture(fixture.idTag)}
              onPointerLeave={() => setHoveredFixture(null)}
            >
              <planeGeometry args={[rectW, rectD]} />
              <meshBasicMaterial color={color} transparent opacity={active ? 0.5 : 0.3} depthTest={false} />
            </mesh>

            {/* Center dot — visual indicator only */}
            <group position={pos} rotation={[-Math.PI / 2, 0, 0]}>
              <mesh geometry={fixtureHandleGeo}>
                <meshBasicMaterial color={active ? '#FFAA44' : color} depthTest={false} />
              </mesh>
            </group>

            {/* Live dimension labels — shown when hovered or dragging */}
            {active && (
              <>
                <Html position={leftLabelPos} center style={{ pointerEvents: 'none' }}>
                  <div style={dimStyle}>{formatDim(distLeft, useInches)}</div>
                </Html>
                <Html position={rightLabelPos} center style={{ pointerEvents: 'none' }}>
                  <div style={dimStyle}>{formatDim(distRight, useInches)}</div>
                </Html>
              </>
            )}

            {/* Edit popup — single click opens */}
            {editingFixture === fixture.idTag && (
              <FixtureEditPopup
                fixture={fixture}
                wallLen={wall.len}
                useInches={useInches}
                position={pos}
                onUpdate={(fields) => onUpdateFixture(fixture.idTag, fields)}
                onClose={() => setEditingFixture(null)}
              />
            )}
          </group>
        )
      })}

      {/* Joint handles at each corner — drag to move */}
      {jointPositions.map((jp, i) => {
        const pos = mozPosToThree(jp.mozX, jp.mozY, wallHeight + 100)
        const isHovered = hoveredHandle === i
        const isDraggedHandle = dragTarget?.type === 'joint' && dragTarget.jointIndex === i
        const active = isDraggedHandle || isHovered

        return (
          <group key={`handle-${i}`} position={pos} rotation={[-Math.PI / 2, 0, 0]}>
            <mesh
              geometry={handleGeo}
              onPointerDown={(e) => { e.stopPropagation(); handlePointerDown(i, e.nativeEvent) }}
              onPointerEnter={() => setHoveredHandle(i)}
              onPointerLeave={() => setHoveredHandle(null)}
            >
              <meshBasicMaterial
                color={active ? '#FF6644' : '#CC4422'}
                depthTest={false}
              />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}
