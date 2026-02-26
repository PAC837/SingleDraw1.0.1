import type { MozRoom } from '../mozaik/types'

/**
 * Serialize a MozRoom back to the DES file format.
 *
 * Strategy for Stage 1: preserve the original rawText unchanged.
 * Since we don't edit any values, the output is byte-identical to the input.
 *
 * NEVER convert string→float→string for unchanged values.
 * This preserves exact decimal representation for round-trip fidelity.
 */
export function writeDes(room: MozRoom): string {
  return room.rawText
}
