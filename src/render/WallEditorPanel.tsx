/**
 * Floating overlay for editing wall properties in plan view.
 * Shows length, height inputs, wall split, and fixture add buttons.
 */

import { useState, useEffect } from 'react'
import type { MozWall, MozFixture } from '../mozaik/types'
import { formatDim, mmToInches, inchesToMm } from '../math/units'

type FixtureType = 'opening' | 'door' | 'double_door' | 'window'

interface WallEditorPanelProps {
  wall: MozWall
  useInches: boolean
  hasTallerNeighbor: boolean
  fixtures: MozFixture[]
  onUpdateLength: (len: number) => void
  onUpdateHeight: (height: number) => void
  onSplitWall: () => void
  onToggleFollowAngle: () => void
  onAddFixture: (fixture: MozFixture) => void
  onRemoveFixture: (idTag: number) => void
  nextIdTag: number
}

const DEFAULTS: Record<FixtureType, { width: number; height: number; elev: number }> = {
  opening:     { width: 914.4, height: 2032, elev: 0 },       // 36" × 80"
  door:        { width: 914.4, height: 2032, elev: 0 },       // 36" × 80"
  double_door: { width: 1219.2, height: 2032, elev: 0 },      // 48" × 80"
  window:      { width: 914.4, height: 1219.2, elev: 1066.8 }, // 36" × 48", 42" elev
}

