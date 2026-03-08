/**
 * Toolbar button to toggle the admin/library manager panel.
 */
import ToolbarButton from '../ui/ToolbarButton'

interface AdminButtonProps {
  open: boolean
  onToggle: () => void
}

export default function AdminButton({ open, onToggle }: AdminButtonProps) {
  const c = open ? 'var(--accent)' : '#aaa'

  return (
    <ToolbarButton active={open} title="Library Manager" onClick={onToggle}>
      {/* Database/grid icon */}
      <svg width="40" height="40" viewBox="0 0 24 24" fill="none">
        <ellipse cx="12" cy="6" rx="8" ry="3" stroke={c} strokeWidth="1.5" />
        <path d="M4 6v4c0 1.66 3.58 3 8 3s8-1.34 8-3V6" stroke={c} strokeWidth="1.5" />
        <path d="M4 10v4c0 1.66 3.58 3 8 3s8-1.34 8-3v-4" stroke={c} strokeWidth="1.5" />
        <path d="M4 14v4c0 1.66 3.58 3 8 3s8-1.34 8-3v-4" stroke={c} strokeWidth="1.5" />
      </svg>
    </ToolbarButton>
  )
}
