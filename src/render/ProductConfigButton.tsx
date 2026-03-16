/**
 * Toolbar button + dropdown for product placement configuration.
 * Sets floor/wall mode, wall height, section height, elevation, and room presets.
 */
import { useEffect } from 'react'
import { mmToInches, inchesToMm, formatDim } from '../math/units'
import { snapModularHeight } from '../mozaik/modularValues'
import { snapToGrid } from '../mozaik/shelfEditor'
import ToolbarButton from '../ui/ToolbarButton'
import FloatingPanel from '../ui/FloatingPanel'

interface ProductConfigButtonProps {
  open: boolean
  placementMode: 'floor' | 'wall'
  unitHeight: number             // mm — floor section height
  wallSectionHeight: number      // mm — wall section height
  wallMountTopAt: number         // mm
  wallHeight: number             // mm — room wall height
  fixedShelfHeight: number       // mm — preferred fixed shelf Z
  baseCabHeight: number          // mm — base cabinet height
  hutchSectionHeight: number     // mm — hutch/upper-stack section height
  useInches: boolean
  onToggle: () => void
  onSetMode: (mode: 'floor' | 'wall') => void
  onSetUnitHeight: (mm: number) => void
  onSetFixedShelfHeight: (mm: number) => void
  onSetBaseCabHeight: (mm: number) => void
  onSetHutchSectionHeight: (mm: number) => void
  onSetWallSectionHeight: (mm: number) => void
  onSetWallHeight: (mm: number) => void
  onCreatePresetRoom: (preset: 'reach-in' | 'walk-in' | 'walk-in-deep' | 'angled') => void
}

const WALL_HEIGHT_PRESETS = [96, 120]
const FLOOR_SECTION_PRESETS = [84, 87, 96, 108]
const WALL_SECTION_PRESETS = [72, 76, 84, 87, 96, 108]
const FIXED_SHELF_PRESETS = [36, 42, 48]
const BASE_CAB_PRESETS = [30, 34.5, 36]
const HUTCH_SECTION_PRESETS = [36, 42, 48]

