/**
 * Toolbar button that captures the viewport, shows a prompt dialog with
 * presets, sends to OpenAI gpt-image-1, and shows the result in a modal.
 */
import { useState, useRef, useEffect } from 'react'
import { captureCanvas } from './Scene'

/** Rules prepended to every prompt to preserve the existing scene. */
const RULES =
  'STRICT RULES: This is a photograph of custom closet cabinetry in a room. ' +
  'Do NOT change any colors, textures, or materials — keep the EXACT same wood color and finish shown. ' +
  'Do NOT change cabinet positions, sizes, proportions, or the room layout. ' +
  'Do NOT add furniture, objects, clothing, accessories, or decorations that are not already visible. ' +
  'Do NOT change the wall color or floor. Keep everything EXACTLY as shown. '

const PRESETS: { label: string; prompt: string }[] = [
  {
    label: 'Photo Polish (Recommended)',
    prompt:
      RULES +
      'Make this image look like a professional interior design photograph. ' +
      'Add realistic soft shadows, subtle ambient occlusion, and gentle light reflections on surfaces. ' +
      'Improve lighting to feel like natural daylight mixed with warm accent lighting. ' +
      'Add subtle depth of field. High-resolution, sharp details.',
  },
  {
    label: 'Warm Showroom',
    prompt:
      RULES +
      'Make this look like a warm, inviting showroom photograph. ' +
      'Add soft warm overhead spotlights casting gentle shadows. ' +
      'Subtle reflections on surfaces. Cozy ambient warmth. ' +
      'Professional showroom photography.',
  },
  {
    label: 'Bright & Clean',
    prompt:
      RULES +
      'Make this look like a bright, clean product photograph. ' +
      'Even, diffused studio lighting with no harsh shadows. ' +
      'Crisp and sharp. Slight ambient occlusion for depth. ' +
      'Clean commercial photography style.',
  },
  {
    label: 'Dramatic Lighting',
    prompt:
      RULES +
      'Make this look like a dramatic architectural photograph. ' +
      'Strong directional lighting from one side creating bold shadows. ' +
      'Moody contrast. Subtle light falloff at edges. ' +
      'High-end interior architecture photography.',
  },
  {
    label: 'Soft Natural Light',
    prompt:
      RULES +
      'Make this look like it was photographed in soft natural window light. ' +
      'Gentle light gradient across the scene. Subtle soft shadows. ' +
      'Warm golden hour quality. Peaceful and inviting. ' +
      'Lifestyle interior photography.',
  },
]

const API_URL = 'https://api.openai.com/v1/images/edits'

/** Convert a data URL to a File (required by OpenAI images/edits). */
function dataUrlToFile(dataUrl: string, filename: string): File {
  const [header, base64] = dataUrl.split(',')
  const mime = header.match(/:(.*?);/)?.[1] ?? 'image/png'
  const bytes = atob(base64)
  const arr = new Uint8Array(bytes.length)
  for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i)
  return new File([arr], filename, { type: mime })
}

