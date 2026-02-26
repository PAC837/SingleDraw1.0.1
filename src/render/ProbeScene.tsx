import { Html } from '@react-three/drei'
import { mozPosToThree } from '../math/basis'

/**
 * Probe scene: labeled spheres at origin and +1000mm along each Mozaik axis.
 * Visually verifies the basis mapping is correct:
 *   +Xm (width) should appear to the RIGHT
 *   +Ym (depth) should appear INTO the screen (-Z in Three.js)
 *   +Zm (height) should appear UP (+Y in Three.js)
 */
export default function ProbeScene() {
  const probes = [
    { label: 'Origin', moz: [0, 0, 0] as const, color: '#ffffff' },
    { label: '+Xm (width)', moz: [1000, 0, 0] as const, color: '#ff4444' },
    { label: '+Ym (depth)', moz: [0, 1000, 0] as const, color: '#44ff44' },
    { label: '+Zm (height)', moz: [0, 0, 1000] as const, color: '#4488ff' },
  ]

  return (
    <group>
      {probes.map(({ label, moz, color }) => {
        const pos = mozPosToThree(moz[0], moz[1], moz[2])
        return (
          <group key={label} position={pos}>
            <mesh>
              <sphereGeometry args={[30, 16, 16]} />
              <meshStandardMaterial color={color} />
            </mesh>
            <Html distanceFactor={3000} style={{ pointerEvents: 'none' }}>
              <div style={{
                color,
                fontSize: '12px',
                fontWeight: 'bold',
                background: 'rgba(0,0,0,0.7)',
                padding: '2px 6px',
                borderRadius: '3px',
                whiteSpace: 'nowrap',
              }}>
                {label}
              </div>
            </Html>
          </group>
        )
      })}

      {/* Axis lines from origin to each probe */}
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([0, 0, 0, 1000, 0, 0]), 3]}
            count={2}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#ff4444" />
      </line>
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([0, 0, 0, 0, 0, -1000]), 3]}
            count={2}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#44ff44" />
      </line>
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            args={[new Float32Array([0, 0, 0, 0, 1000, 0]), 3]}
            count={2}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#4488ff" />
      </line>
    </group>
  )
}
