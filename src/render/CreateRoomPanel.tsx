import { useState } from 'react'
import SectionHeader from '../ui/SectionHeader'
import Input from '../ui/Input'
import Button from '../ui/Button'

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
      <SectionHeader>Create Room</SectionHeader>
      <div className="space-y-2">
        <div className="flex gap-2">
          <label className="flex-1">
            <span className="text-xs text-[var(--text-secondary)]">Width (mm)</span>
            <Input
              type="number"
              value={width}
              onChange={(e) => setWidth(Number(e.target.value))}
              className="w-full mt-1"
            />
          </label>
          <label className="flex-1">
            <span className="text-xs text-[var(--text-secondary)]">Depth (mm)</span>
            <Input
              type="number"
              value={depth}
              onChange={(e) => setDepth(Number(e.target.value))}
              className="w-full mt-1"
            />
          </label>
        </div>
        {hasRoom && (
          <p className="text-xs text-orange-400">This will replace the current room</p>
        )}
        <Button
          variant="primary"
          onClick={() => valid && onCreateRoom(width, depth)}
          disabled={!valid}
          className="w-full disabled:opacity-40"
        >
          Create Room
        </Button>
      </div>
    </>
  )
}
