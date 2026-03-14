/**
 * Toolbar button + dropdown for advanced settings.
 * Currently contains: Flip Ops toggle.
 */
import { useEffect, useRef } from 'react'
import ToolbarButton from '../ui/ToolbarButton'
import FloatingPanel from '../ui/FloatingPanel'

interface AdvancedSettingsButtonProps {
  open: boolean
  flipOps: boolean
  showOperations: boolean
  showShapeDebug: boolean
  spinning3DCards: boolean
  onToggle: () => void
  onToggleFlipOps: () => void
  onToggleShowOps: () => void
  onToggleShapeDebug: () => void
  onToggleSpinning3DCards: () => void
  onAlignWallTops: () => void
}

export default function AdvancedSettingsButton({
  open, flipOps, showOperations, showShapeDebug, spinning3DCards, onToggle, onToggleFlipOps, onToggleShowOps, onToggleShapeDebug, onToggleSpinning3DCards, onAlignWallTops,
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
      <ToolbarButton active={open} title="Advanced settings" onClick={onToggle}>
        {/* Sliders / tune icon */}
        <svg width="40" height="40" viewBox="0 0 20 20" fill="none">
          <line x1="4" y1="5" x2="16" y2="5" stroke={c} strokeWidth="1.3" />
          <line x1="4" y1="10" x2="16" y2="10" stroke={c} strokeWidth="1.3" />
          <line x1="4" y1="15" x2="16" y2="15" stroke={c} strokeWidth="1.3" />
          <circle cx="8" cy="5" r="2" fill="#1e1e1e" stroke={c} strokeWidth="1.3" />
          <circle cx="13" cy="10" r="2" fill="#1e1e1e" stroke={c} strokeWidth="1.3" />
          <circle cx="7" cy="15" r="2" fill="#1e1e1e" stroke={c} strokeWidth="1.3" />
        </svg>
      </ToolbarButton>

      {open && (
        <FloatingPanel className="absolute top-[72px] left-0" style={{ minWidth: 180 }}>
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

          {/* Show Operations toggle */}
          <button
            onClick={onToggleShowOps}
            className="w-full flex items-center justify-between text-xs px-2 py-1.5 rounded transition-colors mt-1"
            style={{
              background: showOperations ? 'var(--accent)' : '#333',
              color: showOperations ? '#000' : '#aaa',
            }}
          >
            <span className="font-medium">Show Operations</span>
            <span className="text-[10px] opacity-70">{showOperations ? 'ON' : 'OFF'}</span>
          </button>
          <p className="text-[9px] text-gray-500 leading-tight">
            Display drill holes and shelf pins on parts
          </p>

          {/* Shape Debug overlay toggle */}
          <button
            onClick={onToggleShapeDebug}
            className="w-full flex items-center justify-between text-xs px-2 py-1.5 rounded transition-colors mt-1"
            style={{
              background: showShapeDebug ? 'var(--accent)' : '#333',
              color: showShapeDebug ? '#000' : '#aaa',
            }}
          >
            <span className="font-medium">Shape Debug</span>
            <span className="text-[10px] opacity-70">{showShapeDebug ? 'ON' : 'OFF'}</span>
          </button>
          <p className="text-[9px] text-gray-500 leading-tight">
            Show TopShape outline (green) vs part shapes (red) on selected CRN products
          </p>

          {/* 3D Cards toggle */}
          <button
            onClick={onToggleSpinning3DCards}
            className="w-full flex items-center justify-between text-xs px-2 py-1.5 rounded transition-colors mt-1"
            style={{
              background: spinning3DCards ? 'var(--accent)' : '#333',
              color: spinning3DCards ? '#000' : '#aaa',
            }}
          >
            <span className="font-medium">3D Cards</span>
            <span className="text-[10px] opacity-70">{spinning3DCards ? 'ON' : 'OFF'}</span>
          </button>
          <p className="text-[9px] text-gray-500 leading-tight">
            Show spinning 3D models in product cards instead of wireframe previews
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
        </FloatingPanel>
      )}
    </div>
  )
}
