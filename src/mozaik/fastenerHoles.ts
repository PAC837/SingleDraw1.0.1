/**
 * Generate synthetic fastener holes for toe/bottom/top parts.
 * These are the 10mm + 20mm "outrigger" holes where horizontal parts
 * contact end panels (FEnd). Pattern derived from 87 4S 6DR sample.
 *
 * Holes are generated on-the-fly at render time — NOT stored on parts,
 * NOT exported to Mozaik.
 */
import type { MozPart, MozOperationHole } from './types'

// X offsets from the FEnd edge (measured from part's left or right edge)
const LARGE_OFFSET = 9.5   // mm — center of FEnd panel (19mm / 2)
const SMALL_OFFSET = 41.5  // mm — one 32mm grid step further in (9.5 + 32)

const LARGE_DEPTH = 16     // mm
const SMALL_DEPTH = 15     // mm

// Y positions vary by part type:
// - Toe (narrow, W ≈ 96mm): fixed at 22mm and W-42mm
// - Bottom/Top (full depth): 68mm (front linebore column) and W-73.5mm (back column)
const TOE_Y_FRONT = 22
const TOE_Y_BACK_OFFSET = 42  // from back edge
const PANEL_Y_FRONT = 68      // matches FRONT_INSET in systemHoles.ts
const PANEL_Y_BACK_OFFSET = 73.5

type HorizontalPartType = 'toe' | 'bottom' | 'top'

function classifyPart(part: MozPart): HorizontalPartType | null {
  const t = part.type.toLowerCase()
  if (t === 'toe') return 'toe'
  if (t === 'bottom') return 'bottom'
  if (t === 'top') return 'top'
  return null
}

/**
 * Generate synthetic fastener holes for a horizontal part at each end
 * (where auto end panels would sit).
 */
export function generateFastenerHoles(
  part: MozPart,
  largeDia: number,
  smallDia: number,
): MozOperationHole[] {
  const partType = classifyPart(part)
  if (!partType || (largeDia <= 0 && smallDia <= 0)) return []

  const partL = part.l
  const partW = part.w

  // Skip if part is too small for holes
  if (partL < SMALL_OFFSET * 2 + 10 || partW < 30) return []

  // Y positions depend on part type
  const yPositions: number[] = partType === 'toe'
    ? [TOE_Y_FRONT, Math.max(TOE_Y_FRONT + 10, partW - TOE_Y_BACK_OFFSET)]
    : [PANEL_Y_FRONT, Math.max(PANEL_Y_FRONT + 10, partW - PANEL_Y_BACK_OFFSET)]

  // flipSideOp: Bottom=true (holes on back face), Toe/Top=false (matches sample)
  const flipSide = partType === 'bottom'

  const holes: MozOperationHole[] = []

  // Holes at each end of the part (left edge and right edge)
  for (const edge of ['left', 'right'] as const) {
    const baseX = edge === 'left' ? 0 : partL

    for (const y of yPositions) {
      if (largeDia > 0) {
        holes.push({
          type: 'hole',
          x: edge === 'left' ? baseX + LARGE_OFFSET : baseX - LARGE_OFFSET,
          y,
          depth: LARGE_DEPTH,
          diameter: largeDia,
          flipSideOp: flipSide,
        })
      }
      if (smallDia > 0) {
        holes.push({
          type: 'hole',
          x: edge === 'left' ? baseX + SMALL_OFFSET : baseX - SMALL_OFFSET,
          y,
          depth: SMALL_DEPTH,
          diameter: smallDia,
          flipSideOp: flipSide,
        })
      }
    }
  }

  return holes
}

/** Check if a part is a horizontal type that gets fastener holes. */
export function isFastenerTarget(part: MozPart): boolean {
  return classifyPart(part) !== null
}
