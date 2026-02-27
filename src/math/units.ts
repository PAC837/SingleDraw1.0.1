const FRACS = [
  '', '¹⁄₁₆', '⅛', '³⁄₁₆', '¼', '⁵⁄₁₆', '⅜', '⁷⁄₁₆',
  '½', '⁹⁄₁₆', '⅝', '¹¹⁄₁₆', '¾', '¹³⁄₁₆', '⅞', '¹⁵⁄₁₆',
]

/** Convert mm to decimal inches. */
export function mmToInches(mm: number): number {
  return mm / 25.4
}

/** Convert decimal inches to mm. */
export function inchesToMm(inches: number): number {
  return inches * 25.4
}

/** Format a dimension in mm as either "1234.5mm" or fractional inches (nearest 1/16). */
export function formatDim(mm: number, useInches: boolean): string {
  if (!useInches) return `${mm.toFixed(1)}mm`
  const total = mm / 25.4
  const whole = Math.floor(total)
  const sixteenths = Math.round((total - whole) * 16)
  if (sixteenths === 0) return `${whole}″`
  if (sixteenths === 16) return `${whole + 1}″`
  return `${whole > 0 ? `${whole} ` : ''}${FRACS[sixteenths]}″`
}
