import { useState } from 'react'
import type { DebugOverlays, MozRoom, MozFile, RenderMode } from '../mozaik/types'
import { formatDim } from '../math/units'
import FileLoader from './FileLoader'
import CreateRoomPanel from './CreateRoomPanel'
import PlaceProductPanel from './PlaceProductPanel'
import ProductPreview from './ProductPreview'

interface UIPanelProps {
  room: MozRoom | null
  products: MozFile[]
  overlays: DebugOverlays
  selectedWall: number | null
  useInches: boolean
  renderMode: RenderMode
  jobFolder: FileSystemDirectoryHandle | null
  textureFolder: FileSystemDirectoryHandle | null
  availableTextures: string[]
  selectedTexture: string | null
  onToggleOverlay: (key: keyof DebugOverlays) => void
  onToggleUnits: () => void
  onSetRenderMode: (mode: RenderMode) => void
  onLinkJobFolder: () => void
  onLinkTextureFolder: () => void
  onSelectTexture: (filename: string | null) => void
  singleDrawFloorTextures: Record<string, string[]>
  selectedFloorType: string | null
  selectedFloorTexture: string | null
  onSetFloorType: (type: string | null) => void
  onSelectFloorTexture: (filename: string | null) => void
  singleDrawWallTextures: Record<string, string[]>
  selectedWallType: string | null
  selectedWallTexture: string | null
  onSetWallType: (type: string | null) => void
  onSelectWallTexture: (filename: string | null) => void
  singleDrawTextures: Record<string, string[]>
  selectedSingleDrawBrand: string | null
  selectedSingleDrawTexture: string | null
  onSetSingleDrawBrand: (brand: string | null) => void
  onSetSingleDrawTexture: (filename: string | null) => void
  onExportDes: () => void
  onExportMoz: (index: number) => void
  libraryFolder: FileSystemDirectoryHandle | null
  availableLibraryFiles: string[]
  onLinkLibraryFolder: () => void
  onLoadFromLibrary: (filenames: string[]) => void
  onGenerateGlbScript: () => void
  sketchUpFolder: FileSystemDirectoryHandle | null
  onLinkSketchUpFolder: () => void
  modelsFolder: FileSystemDirectoryHandle | null
  onLinkModelsFolder: () => void
  onCreateRoom: (width: number, depth: number) => void
  onPlaceProduct: (productIndex: number, wallNumber: number) => void
  onUpdateProductDimension: (productIndex: number, field: 'width' | 'depth', value: number) => void
  onRemoveProduct: (productIndex: number) => void
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
        className="accent-[var(--accent)]"
      />
      <span className={checked ? 'text-[var(--text-primary)]' : 'text-[var(--text-secondary)]'}>
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

function LibrarySection({
  libraryFolder, availableLibraryFiles, onLinkLibraryFolder, onLoadFromLibrary,
}: {
  libraryFolder: FileSystemDirectoryHandle | null
  availableLibraryFiles: string[]
  onLinkLibraryFolder: () => void
  onLoadFromLibrary: (filenames: string[]) => void
}) {
  const [checked, setChecked] = useState<Set<string>>(new Set())

  const toggle = (filename: string) => {
    setChecked(prev => {
      const next = new Set(prev)
      if (next.has(filename)) next.delete(filename)
      else next.add(filename)
      return next
    })
  }

  return (
    <div className="p-4 border-b border-gray-800">
      <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)] mb-3 border-b border-[var(--accent)] pb-1">
        Libraries
      </h2>
      <div className="space-y-2">
        <button
          onClick={onLinkLibraryFolder}
          className="w-full text-xs px-3 py-2 bg-gray-800 rounded border border-[var(--accent)] hover:bg-gray-700 transition-colors text-left"
        >
          {libraryFolder ? `Library: ${libraryFolder.name}` : 'Link Library Folder...'}
        </button>
        {libraryFolder && availableLibraryFiles.length > 0 && (
          <>
            <div
              className="max-h-[200px] overflow-y-auto bg-gray-800 rounded border border-[var(--accent)] p-1"
            >
              {availableLibraryFiles.map((f) => (
                <label
                  key={f}
                  className="flex items-center gap-2 px-2 py-1 rounded cursor-pointer hover:bg-gray-700 text-xs"
                >
                  <input
                    type="checkbox"
                    checked={checked.has(f)}
                    onChange={() => toggle(f)}
                    className="accent-[var(--accent)]"
                  />
                  <span className={checked.has(f) ? 'text-[var(--accent)]' : 'text-[var(--text-primary)]'}>
                    {f.replace(/\.moz$/i, '')}
                  </span>
                </label>
              ))}
            </div>
            <button
              onClick={() => onLoadFromLibrary([...checked])}
              disabled={checked.size === 0}
              className="w-full text-xs px-3 py-2 rounded font-medium transition-opacity"
              style={{
                background: checked.size > 0 ? 'var(--accent)' : '#333',
                color: checked.size > 0 ? '#000' : '#666',
                opacity: checked.size > 0 ? 1 : 0.5,
                cursor: checked.size > 0 ? 'pointer' : 'not-allowed',
              }}
            >
              Load Selected ({checked.size})
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function UIPanel({
  room, products, overlays, selectedWall, useInches, renderMode, jobFolder, textureFolder,
  availableTextures, selectedTexture,
  singleDrawFloorTextures, selectedFloorType, selectedFloorTexture, onSetFloorType, onSelectFloorTexture,
  singleDrawWallTextures, selectedWallType, selectedWallTexture, onSetWallType, onSelectWallTexture,
  singleDrawTextures, selectedSingleDrawBrand, selectedSingleDrawTexture, onSetSingleDrawBrand, onSetSingleDrawTexture,
  onToggleOverlay, onToggleUnits, onSetRenderMode, onLinkJobFolder, onLinkTextureFolder, onSelectTexture, onExportDes, onExportMoz,
  libraryFolder, availableLibraryFiles, onLinkLibraryFolder, onLoadFromLibrary, onGenerateGlbScript,
  sketchUpFolder, onLinkSketchUpFolder, modelsFolder, onLinkModelsFolder,
  onCreateRoom, onPlaceProduct, onUpdateProductDimension, onRemoveProduct,
}: UIPanelProps) {
  const fmt = (mm: number) => formatDim(mm, useInches)

  return (
    <div className="w-80 bg-[var(--bg-panel)] flex flex-col h-full border-r border-gray-800 overflow-y-auto">
      {/* Header */}
      <div className="p-4 border-b border-gray-800">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-bold">
            Single<span className="text-[var(--accent)]">Draw</span>
          </h1>
          <button
            onClick={onToggleUnits}
            className="text-xs px-2 py-1 rounded border border-[var(--accent)] hover:bg-gray-800 transition-colors"
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
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)] mb-3 border-b border-[var(--accent)] pb-1">
          Files
        </h2>
        <FileLoader />
      </div>

      {/* Job Folder + Export */}
      <div className="p-4 border-b border-gray-800">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)] mb-3 border-b border-[var(--accent)] pb-1">
          Export
        </h2>
        <div className="space-y-2">
          <button
            onClick={onLinkJobFolder}
            className="w-full text-xs px-3 py-2 bg-gray-800 rounded border border-[var(--accent)] hover:bg-gray-700 transition-colors text-left"
          >
            {jobFolder ? `Job: ${jobFolder.name}` : 'Link Job Folder...'}
          </button>
          {room && jobFolder && (
            <button
              onClick={onExportDes}
              className="w-full text-xs px-3 py-2 bg-[var(--accent)] text-black font-medium rounded hover:opacity-90 transition-opacity"
            >
              Export DES to Job
            </button>
          )}
        </div>
      </div>

