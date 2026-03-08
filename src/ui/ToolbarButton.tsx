/**
 * Circular toolbar button with active/inactive accent styling.
 */
interface ToolbarButtonProps {
  active: boolean
  title: string
  disabled?: boolean
  onClick: () => void
  children: React.ReactNode
}

export default function ToolbarButton({ active, title, disabled, onClick, children }: ToolbarButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      title={title}
      className="w-16 h-16 rounded-full flex items-center justify-center transition-all"
      style={{
        background: active ? 'var(--bg-panel)' : '#1e1e1e',
        border: `2px solid ${active ? 'var(--accent)' : '#555'}`,
        opacity: disabled ? 0.3 : 1,
        cursor: disabled ? 'not-allowed' : 'pointer',
      }}
    >
      {children}
    </button>
  )
}
