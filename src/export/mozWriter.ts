import type { MozFile } from '../mozaik/types'

/**
 * Serialize a MozFile back to the MOZ file format.
 *
 * Strategy for Stage 1: preserve the original raw XML unchanged.
 * The 3-line binary header is reconstructed from stored values.
 * Since we don't edit any values, the output should be byte-identical to the input.
 *
 * NEVER convert string→float→string for unchanged values.
 * This preserves exact decimal representation for round-trip fidelity.
 */
export function writeMoz(mozFile: MozFile): string {
  const header = [
    mozFile.headerLine1,
    mozFile.headerLine2,
    mozFile.headerLine3,
  ].join('\n')

  return header + '\n' + mozFile.rawXml
}

/**
 * Compare original file content with exported content.
 * Returns true if byte-identical.
 */
export function verifyRoundTrip(
  originalContent: string,
  exportedContent: string,
): { identical: boolean; diffIndex: number; detail: string } {
  if (originalContent === exportedContent) {
    return { identical: true, diffIndex: -1, detail: 'IDENTICAL' }
  }

  // Find first difference
  let diffIndex = 0
  const minLen = Math.min(originalContent.length, exportedContent.length)
  for (let i = 0; i < minLen; i++) {
    if (originalContent[i] !== exportedContent[i]) {
      diffIndex = i
      break
    }
  }

  const context = 40
  const origSnippet = originalContent.slice(
    Math.max(0, diffIndex - context),
    diffIndex + context,
  )
  const exportSnippet = exportedContent.slice(
    Math.max(0, diffIndex - context),
    diffIndex + context,
  )

  return {
    identical: false,
    diffIndex,
    detail: `First difference at byte ${diffIndex}:\n  Original: ...${origSnippet}...\n  Exported: ...${exportSnippet}...`,
  }
}
