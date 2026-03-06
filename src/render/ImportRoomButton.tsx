/**
 * Toolbar button that opens a file picker for importing RoomPlan JSON scans.
 * Parses the JSON into a MozRoom and calls onImportRoom.
 */

import { useRef } from 'react'
import type { MozRoom } from '../mozaik/types'
import { importRoomPlanJSON } from '../mozaik/roomPlanImporter'

interface ImportRoomButtonProps {
  onImportRoom: (room: MozRoom) => void
}

export default function ImportRoomButton({ onImportRoom }: ImportRoomButtonProps) {
  const fileInputRef = useRef<HTMLInputElement>(null)

  const handleFile = async (file: File) => {
    const text = await file.text()
    try {
      const room = importRoomPlanJSON(text)
      onImportRoom(room)
      console.log(`[IMPORT] RoomPlan: ${room.walls.length} walls, ${room.fixtures.length} fixtures`)
    } catch (err) {
      alert('Failed to parse RoomPlan JSON: ' + (err as Error).message)
    }
  }

  return (
    <>
      <input
        ref={fileInputRef}
        type="file"
        accept=".json"
        style={{ display: 'none' }}
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleFile(f)
          e.target.value = '' // reset so same file can be re-imported
        }}
      />
      <button
        onClick={() => fileInputRef.current?.click()}
        title="Import RoomPlan scan"
        className="w-16 h-16 rounded-full flex items-center justify-center transition-all"
        style={{ background: '#1e1e1e', border: '2px solid #555' }}
      >
        {/* LiDAR / scan crosshair icon */}
        <svg width="40" height="40" viewBox="0 0 20 20" fill="none">
          <path d="M10 2v4M10 14v4M2 10h4M14 10h4" stroke="#aaa" strokeWidth="1.5" strokeLinecap="round" />
          <circle cx="10" cy="10" r="3" stroke="#aaa" strokeWidth="1.5" fill="none" />
        </svg>
      </button>
    </>
  )
}
