/**
 * Directional 3D arrow handles on the front face of a product.
 *
 *          [Height ↑]
 *             ▲
 *             |
 *  [Width ↔] ◄►──✦──◄► [Width ↔]
 *           (Move ✦)
 *             |
 *             ▼▲
 *          [Elev ↕]
 *
 * Bump arrows (red) on outer sides. Depth arrows (red) at bottom corners.
 * Each handle has a single job. Simple pixel-to-mm drag (no NDC projection).
 * OrbitControls disabled during drag to prevent camera zoom/pan.
 * Snapping: width = 1" increments, height = modular, elev = 1".
 */

import { useRef, useState, useCallback } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { Html, shaderMaterial } from '@react-three/drei'
import { Vector3 } from 'three'
import { extend } from '@react-three/fiber'
import type { MozProduct } from '../mozaik/types'
import { mozPosToThree } from '../math/basis'
import { MODULAR_HEIGHTS, MODULAR_DEPTHS } from '../mozaik/modularValues'

const INCH = 25.4
const BALL_R = 30
const LOCK_THRESHOLD = 5
const PI = Math.PI

// ── Galaxy Orb Shader ────────────────────────────────────────────────

const GalaxyOrbMaterial = shaderMaterial(
  { uTime: 0 },
  /* vertex */ `
    varying vec3 vPos;
    varying vec3 vNorm;
    varying vec2 vUv;
    uniform float uTime;

    // Simplex-style 3D noise (compact)
    vec3 mod289(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
    vec4 perm(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
    float noise(vec3 p) {
      vec3 a = floor(p);
      vec3 d = p - a;
      d = d*d*(3.0-2.0*d);
      vec4 b = a.xxyy + vec4(0,1,0,1);
      vec4 k1 = perm(b.xyxy);
      vec4 k2 = perm(k1.xyxy + b.zzww);
      vec4 c = k2 + a.zzzz;
      vec4 k3 = perm(c);
      vec4 k4 = perm(c + 1.0);
      vec4 o1 = fract(k3 * (1.0/41.0));
      vec4 o2 = fract(k4 * (1.0/41.0));
      vec4 o3 = o2*d.z + o1*(1.0-d.z);
      vec2 o4 = o3.yw*d.x + o3.xz*(1.0-d.x);
      return o4.y*d.y + o4.x*(1.0-d.y);
    }

    void main() {
      vPos = (modelMatrix * vec4(position, 1.0)).xyz;
      vNorm = normalize(normalMatrix * normal);
      vUv = uv;
      float n = noise(position * 3.0 + uTime * 0.8) * 0.15;
      vec3 displaced = position + normal * n;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(displaced, 1.0);
    }
  `,
  /* fragment */ `
    varying vec3 vPos;
    varying vec3 vNorm;
    varying vec2 vUv;
    uniform float uTime;

    vec3 mod289(vec3 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
    vec4 mod289(vec4 x) { return x - floor(x * (1.0/289.0)) * 289.0; }
    vec4 perm(vec4 x) { return mod289(((x*34.0)+1.0)*x); }
    float noise(vec3 p) {
      vec3 a = floor(p);
      vec3 d = p - a;
      d = d*d*(3.0-2.0*d);
      vec4 b = a.xxyy + vec4(0,1,0,1);
      vec4 k1 = perm(b.xyxy);
      vec4 k2 = perm(k1.xyxy + b.zzww);
      vec4 c = k2 + a.zzzz;
      vec4 k3 = perm(c);
      vec4 k4 = perm(c + 1.0);
      vec4 o1 = fract(k3 * (1.0/41.0));
      vec4 o2 = fract(k4 * (1.0/41.0));
      vec4 o3 = o2*d.z + o1*(1.0-d.z);
      vec2 o4 = o3.yw*d.x + o3.xz*(1.0-d.x);
      return o4.y*d.y + o4.x*(1.0-d.y);
    }

    float fbm(vec3 p) {
      float v = 0.0, a = 0.5;
      for (int i = 0; i < 4; i++) {
        v += a * noise(p);
        p *= 2.0;
        a *= 0.5;
      }
      return v;
    }

    void main() {
      // Swirl angle based on position + time
      float angle = atan(vPos.x, vPos.z) + uTime * 1.2;
      float radius = length(vPos.xz);

      // FBM noise for turbulence
      vec3 noiseCoord = vec3(radius * 3.0, angle * 0.5, uTime * 0.4);
      float n = fbm(noiseCoord);
      float n2 = fbm(noiseCoord + vec3(5.0, 3.0, 1.0));

      // Matrix/Cyber palette: black void → lime green energy → blue nebula
      vec3 voidBlack = vec3(0.04, 0.04, 0.04);
      vec3 darkGreen = vec3(0.15, 0.4, 0.0);
      vec3 limeGreen = vec3(0.67, 1.0, 0.0);
      vec3 electricBlue = vec3(0.27, 0.53, 1.0);
      vec3 brightGreen = vec3(0.8, 1.0, 0.27);

      vec3 col = mix(voidBlack, darkGreen, smoothstep(0.15, 0.4, n));
      col = mix(col, limeGreen, smoothstep(0.35, 0.65, n2));
      col = mix(col, electricBlue, smoothstep(0.5, 0.75, n));
      col = mix(col, brightGreen, smoothstep(0.75, 0.95, n * n2 * 2.0));

      // Fresnel rim glow
      vec3 viewDir = normalize(cameraPosition - vPos);
      float fresnel = 1.0 - abs(dot(normalize(vNorm), viewDir));
      fresnel = pow(fresnel, 2.5);
      col += vec3(0.67, 1.0, 0.0) * fresnel * 0.8;

      // Stars — bright specks
      float star = smoothstep(0.92, 0.95, noise(vPos * 20.0 + uTime * 0.2));
      col += vec3(0.8, 1.0, 0.4) * star * 0.6;

      // Brightness boost
      col *= 1.3;

      gl_FragColor = vec4(col, 1.0);
    }
  `
)

