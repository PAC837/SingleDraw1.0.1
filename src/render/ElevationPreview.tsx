/**
 * Live 3D preview canvas for the Elevation Viewer overlay.
 * Renders the product in a separate R3F Canvas with orbit controls.
 * Includes view preset buttons (Front/Back/Left/Right/3D) and render mode picker.
 */

import { useState, useRef, useEffect, useMemo } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsType } from 'three-stdlib'
import type { MozProduct, RenderMode } from '../mozaik/types'
import type { AutoEndPanel } from '../mozaik/autoEndPanels'
import { PANEL_THICK } from '../mozaik/autoEndPanels'
import { mozPosToThree } from '../math/basis'
import ProductView from './ProductView'
import { GhostIcon, BrickIcon, WireframeIcon } from './RenderModeButton'

type ViewPreset = 'front' | 'back' | 'left' | 'right' | '3d'

interface ElevationPreviewProps {
  product: MozProduct
  adjacentPanels?: AutoEndPanel[]
}

/** Compute camera position for a given view preset. */
function cameraForPreset(
  preset: ViewPreset,
  center: { x: number; y: number; z: number },
  dist: number,
): [number, number, number] {
  switch (preset) {
    case 'front': return [center.x, center.y, center.z + dist]
    case 'back':  return [center.x, center.y, center.z - dist]
    case 'left':  return [center.x - dist, center.y, center.z]
    case 'right': return [center.x + dist, center.y, center.z]
    case '3d':    return [center.x + dist * 0.35, center.y + dist * 0.25, center.z + dist * 0.5]
  }
}

/** Compute the visual center of the product after ProductView's wallAngleDeg=180 transforms.
 *  ProductView applies: position=(0,elev,0), rotation=[0,π,0], scale=[1,1,-1].
 *  Local (w/2, h/2, d/2) → mozPosToThree → scale Z-flip → rotate π → translate. */
function productVisualCenter(product: MozProduct): { x: number; y: number; z: number } {
  return {
    x: -product.width / 2,
    y: product.elev + product.height / 2,
    z: -product.depth / 2,
  }
}

function CameraSetup({ product, preset, version }: {
  product: MozProduct; preset: ViewPreset; version: number
}) {
  const { camera } = useThree()

  useEffect(() => {
    const d = Math.max(product.width, product.height, product.depth) * 2.5
    const center = productVisualCenter(product)
    const pos = cameraForPreset(preset, center, d)
    camera.position.set(pos[0], pos[1], pos[2])
    camera.lookAt(center.x, center.y, center.z)
    camera.updateProjectionMatrix()
  }, [camera, product, preset, version])

  return null
}

function OrbitTarget({ product }: { product: MozProduct }) {
  const ref = useRef<OrbitControlsType>(null)
  const applied = useRef(false)
  const center = productVisualCenter(product)
  const target: [number, number, number] = [center.x, center.y, center.z]

  useEffect(() => {
    applied.current = false
    if (ref.current) {
      ref.current.target.set(target[0], target[1], target[2])
      ref.current.update()
      applied.current = true
    }
  }, [target[0], target[1], target[2]])

  useFrame(() => {
    if (!applied.current && ref.current) {
      ref.current.target.set(target[0], target[1], target[2])
      ref.current.update()
      applied.current = true
    }
  })

  return <OrbitControls ref={ref} makeDefault target={target} />
}

/** Renders auto end panels as simple colored boxes relative to the product. */
function AdjacentPanels({ panels, product, renderMode }: { panels: AutoEndPanel[]; product: MozProduct; renderMode: RenderMode }) {
  return (
    <>
      {panels.map((panel, i) => {
        // Position relative to product origin (not wall coordinate space)
        const panelX = panel.side === 'left' ? -PANEL_THICK : product.width
        const pos = mozPosToThree(
          panelX + PANEL_THICK / 2,
          panel.depth / 2,
          panel.elev + panel.height / 2,
        )
        return (
          <mesh key={`panel-${i}`} position={pos}>
            <boxGeometry args={[PANEL_THICK, panel.height, panel.depth]} />
            {renderMode === 'wireframe' ? (
              <meshBasicMaterial color="#d4c5a9" wireframe />
            ) : (
              <meshStandardMaterial
                color="#d4c5a9"
                transparent={renderMode === 'ghosted'}
                opacity={renderMode === 'ghosted' ? 0.3 : 1}
              />
            )}
          </mesh>
        )
      })}
    </>
  )
}