      {/* Libraries */}
      <LibrarySection
        libraryFolder={libraryFolder}
        availableLibraryFiles={availableLibraryFiles}
        onLinkLibraryFolder={onLinkLibraryFolder}
        onLoadFromLibrary={onLoadFromLibrary}
      />

      {/* 3D Models */}
      <div className="p-4 border-b border-gray-800">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)] mb-3 border-b border-[var(--accent)] pb-1">
          3D Models
        </h2>
        <div className="space-y-2">
          <button
            onClick={onLinkSketchUpFolder}
            className="w-full text-xs px-3 py-2 bg-gray-800 rounded border border-[var(--accent)] hover:bg-gray-700 transition-colors text-left"
          >
            {sketchUpFolder ? `SketchUp: ${sketchUpFolder.name}` : 'Link SketchUp Folder...'}
          </button>
          <button
            onClick={onLinkModelsFolder}
            className="w-full text-xs px-3 py-2 bg-gray-800 rounded border border-[var(--accent)] hover:bg-gray-700 transition-colors text-left"
          >
            {modelsFolder ? `GLB: ${modelsFolder.name}` : 'Link GLB Folder...'}
          </button>
          {sketchUpFolder && (
            <button
              onClick={onGenerateGlbScript}
              className="w-full text-xs px-3 py-2 bg-gray-800 rounded border border-[var(--accent)] hover:bg-gray-700 transition-colors text-left"
            >
              Generate SKP → GLB Script
            </button>
          )}
        </div>
      </div>

      {/* Create Room */}
      <div className="p-4 border-b border-gray-800">
        <CreateRoomPanel hasRoom={!!room} onCreateRoom={onCreateRoom} />
      </div>

      {/* Place Products */}
      {room && products.length > 0 && (
        <div className="p-4 border-b border-gray-800">
          <PlaceProductPanel
            standaloneProducts={products}
            roomProducts={room.products}
            walls={room.walls}
            joints={room.wallJoints}
            selectedWall={selectedWall}
            useInches={useInches}
            onPlaceProduct={onPlaceProduct}
            onUpdateProductDimension={onUpdateProductDimension}
            onRemoveProduct={onRemoveProduct}
          />
        </div>
      )}

      {/* Textures */}
      <div className="p-4 border-b border-gray-800">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)] mb-3 border-b border-[var(--accent)] pb-1">
          Textures
        </h2>
        <div className="space-y-2">
          <button
            onClick={onLinkTextureFolder}
            className="w-full text-xs px-3 py-2 bg-gray-800 rounded border border-[var(--accent)] hover:bg-gray-700 transition-colors text-left"
          >
            {textureFolder ? `Textures: ${textureFolder.name}` : 'Link Textures Folder...'}
          </button>
          {textureFolder && availableTextures.length > 0 && (
            <>
              <label className="text-xs text-gray-400">Product</label>
              <select
                value={selectedTexture ?? ''}
                onChange={(e) => onSelectTexture(e.target.value || null)}
                className="w-full text-xs px-3 py-2 bg-gray-800 rounded border border-[var(--accent)] text-blue-400"
              >
                <option value="">Auto (from DES)</option>
                {availableTextures.map((f) => (
                  <option key={f} value={f}>{f.replace(/\.\w+$/, '')}</option>
                ))}
              </select>
            </>
          )}
          {textureFolder && (
            <>
              <label className="text-xs text-gray-400">Wall</label>
              {Object.keys(singleDrawWallTextures).length > 0 ? (
                <>
                  <select
                    value={selectedWallType ?? ''}
                    onChange={(e) => onSetWallType(e.target.value || null)}
                    className="w-full text-xs px-3 py-2 bg-gray-800 rounded border border-[var(--accent)] text-blue-400"
                  >
                    <option value="">Select wall type...</option>
                    {Object.keys(singleDrawWallTextures).sort().map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  {selectedWallType && singleDrawWallTextures[selectedWallType] && (
                    <select
                      value={selectedWallTexture ?? ''}
                      onChange={(e) => onSelectWallTexture(e.target.value || null)}
                      className="w-full text-xs px-3 py-2 bg-gray-800 rounded border border-[var(--accent)] text-blue-400"
                    >
                      <option value="">No wall texture</option>
                      {singleDrawWallTextures[selectedWallType].map((f) => (
                        <option key={f} value={f}>{f.replace(/\.\w+$/, '')}</option>
                      ))}
                    </select>
                  )}
                </>
              ) : (
                <p className="text-xs text-gray-600 italic">No SingleDraw_Walls/ subfolder</p>
              )}
            </>
          )}
          {textureFolder && (
            <>
              <label className="text-xs text-gray-400">Floor</label>
              {Object.keys(singleDrawFloorTextures).length > 0 ? (
                <>
                  <select
                    value={selectedFloorType ?? ''}
                    onChange={(e) => onSetFloorType(e.target.value || null)}
                    className="w-full text-xs px-3 py-2 bg-gray-800 rounded border border-[var(--accent)] text-blue-400"
                  >
                    <option value="">Select floor type...</option>
                    {Object.keys(singleDrawFloorTextures).sort().map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                  {selectedFloorType && singleDrawFloorTextures[selectedFloorType] && (
                    <select
                      value={selectedFloorTexture ?? ''}
                      onChange={(e) => onSelectFloorTexture(e.target.value || null)}
                      className="w-full text-xs px-3 py-2 bg-gray-800 rounded border border-[var(--accent)] text-blue-400"
                    >
                      <option value="">No floor texture</option>
                      {singleDrawFloorTextures[selectedFloorType].map((f) => (
                        <option key={f} value={f}>{f.replace(/\.\w+$/, '')}</option>
                      ))}
                    </select>
                  )}
                </>
              ) : (
                <p className="text-xs text-gray-600 italic">No SingleDraw_Floor/ subfolder</p>
              )}
            </>
          )}
          {textureFolder && (
            <>
              <label className="text-xs text-gray-400">SingleDraw Textures</label>
              {Object.keys(singleDrawTextures).length > 0 ? (
                <>
                  <select
                    value={selectedSingleDrawBrand ?? ''}
                    onChange={(e) => onSetSingleDrawBrand(e.target.value || null)}
                    className="w-full text-xs px-3 py-2 bg-gray-800 rounded border border-[var(--accent)] text-blue-400"
                  >
                    <option value="">Select brand...</option>
                    {Object.keys(singleDrawTextures).sort().map((brand) => (
                      <option key={brand} value={brand}>{brand}</option>
                    ))}
                  </select>
                  {selectedSingleDrawBrand && singleDrawTextures[selectedSingleDrawBrand] && (
                    <select
                      value={selectedSingleDrawTexture ?? ''}
                      onChange={(e) => onSetSingleDrawTexture(e.target.value || null)}
                      className="w-full text-xs px-3 py-2 bg-gray-800 rounded border border-[var(--accent)] text-blue-400"
                    >
                      <option value="">No texture</option>
                      {singleDrawTextures[selectedSingleDrawBrand].map((f) => (
                        <option key={f} value={f}>{f.replace(/\.\w+$/, '')}</option>
                      ))}
                    </select>
                  )}
                </>
              ) : (
                <p className="text-xs text-gray-600 italic">No SingleDraw_Textures/ subfolder</p>
              )}
            </>
          )}
        </div>
      </div>

      {/* Render Mode + Debug Overlays */}
      <div className="p-4 border-b border-gray-800">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)] mb-3 border-b border-[var(--accent)] pb-1">
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
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)] mb-3 border-b border-[var(--accent)] pb-1">
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
              if (!wall) return <p className="text-[var(--accent)]">Selected: Wall {selectedWall}</p>
              return (
                <div className="mt-2 pt-2 border-t border-gray-800 text-[var(--accent)]">
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
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)] mb-3 border-b border-[var(--accent)] pb-1">
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
                <ProductPreview product={mf.product} />
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
          <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--accent)] mb-3 border-b border-[var(--accent)] pb-1">
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