extend({ GalaxyOrbMaterial })

// TypeScript declaration for R3F custom element
declare module '@react-three/fiber' {
  interface ThreeElements {
    galaxyOrbMaterial: any
  }
}

function GalaxyOrb() {
  const ref = useRef<any>(null)
  useFrame(({ clock }) => {
    if (ref.current) ref.current.uTime = clock.getElapsedTime()
  })
  return (
    <mesh renderOrder={1001}>
      <sphereGeometry args={[BALL_R * 1.2, 32, 32]} />
      <galaxyOrbMaterial ref={ref} depthTest={false} />
    </mesh>
  )
}

type HandleRole = 'width' | 'height' | 'elev' | 'move'

function snapValue(raw: number, field: 'width' | 'depth' | 'height' | 'elev'): number {
  if (raw <= 0) return raw
  switch (field) {
    case 'width':
      return Math.round(raw / INCH) * INCH
    case 'depth': {
      let best = MODULAR_DEPTHS[0], bestDist = Math.abs(raw - best)
      for (const d of MODULAR_DEPTHS) { const dist = Math.abs(raw - d); if (dist < bestDist) { best = d; bestDist = dist } }
      return best
    }
    case 'height': {
      let best = MODULAR_HEIGHTS[0], bestDist = Math.abs(raw - best)
      for (const h of MODULAR_HEIGHTS) { const dist = Math.abs(raw - h); if (dist < bestDist) { best = h; bestDist = dist } }
      return best
    }
    case 'elev':
      return Math.round(raw / INCH) * INCH
  }
}