export default function WallEditorPanel({
  wall, useInches, hasTallerNeighbor, fixtures,
  onUpdateLength, onUpdateHeight, onSplitWall, onToggleFollowAngle,
  onAddFixture, onRemoveFixture, nextIdTag,
}: WallEditorPanelProps) {
  const display = (mm: number) => useInches ? mmToInches(mm).toFixed(2) : String(mm)

  const [lenStr, setLenStr] = useState(display(wall.len))
  const [heightStr, setHeightStr] = useState(display(wall.height))

  // Fixture form state
  const [activeForm, setActiveForm] = useState<FixtureType | null>(null)
  const [fWidth, setFWidth] = useState('')
  const [fHeight, setFHeight] = useState('')
  const [fElev, setFElev] = useState('')
  const [fCentered, setFCentered] = useState(true)
  const [fDistLeft, setFDistLeft] = useState('')

  // Sync when selected wall or unit mode changes
  useEffect(() => {
    setLenStr(display(wall.len))
    setHeightStr(display(wall.height))
    setActiveForm(null)
  }, [wall.wallNumber, wall.len, wall.height, useInches])

  const openForm = (type: FixtureType) => {
    if (activeForm === type) { setActiveForm(null); return }
    setActiveForm(type)
    const d = DEFAULTS[type]
    setFWidth(display(d.width))
    setFHeight(display(d.height))
    setFElev(display(d.elev))
    setFCentered(true)
    setFDistLeft(display(0))
  }

  const commitLength = () => {
    const v = parseFloat(lenStr)
    if (isNaN(v) || v <= 0) { setLenStr(display(wall.len)); return }
    const mm = useInches ? inchesToMm(v) : v
    if (mm !== wall.len) onUpdateLength(mm)
    else setLenStr(display(wall.len))
  }

  const commitHeight = () => {
    const v = parseFloat(heightStr)
    if (isNaN(v) || v <= 0) { setHeightStr(display(wall.height)); return }
    const mm = useInches ? inchesToMm(v) : v
    if (mm !== wall.height) onUpdateHeight(mm)
    else setHeightStr(display(wall.height))
  }

  const commitFixture = () => {
    if (!activeForm) return
    const w = useInches ? inchesToMm(parseFloat(fWidth)) : parseFloat(fWidth)
    const h = useInches ? inchesToMm(parseFloat(fHeight)) : parseFloat(fHeight)
    const e = activeForm === 'window' ? (useInches ? inchesToMm(parseFloat(fElev)) : parseFloat(fElev)) : 0
    if (isNaN(w) || isNaN(h) || w <= 0 || h <= 0) return
    if (activeForm === 'window' && (isNaN(e) || e < 0)) return

    let x: number
    if (fCentered) {
      x = (wall.len - w) / 2
    } else {
      x = useInches ? inchesToMm(parseFloat(fDistLeft)) : parseFloat(fDistLeft)
      if (isNaN(x) || x < 0) return
    }

    const nameMap: Record<FixtureType, string> = { opening: 'Opening', door: 'Door', double_door: 'DoubleDoor', window: 'Window' }
    const fixture: MozFixture = {
      name: nameMap[activeForm],
      idTag: nextIdTag,
      type: activeForm === 'window' ? 6 : 7,
      subType: activeForm === 'opening' ? 2 : activeForm === 'double_door' ? 1 : 0,
      wall: wall.wallNumber,
      onWallFront: true,
      width: w,
      height: h,
      depth: activeForm === 'door' || activeForm === 'double_door' ? 101.6 : 50.8,
      x,
      elev: e,
      rot: 0,
    }
    onAddFixture(fixture)
    setActiveForm(null)
  }

  const unit = useInches ? 'in' : 'mm'
  const inputCls = 'flex-1 text-xs px-2 py-1 bg-gray-800 rounded border border-[var(--accent)] text-white'
  const btnCls = 'text-xs px-3 py-1.5 rounded border border-[var(--accent)] bg-gray-800 hover:bg-gray-700 transition-colors'

  return (
    <div
      className="absolute top-14 left-3 z-10 w-56 rounded-lg p-3 space-y-2 shadow-lg overflow-y-auto"
      style={{ background: 'var(--bg-panel)', border: '1px solid #333', maxHeight: 'calc(100vh - 80px)' }}
    >
      <div className="text-xs font-semibold text-[var(--accent)] border-b border-[var(--accent)] pb-1 mb-1">
        Wall {wall.wallNumber}
      </div>

      <label className="block">
        <span className="text-xs text-[var(--text-secondary)]">Length ({unit})</span>
        <div className="flex items-center gap-1 mt-1">
          <input type="number" value={lenStr} onChange={e => setLenStr(e.target.value)}
            onBlur={commitLength} onKeyDown={e => e.key === 'Enter' && commitLength()} className={inputCls} />
          <span className="text-xs text-[var(--text-secondary)] w-16 text-right">{formatDim(wall.len, useInches)}</span>
        </div>
      </label>

      <label className="block">
        <span className="text-xs text-[var(--text-secondary)]">Height ({unit})</span>
        <div className="flex items-center gap-1 mt-1">
          <input type="number" value={heightStr} onChange={e => setHeightStr(e.target.value)}
            onBlur={commitHeight} onKeyDown={e => e.key === 'Enter' && commitHeight()} className={inputCls} />
          <span className="text-xs text-[var(--text-secondary)] w-16 text-right">{formatDim(wall.height, useInches)}</span>
        </div>
      </label>

      <button
        onClick={onToggleFollowAngle}
        disabled={!hasTallerNeighbor && !wall.followAngle}
        className={`w-full text-xs px-3 py-1.5 rounded border transition-colors ${
          wall.followAngle
            ? 'bg-[var(--accent)] text-black font-medium border-[var(--accent)]'
            : hasTallerNeighbor
              ? 'bg-gray-800 border-[var(--accent)] hover:bg-gray-700'
              : 'bg-gray-800 border-gray-600 text-gray-500 cursor-not-allowed'
        }`}
      >
        {wall.followAngle ? 'Follow Angle: ON' : 'Follow Angle'}
      </button>

      <div className="text-xs text-[var(--text-secondary)]">
        Angle: {wall.ang}&deg; &nbsp;|&nbsp; Thick: {formatDim(wall.thickness, useInches)}
      </div>

      <button onClick={onSplitWall} className={`w-full ${btnCls} py-2`}>
        Add Wall (Split)
      </button>

      {/* Fixture buttons */}
      <div className="grid grid-cols-2 gap-1">
        {(['opening', 'door', 'double_door', 'window'] as FixtureType[]).map(t => (
          <button key={t} onClick={() => openForm(t)}
            className={`text-xs py-1.5 rounded border transition-colors ${
              activeForm === t ? 'bg-[var(--accent)] text-black font-medium border-[var(--accent)]'
                : 'bg-gray-800 border-gray-600 hover:border-[var(--accent)]'
            }`}
          >
            {t === 'opening' ? 'Opening' : t === 'door' ? 'Door' : t === 'double_door' ? 'Dbl Door' : 'Window'}
          </button>
        ))}
      </div>

      {/* Fixture form */}
      {activeForm && (
        <div className="space-y-1.5 p-2 rounded border border-gray-600" style={{ background: '#1a1a1a' }}>
          <div className="text-xs font-medium text-[var(--accent)]">
            Add {activeForm === 'opening' ? 'Opening' : activeForm === 'door' ? 'Door' : activeForm === 'double_door' ? 'Double Door' : 'Window'}
          </div>
          <label className="block">
            <span className="text-[10px] text-[var(--text-secondary)]">Width ({unit})</span>
            <input type="number" value={fWidth} onChange={e => setFWidth(e.target.value)} className={`w-full ${inputCls}`} />
          </label>
          <label className="block">
            <span className="text-[10px] text-[var(--text-secondary)]">Height ({unit})</span>
            <input type="number" value={fHeight} onChange={e => setFHeight(e.target.value)} className={`w-full ${inputCls}`} />
          </label>
          {activeForm === 'window' && (
            <label className="block">
              <span className="text-[10px] text-[var(--text-secondary)]">Elevation ({unit})</span>
              <input type="number" value={fElev} onChange={e => setFElev(e.target.value)} className={`w-full ${inputCls}`} />
            </label>
          )}
          <label className="flex items-center gap-2 text-xs">
            <input type="checkbox" checked={fCentered} onChange={e => setFCentered(e.target.checked)} />
            <span className="text-[var(--text-secondary)]">Centered on wall</span>
          </label>
          {!fCentered && (
            <label className="block">
              <span className="text-[10px] text-[var(--text-secondary)]">Distance from left ({unit})</span>
              <input type="number" value={fDistLeft} onChange={e => setFDistLeft(e.target.value)} className={`w-full ${inputCls}`} />
            </label>
          )}
          <button onClick={commitFixture} className={`w-full ${btnCls} py-1.5 mt-1`}>
            Add
          </button>
        </div>
      )}

      {/* Existing fixtures on this wall */}
      {fixtures.length > 0 && (
        <div className="space-y-1">
          <div className="text-[10px] text-[var(--text-secondary)] uppercase tracking-wide">Fixtures</div>
          {fixtures.map(f => (
            <div key={f.idTag} className="flex items-center justify-between text-xs px-1 py-0.5 rounded bg-gray-800">
              <span>{f.name} ({formatDim(f.width, useInches)})</span>
              <button onClick={() => onRemoveFixture(f.idTag)}
                className="text-red-400 hover:text-red-300 text-[10px] font-bold px-1">X</button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
