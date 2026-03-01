/**
 * Eyeball visibility toggle with expanding cone sub-menu.
 * Wall numbers drop straight down; category toggles fan diagonally bottom-right.
 */
import { useEffect, useRef } from 'react'
import type { Visibility, MozWall } from '../mozaik/types'

interface VisibilityMenuProps {
  open: boolean
  visibility: Visibility
  walls: MozWall[]
  onToggle: () => void
  onToggleVisibility: (key: 'allWalls' | 'floor' | 'products' | 'inserts') => void
  onToggleWall: (wallNumber: number) => void
  onHoverWall: (wallNumber: number | null) => void
}

const ORBIT_ITEMS: { key: 'allWalls' | 'floor' | 'products' | 'inserts'; label: string }[] = [
  { key: 'allWalls', label: 'All Walls' },
  { key: 'floor', label: 'Floor' },
  { key: 'products', label: 'Products' },
  { key: 'inserts', label: 'Inserts' },
]

function EyeIcon({ active }: { active: boolean }) {
  const c = active ? 'var(--accent)' : '#aaa'
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path
        d="M1.5 10S5 4.5 10 4.5 18.5 10 18.5 10 15 15.5 10 15.5 1.5 10 1.5 10z"
        stroke={c} strokeWidth="1.5" fill="none"
      />
      <circle cx="10" cy="10" r="2.8" fill={active ? 'var(--accent)' : '#888'} />
    </svg>
  )
}

/** Small SVG icons for each orbit category. */
function OrbitIcon({ category, on }: { category: string; on: boolean }) {
  const c = on ? 'var(--accent)' : '#888'
  switch (category) {
    case 'allWalls':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="2" y="2" width="12" height="12" stroke={c} strokeWidth="1.5" fill="none" />
          <line x1="2" y1="8" x2="14" y2="8" stroke={c} strokeWidth="1" />
        </svg>
      )
    case 'floor':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <path d="M2 12L8 6l6 6H2z" stroke={c} strokeWidth="1.5" fill="none" />
          <line x1="2" y1="12" x2="14" y2="12" stroke={c} strokeWidth="1.5" />
        </svg>
      )
    case 'products':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="3" y="5" width="10" height="8" stroke={c} strokeWidth="1.5" fill="none" />
          <line x1="3" y1="9" x2="13" y2="9" stroke={c} strokeWidth="1" />
          <line x1="8" y1="5" x2="8" y2="9" stroke={c} strokeWidth="1" />
        </svg>
      )
    case 'inserts':
      return (
        <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
          <rect x="4" y="3" width="8" height="10" rx="1" stroke={c} strokeWidth="1.5" fill="none" />
          <circle cx="8" cy="8" r="2" stroke={c} strokeWidth="1" fill="none" />
        </svg>
      )
    default:
      return null
  }
}

export default function VisibilityMenu({
  open, visibility, walls, onToggle, onToggleVisibility, onToggleWall, onHoverWall,
}: VisibilityMenuProps) {
  const containerRef = useRef<HTMLDivElement>(null)

  // Click-outside to close
  useEffect(() => {
    if (!open) return
    const handler = (e: PointerEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        onToggle()
      }
    }
    document.addEventListener('pointerdown', handler)
    return () => document.removeEventListener('pointerdown', handler)
  }, [open, onToggle])

  return (
    <div ref={containerRef} className="relative">
      {/* Eyeball toggle button */}
      <button
        onClick={onToggle}
        title="Toggle visibility"
        className="w-10 h-10 rounded-full flex items-center justify-center transition-all"
        style={{
          background: open ? 'var(--bg-panel)' : '#1e1e1e',
          border: `2px solid ${open ? 'var(--accent)' : '#555'}`,
        }}
      >
        <EyeIcon active={open} />
      </button>

      {/* Cone sub-menu */}
      {open && (
        <>
          {/* Wall number column — straight down */}
          {walls.map((w, i) => {
            const isVis = visibility.walls[w.wallNumber] !== false
            return (
              <button
                key={`w-${w.wallNumber}`}
                onClick={() => onToggleWall(w.wallNumber)}
                onPointerEnter={() => onHoverWall(w.wallNumber)}
                onPointerLeave={() => onHoverWall(null)}
                title={`Wall ${w.wallNumber}`}
                className="absolute flex items-center justify-center rounded-full transition-all"
                style={{
                  width: 28, height: 28,
                  top: 48 + i * 36, left: 6,
                  background: '#1e1e1e',
                  border: `2px solid ${isVis ? 'var(--accent)' : '#555'}`,
                  color: isVis ? 'var(--accent)' : '#888',
                  fontSize: 13, fontWeight: 700,
                  opacity: 0,
                  transform: 'scale(0.5)',
                  animation: `visMenuIn 150ms ${i * 30}ms forwards`,
                }}
              >
                {w.wallNumber}
              </button>
            )
          })}

          {/* Orbit items — diagonal to bottom-right */}
          {ORBIT_ITEMS.map((item, i) => {
            const isVis = visibility[item.key]
            return (
              <button
                key={item.key}
                onClick={() => onToggleVisibility(item.key)}
                title={item.label}
                className="absolute flex items-center justify-center rounded-full transition-all"
                style={{
                  width: 28, height: 28,
                  top: 42 + i * 36, left: 42 + i * 36,
                  background: '#1e1e1e',
                  border: `2px solid ${isVis ? 'var(--accent)' : '#555'}`,
                  opacity: 0,
                  transform: 'scale(0.5)',
                  animation: `visMenuIn 150ms ${(walls.length + i) * 30}ms forwards`,
                }}
              >
                <OrbitIcon category={item.key} on={isVis} />
              </button>
            )
          })}

          {/* Tooltip labels for orbit items */}
          {ORBIT_ITEMS.map((item, i) => {
            const isVis = visibility[item.key]
            return (
              <span
                key={`lbl-${item.key}`}
                className="absolute pointer-events-none whitespace-nowrap"
                style={{
                  top: 48 + i * 36, left: 42 + i * 36 + 34,
                  fontSize: 11, fontWeight: 600,
                  color: isVis ? 'var(--accent)' : '#888',
                  opacity: 0,
                  animation: `visMenuIn 150ms ${(walls.length + i) * 30}ms forwards`,
                }}
              >
                {item.label}
              </span>
            )
          })}
        </>
      )}

      {/* Keyframe animation injected once */}
      <style>{`
        @keyframes visMenuIn {
          from { opacity: 0; transform: scale(0.5); }
          to   { opacity: 1; transform: scale(1); }
        }
      `}</style>
    </div>
  )
}
