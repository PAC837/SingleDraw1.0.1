/**
 * XML mutation utilities for raw Mozaik XML — part removal, attribute updates,
 * and CabProdParm upserts.
 *
 * Index-based functions (updatePartAttrByIndex, updatePartZByIndex) are preferred
 * over name-based matching because CabProdPart Names are not unique (e.g. all
 * adjustable shelves share Name="Shelf").
 */

/** Format a number to match Mozaik XML output: max 4 decimals, strip trailing zeros. */
function numStr(n: number): string {
  if (Number.isInteger(n)) return String(n)
  return parseFloat(n.toFixed(4)).toString()
}

/** Escape special regex characters in a string. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Remove the Nth CabProdPart element from rawInnerXml by index.
 */
export function removePartByIndexFromRawXml(rawXml: string, partIndex: number): string {
  if (!rawXml) return rawXml
  const openTag = /<CabProdPart\b/g
  let match: RegExpExecArray | null
  let count = 0
  while ((match = openTag.exec(rawXml)) !== null) {
    if (count === partIndex) {
      const lineStart = rawXml.lastIndexOf('\n', match.index)
      const elemStart = lineStart >= 0 ? lineStart : match.index
      const closeAngle = rawXml.indexOf('>', match.index)
      if (closeAngle >= 0 && rawXml[closeAngle - 1] === '/') {
        return rawXml.slice(0, elemStart) + rawXml.slice(closeAngle + 1)
      }
      const closeTag = rawXml.indexOf('</CabProdPart>', match.index)
      if (closeTag >= 0) {
        return rawXml.slice(0, elemStart) + rawXml.slice(closeTag + '</CabProdPart>'.length)
      }
      return rawXml
    }
    count++
  }
  return rawXml
}

/**
 * Find the start index of the Nth CabProdPart opening tag in rawXml.
 * Returns -1 if not found.
 */
function findNthPartStart(rawXml: string, partIndex: number): number {
  const openTag = /<CabProdPart\b/g
  let match: RegExpExecArray | null
  let count = 0
  while ((match = openTag.exec(rawXml)) !== null) {
    if (count === partIndex) return match.index
    count++
  }
  return -1
}

/**
 * Replace an attribute value within a single CabProdPart tag substring.
 * The tag is the text from `<CabProdPart` to the next `>`.
 */
function replaceAttrInTag(tag: string, attr: string, newValue: string): string {
  const regex = new RegExp(`(\\b${attr}=")[^"]*"`)
  return tag.replace(regex, `$1${newValue}"`)
}

/**
 * Update attributes on the Nth CabProdPart element by index.
 * Robust: no name collisions, no floating-point format mismatches.
 */
export function updatePartAttrByIndex(
  rawXml: string,
  partIndex: number,
  changes: Array<{ attr: string; newValue: number }>,
): string {
  if (!rawXml || partIndex < 0 || changes.length === 0) return rawXml

  const tagStart = findNthPartStart(rawXml, partIndex)
  if (tagStart < 0) return rawXml

  // Find end of opening tag (either /> or >)
  const closeAngle = rawXml.indexOf('>', tagStart)
  if (closeAngle < 0) return rawXml

  const tagEnd = closeAngle + 1
  let tag = rawXml.slice(tagStart, tagEnd)

  for (const { attr, newValue } of changes) {
    tag = replaceAttrInTag(tag, attr, numStr(newValue))
  }

  return rawXml.slice(0, tagStart) + tag + rawXml.slice(tagEnd)
}

/**
 * Update Z attribute on multiple CabProdPart elements by index.
 * Replacement for updatePartZInRawXml — uses index instead of name+value matching.
 */
export function updatePartZByIndex(
  rawXml: string,
  changes: Array<{ partIndex: number; newZ: number }>,
): string {
  if (!rawXml || changes.length === 0) return rawXml

  // Process in reverse index order so earlier replacements don't shift later indices
  const sorted = [...changes].sort((a, b) => b.partIndex - a.partIndex)

  let xml = rawXml
  for (const { partIndex, newZ } of sorted) {
    xml = updatePartAttrByIndex(xml, partIndex, [{ attr: 'Z', newValue: newZ }])
  }
  return xml
}

/** Descriptions for known CabProdParm names. */
const PARM_DESCS: Record<string, string> = {
  ToeR: 'Toe Recess',
  ToeH: 'Toe Height',
}

/**
 * Insert or update a CabProdParm value in rawInnerXml.
 * If the parm exists, updates its Value attribute. Otherwise inserts before </CabProdParms>.
 */
export function upsertCabProdParm(rawXml: string, name: string, value: number): string {
  if (!rawXml) return rawXml

  const nameEsc = escapeRegex(name)
  const valStr = numStr(value)

  // Try to update existing parm
  const updateRegex = new RegExp(
    `(<CabProdParm\\b[^>]*?\\bName="${nameEsc}"[^>]*?\\bValue=")([^"]*)(")`,
  )
  if (updateRegex.test(rawXml)) {
    return rawXml.replace(updateRegex, `$1${valStr}$3`)
  }

  // Insert new parm before </CabProdParms>
  const desc = PARM_DESCS[name] ?? name
  const newParm = `        <CabProdParm ProdID="0" Name="${name}" Desc="${desc}" Type="0" Category="0" Value="${valStr}" Options="" MaxVal="0" MinVal="0" />`
  return rawXml.replace('</CabProdParms>', newParm + '\n      </CabProdParms>')
}
