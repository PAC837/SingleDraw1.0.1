/**
 * Parametric formula inference for CRN (corner) product resize.
 *
 * Instead of heuristic arm-based rules, infers whether each numeric value
 * (part X, Y, L, W, shape point coords) depends on product Width, Depth,
 * or Height by checking if `value - dimension` can be explained by known
 * parameter values (CabProdParms + part thicknesses).
 *
 * On resize, only values that depend on the changing dimension get +delta.
 * Everything else stays constant.
 */

import type { EvalContext } from './shapeEquations'

type DimKey = 'W' | 'D' | 'H'

const EXACT_TOL = 0.5   // mm — exact param combo match tolerance
const NEAR_MAX = 25     // mm — max constant residual for near match

/** Get unique non-zero numeric values from CabProdParms only.
 *  partThickness is excluded — part.w values (e.g. shelf W=609.6) can equal
 *  product dimensions, causing false "param-only" matches that prevent stretching. */
function getParamValues(ctx: EvalContext): number[] {
  const set = new Set<number>()
  for (const v of Object.values(ctx.params)) if (v !== 0) set.add(v)
  return [...set]
}

/** Check if value ≈ ±p1 ±p2 ±p3 for any combo of up to 3 param values. */
function isParamExpr(value: number, vals: number[], tol: number): boolean {
  if (Math.abs(value) < tol) return true

  // 1-term
  for (const a of vals) {
    if (Math.abs(value - a) < tol || Math.abs(value + a) < tol) return true
  }

  // 2-term
  for (let i = 0; i < vals.length; i++)
    for (let j = 0; j < vals.length; j++) {
      if (Math.abs(value - vals[i] - vals[j]) < tol) return true
      if (Math.abs(value - vals[i] + vals[j]) < tol) return true
      if (Math.abs(value + vals[i] - vals[j]) < tol) return true
      if (Math.abs(value + vals[i] + vals[j]) < tol) return true
    }

  // 3-term
  for (let i = 0; i < vals.length; i++)
    for (let j = 0; j < vals.length; j++)
      for (let k = 0; k < vals.length; k++)
        for (const s1 of [1, -1])
          for (const s2 of [1, -1])
            for (const s3 of [1, -1])
              if (Math.abs(value - s1 * vals[i] - s2 * vals[j] - s3 * vals[k]) < tol)
                return true

  return false
}

/** Min distance from value to any param combo (up to 3 terms). */
function closestParamDist(value: number, vals: number[]): number {
  let best = Math.abs(value) // distance to zero

  // 1-term
  for (const a of vals) {
    best = Math.min(best, Math.abs(value - a), Math.abs(value + a))
  }

  // 2-term
  for (let i = 0; i < vals.length; i++)
    for (let j = 0; j < vals.length; j++) {
      best = Math.min(best,
        Math.abs(value - vals[i] - vals[j]),
        Math.abs(value - vals[i] + vals[j]),
        Math.abs(value + vals[i] - vals[j]),
        Math.abs(value + vals[i] + vals[j]))
    }

  // 3-term
  for (let i = 0; i < vals.length; i++)
    for (let j = 0; j < vals.length; j++)
      for (let k = 0; k < vals.length; k++)
        for (const s1 of [1, -1])
          for (const s2 of [1, -1])
            for (const s3 of [1, -1])
              best = Math.min(best,
                Math.abs(value - s1 * vals[i] - s2 * vals[j] - s3 * vals[k]))

  return best
}

/**
 * Determine which product dimension a numeric value depends on.
 * Returns 'W', 'D', or 'H' if the value contains that dimension in its formula,
 * or null if the value is a constant (param-only or unmatched).
 */
export function inferDependency(
  value: number,
  ctx: EvalContext,
  preference: DimKey,
): DimKey | null {
  if (Math.abs(value) < EXACT_TOL) return null

  const vals = getParamValues(ctx)

  // Param-only → constant (no dimension dependency)
  if (isParamExpr(value, vals, EXACT_TOL)) return null

  // Try each dimension in preference order
  const dims: DimKey[] = [preference]
  for (const d of ['W', 'D', 'H'] as const) if (d !== preference) dims.push(d)

  for (const dim of dims) {
    const dimVal = dim === 'W' ? ctx.W : dim === 'D' ? ctx.D : /* H */ 0
    if (dimVal === 0) continue // H not stored in EvalContext, skip
    const residual = value - dimVal
    // Exact: residual is a clean param expression
    if (isParamExpr(residual, vals, EXACT_TOL)) return dim
    // Near: residual is close to a param expression (constant offset < 50mm)
    if (closestParamDist(residual, vals) < NEAR_MAX) return dim
  }

  return null
}

/**
 * Get dimension preference for a part value field based on rotation a2.
 * a2=0/180: L runs along width (X), part-W runs along depth (Y)
 * a2=90/270: L runs along depth (Y), part-W runs along width (X)
 */
export function getDimPref(
  field: 'x' | 'y' | 'l' | 'w' | 'spX' | 'spY',
  a2: number,
): DimKey {
  const lPref: DimKey = (a2 === 0 || a2 === 180) ? 'W' : 'D'
  const wPref: DimKey = (a2 === 0 || a2 === 180) ? 'D' : 'W'
  switch (field) {
    case 'x': return 'W'     // X position is always along product width
    case 'y': return 'D'     // Y position is always along product depth
    case 'spX': return lPref // shape point x follows part L axis
    case 'spY': return wPref // shape point y follows part W axis
    case 'l': return lPref
    case 'w': return wPref
  }
}
