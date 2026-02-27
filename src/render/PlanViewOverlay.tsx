/**
 * Plan view overlay rendered inside the R3F Canvas when wall editor is active.
 * Adds dimension labels, wall numbers, and draggable joint handles on top
 * of the existing 3D wall rendering (which is viewed from above).
 */

import { useMemo, useRef, useState, useCallback } from 'react'
import { Html } from '@react-three/drei'
import { useThree } from '@react-three/fiber'
import { CircleGeometry, Plane, Vector3, Raycaster, Vector2 } from 'three'
import type { MozRoom, DragTarget } from '../mozaik/types'
import { computeWallGeometries, wallEndpoint } from '../math/wallMath'
import { mozPosToThree } from '../math/basis'
import { formatDim } from '../math/units'

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
    // Capture pointer on the canvas for smooth dragging
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

      {/* Joint handles at each corner */}
      {jointPositions.map((jp, i) => {
        const pos = mozPosToThree(jp.mozX, jp.mozY, wallHeight + 100)
        const isHovered = hoveredHandle === i
        const isDraggedHandle = dragTarget?.type === 'joint' && dragTarget.jointIndex === i

        return (
          <mesh
            key={`handle-${i}`}
            position={pos}
            rotation={[-Math.PI / 2, 0, 0]}
            geometry={handleGeo}
            onPointerDown={(e) => { e.stopPropagation(); handlePointerDown(i, e.nativeEvent) }}
            onPointerEnter={() => setHoveredHandle(i)}
            onPointerLeave={() => setHoveredHandle(null)}
          >
            <meshBasicMaterial
              color={isDraggedHandle ? '#AAFF00' : isHovered ? '#AAFF00' : '#888888'}
              depthTest={false}
            />
          </mesh>
        )
      })}
    </group>
  )
}
