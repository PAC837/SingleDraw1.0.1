/**
 * Viewer toolbar button for toggling wall editor (plan view).
 * Click once = plan view (green), click again = 3D (gray).
 */

interface WallEditorButtonProps {
  active: boolean
  disabled: boolean
  onToggle: () => void
}

export default function WallEditorButton({ active, disabled, onToggle }: WallEditorButtonProps) {
  return (
    <div className="absolute top-3 left-3 z-10">
      <button
        onClick={onToggle}
        disabled={disabled}
        title={active ? 'Back to 3D view' : 'Wall editor (plan view)'}
        className="w-10 h-10 rounded-full flex items-center justify-center transition-all"
        style={{
          background: active ? 'var(--bg-panel)' : '#1e1e1e',
          border: `2px solid ${active ? 'var(--accent)' : '#555'}`,
          opacity: disabled ? 0.3 : 1,
          cursor: disabled ? 'not-allowed' : 'pointer',
        }}
      >
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
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
      </button>
    </div>
  )
}
