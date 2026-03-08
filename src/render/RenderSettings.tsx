/**
 * Render settings panel — preset dropdown, edge/offset sliders,
 * lighting controls, tone mapping, and background color.
 */

import { LinearToneMapping, ACESFilmicToneMapping } from 'three'
import type { RenderMode, DebugOverlays } from '../mozaik/types'
import { RENDER_PRESETS } from '../store'
import SectionHeader from '../ui/SectionHeader'

interface RenderSettingsProps {
  renderMode: RenderMode
  onSetRenderMode: (mode: RenderMode) => void
  renderPreset: string | null
  onSetRenderPreset: (preset: string) => void
  edgeOpacity: number
  onSetEdgeOpacity: (value: number) => void
  polygonOffsetFactor: number
  onSetPolygonOffsetFactor: (value: number) => void
  polygonOffsetUnits: number
  onSetPolygonOffsetUnits: (value: number) => void
  ambientIntensity: number
  onSetAmbientIntensity: (value: number) => void
  directionalIntensity: number
  onSetDirectionalIntensity: (value: number) => void
  warmth: number
  onSetWarmth: (value: number) => void
  exposure: number
  onSetExposure: (value: number) => void
  toneMapping: number
  onSetToneMapping: (value: number) => void
  bgColor: string
  onSetBgColor: (value: string) => void
  hdriEnabled: boolean
  onToggleHdri: () => void
  hdriIntensity: number
  onSetHdriIntensity: (value: number) => void
  overlays: DebugOverlays
  onToggleOverlay: (key: keyof DebugOverlays) => void
}

function Toggle({
  label, checked, onChange,
}: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer text-sm">
      <input type="checkbox" checked={checked} onChange={onChange} className="accent-[var(--accent)]" />
      <span className={checked ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}>{label}</span>
    </label>
  )
}

