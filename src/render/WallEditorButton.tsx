/**
 * Viewer toolbar buttons for toggling between wall editor (plan view) and 3D view.
 * Wall editor button always visible (when room loaded). 3D button only visible in editor mode.
 */

interface WallEditorButtonProps {
  active: boolean
  disabled: boolean
  onToggle: () => void
}

export default function WallEditorButton({ active, disabled, onToggle }: WallEditorButtonProps) {
  return (
    <div className="absolute top-3 left-3 z-10 flex gap-2">
      {/* Wall editor (plan view) button */}
      <button
        onClick={() => { if (!active) onToggle() }}
        disabled={disabled}
        title="Wall editor (plan view)"
        className="w-10 h-10 rounded-full flex items-center justify-center transition-all"
        style={{
          background: active ? 'var(--bg-panel)' : '#1e1e1e',
          border: `2px solid ${active ? 'var(--accent)' : '#555'}`,
          opacity: disabled ? 0.3 : 1,
          cursor: disabled ? 'not-allowed' : active ? 'default' : 'pointer',
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

      {/* 3D view button — only visible when wall editor is active */}
      {active && (
        <button
          onClick={onToggle}
          title="Back to 3D view"
          className="w-10 h-10 rounded-full flex items-center justify-center transition-all"
          style={{
            background: '#1e1e1e',
            border: '2px solid #555',
            cursor: 'pointer',
          }}
        >
          <span style={{ color: '#aaa', fontSize: '11px', fontWeight: 700, letterSpacing: '-0.5px' }}>3D</span>
        </button>
      )}
    </div>
  )
}
