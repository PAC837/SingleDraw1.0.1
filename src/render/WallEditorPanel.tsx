/**
 * Floating overlay for editing wall properties in plan view.
 * Shows length, height inputs and an "Add Wall" split button.
 */

import { useState, useEffect } from 'react'
import type { MozWall } from '../mozaik/types'
import { formatDim, mmToInches, inchesToMm } from '../math/units'

interface WallEditorPanelProps {
  wall: MozWall
  useInches: boolean
  hasTallerNeighbor: boolean
  leftJoined: boolean
  rightJoined: boolean
  onUpdateLength: (len: number) => void
  onUpdateHeight: (height: number) => void
  onSplitWall: () => void
  onToggleFollowAngle: () => void
  onToggleLeftCorner: () => void
  onToggleRightCorner: () => void
}

export default function WallEditorPanel({ wall, useInches, hasTallerNeighbor, leftJoined, rightJoined, onUpdateLength, onUpdateHeight, onSplitWall, onToggleFollowAngle, onToggleLeftCorner, onToggleRightCorner }: WallEditorPanelProps) {
  const display = (mm: number) => useInches ? mmToInches(mm).toFixed(2) : String(mm)

  const [lenStr, setLenStr] = useState(display(wall.len))
  const [heightStr, setHeightStr] = useState(display(wall.height))

  // Sync when selected wall or unit mode changes
  useEffect(() => {
    setLenStr(display(wall.len))
    setHeightStr(display(wall.height))
  }, [wall.wallNumber, wall.len, wall.height, useInches])

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

  return (
    <div
      className="absolute top-14 left-3 z-10 w-56 rounded-lg p-3 space-y-2 shadow-lg"
      style={{ background: 'var(--bg-panel)', border: '1px solid #333' }}
    >
      <div className="text-xs font-semibold text-[var(--accent)] border-b border-[var(--accent)] pb-1 mb-1">
        Wall {wall.wallNumber}
      </div>

      <label className="block">
        <span className="text-xs text-[var(--text-secondary)]">Length ({useInches ? 'in' : 'mm'})</span>
        <div className="flex items-center gap-1 mt-1">
          <input
            type="number"
            value={lenStr}
            onChange={e => setLenStr(e.target.value)}
            onBlur={commitLength}
            onKeyDown={e => e.key === 'Enter' && commitLength()}
            className="flex-1 text-xs px-2 py-1 bg-gray-800 rounded border border-[var(--accent)] text-white"
          />
          <span className="text-xs text-[var(--text-secondary)] w-16 text-right">{formatDim(wall.len, useInches)}</span>
        </div>
      </label>

      <label className="block">
        <span className="text-xs text-[var(--text-secondary)]">Height ({useInches ? 'in' : 'mm'})</span>
        <div className="flex items-center gap-1 mt-1">
          <input
            type="number"
            value={heightStr}
            onChange={e => setHeightStr(e.target.value)}
            onBlur={commitHeight}
            onKeyDown={e => e.key === 'Enter' && commitHeight()}
            className="flex-1 text-xs px-2 py-1 bg-gray-800 rounded border border-[var(--accent)] text-white"
          />
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

      <div className="flex gap-1">
        <button
          onClick={onToggleLeftCorner}
          className={`flex-1 text-xs px-2 py-1.5 rounded border transition-colors ${
            leftJoined
              ? 'bg-blue-900/50 border-blue-500 text-blue-300'
              : 'bg-gray-800 border-gray-600 text-gray-400 hover:bg-gray-700'
          }`}
        >
          L: {leftJoined ? 'Joined' : 'Unjoined'}
        </button>
        <button
          onClick={onToggleRightCorner}
          className={`flex-1 text-xs px-2 py-1.5 rounded border transition-colors ${
            rightJoined
              ? 'bg-blue-900/50 border-blue-500 text-blue-300'
              : 'bg-gray-800 border-gray-600 text-gray-400 hover:bg-gray-700'
          }`}
        >
          R: {rightJoined ? 'Joined' : 'Unjoined'}
        </button>
      </div>

      <div className="text-xs text-[var(--text-secondary)]">
        Angle: {wall.ang}° &nbsp;|&nbsp; Thick: {formatDim(wall.thickness, useInches)}
      </div>

      <button
        onClick={onSplitWall}
        className="w-full text-xs px-3 py-2 bg-gray-800 rounded border border-[var(--accent)] hover:bg-gray-700 transition-colors"
      >
        Add Wall (Split)
      </button>
    </div>
  )
}