function RenderModeSelector({ mode, onChange }: { mode: RenderMode; onChange: (m: RenderMode) => void }) {
  const modes: { value: RenderMode; label: string }[] = [
    { value: 'ghosted', label: 'Ghost' },
    { value: 'solid', label: 'Solid' },
    { value: 'wireframe', label: 'Wire' },
  ]
  return (
    <div className="flex gap-1">
      {modes.map((m) => (
        <button
          key={m.value}
          onClick={() => onChange(m.value)}
          className={`text-xs px-2 py-1 rounded transition-colors ${
            mode === m.value
              ? 'bg-[var(--accent)] text-black font-medium'
              : 'bg-gray-800 hover:bg-gray-700'
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}

function Slider({ label, value, min, max, step, format, onChange }: {
  label: string; value: number; min: number; max: number; step: number
  format: (v: number) => string; onChange: (v: number) => void
}) {
  return (
    <div className="mb-3">
      <label className="text-xs text-gray-400 flex justify-between">
        <span>{label}</span>
        <span>{format(value)}</span>
      </label>
      <input type="range" min={min} max={max} step={step}
        value={value}
        onChange={e => onChange(parseFloat(e.target.value))}
        className="w-full accent-[var(--accent)]" />
    </div>
  )
}

const BG_COLORS = ['#ffffff', '#f0f0f0', '#2a2a2a', '#1a1a2e', '#000000']

const fmtPct = (v: number) => `${Math.round(v * 100)}%`
const fmtDec = (v: number) => v.toFixed(1)

export default function RenderSettings({
  renderMode, onSetRenderMode, renderPreset, onSetRenderPreset,
  edgeOpacity, onSetEdgeOpacity, polygonOffsetFactor, onSetPolygonOffsetFactor,
  polygonOffsetUnits, onSetPolygonOffsetUnits,
  ambientIntensity, onSetAmbientIntensity, directionalIntensity, onSetDirectionalIntensity,
  warmth, onSetWarmth, exposure, onSetExposure,
  toneMapping, onSetToneMapping, bgColor, onSetBgColor,
  hdriEnabled, onToggleHdri, hdriIntensity, onSetHdriIntensity,
  overlays, onToggleOverlay,
}: RenderSettingsProps) {
  return (
    <div className="p-4 border-b border-gray-800">
      <SectionHeader>Render</SectionHeader>
      <div className="mb-3">
        <RenderModeSelector mode={renderMode} onChange={onSetRenderMode} />
      </div>
      <div className="mb-3">
        <label className="text-xs text-gray-400 mb-1 block">Preset</label>
        <select
          value={renderPreset ?? 'custom'}
          onChange={(e) => { if (e.target.value !== 'custom') onSetRenderPreset(e.target.value) }}
          className="w-full text-xs px-2 py-1 bg-[#222] text-white border border-gray-700 rounded"
        >
          <option value="custom">Custom</option>
          {Object.entries(RENDER_PRESETS).map(([key, p]) => (
            <option key={key} value={key}>{p.label}</option>
          ))}
        </select>
      </div>

      <Slider label="Edge Opacity" value={edgeOpacity} min={0} max={1} step={0.05} format={fmtPct} onChange={onSetEdgeOpacity} />
      <Slider label="Offset Factor" value={polygonOffsetFactor} min={0} max={10} step={0.5} format={fmtDec} onChange={onSetPolygonOffsetFactor} />
      <Slider label="Offset Units" value={polygonOffsetUnits} min={0} max={10} step={0.5} format={fmtDec} onChange={onSetPolygonOffsetUnits} />

      <div className="border-t border-gray-700 my-2" />

      <Slider label="Ambient" value={ambientIntensity} min={0} max={2} step={0.1} format={fmtDec} onChange={onSetAmbientIntensity} />
      <Slider label="Directional" value={directionalIntensity} min={0} max={2} step={0.1} format={fmtDec} onChange={onSetDirectionalIntensity} />
      <Slider label="Warmth" value={warmth} min={-1} max={1} step={0.1} format={fmtDec} onChange={onSetWarmth} />
      <Slider label="Exposure" value={exposure} min={0.5} max={2} step={0.1} format={fmtDec} onChange={onSetExposure} />
      <div className="mb-3">
        <Toggle label="HDRI Lighting" checked={hdriEnabled} onChange={onToggleHdri} />
      </div>
      {hdriEnabled && <Slider label="HDRI Intensity" value={hdriIntensity} min={0} max={2} step={0.1} format={fmtDec} onChange={onSetHdriIntensity} />}

      <div className="mb-3">
        <label className="text-xs text-gray-400 mb-1 block">Tone Mapping</label>
        <select
          value={toneMapping}
          onChange={(e) => onSetToneMapping(parseInt(e.target.value))}
          className="w-full text-xs px-2 py-1 bg-[#222] text-white border border-gray-700 rounded"
        >
          <option value={LinearToneMapping}>Linear</option>
          <option value={ACESFilmicToneMapping}>ACES Filmic</option>
        </select>
      </div>

      <div className="mb-3">
        <label className="text-xs text-gray-400 mb-1 block">Background</label>
        <div className="flex gap-1">
          {BG_COLORS.map(c => (
            <button
              key={c}
              onClick={() => onSetBgColor(c)}
              className={`w-8 h-6 rounded border-2 ${bgColor === c ? 'border-[var(--accent)]' : 'border-gray-600'}`}
              style={{ background: c }}
              title={c}
            />
          ))}
        </div>
      </div>

      <div className="space-y-2">
        <Toggle label="Origin Marker" checked={overlays.originMarker} onChange={() => onToggleOverlay('originMarker')} />
        <Toggle label="Axis Gizmo" checked={overlays.axisGizmo} onChange={() => onToggleOverlay('axisGizmo')} />
        <Toggle label="Floor Grid" checked={overlays.floorGrid} onChange={() => onToggleOverlay('floorGrid')} />
        <Toggle label="Wall Normals" checked={overlays.wallNormals} onChange={() => onToggleOverlay('wallNormals')} />
        <Toggle label="Bounding Boxes" checked={overlays.boundingBoxes} onChange={() => onToggleOverlay('boundingBoxes')} />
        <Toggle label="Double-Sided Walls" checked={overlays.doubleSidedWalls} onChange={() => onToggleOverlay('doubleSidedWalls')} />
        <Toggle label="Probe Scene" checked={overlays.probeScene} onChange={() => onToggleOverlay('probeScene')} />
      </div>
    </div>
  )
}
