/**
 * Evaluate parametric shape equations from Mozaik CRN (corner) products.
 *
 * Equations are simple arithmetic chains referencing product dimensions (W, D),
 * CabProdParm values, and part properties (e.g., Uend.th).
 *
 * Examples: "W-CornerEndWRight", "D-CornerEndWLeft-CornerMargin", "CornerRadius"
 */

import type { MozProduct, MozShapePoint } from './types'

export interface EvalContext {
  W: number
  D: number
  params: Record<string, number>
  partThickness: Record<string, number>  // "Uend" → thickness
}

/** Zero-value tokens — markers, not dimensions. */
const ZERO_TOKENS = new Set(['DontTouch', 'DSlopD', 'DSlopW'])

/** Build evaluation context from a product. */
export function buildEvalContext(product: MozProduct): EvalContext {
  const params: Record<string, number> = {}
  for (const p of product.parameters) {
    params[p.name] = parseFloat(p.value) || 0
  }

  const partThickness: Record<string, number> = {}
  for (const part of product.parts) {
    // Store by type and name for dot-notation lookup (e.g., "Uend.th")
    const key = part.type.toLowerCase()
    if (!partThickness[key]) partThickness[key] = part.w
    // Also store by name
    partThickness[part.name.toLowerCase()] = part.w
  }

  return { W: product.width, D: product.depth, params, partThickness }
}

/**
 * Evaluate a single shape equation string.
 * Handles chains like "W-CornerEndWRight-CornerMargin" or single tokens like "CornerRadius".
 */
export function evaluateShapeEq(eq: string, ctx: EvalContext): number {
  if (!eq) return 0

  // Tokenize: split on + and - while keeping the operators
  const tokens: { value: string; op: '+' | '-' }[] = []
  let current = ''
  let op: '+' | '-' = '+'

  for (let i = 0; i < eq.length; i++) {
    const ch = eq[i]
    if ((ch === '+' || ch === '-') && current.length > 0) {
      tokens.push({ value: current.trim(), op })
      op = ch as '+' | '-'
      current = ''
    } else {
      current += ch
    }
  }
  if (current.trim()) tokens.push({ value: current.trim(), op })

  let result = 0
  for (const token of tokens) {
    const val = resolveToken(token.value, ctx)
    result = token.op === '+' ? result + val : result - val
  }
  return result
}

/** Resolve a single token to a numeric value. */
function resolveToken(token: string, ctx: EvalContext): number {
  // Numeric literal
  const num = parseFloat(token)
  if (!isNaN(num)) return num

  // Product dimensions
  if (token === 'W') return ctx.W
  if (token === 'D') return ctx.D

  // Zero-value markers
  if (ZERO_TOKENS.has(token)) return 0

  // Dot notation: "Uend.th" → part type "uend", thickness
  if (token.includes('.')) {
    const [partRef, prop] = token.split('.')
    if (prop === 'th') {
      const th = ctx.partThickness[partRef.toLowerCase()]
      if (th !== undefined) return th
    }
    return 0
  }

  // CabProdParm lookup
  if (ctx.params[token] !== undefined) return ctx.params[token]

  console.warn(`[ShapeEq] Unknown token: "${token}"`)
  return 0
}

/**
 * Re-evaluate all TopShapeXml points using current product dimensions & parameters.
 *
 * Points with equations: recomputed from scratch (idempotent).
 * Points without equations: classified by original value vs original W/D.
 *   - If original X ≈ W → X tracks new W
 *   - If original Y ≈ D → Y tracks new D
 *   - If 0 or other constant → stays unchanged
 *
 * When `originalPts` is provided (from _crnDeps cache), uses those as the source
 * of truth to avoid compounding shifts on repeated resize operations.
 */
export function evaluateTopShape(
  product: MozProduct,
  oldWidth?: number,
  oldDepth?: number,
  originalPts?: MozShapePoint[],
): MozShapePoint[] {
  const pts = originalPts ?? product.topShapePoints
  if (!pts || pts.length === 0) return []
  const ctx = buildEvalContext(product)
  const origW = oldWidth ?? product.width
  const origD = oldDepth ?? product.depth

  return pts.map(pt => {
    // Equations: evaluate from scratch at new dimensions
    const x = pt.xEq ? evaluateShapeEq(pt.xEq, ctx)
      : Math.abs(pt.x - origW) < 1 ? ctx.W   // tracks W
      : pt.x                                   // constant (0, param value, etc.)
    const y = pt.yEq ? evaluateShapeEq(pt.yEq, ctx)
      : Math.abs(pt.y - origD) < 1 ? ctx.D   // tracks D
      : pt.y                                   // constant
    const data = pt.dataEq ? evaluateShapeEq(pt.dataEq, ctx) : pt.data
    return { ...pt, x, y, data }
  })
}
