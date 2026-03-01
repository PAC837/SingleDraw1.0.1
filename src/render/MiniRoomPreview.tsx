/**
 * Mini 3D room preview shown in the bottom-right corner during plan view.
 * Renders the room in a separate Canvas with a fixed isometric perspective camera.
 * Has its own render mode picker (defaults to ghosted).
 */

import { useState, useRef, useEffect } from 'react'
import { Canvas, useThree, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { OrbitControls as OrbitControlsType } from 'three-stdlib'
import type { MozRoom, RenderMode } from '../mozaik/types'
import RoomWalls from './RoomWalls'
import RoomFloor from './RoomFloor'
import { GhostIcon, BrickIcon, WireframeIcon } from './RenderModeButton'

interface MiniRoomPreviewProps {
  room: MozRoom
  roomCenter: [number, number, number]
  selectedWall: number | null
  onSelectWall: (wallNumber: number) => void
  textureFolder: FileSystemDirectoryHandle | null
  selectedFloorType: string | null
  selectedFloorTexture: string | null
  selectedWallType: string | null
  selectedWallTexture: string | null
}

function MiniOrbitTarget({ target }: { target: [number, number, number] }) {
  const ref = useRef<OrbitControlsType>(null)
  const applied = useRef(false)

  useEffect(() => {
    applied.current = false
    if (ref.current) {
      ref.current.target.set(target[0], target[1], target[2])
      ref.current.update()
      applied.current = true
    }
  }, [target])

  useFrame(() => {
    if (!applied.current && ref.current) {
      ref.current.target.set(target[0], target[1], target[2])
      ref.current.update()
      applied.current = true
    }
  })

  return <OrbitControls ref={ref} makeDefault target={target} />
}

function MiniCameraSetup({ roomCenter }: { roomCenter: [number, number, number] }) {
  const { camera } = useThree()
  const initialized = useRef(false)

  useEffect(() => {
    if (!initialized.current) {
      const [cx, cy, cz] = roomCenter
      camera.position.set(cx + 4000, cy + 3000, cz + 4000)
      camera.lookAt(cx, cy, cz)
      camera.updateProjectionMatrix()
      initialized.current = true
    }
  }, [camera, roomCenter])

  return null
}

const MODES: RenderMode[] = ['ghosted', 'solid', 'wireframe']

function ModePickerIcon({ mode, color, size }: { mode: RenderMode; color: string; size: number }) {
  switch (mode) {
    case 'ghosted': return <GhostIcon color={color} size={size} />
    case 'solid': return <BrickIcon color={color} size={size} />
    case 'wireframe': return <WireframeIcon color={color} size={size} />
  }
}

export default function MiniRoomPreview({
  room, roomCenter, selectedWall, onSelectWall,
  textureFolder, selectedFloorType, selectedFloorTexture, selectedWallType, selectedWallTexture,
}: MiniRoomPreviewProps) {
  const [localMode, setLocalMode] = useState<RenderMode>('ghosted')

  return (
    <div
      className="absolute bottom-3 right-3 z-10 rounded-lg overflow-hidden"
      style={{
        width: 300,
        height: 220,
        border: '2px solid #444',
        background: '#1a1a1a',
      }}
    >
      <div
        className="absolute top-1 left-2 text-xs font-medium z-10"
        style={{ color: '#888', pointerEvents: 'none' }}
      >
        3D Preview
      </div>

      {/* Render mode picker */}
      <div className="absolute top-1 right-1 z-10 flex gap-0.5">
        {MODES.map((m) => (
          <button
            key={m}
            onClick={() => setLocalMode(m)}
            title={m}
            className="flex items-center justify-center rounded"
            style={{
              width: 22, height: 22,
              background: m === localMode ? 'rgba(0,0,0,0.6)' : 'transparent',
              border: m === localMode ? '1px solid var(--accent)' : '1px solid transparent',
            }}
          >
            <ModePickerIcon mode={m} color={m === localMode ? 'var(--accent)' : '#666'} size={16} />
          </button>
        ))}
      </div>

      <Canvas
        camera={{
          position: [5000, 4000, 5000],
          fov: 50,
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

        <MiniCameraSetup roomCenter={roomCenter} />
        <MiniOrbitTarget target={roomCenter} />

        <RoomFloor
          room={room}
          textureFolder={textureFolder}
          selectedFloorType={selectedFloorType}
          selectedFloorTexture={selectedFloorTexture}
        />
        <RoomWalls
          room={room}
          doubleSided={false}
          selectedWall={selectedWall}
          onSelectWall={onSelectWall}
          renderMode={localMode}
          textureFolder={textureFolder}
          selectedWallType={selectedWallType}
          selectedWallTexture={selectedWallTexture}
        />
      </Canvas>
    </div>
  )
}
