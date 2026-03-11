/**
 * Debug overlay for CRN products: shows TopShapeXml outline (green) vs
 * Bottom part shape outline (red) so you can visually verify alignment
 * during resize. Yellow dots mark parametric landmarks.
 */
import { useMemo } from 'react'
import type { MozProduct } from '../mozaik/types'

const BAR = 3
const DOT_R = 6

/** Draw a colored outline from 2D points in Mozaik product-local coords. */
function OutlineFromPoints({
  points,
  color,
  height,
  yOffset,
}: {
  points: [number, number][]
  color: string
  height: number
  yOffset: number  // vertical offset to separate overlapping outlines
}) {
  const bars = useMemo(() => {
    const result: { pos: [number, number, number]; size: [number, number, number]; rotY: number }[] = []
    const n = points.length
    for (let i = 0; i < n; i++) {
      const [mx1, my1] = points[i]
      const [mx2, my2] = points[(i + 1) % n]
      const x1 = mx1, z1 = -my1
      const x2 = mx2, z2 = -my2
      const dx = x2 - x1, dz = z2 - z1
      const len = Math.sqrt(dx * dx + dz * dz)
      if (len < 0.1) continue
      const midX = (x1 + x2) / 2, midZ = (z1 + z2) / 2
      const rotY = -Math.atan2(dz, dx)
      // Bottom edge
      result.push({ pos: [midX, yOffset, midZ], size: [len + BAR, BAR, BAR], rotY })
      // Top edge
      result.push({ pos: [midX, height + yOffset, midZ], size: [len + BAR, BAR, BAR], rotY })
    }
    return result
  }, [points, height, yOffset])

  return (
    <group>
      {bars.map((b, i) => (
        <mesh key={i} position={b.pos} rotation={[0, b.rotY, 0]} renderOrder={1000}>
          <boxGeometry args={b.size} />
          <meshBasicMaterial color={color} depthTest={false} transparent opacity={0.8} />
        </mesh>
      ))}
    </group>
  )
}

/** Yellow dot at a parametric landmark position. */
function LandmarkDot({ x, y, height }: { x: number; y: number; height: number }) {
  return (
    <mesh position={[x, height / 2, -y]} renderOrder={1001}>
      <sphereGeometry args={[DOT_R, 8, 8]} />
      <meshBasicMaterial color="#ffdd00" depthTest={false} />
    </mesh>
  )
}

interface ShapeDebugOverlayProps {
  product: MozProduct
}

export default function ShapeDebugOverlay({ product }: ShapeDebugOverlayProps) {
  // Green: TopShapeXml outline (product-level, equation-evaluated)
  const topPoints = useMemo((): [number, number][] => {
    if (!product.topShapePoints || product.topShapePoints.length < 3) return []
    return product.topShapePoints.map(p => [p.x, p.y])
  }, [product.topShapePoints])

  // Red: Bottom part shape outline (what geometry actually uses)
  const bottomPoints = useMemo((): [number, number][] => {
    const bottom = product.parts.find(p => p.type.toLowerCase() === 'bottom')
    if (!bottom || bottom.shapePoints.length < 3) return []
    return bottom.shapePoints.map(p => [p.x, p.y])
  }, [product.parts])

  // Parametric landmarks from CabProdParms
  const landmarks = useMemo(() => {
    const params: Record<string, number> = {}
    for (const p of product.parameters) {
      params[p.name] = parseFloat(p.value) || 0
    }
    const W = product.width, D = product.depth
    const marks: { x: number; y: number }[] = []

    // Inner corner point
    const cer = params['CornerEndWRight'] ?? 0
    const cel = params['CornerEndWLeft'] ?? 0
    if (cer > 0 && cel > 0) {
      marks.push({ x: W - cer, y: D - cel })
    }

    // Notch point (with margin)
    const cm = params['CornerMargin'] ?? 0
    if (cel > 0 && cm > 0) {
      marks.push({ x: W, y: D - cel - cm })
    }

    // Left wing inner edge
    if (cel > 0) {
      marks.push({ x: 0, y: D - cel })
    }

    return marks
  }, [product])

  if (topPoints.length === 0 && bottomPoints.length === 0) return null

  const h = product.height

  return (
    <group>
      {/* Green: TopShapeXml (authoritative equations) */}
      {topPoints.length > 0 && (
        <OutlineFromPoints points={topPoints} color="#00ff88" height={h} yOffset={2} />
      )}

      {/* Red: Bottom part actual shape */}
      {bottomPoints.length > 0 && (
        <OutlineFromPoints points={bottomPoints} color="#ff4444" height={h} yOffset={-2} />
      )}

      {/* Yellow dots: parametric landmarks */}
      {landmarks.map((lm, i) => (
        <LandmarkDot key={i} x={lm.x} y={lm.y} height={h} />
      ))}
    </group>
  )
}
