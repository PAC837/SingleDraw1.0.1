/**
 * Floating dropdown panel with accent border.
 */
interface FloatingPanelProps {
  children: React.ReactNode
  className?: string
  style?: React.CSSProperties
}

export default function FloatingPanel({ children, className = '', style }: FloatingPanelProps) {
  return (
    <div
      className={`z-20 rounded-lg p-3 space-y-2 ${className}`}
      style={{
        background: '#1e1e1e',
        border: '1px solid var(--accent)',
        ...style,
      }}
      onPointerDown={e => e.stopPropagation()}
    >
      {children}
    </div>
  )
}
