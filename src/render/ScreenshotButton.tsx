/**
 * Toolbar button that captures the 3D viewport as a PNG and downloads it.
 */
import { captureCanvas } from './Scene'

export default function ScreenshotButton() {
  const handleClick = () => {
    const dataUrl = captureCanvas()
    if (!dataUrl) return
    const link = document.createElement('a')
    link.href = dataUrl
    link.download = `screenshot-${Date.now()}.png`
    link.click()
  }

  return (
    <button
      onClick={handleClick}
      title="Screenshot (download PNG)"
      className="w-16 h-16 rounded-full flex items-center justify-center transition-all"
      style={{ background: '#1e1e1e', border: '2px solid #555' }}
    >
      <svg width="40" height="40" viewBox="0 0 20 20" fill="none">
        {/* Camera body */}
        <rect x="2" y="6" width="16" height="11" rx="2" stroke="#aaa" strokeWidth="1.5" fill="none" />
        {/* Lens */}
        <circle cx="10" cy="11.5" r="3.5" stroke="#aaa" strokeWidth="1.5" fill="none" />
        <circle cx="10" cy="11.5" r="1.5" fill="#aaa" />
        {/* Viewfinder bump */}
        <path d="M7 6 L8 3.5 L12 3.5 L13 6" stroke="#aaa" strokeWidth="1.5" fill="none" />
      </svg>
    </button>
  )
}
