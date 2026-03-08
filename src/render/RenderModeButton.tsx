/**
 * Toolbar button that cycles render mode: ghosted → solid → wireframe.
 * Each mode has a distinct SVG icon.
 */

import type { RenderMode } from '../mozaik/types'
import ToolbarButton from '../ui/ToolbarButton'

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
export function GhostIcon({ color, size = 40 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <path
        d="M6 21V12a6 6 0 0112 0v9l-2.5-2.5L13.5 21 12 19l-1.5 2L8.5 18.5 6 21z"
        stroke={color} strokeWidth="1.6" fill="none" strokeLinejoin="round"
      />
      <circle cx="9.5" cy="12" r="1.5" fill={color} />
      <circle cx="14.5" cy="12" r="1.5" fill={color} />
    </svg>
  )
}

/** Brick wall — stacked offset rectangles. */
export function BrickIcon({ color, size = 40 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      <rect x="2" y="4" width="9" height="5" stroke={color} strokeWidth="1.4" />
      <rect x="11" y="4" width="11" height="5" stroke={color} strokeWidth="1.4" />
      <rect x="2" y="9" width="11" height="5" stroke={color} strokeWidth="1.4" />
      <rect x="13" y="9" width="9" height="5" stroke={color} strokeWidth="1.4" />
      <rect x="2" y="14" width="9" height="5" stroke={color} strokeWidth="1.4" />
      <rect x="11" y="14" width="11" height="5" stroke={color} strokeWidth="1.4" />
    </svg>
  )
}

/** Wireframe cube outline. */
export function WireframeIcon({ color, size = 40 }: { color: string; size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none">
      {/* Front face */}
      <rect x="3" y="8" width="12" height="12" stroke={color} strokeWidth="1.4" />
      {/* Back face (offset) */}
      <rect x="9" y="3" width="12" height="12" stroke={color} strokeWidth="1.4" />
      {/* Depth edges */}
      <line x1="3" y1="8" x2="9" y2="3" stroke={color} strokeWidth="1.4" />
      <line x1="15" y1="8" x2="21" y2="3" stroke={color} strokeWidth="1.4" />
      <line x1="15" y1="20" x2="21" y2="15" stroke={color} strokeWidth="1.4" />
      <line x1="3" y1="20" x2="9" y2="15" stroke={color} strokeWidth="1.4" />
    </svg>
  )
}

export function ModeIcon({ mode, color, size }: { mode: RenderMode; color: string; size?: number }) {
  switch (mode) {
    case 'ghosted': return <GhostIcon color={color} size={size} />
    case 'solid': return <BrickIcon color={color} size={size} />
    case 'wireframe': return <WireframeIcon color={color} size={size} />
  }
}

export default function RenderModeButton({ mode, onCycle }: RenderModeButtonProps) {
  return (
    <ToolbarButton active={true} title={LABELS[mode]} onClick={onCycle}>
      <ModeIcon mode={mode} color="var(--accent)" />
    </ToolbarButton>
  )
}
