/**
 * Home button — returns to 3D view and closes all open panels.
 */
import ToolbarButton from '../ui/ToolbarButton'

interface HomeButtonProps {
  active: boolean
  onGoHome: () => void
}

export default function HomeButton({ active, onGoHome }: HomeButtonProps) {
  const c = active ? 'var(--accent)' : '#aaa'
  return (
    <ToolbarButton active={active} title="Home (3D view)" onClick={onGoHome}>
      <svg width="40" height="40" viewBox="0 0 20 20" fill="none">
        <path
          d="M3 10L10 3l7 7"
          stroke={c} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
        />
        <path
          d="M5 9v7a1 1 0 001 1h3v-4h2v4h3a1 1 0 001-1V9"
          stroke={c} strokeWidth="1.5" fill="none"
        />
      </svg>
    </ToolbarButton>
  )
}