function snapElevToModular(rawElev: number, productHeight: number): number {
  let bestElev = 0, bestDist = Math.abs(rawElev)
  for (const h of MODULAR_HEIGHTS) {
    const candidate = h - productHeight
    if (candidate < -0.5) continue
    const e = Math.max(0, candidate)
    const dist = Math.abs(rawElev - e)
    if (dist < bestDist) { bestElev = e; bestDist = dist }
  }
  return bestElev
}

// ── Arrow+Shaft primitive (RPG-style directional arrow) ─────────────

function ArrowWithShaft({ rotation, position, color }: {
  rotation: [number, number, number]
  position?: [number, number, number]
  color: string
}) {
  const headR = BALL_R * 0.7    // arrowhead radius
  const headH = BALL_R * 0.9    // arrowhead height
  const shaftW = BALL_R * 0.2   // shaft width
  const shaftH = BALL_R * 1.0   // shaft length
  return (
    <group rotation={rotation} position={position}>
      {/* Shaft — thin box below the head */}
      <mesh position={[0, -shaftH / 2, 0]} renderOrder={1000}>
        <boxGeometry args={[shaftW, shaftH, shaftW]} />
        <meshBasicMaterial color={color} depthTest={false} />
      </mesh>
      {/* Arrowhead — cone at top */}
      <mesh position={[0, headH / 2, 0]} renderOrder={1000}>
        <coneGeometry args={[headR, headH, 8]} />
        <meshBasicMaterial color={color} depthTest={false} />
      </mesh>
    </group>
  )
}

interface ArrowGroupProps { color: string }

/** Left-right double arrow */
function WidthArrows({ color }: ArrowGroupProps) {
  const off = BALL_R * 2.2
  return (
    <group>
      <ArrowWithShaft rotation={[0, 0, PI / 2]} position={[-off, 0, 0]} color={color} />
      <ArrowWithShaft rotation={[0, 0, -PI / 2]} position={[off, 0, 0]} color={color} />
    </group>
  )
}

/** Single up arrow */
function HeightArrow({ color }: ArrowGroupProps) {
  return <ArrowWithShaft rotation={[0, 0, 0]} position={[0, BALL_R * 1.2, 0]} color={color} />
}

/** Up/down arrows — conditional on elevation */
function ElevArrows({ canGoDown, color }: ArrowGroupProps & { canGoDown: boolean }) {
  const off = BALL_R * 2.0
  return (
    <group>
      <ArrowWithShaft rotation={[0, 0, 0]} position={[0, off, 0]} color={color} />
      {canGoDown && <ArrowWithShaft rotation={[0, 0, PI]} position={[0, -off, 0]} color={color} />}
    </group>
  )
}

