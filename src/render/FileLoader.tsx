import { useRef } from 'react'
import { parseDes } from '../mozaik/desParser'
import { parseMoz } from '../mozaik/mozParser'
import { wallChainReport } from '../math/wallMath'
import { useAppDispatch } from '../store'

export default function FileLoader() {
  const dispatch = useAppDispatch()
  const desRef = useRef<HTMLInputElement>(null)
  const mozRef = useRef<HTMLInputElement>(null)

  function handleDesFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    console.log(`[DES] Reading file: ${file.name} (type: DES room file)`)

    const reader = new FileReader()
    reader.onload = () => {
      try {
        const text = reader.result as string
        const room = parseDes(text)
        console.log(`[DES] Parsed: "${room.name}" (ID: ${room.uniqueId})`)
        console.log(`[DES] Walls: ${room.walls.length}, Fixtures: ${room.fixtures.length}, Products: ${room.products.length}`)

        if (room.walls.length > 0) {
          console.log(`[DES] Wall geometry:\n${wallChainReport(room.walls)}`)
        }

        dispatch({ type: 'LOAD_ROOM', room })
      } catch (err) {
        console.error('[DES] Parse error:', err)
      }
    }
    reader.readAsText(file)

    // Reset input so same file can be re-loaded
    if (desRef.current) desRef.current.value = ''
  }

  function handleMozFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    console.log(`[MOZ] Reading file: ${file.name} (type: MOZ product file)`)

    const reader = new FileReader()
    reader.onload = () => {
      try {
        const text = reader.result as string
        const mozFile = parseMoz(text)
        dispatch({ type: 'LOAD_MOZ', file: mozFile })
      } catch (err) {
        console.error('[MOZ] Parse error:', err)
      }
    }
    reader.readAsText(file)

    if (mozRef.current) mozRef.current.value = ''
  }

  return (
    <div className="space-y-3">
      <div>
        <label className="block text-xs text-[var(--text-secondary)] mb-1 uppercase tracking-wider">
          Room File (DES)
        </label>
        <label className="block w-full cursor-pointer bg-[var(--bg-dark)] border border-gray-700 rounded px-3 py-2 text-sm hover:border-[var(--yellow)] transition-colors text-center">
          Load DES
          <input
            ref={desRef}
            type="file"
            accept=".des"
            onChange={handleDesFile}
            className="hidden"
          />
        </label>
      </div>
      <div>
        <label className="block text-xs text-[var(--text-secondary)] mb-1 uppercase tracking-wider">
          Product File (MOZ)
        </label>
        <label className="block w-full cursor-pointer bg-[var(--bg-dark)] border border-gray-700 rounded px-3 py-2 text-sm hover:border-[var(--yellow)] transition-colors text-center">
          Load MOZ
          <input
            ref={mozRef}
            type="file"
            accept=".moz,.mos"
            onChange={handleMozFile}
            className="hidden"
          />
        </label>
      </div>
    </div>
  )
}
