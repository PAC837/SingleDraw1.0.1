import type { MozWall } from '../mozaik/types'
import {
  computeWallGeometries, signedArea, verifyChainClosure, normalizedWallOrder,
} from '../math/wallMath'

export interface WallVerifyResult {
  pass: boolean
  details: string[]
}

/** Run all wall geometry verifications. */
export function verifyWalls(walls: MozWall[]): WallVerifyResult {
  const details: string[] = []
  let allPass = true

  if (walls.length === 0) {
    return { pass: false, details: ['No walls to verify'] }
  }

  // 1. Chain closure
  const closure = verifyChainClosure(walls)
  if (closure.closed) {
    details.push(`[PASS] Chain closure: gap=${closure.gap.toFixed(6)}mm`)
  } else {
    details.push(`[FAIL] Chain closure: gap=${closure.gap.toFixed(6)}mm (>0.01mm)`)
    allPass = false
  }

  // 2. Signed area / winding
  const area = signedArea(walls)
  const winding = area < 0 ? 'CW' : 'CCW'
  details.push(`[INFO] Signed area: ${area.toFixed(2)} (${winding} winding)`)

  // 3. All normals should be non-zero
  const geoms = computeWallGeometries(walls)
  let allNormalsValid = true
  for (const g of geoms) {
    const normLen = Math.sqrt(g.normal[0] ** 2 + g.normal[1] ** 2)
    if (Math.abs(normLen - 1) > 0.001) {
      details.push(`[FAIL] Wall ${g.wallNumber} normal not unit length: ${normLen.toFixed(6)}`)
      allNormalsValid = false
      allPass = false
    }
  }
  if (allNormalsValid) {
    details.push(`[PASS] All ${geoms.length} wall normals are unit length`)
  }

  // 4. Normalized ordering
  const order = normalizedWallOrder(walls)
  details.push(`[INFO] Normalized order: [${order.join(', ')}]`)

  // 5. Wall count consistency
  const uniqueIds = new Set(walls.map((w) => w.wallNumber))
  if (uniqueIds.size === walls.length) {
    details.push(`[PASS] All ${walls.length} wall numbers are unique`)
  } else {
    details.push(`[FAIL] Duplicate wall numbers found`)
    allPass = false
  }

  return { pass: allPass, details }
}
