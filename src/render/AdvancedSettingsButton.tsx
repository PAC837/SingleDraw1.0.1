/**
 * Toolbar button + dropdown for advanced settings.
 * Currently contains: Flip Ops toggle.
 */
import { useEffect, useRef } from 'react'

interface AdvancedSettingsButtonProps {
  open: boolean
  flipOps: boolean
  onToggle: () => void
  onToggleFlipOps: () => void
  onAlignWallTops: () => void
}

export default function AdvancedSettingsButton({
  open, flipOps, onToggle, onToggleFlipOps, onAlignWallTops,
}: AdvancedSettingsButtonProps) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: PointerEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onToggle()
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [open, onToggle])

  const c = open ? 'var(--accent)' : '#aaa'

  return (
    <div ref={ref} className="relative">
      <button
        onClick={onToggle}
        title="Advanced settings"
        className="w-16 h-16 rounded-full flex items-center justify-center transition-all"
        style={{
          background: open ? 'var(--bg-panel)' : '#1e1e1e',
          border: `2px solid ${open ? 'var(--accent)' : '#555'}`,
        }}
      >
        {/* Sliders / tune icon */}
        <svg width="40" height="40" viewBox="0 0 20 20" fill="none">
          <line x1="4" y1="5" x2="16" y2="5" stroke={c} strokeWidth="1.3" />
          <line x1="4" y1="10" x2="16" y2="10" stroke={c} strokeWidth="1.3" />
          <line x1="4" y1="15" x2="16" y2="15" stroke={c} strokeWidth="1.3" />
          <circle cx="8" cy="5" r="2" fill="#1e1e1e" stroke={c} strokeWidth="1.3" />
          <circle cx="13" cy="10" r="2" fill="#1e1e1e" stroke={c} strokeWidth="1.3" />
          <circle cx="7" cy="15" r="2" fill="#1e1e1e" stroke={c} strokeWidth="1.3" />
        </svg>
      </button>

      {open && (
        <div
          className="absolute top-[72px] left-0 z-20 rounded-lg p-3 space-y-2"
          style={{ background: '#1e1e1e', border: '1px solid var(--accent)', minWidth: 180 }}
        >
          <label className="text-[10px] text-gray-400 uppercase tracking-wider">Advanced</label>

          {/* Flip Ops toggle */}
          <button
            onClick={onToggleFlipOps}
            className="w-full flex items-center justify-between text-xs px-2 py-1.5 rounded transition-colors"
            style={{
              background: flipOps ? 'var(--accent)' : '#333',
              color: flipOps ? '#000' : '#aaa',
            }}
          >
            <span className="font-medium">Flip Ops</span>
            <span className="text-[10px] opacity-70">{flipOps ? 'ON' : 'OFF'}</span>
          </button>
          <p className="text-[9px] text-gray-500 leading-tight">
            Tops-aligned sections share a panel even at different heights
          </p>

          {/* Align Wall Tops — one-shot action */}
          <button
            onClick={onAlignWallTops}
            className="w-full flex items-center justify-between text-xs px-2 py-1.5 rounded transition-colors"
            style={{ background: '#333', color: '#aaa' }}
          >
            <span className="font-medium">Align Wall Tops</span>
            <span className="text-[10px] opacity-70">&#x25B6;</span>
          </button>
          <p className="text-[9px] text-gray-500 leading-tight">
            Snap wall cabinet tops to tallest floor cabinet height on each wall
          </p>
        </div>
      )}
    </div>
  )
}
