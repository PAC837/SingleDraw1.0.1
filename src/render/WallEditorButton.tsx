/**
 * Viewer toolbar button for toggling wall editor (plan view).
 * Click once = plan view (green), click again = 3D (gray).
 */
import ToolbarButton from '../ui/ToolbarButton'

interface WallEditorButtonProps {
  active: boolean
  disabled: boolean
  onToggle: () => void
}

export default function WallEditorButton({ active, disabled, onToggle }: WallEditorButtonProps) {
  return (
    <ToolbarButton active={active} disabled={disabled} title={active ? 'Back to 3D view' : 'Wall editor (plan view)'} onClick={onToggle}>
      <svg width="40" height="40" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
        <rect
          x="3" y="3" width="14" height="14"
          stroke={active ? 'var(--accent)' : '#aaa'}
          strokeWidth="2"
          fill="none"
        />
        <circle cx="3" cy="3" r="1.5" fill={active ? 'var(--accent)' : '#888'} />
        <circle cx="17" cy="3" r="1.5" fill={active ? 'var(--accent)' : '#888'} />
        <circle cx="17" cy="17" r="1.5" fill={active ? 'var(--accent)' : '#888'} />
        <circle cx="3" cy="17" r="1.5" fill={active ? 'var(--accent)' : '#888'} />
      </svg>
    </ToolbarButton>
  )
}
