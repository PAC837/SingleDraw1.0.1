/**
 * Plan view overlay rendered inside the R3F Canvas when wall editor is active.
 * Adds dimension labels, wall numbers, and draggable joint handles on top
 * of the existing 3D wall rendering (which is viewed from above).
 */

import { useMemo, useRef, useState, useCallback } from 'react'
import { Html } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { CircleGeometry, Plane, Vector3, Raycaster, Vector2, BufferGeometry, Float32BufferAttribute } from 'three'
import type { MozRoom, DragTarget } from '../mozaik/types'
import { computeWallGeometries, wallEndpoint, signedArea } from '../math/wallMath'
import { mozPosToThree } from '../math/basis'
import { formatDim } from '../math/units'
import { DEG2RAD } from '../math/constants'

interface PlanViewOverlayProps {
  room: MozRoom
  useInches: boolean
  dragTarget: DragTarget | null
  onSetDragTarget: (target: DragTarget | null) => void
  onMoveJoint: (jointIndex: number, newX: number, newY: number) => void
}

const handleGeo = new CircleGeometry(80, 24)
const dragPlane = new Plane(new Vector3(0, 1, 0), 0) // XZ plane at y=0

export default function PlanViewOverlay({ room, useInches, dragTarget, onSetDragTarget, onMoveJoint }: PlanViewOverlayProps) {
  const { camera, gl } = useThree()
  const [hoveredHandle, setHoveredHandle] = useState<number | null>(null)
  const isDragging = useRef(false)

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

  const handlePointerMove = useCallback((nativeEvent: PointerEvent) => {
    if (!isDragging.current || !dragTarget || dragTarget.type !== 'joint') return
    const pos = unprojectToPlane(nativeEvent.clientX, nativeEvent.clientY)
    if (pos) onMoveJoint(dragTarget.jointIndex, pos[0], pos[1])
  }, [dragTarget, unprojectToPlane, onMoveJoint])

  const handlePointerUp = useCallback((nativeEvent: PointerEvent) => {
    isDragging.current = false
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