/** 4-way cross arrow */
function MoveArrows({ color }: ArrowGroupProps) {
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

/** Forward-backward double arrow (along Z axis for depth) */
function DepthArrows({ color }: ArrowGroupProps) {
  const off = BALL_R * 2.2
  return (
    <group>
      <ArrowWithShaft rotation={[PI / 2, 0, 0]} position={[0, 0, -off]} color={color} />
      <ArrowWithShaft rotation={[-PI / 2, 0, 0]} position={[0, 0, off]} color={color} />
    </group>
  )
}

// ── Handle components (drag logic unchanged) ────────────────────────

interface HandleBallProps {
  mozPos: [number, number, number]
  role: HandleRole
  sign: number
  wallAngleDeg?: number
  product: MozProduct
  productIndex: number
  onResize: (index: number, field: 'width' | 'depth' | 'height', value: number, anchor?: 'left' | 'right') => void
  onResizeWidth: (index: number, value: number, anchor: 'left' | 'right') => void
  onUpdateElev: (index: number, elev: number) => void
  onUpdateX: (index: number, x: number) => void
}

function HandleBall({
  mozPos, role, sign, wallAngleDeg, product, productIndex, onResize, onResizeWidth, onUpdateElev, onUpdateX,
}: HandleBallProps) {
  const groupRotY = ((wallAngleDeg ?? 0) + product.rot) * Math.PI / 180
  const screenSign = Math.cos(groupRotY) < 0 ? -1 : 1
  const { camera, gl, controls } = useThree()
  const [hovered, setHovered] = useState(false)
  const [active, setActive] = useState(false)
  const dragging = useRef(false)
  const startMouse = useRef({ x: 0, y: 0 })
  const startVals = useRef({ width: 0, height: 0, elev: 0, x: 0 })
  const moveAxis = useRef<'x' | 'y' | null>(null)

  const pos = mozPosToThree(mozPos[0], mozPos[1], mozPos[2])

  const mmPerPixel = useCallback(() => {
    const camDist = camera.position.distanceTo(new Vector3(0, 0, 0))
    if ('fov' in camera && typeof camera.fov === 'number') {
      const fovRad = (camera.fov * Math.PI) / 180
      return (2 * camDist * Math.tan(fovRad / 2)) / gl.domElement.clientHeight
    }
    return 1
  }, [camera, gl])

  const onPointerDown = useCallback((e: any) => {
    e.stopPropagation()
    dragging.current = true
    moveAxis.current = null
    setActive(true)
    startMouse.current = {
      x: e.clientX ?? e.nativeEvent?.clientX ?? 0,
      y: e.clientY ?? e.nativeEvent?.clientY ?? 0,
    }
    startVals.current = { width: product.width, height: product.height, elev: product.elev, x: product.x }

    const ctrl = controls as any
    if (ctrl) ctrl.enabled = false
    const scale = mmPerPixel()

    const onMove = (ev: PointerEvent) => {
      if (!dragging.current) return
      const dx = ev.clientX - startMouse.current.x
      const dy = ev.clientY - startMouse.current.y
      const dxMm = dx * scale
      const dyMm = -dy * scale

      switch (role) {
        case 'width': {
          const raw = startVals.current.width + dxMm * sign * screenSign
          const snapped = snapValue(Math.max(INCH, raw), 'width')
          const anchor: 'left' | 'right' = sign < 0 ? 'left' : 'right'
          onResizeWidth(productIndex, snapped, anchor)
          break
        }
        case 'height': {
          const raw = startVals.current.height + dyMm
          const snapped = snapValue(Math.max(MODULAR_HEIGHTS[0], raw), 'height')
          onResize(productIndex, 'height', snapped)
          break
        }
        case 'elev': {
          const raw = startVals.current.elev + dyMm
          const snapped = snapElevToModular(Math.max(0, raw), product.height)
          onUpdateElev(productIndex, snapped)
          break
        }
        case 'move': {
          if (!moveAxis.current) {
            if (Math.abs(dx) > LOCK_THRESHOLD) moveAxis.current = 'x'
            else if (Math.abs(dy) > LOCK_THRESHOLD) moveAxis.current = 'y'
            else break
          }
          if (moveAxis.current === 'x') {
            const newX = snapValue(Math.max(0, startVals.current.x + dxMm), 'width')
            onUpdateX(productIndex, newX)
          } else {
            const newElev = snapElevToModular(Math.max(0, startVals.current.elev + dyMm), product.height)
            onUpdateElev(productIndex, newElev)
          }
          break
        }
      }
    }

    const onUp = () => {
      dragging.current = false
      moveAxis.current = null
      setActive(false)
      document.body.style.cursor = ''
      if (ctrl) ctrl.enabled = true
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    document.body.style.cursor = 'grabbing'
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [role, sign, screenSign, product, productIndex, onResize, onResizeWidth, onUpdateElev, onUpdateX, gl, controls, mmPerPixel])

  const greenColor = active ? '#FFFF00' : hovered ? '#CCFF44' : '#AAFF00'
  const s = active ? 1.2 : hovered ? 1.3 : 1.0

  return (
    <group
      position={pos}
      scale={[s, s, s]}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'grab' }}
      onPointerOut={() => { setHovered(false); if (!dragging.current) document.body.style.cursor = '' }}
      onPointerDown={onPointerDown}
      renderOrder={1000}
    >
      {/* Invisible hit sphere for larger click target */}
      <mesh>
        <sphereGeometry args={[BALL_R * 2, 8, 6]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      {role === 'width' && <WidthArrows color={greenColor} />}
      {role === 'height' && <HeightArrow color={greenColor} />}
      {role === 'elev' && <ElevArrows canGoDown={product.elev > 0} color={greenColor} />}
      {role === 'move' && <MoveArrows color={greenColor} />}
    </group>
  )
}

/** 3D arrow cone — bumps section left or right. */
function BumpBall({
  mozPos, productIndex, direction, onBump,
}: {
  mozPos: [number, number, number]
  productIndex: number
  direction: 'left' | 'right'
  onBump: (index: number) => void
}) {
  const [hovered, setHovered] = useState(false)
  const pos = mozPosToThree(mozPos[0], mozPos[1], mozPos[2])
  const rotZ = direction === 'left' ? PI / 2 : -PI / 2
  const s = hovered ? 1.3 : 1.0

  return (
    <mesh
      position={pos}
      rotation={[0, 0, rotZ]}
      scale={[s, s, s]}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = '' }}
      onClick={(e) => { e.stopPropagation(); onBump(productIndex) }}
      renderOrder={1000}
    >
      <coneGeometry args={[BALL_R * 1.0, BALL_R * 2.2, 12]} />
      <meshBasicMaterial color={hovered ? '#ff4444' : '#cc0000'} depthTest={false} />
    </mesh>
  )
}

