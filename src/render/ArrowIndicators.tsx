/**
 * Directional arrow indicators for product resize handles.
 */
import GalaxyOrb from './GalaxyOrbMaterial'

const BALL_R = 30
const PI = Math.PI

export function ArrowWithShaft({ rotation, position, color }: {
  rotation: [number, number, number]
  position?: [number, number, number]
  color: string
}) {
  const headR = BALL_R * 0.7
  const headH = BALL_R * 0.9
  const shaftW = BALL_R * 0.2
  const shaftH = BALL_R * 1.0
  return (
    <group rotation={rotation} position={position}>
      <mesh position={[0, -shaftH / 2, 0]} renderOrder={1000}>
        <boxGeometry args={[shaftW, shaftH, shaftW]} />
        <meshBasicMaterial color={color} depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>
      <mesh position={[0, headH / 2, 0]} renderOrder={1000}>
        <coneGeometry args={[headR, headH, 8]} />
        <meshBasicMaterial color={color} depthTest={false} depthWrite={false} toneMapped={false} />
      </mesh>
    </group>
  )
}

interface ArrowGroupProps { color: string }

export function WidthArrows({ color }: ArrowGroupProps) {
  const off = BALL_R * 2.2
  return (
    <group>
      <ArrowWithShaft rotation={[0, 0, PI / 2]} position={[-off, 0, 0]} color={color} />
      <ArrowWithShaft rotation={[0, 0, -PI / 2]} position={[off, 0, 0]} color={color} />
    </group>
  )
}

export function HeightArrow({ color }: ArrowGroupProps) {
  return <ArrowWithShaft rotation={[0, 0, 0]} position={[0, BALL_R * 1.2, 0]} color={color} />
}

export function ElevArrows({ canGoDown, color }: ArrowGroupProps & { canGoDown: boolean }) {
  const off = BALL_R * 2.0
  return (
    <group>
      <ArrowWithShaft rotation={[0, 0, 0]} position={[0, off, 0]} color={color} />
      {canGoDown && <ArrowWithShaft rotation={[0, 0, PI]} position={[0, -off, 0]} color={color} />}
    </group>
  )
}

export function MoveArrows({ color }: ArrowGroupProps) {
  const off = BALL_R * 2.0
  return (
    <group>
      <ArrowWithShaft rotation={[0, 0, PI / 2]} position={[-off, 0, 0]} color={color} />
      <ArrowWithShaft rotation={[0, 0, -PI / 2]} position={[off, 0, 0]} color={color} />
      <ArrowWithShaft rotation={[0, 0, 0]} position={[0, off, 0]} color={color} />
      <ArrowWithShaft rotation={[0, 0, PI]} position={[0, -off, 0]} color={color} />
      <GalaxyOrb />
    </group>
  )
}

export function DepthArrows({ color }: ArrowGroupProps) {
  const off = BALL_R * 2.2
  return (
    <group>
      <ArrowWithShaft rotation={[PI / 2, 0, 0]} position={[0, 0, -off]} color={color} />
      <ArrowWithShaft rotation={[-PI / 2, 0, 0]} position={[0, 0, off]} color={color} />
    </group>
  )
}
