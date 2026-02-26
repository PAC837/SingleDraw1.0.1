import { useMemo } from 'react'
import { Grid, Html } from '@react-three/drei'
import { ArrowHelper, Vector3 } from 'three'
import type { DebugOverlays, MozRoom } from '../mozaik/types'
import { computeWallGeometries } from '../math/wallMath'
import { mozPosToThree } from '../math/basis'

interface DebugOverlaysProps {
  overlays: DebugOverlays
  room: MozRoom | null
}

function OriginMarker() {
  return (
    <group>
      <mesh>
        <sphereGeometry args={[20, 16, 16]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
      <Html distanceFactor={3000} style={{ pointerEvents: 'none' }}>
        <div style={{
          color: '#fff',
          fontSize: '10px',
          background: 'rgba(0,0,0,0.7)',
          padding: '1px 4px',
          borderRadius: '2px',
        }}>
          Origin
        </div>
      </Html>
    </group>
  )
}

function AxisGizmo() {
  const len = 500
  const axes = [
    { dir: new Vector3(1, 0, 0), color: 0xff4444, label: 'X' },
    { dir: new Vector3(0, 1, 0), color: 0x4488ff, label: 'Y (up)' },
    { dir: new Vector3(0, 0, 1), color: 0x44ff44, label: 'Z' },
  ]

  return (
    <group>
      {axes.map(({ dir, color, label }) => (
        <primitive
          key={label}
          object={new ArrowHelper(dir, new Vector3(0, 0, 0), len, color, 40, 20)}
        />
      ))}
    </group>
  )
}

function FloorGrid() {
  return (
    <Grid
      args={[20000, 20000]}
      cellSize={500}
      sectionSize={2500}
      cellColor="#282828"
      sectionColor="#404040"
      fadeDistance={25000}
      position={[0, 0, 0]}
    />
  )
}

function WallNormals({ room }: { room: MozRoom }) {
  const geometries = useMemo(
    () => computeWallGeometries(room.walls),
    [room.walls],
  )

  return (
    <group>
      {geometries.map((g) => {
        // Arrow at wall midpoint, pointing along inward normal
        const midX = (g.start[0] + g.end[0]) / 2
        const midY = (g.start[1] + g.end[1]) / 2
        const midZ = g.height / 2

        const origin = mozPosToThree(midX, midY, midZ)
        // Normal is in Mozaik XY → transform to Three.js XZ
        const dir = new Vector3(g.normal[0], 0, -g.normal[1]).normalize()
        const arrowLen = 300

        return (
          <primitive
            key={`normal-${g.wallNumber}`}
            object={new ArrowHelper(dir, origin, arrowLen, 0x00ffff, 40, 20)}
          />
        )
      })}
    </group>
  )
}

export default function DebugOverlaysComponent({ overlays, room }: DebugOverlaysProps) {
  return (
    <group>
      {overlays.originMarker && <OriginMarker />}
      {overlays.axisGizmo && <AxisGizmo />}
      {overlays.floorGrid && <FloorGrid />}
      {overlays.wallNormals && room && <WallNormals room={room} />}
    </group>
  )
}
