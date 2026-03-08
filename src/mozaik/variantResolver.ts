/**
 * Variant resolver — maps a dynamic product group + target height
 * to the best matching MOZ variant file.
 */
import type { DynamicProductGroup } from './types'
import { mmToInches } from '../math/units'

/**
 * Given a dynamic product group and a target height in mm,
 * resolve which variant MOZ file to use.
 *
 * Strategy:
 * 1. Convert target height mm to nearest inch label
 * 2. Look up exact match in group.heightMap
 * 3. If no exact match, find closest available variant
 * 4. Return filename + whether parametric resize is needed
 */
export function resolveVariant(
  group: DynamicProductGroup,
  targetHeightMm: number,
): { filename: string; needsResize: boolean; resolvedInches: number } {
  const targetInches = Math.round(mmToInches(targetHeightMm))
  const availableHeights = Object.keys(group.heightMap).map(Number)

  if (availableHeights.length === 0) {
    // No height-keyed variants — use first member
    return { filename: group.memberFiles[0], needsResize: true, resolvedInches: 0 }
  }

  // Exact match?
  if (group.heightMap[targetInches]) {
    return {
      filename: group.heightMap[targetInches],
      needsResize: false,
      resolvedInches: targetInches,
    }
  }

  // Closest available
  availableHeights.sort((a, b) =>
    Math.abs(a - targetInches) - Math.abs(b - targetInches)
  )
  const closest = availableHeights[0]
  return {
    filename: group.heightMap[closest],
    needsResize: true,
    resolvedInches: closest,
  }
}