export default function ProductConfigButton({
  open, placementMode, unitHeight, wallSectionHeight, wallMountTopAt, wallHeight, fixedShelfHeight, baseCabHeight, hutchSectionHeight, useInches,
  onToggle, onSetMode, onSetUnitHeight, onSetFixedShelfHeight, onSetBaseCabHeight, onSetHutchSectionHeight, onSetWallSectionHeight, onSetWallHeight, onCreatePresetRoom,
}: ProductConfigButtonProps) {
  // Close only when clicking the 3D canvas background (onPointerMissed)
  useEffect(() => {
    if (!open) return
    const handler = () => onToggle()
    window.addEventListener('canvas-bg-click', handler)
    return () => window.removeEventListener('canvas-bg-click', handler)
  }, [open, onToggle])

  const wallHtIn = Math.round(mmToInches(wallHeight))
  const wallElev = Math.max(0, wallMountTopAt - wallSectionHeight)

  const c = open ? 'var(--accent)' : '#aaa'
  const c2 = open ? 'var(--accent)' : '#888'

  return (
    <div className="relative">
      <ToolbarButton active={open} title="Product configuration" onClick={onToggle}>
        <svg width="40" height="40" viewBox="0 0 20 20" fill="none">
          <rect x="4" y="2" width="12" height="16" rx="1.5" stroke={c} strokeWidth="1.5" fill="none" />
          <line x1="7" y1="6" x2="13" y2="6" stroke={c2} strokeWidth="1.2" />
          <line x1="7" y1="9" x2="13" y2="9" stroke={c2} strokeWidth="1.2" />
          <line x1="7" y1="12" x2="11" y2="12" stroke={c2} strokeWidth="1.2" />
        </svg>
      </ToolbarButton>

      {open && (
        <FloatingPanel className="absolute top-[72px] left-0 space-y-2.5" style={{ minWidth: 220 }}>
          {/* Mode toggle */}
          <div className="flex gap-1">
            {(['floor', 'wall'] as const).map(m => (
              <button
                key={m}
                onClick={() => onSetMode(m)}
                className="flex-1 text-xs px-2 py-1.5 rounded font-medium transition-colors"
                style={{
                  background: placementMode === m ? 'var(--accent)' : '#333',
                  color: placementMode === m ? '#000' : '#aaa',
                }}
              >
                {m === 'floor' ? 'Floor' : 'Wall'}
              </button>
            ))}
          </div>

          {/* Wall Height */}
          <div>
            <label className="text-[10px] text-gray-400 uppercase tracking-wider">Wall Height</label>
            <div className="flex gap-1 mt-1">
              {WALL_HEIGHT_PRESETS.map(p => (
                <button
                  key={p}
                  onClick={() => onSetWallHeight(inchesToMm(p))}
                  className="text-xs px-2 py-1 rounded transition-colors"
                  style={{
                    background: wallHtIn === p ? 'var(--accent)' : '#333',
                    color: wallHtIn === p ? '#000' : '#aaa',
                  }}
                >
                  {p}
                </button>
              ))}
              <input
                type="number"
                value={useInches ? wallHtIn : Math.round(wallHeight)}
                onChange={e => {
                  const v = Number(e.target.value)
                  onSetWallHeight(useInches ? inchesToMm(v) : v)
                }}
                className="w-14 text-xs px-1.5 py-1 bg-gray-800 rounded border border-gray-600 text-white text-center"
              />
            </div>
          </div>

          {/* Floor Section Height */}
          <div>
            <label className="text-[10px] uppercase tracking-wider"
              style={{ color: placementMode === 'floor' ? 'var(--accent)' : '#9ca3af' }}>
              Floor Height
              <span className="text-gray-500 normal-case ml-1">{formatDim(unitHeight, useInches)}</span>
            </label>
            <div className="flex flex-wrap gap-1 mt-1">
              {FLOOR_SECTION_PRESETS.map(p => {
                const isActive = unitHeight === snapModularHeight(inchesToMm(p))
                return (
                  <button
                    key={p}
                    onClick={() => { onSetMode('floor'); onSetUnitHeight(inchesToMm(p)) }}
                    className="text-xs px-2 py-1 rounded transition-colors"
                    style={{
                      background: isActive ? 'var(--accent)' : '#333',
                      color: isActive ? '#000' : '#aaa',
                    }}
                  >
                    {p}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Fixed Shelf Height */}
          <div>
            <label className="text-[10px] uppercase tracking-wider" style={{ color: '#9ca3af' }}>
              Fixed Shelf Height
              <span className="text-gray-500 normal-case ml-1">{formatDim(fixedShelfHeight, useInches)}</span>
            </label>
            <div className="flex gap-1 mt-1">
              {FIXED_SHELF_PRESETS.map(p => {
                const isActive = fixedShelfHeight === snapToGrid(inchesToMm(p))
                return (
                  <button
                    key={p}
                    onClick={() => onSetFixedShelfHeight(inchesToMm(p))}
                    className="text-xs px-2 py-1 rounded transition-colors"
                    style={{
                      background: isActive ? 'var(--accent)' : '#333',
                      color: isActive ? '#000' : '#aaa',
                    }}
                  >
                    {p}
                  </button>
                )
              })}
              <input
                type="number"
                value={useInches ? Math.round(mmToInches(fixedShelfHeight)) : Math.round(fixedShelfHeight)}
                onChange={e => {
                  const v = Number(e.target.value)
                  onSetFixedShelfHeight(useInches ? inchesToMm(v) : v)
                }}
                className="w-14 text-xs px-1.5 py-1 bg-gray-800 rounded border border-gray-600 text-white text-center"
              />
            </div>
          </div>

          {/* Base Cabinet Height */}
          <div>
            <label className="text-[10px] uppercase tracking-wider" style={{ color: '#9ca3af' }}>
              Base Cabinet Height
              <span className="text-gray-500 normal-case ml-1">{formatDim(baseCabHeight, useInches)}</span>
            </label>
            <div className="flex gap-1 mt-1">
              {BASE_CAB_PRESETS.map(p => {
                const isActive = Math.abs(baseCabHeight - inchesToMm(p)) < 1
                return (
                  <button
                    key={p}
                    onClick={() => onSetBaseCabHeight(inchesToMm(p))}
                    className="text-xs px-2 py-1 rounded transition-colors"
                    style={{
                      background: isActive ? 'var(--accent)' : '#333',
                      color: isActive ? '#000' : '#aaa',
                    }}
                  >
                    {p}
                  </button>
                )
              })}
              <input
                type="number"
                step="0.5"
                value={useInches ? +(mmToInches(baseCabHeight)).toFixed(1) : Math.round(baseCabHeight)}
                onChange={e => {
                  const v = Number(e.target.value)
                  onSetBaseCabHeight(useInches ? inchesToMm(v) : v)
                }}
                className="w-14 text-xs px-1.5 py-1 bg-gray-800 rounded border border-gray-600 text-white text-center"
              />
            </div>
          </div>

          {/* Hutch Section Height */}
          <div>
            <label className="text-[10px] uppercase tracking-wider" style={{ color: '#9ca3af' }}>
              Hutch Section Height
              <span className="text-gray-500 normal-case ml-1">{formatDim(hutchSectionHeight, useInches)}</span>
            </label>
            <div className="flex gap-1 mt-1">
              {HUTCH_SECTION_PRESETS.map(p => {
                const isActive = hutchSectionHeight === snapModularHeight(inchesToMm(p))
                return (
                  <button
                    key={p}
                    onClick={() => onSetHutchSectionHeight(inchesToMm(p))}
                    className="text-xs px-2 py-1 rounded transition-colors"
                    style={{
                      background: isActive ? 'var(--accent)' : '#333',
                      color: isActive ? '#000' : '#aaa',
                    }}
                  >
                    {p}
                  </button>
                )
              })}
              <input
                type="number"
                value={useInches ? Math.round(mmToInches(hutchSectionHeight)) : Math.round(hutchSectionHeight)}
                onChange={e => {
                  const v = Number(e.target.value)
                  onSetHutchSectionHeight(useInches ? inchesToMm(v) : v)
                }}
                className="w-14 text-xs px-1.5 py-1 bg-gray-800 rounded border border-gray-600 text-white text-center"
              />
            </div>
          </div>

          {/* Wall Section Height */}
          <div>
            <label className="text-[10px] uppercase tracking-wider"
              style={{ color: placementMode === 'wall' ? 'var(--accent)' : '#9ca3af' }}>
              Wall Section Height
              <span className="text-gray-500 normal-case ml-1">{formatDim(wallSectionHeight, useInches)}</span>
            </label>
            <div className="flex flex-wrap gap-1 mt-1">
              {WALL_SECTION_PRESETS.map(p => {
                const isActive = wallSectionHeight === snapModularHeight(inchesToMm(p))
                return (
                  <button
                    key={p}
                    onClick={() => { onSetWallSectionHeight(inchesToMm(p)) }}
                    className="text-xs px-2 py-1 rounded transition-colors"
                    style={{
                      background: isActive ? 'var(--accent)' : '#333',
                      color: isActive ? '#000' : '#aaa',
                    }}
                  >
                    {p}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Elevation readout — both modes, active highlighted */}
          <div className="text-xs pt-1 border-t border-gray-700 space-y-0.5">
            <div style={{ color: placementMode === 'floor' ? 'var(--accent)' : '#9ca3af' }}>
              Floor: on ground
            </div>
            <div style={{ color: placementMode === 'wall' ? 'var(--accent)' : '#9ca3af' }}>
              Wall: elev <span className="text-white">{formatDim(wallElev, useInches)}</span>
            </div>
          </div>

          {/* Room Presets */}
          <div className="pt-1 border-t border-gray-700">
            <label className="text-[10px] text-gray-400 uppercase tracking-wider">Room</label>
            <div className="flex gap-1.5 mt-1">
              <PresetIcon preset="reach-in" label="Reach-In" onClick={onCreatePresetRoom} />
              <PresetIcon preset="walk-in" label="Walk-In" onClick={onCreatePresetRoom} />
              <PresetIcon preset="walk-in-deep" label="Deep" onClick={onCreatePresetRoom} />
              <PresetIcon preset="angled" label="Angled" onClick={onCreatePresetRoom} />
            </div>
          </div>
        </FloatingPanel>
      )}
    </div>
  )
}

type Preset = 'reach-in' | 'walk-in' | 'walk-in-deep' | 'angled'

function PresetIcon({ preset, label, onClick }: {
  preset: Preset; label: string; onClick: (p: Preset) => void
}) {
  return (
    <button
      onClick={() => onClick(preset)}
      title={label}
      className="flex flex-col items-center gap-0.5 p-1 rounded hover:bg-gray-700 transition-colors"
    >
      <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
        {preset === 'reach-in' && (
          <>
            <rect x="4" y="6" width="20" height="8" stroke="#888" strokeWidth="1.2" fill="none" />
            <line x1="10" y1="14" x2="18" y2="14" stroke="var(--accent)" strokeWidth="1.5" />
          </>
        )}
        {preset === 'walk-in' && (
          <>
            <rect x="5" y="5" width="18" height="18" stroke="#888" strokeWidth="1.2" fill="none" />
            <line x1="10" y1="23" x2="18" y2="23" stroke="var(--accent)" strokeWidth="1.5" />
          </>
        )}
        {preset === 'walk-in-deep' && (
          <>
            <rect x="8" y="3" width="12" height="22" stroke="#888" strokeWidth="1.2" fill="none" />
            <line x1="11" y1="25" x2="17" y2="25" stroke="var(--accent)" strokeWidth="1.5" />
          </>
        )}
        {preset === 'angled' && (
          <>
            <path d="M5 23 L5 5 L18 5 L23 10 L23 23 Z" stroke="#888" strokeWidth="1.2" fill="none" />
            <line x1="10" y1="23" x2="18" y2="23" stroke="var(--accent)" strokeWidth="1.5" />
          </>
        )}
      </svg>
      <span className="text-[9px] text-gray-500">{label}</span>
    </button>
  )
}