export default function RenderButton() {
  const [loading, setLoading] = useState(false)
  const [resultUrl, setResultUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [showPrompt, setShowPrompt] = useState(false)
  const [prompt, setPrompt] = useState(PRESETS[0].prompt)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  useEffect(() => {
    if (showPrompt && textareaRef.current) textareaRef.current.focus()
  }, [showPrompt])

  const handleRender = async () => {
    setShowPrompt(false)

    const apiKey = import.meta.env.VITE_OPENAI_API_KEY as string | undefined
    if (!apiKey) {
      setError('Set VITE_OPENAI_API_KEY in .env.local')
      return
    }

    const dataUrl = captureCanvas()
    if (!dataUrl) {
      setError('Could not capture viewport')
      return
    }

    setLoading(true)
    setError(null)
    setResultUrl(null)

    try {
      const file = dataUrlToFile(dataUrl, 'screenshot.png')
      console.log('[Render] Screenshot file size:', file.size, 'bytes')

      const formData = new FormData()
      formData.append('image', file)
      formData.append('prompt', prompt)
      formData.append('model', 'gpt-image-1')
      formData.append('size', 'auto')

      console.log('[Render] Sending to OpenAI gpt-image-1...', {
        model: 'gpt-image-1',
        promptLength: prompt.length,
        imageSize: file.size,
      })

      const res = await fetch(API_URL, {
        method: 'POST',
        headers: { Authorization: `Bearer ${apiKey}` },
        body: formData,
      })

      console.log('[Render] Response:', res.status, res.headers.get('content-type'))

      if (!res.ok) {
        const json = await res.json()
        console.error('[Render] Error response:', json)
        throw new Error(json.error?.message ?? `OpenAI ${res.status}`)
      }

      const json = await res.json()
      const b64 = json.data?.[0]?.b64_json
      if (b64) {
        const binary = atob(b64)
        const arr = new Uint8Array(binary.length)
        for (let i = 0; i < binary.length; i++) arr[i] = binary.charCodeAt(i)
        const blob = new Blob([arr], { type: 'image/png' })
        console.log('[Render] Result blob size:', blob.size, 'bytes')
        setResultUrl(URL.createObjectURL(blob))
      } else if (json.data?.[0]?.url) {
        console.log('[Render] Got URL result')
        setResultUrl(json.data[0].url)
      } else {
        throw new Error('No image in response')
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  const handleDownload = () => {
    if (!resultUrl) return
    const link = document.createElement('a')
    link.href = resultUrl
    link.download = `render-${Date.now()}.png`
    link.click()
  }

  const handleClose = () => {
    if (resultUrl?.startsWith('blob:')) URL.revokeObjectURL(resultUrl)
    setResultUrl(null)
    setError(null)
  }

  return (
    <>
      <button
        onClick={() => setShowPrompt(true)}
        disabled={loading}
        title="AI Render (OpenAI)"
        className="w-16 h-16 rounded-full flex items-center justify-center transition-all"
        style={{
          background: loading ? 'var(--bg-panel)' : '#1e1e1e',
          border: `2px solid ${loading ? 'var(--accent)' : '#555'}`,
          opacity: loading ? 0.6 : 1,
        }}
      >
        <svg width="40" height="40" viewBox="0 0 20 20" fill="none">
          <path d="M10 2 L11 7 L16 8 L11 9 L10 14 L9 9 L4 8 L9 7 Z" stroke="#aaa" strokeWidth="1.2" fill="none" />
          <circle cx="15" cy="4" r="1.2" fill="#aaa" />
          <circle cx="5" cy="14" r="1" fill="#aaa" />
          <circle cx="16" cy="15" r="0.8" fill="#aaa" />
        </svg>
      </button>

      {/* Prompt dialog */}
      {showPrompt && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.7)' }}
          onClick={() => setShowPrompt(false)}>
          <div className="bg-gray-900 rounded-lg p-5 w-[520px] max-h-[80vh] flex flex-col"
            onClick={e => e.stopPropagation()}>
            <p className="text-white text-sm font-medium mb-3">Render Prompt</p>

            {/* Preset buttons */}
            <div className="flex flex-wrap gap-1.5 mb-3 max-h-[180px] overflow-y-auto pr-1">
              {PRESETS.map(p => (
                <button key={p.label} onClick={() => setPrompt(p.prompt)}
                  className="px-2.5 py-1 rounded text-xs transition-colors"
                  style={{
                    background: prompt === p.prompt ? 'var(--accent)' : '#333',
                    color: prompt === p.prompt ? '#000' : '#ccc',
                  }}>
                  {p.label}
                </button>
              ))}
            </div>

            {/* Editable prompt */}
            <textarea ref={textareaRef} value={prompt}
              onChange={e => setPrompt(e.target.value)}
              rows={5}
              className="w-full rounded bg-gray-800 text-gray-200 text-xs p-2.5 resize-none border border-gray-700 focus:border-gray-500 outline-none mb-3"
              placeholder="Describe how the render should look..."
            />

            <div className="flex justify-end gap-2">
              <button onClick={() => setShowPrompt(false)}
                className="px-3 py-1.5 rounded text-xs text-gray-400 hover:text-white">
                Cancel
              </button>
              <button onClick={handleRender}
                className="px-4 py-1.5 rounded text-xs font-medium"
                style={{ background: 'var(--accent)', color: '#000' }}>
                Render
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.7)' }}>
          <div className="text-center text-white">
            <div className="animate-spin w-10 h-10 border-4 border-white border-t-transparent rounded-full mx-auto mb-3" />
            <p className="text-sm">Rendering...</p>
          </div>
        </div>
      )}

      {/* Result modal */}
      {(resultUrl || error) && !loading && (
        <div className="fixed inset-0 z-50 flex items-center justify-center"
          style={{ background: 'rgba(0,0,0,0.85)' }}
          onClick={handleClose}>
          <div className="relative max-w-[90vw] max-h-[90vh]" onClick={e => e.stopPropagation()}>
            <button onClick={handleClose}
              className="absolute -top-3 -right-3 w-8 h-8 rounded-full bg-gray-800 text-white flex items-center justify-center text-lg z-10 hover:bg-gray-600">
              &times;
            </button>

            {error ? (
              <div className="bg-gray-900 rounded-lg p-6 text-center">
                <p className="text-red-400 text-sm mb-2">Render failed</p>
                <p className="text-gray-400 text-xs max-w-md">{error}</p>
              </div>
            ) : (
              <>
                <img src={resultUrl!} alt="AI Render" className="rounded-lg max-w-[90vw] max-h-[80vh] object-contain" />
                <div className="flex justify-center mt-3">
                  <button onClick={handleDownload}
                    className="px-4 py-2 rounded text-sm font-medium"
                    style={{ background: 'var(--accent)', color: '#000' }}>
                    Download
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