/** Red forward/backward arrows — drag to resize depth. */
function DepthDragBall({
  mozPos, productIndex, product, onResize,
}: {
  mozPos: [number, number, number]
  productIndex: number
  product: MozProduct
  onResize: (index: number, field: 'width' | 'depth' | 'height', value: number) => void
}) {
  const [hovered, setHovered] = useState(false)
  const [active, setActive] = useState(false)
  const { camera, gl, controls } = useThree()
  const dragging = useRef(false)
  const startMouse = useRef(0)
  const startDepth = useRef(0)
  const pos = mozPosToThree(mozPos[0], mozPos[1], mozPos[2])

  const mmPerPixel = useCallback(() => {
    const camDist = camera.position.distanceTo(new Vector3(0, 0, 0))
    if ('fov' in camera && typeof camera.fov === 'number') {
      const fovRad = (camera.fov * Math.PI) / 180
      return (2 * camDist * Math.tan(fovRad / 2)) / gl.domElement.clientHeight
    }
    return 1
  }, [camera, gl])

  const onPointerDown = useCallback((e: any) => {
    e.stopPropagation()
    dragging.current = true
    setActive(true)
    startMouse.current = e.clientY ?? e.nativeEvent?.clientY ?? 0
    startDepth.current = product.depth

    const ctrl = controls as any
    if (ctrl) ctrl.enabled = false
    const scale = mmPerPixel()

    const onMove = (ev: PointerEvent) => {
      if (!dragging.current) return
      const dy = ev.clientY - startMouse.current
      const dyMm = dy * scale
      const raw = startDepth.current + dyMm
      const snapped = snapValue(Math.max(MODULAR_DEPTHS[0], raw), 'depth')
      onResize(productIndex, 'depth', snapped)
    }

    const onUp = () => {
      dragging.current = false
      setActive(false)
      document.body.style.cursor = ''
      if (ctrl) ctrl.enabled = true
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    document.body.style.cursor = 'ns-resize'
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [product, productIndex, onResize, controls, mmPerPixel])

  const redColor = active ? '#FF6666' : hovered ? '#FF4444' : '#CC0000'
  const s = active ? 1.2 : hovered ? 1.3 : 1.0

  return (
    <group
      position={pos}
      scale={[s, s, s]}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'ns-resize' }}
      onPointerOut={() => { setHovered(false); if (!dragging.current) document.body.style.cursor = '' }}
      onPointerDown={onPointerDown}
      renderOrder={1000}
    >
      {/* Invisible hit sphere for larger click target */}
      <mesh>
        <sphereGeometry args={[BALL_R * 2, 8, 6]} />
        <meshBasicMaterial transparent opacity={0} depthWrite={false} />
      </mesh>
      <DepthArrows color={redColor} />
    </group>
  )
}

