import type { DebugOverlays, MozRoom, MozFile, RenderMode } from '../mozaik/types'
import { formatDim } from '../math/units'
import FileLoader from './FileLoader'

interface UIPanelProps {
  room: MozRoom | null
  products: MozFile[]
  overlays: DebugOverlays
  selectedWall: number | null
  useInches: boolean
  renderMode: RenderMode
  jobFolder: FileSystemDirectoryHandle | null
  onToggleOverlay: (key: keyof DebugOverlays) => void
  onToggleUnits: () => void
  onSetRenderMode: (mode: RenderMode) => void
  onLinkJobFolder: () => void
  onExportDes: () => void
  onExportMoz: (index: number) => void
}

function Toggle({
  label, checked, onChange,
}: { label: string; checked: boolean; onChange: () => void }) {
  return (
    <label className="flex items-center gap-2 cursor-pointer text-sm">
      <input
        type="checkbox"
        checked={checked}
        onChange={onChange}
        className="accent-[var(--yellow)]"
      />
      <span className={checked ? 'text-white' : 'text-[var(--text-secondary)]'}>
        {label}
      </span>
    </label>
  )
}

function RenderModeSelector({
  mode, onChange,
}: { mode: RenderMode; onChange: (m: RenderMode) => void }) {
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
              ? 'bg-[var(--yellow)] text-black font-medium'
              : 'bg-gray-800 hover:bg-gray-700'
          }`}
        >
          {m.label}
        </button>
      ))}
    </div>
  )
}

export default function UIPanel({
  room, products, overlays, selectedWall, useInches, renderMode, jobFolder,
  onToggleOverlay, onToggleUnits, onSetRenderMode, onLinkJobFolder, onExportDes, onExportMoz,
}: UIPanelProps) {
  const fmt = (mm: number) => formatDim(mm, useInches)

  return (
    <div className="w-80 bg-[var(--bg-panel)] flex flex-col h-full border-r border-gray-800 overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">
            Single<span className="text-[var(--yellow)]">Draw</span>
          </h1>
          <button
            onClick={onToggleUnits}
            className="text-xs px-2 py-1 rounded border border-gray-700 hover:bg-gray-800 transition-colors"
          >
            {useInches ? 'in' : 'mm'}
          </button>
        </div>
        <p className="text-xs text-[var(--text-secondary)] mt-1">
          Stage 1 — Coordinate Truth Harness
        </p>
      </div>

      {/* File Loading */}
      <div className="p-4 border-b border-gray-800">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-3">
          Files
        </h2>
        <FileLoader />
      </div>

      {/* Job Folder + Export */}
      <div className="p-4 border-b border-gray-800">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-3">
          Export
        </h2>
        <div className="space-y-2">
          <button
            onClick={onLinkJobFolder}
            className="w-full text-xs px-3 py-2 bg-gray-800 rounded hover:bg-gray-700 transition-colors text-left"
          >
            {jobFolder ? `Job: ${jobFolder.name}` : 'Link Job Folder...'}
          </button>
          {room && jobFolder && (
            <button
              onClick={onExportDes}
              className="w-full text-xs px-3 py-2 bg-[var(--yellow)] text-black font-medium rounded hover:opacity-90 transition-opacity"
            >
              Export DES to Job
            </button>
          )}
        </div>
      </div>

      {/* Render Mode + Debug Overlays */}
      <div className="p-4 border-b border-gray-800">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-3">
          Render
        </h2>
        <div className="mb-3">
          <RenderModeSelector mode={renderMode} onChange={onSetRenderMode} />
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

      {/* Room Info */}
      {room && (
        <div className="p-4 border-b border-gray-800">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-3">
            Room
          </h2>
          <div className="text-sm space-y-1">
            <p><span className="text-[var(--text-secondary)]">Name:</span> {room.name}</p>
            <p><span className="text-[var(--text-secondary)]">Walls:</span> {room.walls.length}</p>
            <p><span className="text-[var(--text-secondary)]">Openings:</span> {room.fixtures.filter(f => f.name === 'Opening').length}</p>
            <p><span className="text-[var(--text-secondary)]">Products:</span> {room.products.length}</p>
            <p><span className="text-[var(--text-secondary)]">Wall Height:</span> {fmt(room.parms.H_Walls)}</p>
            <p><span className="text-[var(--text-secondary)]">Wall Thickness:</span> {fmt(room.parms.WallThickness)}</p>
            {selectedWall !== null && (() => {
              const wall = room.walls.find(w => w.wallNumber === selectedWall)
              if (!wall) return <p className="text-[var(--yellow)]">Selected: Wall {selectedWall}</p>
              return (
                <div className="mt-2 pt-2 border-t border-gray-700 text-[var(--yellow)]">
                  <p className="font-medium">Wall {selectedWall}</p>
                  <p><span className="text-[var(--text-secondary)]">Length:</span> {fmt(wall.len)}</p>
                  <p><span className="text-[var(--text-secondary)]">Height:</span> {fmt(wall.height)}</p>
                  <p><span className="text-[var(--text-secondary)]">Thickness:</span> {fmt(wall.thickness)}</p>
                  <p><span className="text-[var(--text-secondary)]">Angle:</span> {wall.ang}°</p>
                </div>
              )
            })()}
          </div>
        </div>
      )}

      {/* Products */}
      {products.length > 0 && (
        <div className="p-4 border-b border-gray-800">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-3">
            Products ({products.length})
          </h2>
          <div className="space-y-2">
            {products.map((mf, i) => (
              <div key={i} className="text-sm bg-[var(--bg-dark)] rounded p-2">
                <p className="font-medium">{mf.product.prodName}</p>
                <p className="text-xs text-[var(--text-secondary)]">
                  {fmt(mf.product.width)} × {fmt(mf.product.height)} × {fmt(mf.product.depth)}
                </p>
                <p className="text-xs text-[var(--text-secondary)]">
                  Parts: {mf.product.parts.length}
                </p>
                <button
                  onClick={() => onExportMoz(i)}
                  className="mt-1 text-xs px-2 py-1 bg-gray-800 rounded hover:bg-gray-700 transition-colors"
                >
                  Export MOZ
                </button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Room products */}
      {room && room.products.length > 0 && (
        <div className="p-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-3">
            Room Products ({room.products.length})
          </h2>
          <div className="space-y-2">
            {room.products.map((p, i) => (
              <div key={i} className="text-sm bg-[var(--bg-dark)] rounded p-2">
                <p className="font-medium">{p.prodName}</p>
                <p className="text-xs text-[var(--text-secondary)]">
                  Wall: {p.wall} | X: {fmt(p.x)} | Parts: {p.parts.length}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
