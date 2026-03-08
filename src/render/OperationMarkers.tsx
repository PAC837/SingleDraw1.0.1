/**
 * Visual indicators for manufacturing operations (holes, line bores, pockets)
 * rendered on part surfaces. Coordinates mapped from Mozaik part-local to
 * mesh-local geometry space (centered, baked rotation for shapes).
 */
import { useMemo } from 'react'
import { BufferGeometry, Float32BufferAttribute, LineBasicMaterial, Line } from 'three'
import type { MozOperation, MozOperationHole, MozOperationLineBore, MozOperationPocket } from '../mozaik/types'

const MARKER_COLOR = '#000000'
const SURFACE_OFFSET = 0.5 // mm above surface to avoid z-fighting

interface OperationMarkersProps {
  operations: MozOperation[]
  centerX: number   // geometry center X offset (L/2 for box, shape bounds center for shape)
  centerY: number   // geometry center Y offset (W/2 for box, shape bounds center for shape)
  thick: number     // panel thickness
  isShape: boolean  // shaped geometry has negated Z axis
  partL: number     // part length (for clipping line bores)
  partW: number     // part width (for clipping line bores)
}

/** Map Mozaik part-local (opX, opY) to mesh-local geometry coords. */
function mapCoord(
  opX: number, opY: number, flipSide: boolean,
  centerX: number, centerY: number, thick: number, isShape: boolean,
): [number, number, number] {
  const x = opX - centerX
  const y = flipSide ? -(thick / 2 + SURFACE_OFFSET) : thick / 2 + SURFACE_OFFSET
  const z = isShape ? -(opY - centerY) : opY - centerY
  return [x, y, z]
}

function HoleMarker({ op, centerX, centerY, thick, isShape }: {
  op: MozOperationHole; centerX: number; centerY: number; thick: number; isShape: boolean
}) {
  const r = Math.max(op.diameter / 2, 2)
  const pos = mapCoord(op.x, op.y, op.flipSideOp, centerX, centerY, thick, isShape)
  return (
    <mesh position={pos}>
      <cylinderGeometry args={[r, r, 1, 12]} />
      <meshBasicMaterial color={MARKER_COLOR} transparent opacity={0.8}
        polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
    </mesh>
  )
}

function LineBoreMarker({ op, centerX, centerY, thick, isShape, partL, partW }: {
  op: MozOperationLineBore; centerX: number; centerY: number; thick: number; isShape: boolean
  partL: number; partW: number
}) {
  const dots = useMemo(() => {
    const result: [number, number][] = []
    const angRad = (op.ang * Math.PI) / 180
    const spacing = 32 // 32mm standard shelf pin spacing
    for (let i = 0; i < op.quan; i++) {
      const dotX = op.x + i * spacing * Math.cos(angRad)
      const dotY = op.y + i * spacing * Math.sin(angRad)
      // Clip dots to panel bounds (parametric — hides as panel shrinks)
      if (dotX < -0.5 || dotX > partL + 0.5 || dotY < -0.5 || dotY > partW + 0.5) continue
      result.push([dotX, dotY])
    }
    return result
  }, [op, partL, partW])

  const r = Math.max(op.diameter / 2, 1.5)

  return (
    <group>
      {dots.map(([dotX, dotY], i) => {
        const pos = mapCoord(dotX, dotY, op.flipSideOp, centerX, centerY, thick, isShape)
        return (
          <mesh key={i} position={pos}>
            <cylinderGeometry args={[r, r, 0.5, 8]} />
            <meshBasicMaterial color={MARKER_COLOR} transparent opacity={0.7}
              polygonOffset polygonOffsetFactor={-1} polygonOffsetUnits={-1} />
          </mesh>
        )
      })}
    </group>
  )
}

function PocketMarker({ op, centerX, centerY, thick, isShape }: {
  op: MozOperationPocket; centerX: number; centerY: number; thick: number; isShape: boolean
}) {
  const lineGeo = useMemo(() => {
    if (op.toolPathNodes.length < 2) return null
    const positions: number[] = []
    for (const node of op.toolPathNodes) {
      const [x, y, z] = mapCoord(op.x + node.x, op.y + node.y, false, centerX, centerY, thick, isShape)
      positions.push(x, y, z)
    }
    if (op.closedShape && op.toolPathNodes.length > 0) {
      const [x, y, z] = mapCoord(
        op.x + op.toolPathNodes[0].x, op.y + op.toolPathNodes[0].y,
        false, centerX, centerY, thick, isShape,
      )
      positions.push(x, y, z)
    }
    const geo = new BufferGeometry()
    geo.setAttribute('position', new Float32BufferAttribute(positions, 3))
    return geo
  }, [op, centerX, centerY, thick, isShape])

  const lineObj = useMemo(() => {
    if (!lineGeo) return null
    const mat = new LineBasicMaterial({ color: MARKER_COLOR, transparent: true, opacity: 0.8 })
    return new Line(lineGeo, mat)
  }, [lineGeo])

  if (!lineObj) return null
  return <primitive object={lineObj} />
}

export default function OperationMarkers({
  operations, centerX, centerY, thick, isShape, partL, partW,
}: OperationMarkersProps) {
  const holes = operations.filter((o): o is MozOperationHole => o.type === 'hole')
  const bores = operations.filter((o): o is MozOperationLineBore => o.type === 'linebore')
  const pockets = operations.filter((o): o is MozOperationPocket => o.type === 'pocket')

  if (holes.length === 0 && bores.length === 0 && pockets.length === 0) return null

  return (
    <group>
      {holes.map((op, i) => (
        <HoleMarker key={`h${i}`} op={op} centerX={centerX} centerY={centerY} thick={thick} isShape={isShape} />
      ))}
      {bores.map((op, i) => (
        <LineBoreMarker key={`b${i}`} op={op} centerX={centerX} centerY={centerY} thick={thick} isShape={isShape} partL={partL} partW={partW} />
      ))}
      {pockets.map((op, i) => (
        <PocketMarker key={`p${i}`} op={op} centerX={centerX} centerY={centerY} thick={thick} isShape={isShape} />
      ))}
    </group>
  )
}