const MODES: RenderMode[] = ['ghosted', 'solid', 'wireframe']
const VIEWS: { key: ViewPreset; label: string }[] = [
  { key: 'front', label: 'F' },
  { key: 'back', label: 'B' },
  { key: 'left', label: 'L' },
  { key: 'right', label: 'R' },
  { key: '3d', label: '3D' },
]

function ModeIcon({ mode, color, size }: { mode: RenderMode; color: string; size: number }) {
  switch (mode) {
    case 'ghosted': return <GhostIcon color={color} size={size} />
    case 'solid': return <BrickIcon color={color} size={size} />
    case 'wireframe': return <WireframeIcon color={color} size={size} />
  }
}

export default function ElevationPreview({ product, adjacentPanels }: ElevationPreviewProps) {
  const [localMode, setLocalMode] = useState<RenderMode>('solid')
  const [viewPreset, setViewPreset] = useState<ViewPreset>('3d')
  const [viewVersion, setViewVersion] = useState(0)

  const handleViewClick = (v: ViewPreset) => {
    setViewPreset(v)
    setViewVersion(n => n + 1) // force camera reset even if same preset
  }

  const panels = useMemo(() => adjacentPanels ?? [], [adjacentPanels])

  return (
    <div className="relative w-full h-full rounded-lg overflow-hidden" style={{ background: '#1a1a1a' }}>
      {/* Render mode picker */}
      <div className="absolute top-2 right-2 z-10 flex gap-0.5">
        {MODES.map((m) => (
          <button
            key={m}
            onClick={() => setLocalMode(m)}
            title={m}
            className="flex items-center justify-center rounded"
            style={{
              width: 24, height: 24,
              background: m === localMode ? 'rgba(0,0,0,0.6)' : 'transparent',
              border: m === localMode ? '1px solid var(--accent)' : '1px solid transparent',
            }}
          >
            <ModeIcon mode={m} color={m === localMode ? 'var(--accent)' : '#666'} size={16} />
          </button>
        ))}
      </div>

      {/* View preset buttons */}
      <div className="absolute top-9 right-2 z-10 flex gap-0.5">
        {VIEWS.map(({ key, label }) => (
          <button
            key={key}
            onClick={() => handleViewClick(key)}
            title={`${key} view`}
            className="flex items-center justify-center rounded text-[9px] font-semibold"
            style={{
              width: key === '3d' ? 28 : 22, height: 20,
              background: key === viewPreset ? 'rgba(0,0,0,0.6)' : 'transparent',
              border: key === viewPreset ? '1px solid var(--accent)' : '1px solid transparent',
              color: key === viewPreset ? 'var(--accent)' : '#666',
            }}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="absolute top-2 left-3 text-xs font-medium z-10" style={{ color: '#888', pointerEvents: 'none' }}>
        3D Preview
      </div>

      <Canvas
        camera={{
          position: [3000, 2500, 3000],
          fov: 45,
          near: 1,
          far: 100000,
          up: [0, 1, 0],
        }}
        gl={{ antialias: true }}
        style={{ background: '#1a1a1a' }}
      >
        <ambientLight intensity={0.6} />
        <hemisphereLight args={['#d4e6f1', '#b0a090', 0.5]} />
        <directionalLight position={[5000, 10000, 5000]} intensity={0.7} />
        <directionalLight position={[-3000, 8000, -3000]} intensity={0.3} />

        <CameraSetup product={product} preset={viewPreset} version={viewVersion} />
        <OrbitTarget product={product} />

        <ProductView
          product={product}
          wallAngleDeg={180}
          renderMode={localMode}
          showOperations={true}
        />

        {panels.length > 0 && (
          <group rotation={[0, Math.PI, 0]} scale={[1, 1, -1]}>
            <AdjacentPanels panels={panels} product={product} renderMode={localMode} />
          </group>
        )}
      </Canvas>
    </div>
  )
}
