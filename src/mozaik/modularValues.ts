/**
 * Modular heights and depths from PAC Library's Library.ndx.
 * These are the ONLY valid section heights/depths — source of truth.
 * Heights are on a ~32mm grid; depths are 5 fixed values.
 */

/** 93 ModularHeight values from Library.ndx (mm, sorted ascending). */
export const MODULAR_HEIGHTS: readonly number[] = [
  51.99, 84.00, 115.99, 148.00, 179.99, 212.00, 244.00, 275.99,
  308.00, 339.99, 372.00, 403.99, 436.00, 468.00, 499.99, 532.00,
  563.99, 596.00, 627.99, 660.00, 692.00, 723.99, 756.00, 787.99,
  820.00, 851.99, 884.00, 916.00, 947.99, 980.00, 1011.99, 1044.00,
  1076.00, 1107.99, 1140.00, 1171.99, 1204.00, 1236.00, 1268.00, 1300.00,
  1331.99, 1364.00, 1395.99, 1428.00, 1460.00, 1492.00, 1524.00, 1555.99,
  1588.00, 1619.99, 1652.00, 1684.00, 1716.00, 1748.00, 1779.99, 1812.00,
  1843.99, 1876.00, 1908.00, 1940.00, 1972.00, 2003.99, 2036.00, 2067.99,
  2100.00, 2132.00, 2164.00, 2196.00, 2227.99, 2260.00, 2292.00, 2324.00,
  2356.00, 2387.99, 2420.00, 2451.99, 2484.00, 2516.00, 2548.00, 2580.00,
  2611.99, 2644.00, 2675.99, 2708.00, 2740.00, 2772.00, 2804.00, 2835.99,
  2868.00, 2899.99, 2932.00, 2964.00, 2996.00, 3028.00,
]

/** 5 ModularDepth values from Library.ndx (mm). */
export const MODULAR_DEPTHS: readonly number[] = [
  292.10, 356.00, 406.00, 484.00, 606.00,
]

/** Snap DOWN to the nearest modular height ≤ input (with 0.5mm tolerance). */
export function snapModularHeight(mm: number): number {
  let best = MODULAR_HEIGHTS[0]
  for (const h of MODULAR_HEIGHTS) {
    if (h <= mm + 0.5) best = h
    else break
  }
  return best
}

/** Snap to the nearest modular depth. */
export function snapModularDepth(mm: number): number {
  let best = MODULAR_DEPTHS[0]
  let bestDist = Math.abs(mm - best)
  for (const d of MODULAR_DEPTHS) {
    const dist = Math.abs(mm - d)
    if (dist < bestDist) { best = d; bestDist = dist }
  }
  return best
}
