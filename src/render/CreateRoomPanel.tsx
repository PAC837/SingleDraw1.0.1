import { useState } from 'react'

interface CreateRoomPanelProps {
  hasRoom: boolean
  onCreateRoom: (width: number, depth: number) => void
}

export default function CreateRoomPanel({ hasRoom, onCreateRoom }: CreateRoomPanelProps) {
  const [width, setWidth] = useState(3048)   // 10ft
  const [depth, setDepth] = useState(3048)   // 10ft

  const valid = width >= 304.8 && depth >= 304.8

  return (
    <>
      <h2 className="text-xs font-semibold uppercase tracking-wider text-[var(--text-secondary)] mb-3">
        Create Room
      </h2>
      <div className="space-y-2">
        <div className="flex gap-2">
          <label className="flex-1">
            <span className="text-xs text-[var(--text-secondary)]">Width (mm)</span>
            <input
              type="number"
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              className="w-full text-xs px-2 py-1 bg-gray-800 rounded border border-gray-700 text-white mt-1"
            />
          </label>
          <label className="flex-1">
            <span className="text-xs text-[var(--text-secondary)]">Depth (mm)</span>
            <input
              type="number"
              value={depth}
              onChange={(e) => setDepth(Number(e.target.value))}
              className="w-full text-xs px-2 py-1 bg-gray-800 rounded border border-gray-700 text-white mt-1"
            />
          </label>
        </div>
        {hasRoom && (
          <p className="text-xs text-orange-400">This will replace the current room</p>
        )}
        <button
          onClick={() => valid && onCreateRoom(width, depth)}
          disabled={!valid}
          className="w-full text-xs px-3 py-2 bg-[var(--yellow)] text-black font-medium rounded hover:opacity-90 transition-opacity disabled:opacity-40"
        >
          Create Room
        </button>
      </div>
    </>
  )
}
