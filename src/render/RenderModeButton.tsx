/**
 * Toolbar button that cycles render mode: ghosted → solid → wireframe.
 * Each mode has a distinct SVG icon.
 */

import type { RenderMode } from '../mozaik/types'

interface RenderModeButtonProps {
  mode: RenderMode
  onCycle: () => void
}

const LABELS: Record<RenderMode, string> = {
  ghosted: 'Render: Ghosted',
  solid: 'Render: Solid',
  wireframe: 'Render: Wireframe',
}

/** Ghost silhouette — rounded top + wavy bottom + two eyes. */
function GhostIcon({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <path
        d="M5 18V10a5 5 0 0110 0v8l-2-2-1.5 2L10 16l-1.5 2L7 16l-2 2z"
        stroke={color} strokeWidth="1.5" fill="none" strokeLinejoin="round"
      />
      <circle cx="8" cy="10" r="1.2" fill={color} />
      <circle cx="12" cy="10" r="1.2" fill={color} />
    </svg>
  )
}

/** Brick wall — stacked offset rectangles. */
function BrickIcon({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      <rect x="2" y="4" width="7" height="4" stroke={color} strokeWidth="1.3" />
      <rect x="9" y="4" width="9" height="4" stroke={color} strokeWidth="1.3" />
      <rect x="2" y="8" width="9" height="4" stroke={color} strokeWidth="1.3" />
      <rect x="11" y="8" width="7" height="4" stroke={color} strokeWidth="1.3" />
      <rect x="2" y="12" width="7" height="4" stroke={color} strokeWidth="1.3" />
      <rect x="9" y="12" width="9" height="4" stroke={color} strokeWidth="1.3" />
    </svg>
  )
}

/** Wireframe cube outline. */
function WireframeIcon({ color }: { color: string }) {
  return (
    <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
      {/* Front face */}
      <rect x="4" y="7" width="9" height="9" stroke={color} strokeWidth="1.3" />
      {/* Back face (offset) */}
      <rect x="7" y="4" width="9" height="9" stroke={color} strokeWidth="1.3" />
      {/* Depth edges */}
      <line x1="4" y1="7" x2="7" y2="4" stroke={color} strokeWidth="1.3" />
      <line x1="13" y1="7" x2="16" y2="4" stroke={color} strokeWidth="1.3" />
      <line x1="13" y1="16" x2="16" y2="13" stroke={color} strokeWidth="1.3" />
      <line x1="4" y1="16" x2="7" y2="13" stroke={color} strokeWidth="1.3" />
    </svg>
  )
}

function ModeIcon({ mode, color }: { mode: RenderMode; color: string }) {
  switch (mode) {
    case 'ghosted': return <GhostIcon color={color} />
    case 'solid': return <BrickIcon color={color} />
    case 'wireframe': return <WireframeIcon color={color} />
  }
}

export default function RenderModeButton({ mode, onCycle }: RenderModeButtonProps) {
  const c = 'var(--accent)'
  return (
    <button
      onClick={onCycle}
      title={LABELS[mode]}
      className="w-10 h-10 rounded-full flex items-center justify-center transition-all"
      style={{
        background: 'var(--bg-panel)',
        border: `2px solid ${c}`,
      }}
    >
      <ModeIcon mode={mode} color={c} />
    </button>
  )
}