interface ProductResizeHandlesProps {
  product: MozProduct
  productIndex: number
  wallAngleDeg?: number
  onResize: (index: number, field: 'width' | 'depth' | 'height', value: number, anchor?: 'left' | 'right') => void
  onResizeWidth: (index: number, value: number, anchor: 'left' | 'right') => void
  onUpdateElev: (index: number, elev: number) => void
  onUpdateX: (index: number, x: number) => void
  onBumpLeft?: (index: number) => void
  onBumpRight?: (index: number) => void
  onRemove?: (index: number) => void
}

export default function ProductResizeHandles({
  product, productIndex, wallAngleDeg, onResize, onResizeWidth, onUpdateElev, onUpdateX,
  onBumpLeft, onBumpRight, onRemove,
}: ProductResizeHandlesProps) {
  const w = product.width, h = product.height

  const handles: { id: string; mozPos: [number, number, number]; role: HandleRole; sign: number }[] = [
    { id: 'top',    mozPos: [w / 2, 0, h],     role: 'height', sign: 1 },
    { id: 'bottom', mozPos: [w / 2, 0, 0],     role: 'elev',   sign: 1 },
    { id: 'left',   mozPos: [0,     0, h / 2],  role: 'width',  sign: -1 },
    { id: 'right',  mozPos: [w,     0, h / 2],  role: 'width',  sign: 1 },
    { id: 'center', mozPos: [w / 2, 0, h / 2],  role: 'move',   sign: 1 },
  ]

  return (
    <group>
      {handles.map((def) => (
        <HandleBall
          key={def.id}
          mozPos={def.mozPos}
          role={def.role}
          sign={def.sign}
          wallAngleDeg={wallAngleDeg}
          product={product}
          productIndex={productIndex}
          onResize={onResize}
          onResizeWidth={onResizeWidth}
          onUpdateElev={onUpdateElev}
          onUpdateX={onUpdateX}
        />
      ))}
      {/* Bump arrows — callbacks swapped to compensate for 180° product rotation */}
      {onBumpRight && (
        <BumpBall mozPos={[-BALL_R * 2.5, 0, h * 0.65]} direction="left"
          productIndex={productIndex} onBump={onBumpRight} />
      )}
      {onBumpLeft && (
        <BumpBall mozPos={[w + BALL_R * 2.5, 0, h * 0.65]} direction="right"
          productIndex={productIndex} onBump={onBumpLeft} />
      )}
      {/* Depth drag arrows at bottom corners */}
      <DepthDragBall mozPos={[0, 0, 0]} productIndex={productIndex}
        product={product} onResize={onResize} />
      <DepthDragBall mozPos={[w, 0, 0]} productIndex={productIndex}
        product={product} onResize={onResize} />

      {/* Red X delete button at top-right corner */}
      {onRemove && (
        <Html position={mozPosToThree(w, 0, h)} center style={{ pointerEvents: 'auto' }}>
          <button
            onClick={(e) => { e.stopPropagation(); onRemove(productIndex) }}
            title="Delete product"
            style={{
              width: 22, height: 22, borderRadius: '50%',
              background: '#cc2222', border: '2px solid #ff4444',
              color: 'white', fontSize: 13, fontWeight: 'bold', lineHeight: '16px',
              cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
              transform: 'translate(8px, -8px)',
            }}
          >
            ×
          </button>
        </Html>
      )}
    </group>
  )
}
