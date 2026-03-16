/**
 * Shelf editor logic for the Elevation Viewer.
 *
 * Finds shelf groups (shelf + rod + hangers that move together),
 * computes movement bounds, applies Z shifts, and updates rawInnerXml
 * for round-trip export fidelity.
 */

import type { MozProduct, MozPart } from './types'

/** A shelf group: the shelf and all parts that move with it. */
export interface ShelfGroup {
  shelfIndex: number
  rodIndices: number[]
  hangerIndices: number[]
  shelfZ: number
}

/** Min/max Z bounds for a shelf movement. */
export interface ShelfBounds {
  minZ: number
  maxZ: number
}

const SHELF_ASSOC_RANGE = 200  // mm — max distance below shelf to associate rod/hangers
const MIN_CLEARANCE = 32        // mm — one grid step above structural elements
const SNAP_GRID = 32            // mm — shelf snap increment

/**
 * Determine if a part is a fixed shelf.
 * Matches by type (case-insensitive) or report name containing "F.Shelf".
 */
function isFixedShelf(part: MozPart): boolean {
  const t = part.type.toLowerCase()
  return t === 'fixedshelf' || t === 'fixed shelf' || part.reportName.includes('F.Shelf')
}

/**
 * Find all parts in the group that moves with a given shelf.
 * Rod and hangers within SHELF_ASSOC_RANGE mm below the shelf belong to its group.
 */
export function findShelfGroup(product: MozProduct, shelfPartIndex: number): ShelfGroup | null {
  const shelf = product.parts[shelfPartIndex]
  if (!shelf || !isFixedShelf(shelf)) return null

  const shelfZ = shelf.z
  const rodIndices: number[] = []
  const hangerIndices: number[] = []

  for (let i = 0; i < product.parts.length; i++) {
    if (i === shelfPartIndex) continue
    const p = product.parts[i]
    const zDiff = shelfZ - p.z
    if (zDiff < 0 || zDiff > SHELF_ASSOC_RANGE) continue

    const nameLower = p.name.toLowerCase()
    const reportLower = p.reportName.toLowerCase()
    if (nameLower.includes('rod') || reportLower.includes('rod')) {
      rodIndices.push(i)
    } else if (nameLower.includes('hanger') || reportLower.includes('hanger')) {
      hangerIndices.push(i)
    }
  }

  return { shelfIndex: shelfPartIndex, rodIndices, hangerIndices, shelfZ }
}

/**
 * Find all fixed shelf part indices in a product.
 */
export function findFixedShelves(product: MozProduct): number[] {
  return product.parts
    .map((p, i) => isFixedShelf(p) ? i : -1)
    .filter(i => i >= 0)
}

/**
 * Compute valid Z range for a shelf, ensuring minimum clearance
 * from structural elements above and below.
 */
export function computeShelfBounds(product: MozProduct, shelfPartIndex: number): ShelfBounds {
  const shelf = product.parts[shelfPartIndex]
  if (!shelf) return { minZ: 0, maxZ: product.height }

  // Find structural boundaries: Bottom, Top, other FixedShelves
  let floorZ = 0
  let ceilingZ = product.height

  for (let i = 0; i < product.parts.length; i++) {
    if (i === shelfPartIndex) continue
    const p = product.parts[i]
    const t = p.type.toLowerCase()

    if (t === 'bottom' || t === 'toe') {
      // Floor boundary is above this element (always take highest structural part)
      // Use fixed 19mm panel thickness — p.w is depth after rotation, not thickness
      const topOfPart = p.z + 19
      if (topOfPart > floorZ) {
        floorZ = topOfPart
      }
    } else if (t === 'top') {
      // Ceiling boundary is below this element
      if (p.z < ceilingZ && p.z > shelf.z) {
        ceilingZ = p.z
      }
    } else if (isFixedShelf(p)) {
      // Other shelves constrain from either direction
      if (p.z < shelf.z && p.z > floorZ) {
        floorZ = p.z + (p.w || 19) // above the other shelf
      }
      if (p.z > shelf.z && p.z < ceilingZ) {
        ceilingZ = p.z - (p.w || 19) // below the other shelf
      }
    }
  }

  return {
    minZ: floorZ + MIN_CLEARANCE,
    maxZ: ceilingZ - MIN_CLEARANCE,
  }
}

/** Snap a Z value to the nearest 32mm grid increment. */
export function snapToGrid(z: number): number {
  return Math.round(z / SNAP_GRID) * SNAP_GRID
}

/**
 * Apply a preferred fixed shelf height to the LOWEST fixed shelf in a product.
 * Moves the shelf group (shelf + rods + hangers) to the preferred Z.
 * Clamps to valid bounds and snaps to 32mm grid.
 */
export function applyFixedShelfHeight(product: MozProduct, preferredZ: number): MozProduct {
  const shelfIndices = findFixedShelves(product)
  if (shelfIndices.length === 0) return product

  // Find the lowest fixed shelf (first from bottom)
  let lowestIdx = shelfIndices[0]
  for (const idx of shelfIndices) {
    if (product.parts[idx].z < product.parts[lowestIdx].z) lowestIdx = idx
  }

  const bounds = computeShelfBounds(product, lowestIdx)
  const snapped = snapToGrid(preferredZ)
  const clamped = Math.max(bounds.minZ, Math.min(bounds.maxZ, snapped))
  return moveShelfGroup(product, lowestIdx, clamped)
}

/**
 * Remove the Nth CabProdPart element from rawInnerXml by index.
 * Parts in the parts[] array are in the same order as CabProdPart elements in XML,
 * so index-based removal is correct even when multiple parts share the same Name.
 */
export function removePartByIndexFromRawXml(rawXml: string, partIndex: number): string {
  if (!rawXml) return rawXml
  const openTag = /<CabProdPart\b/g
  let match: RegExpExecArray | null
  let count = 0
  while ((match = openTag.exec(rawXml)) !== null) {
    if (count === partIndex) {
      // Include leading whitespace/newline for clean removal
      const lineStart = rawXml.lastIndexOf('\n', match.index)
      const elemStart = lineStart >= 0 ? lineStart : match.index
      // Check if self-closing (ends with />)
      const closeAngle = rawXml.indexOf('>', match.index)
      if (closeAngle >= 0 && rawXml[closeAngle - 1] === '/') {
        return rawXml.slice(0, elemStart) + rawXml.slice(closeAngle + 1)
      }
      // Open+close: find </CabProdPart>
      const closeTag = rawXml.indexOf('</CabProdPart>', match.index)
      if (closeTag >= 0) {
        return rawXml.slice(0, elemStart) + rawXml.slice(closeTag + '</CabProdPart>'.length)
      }
      return rawXml // couldn't find close, return unchanged
    }
    count++
  }
  return rawXml
}

/**
 * Remove the FS (Fixed Shelf) section from ProductInterior in rawInnerXml.
 *
 * Mozaik uses the ProductInterior section tree as the authoritative structure
 * for generating parts. If the FS section remains, Mozaik regenerates the
 * deleted fixed shelf (and associated hangers/rods) on import.
 *
 * Strategy: find the FS section, collect all its descendants, remove them all,
 * then insert a single merged CR section in their place.
 */
export function removeFixedShelfSection(rawXml: string): string {
  if (!rawXml) return rawXml

  const sections = parseSections(rawXml)
  const fsSection = sections.find(s => s.divideType === 'FS')
  if (!fsSection) return rawXml

  // Collect all descendant IDs (children, grandchildren, etc.)
  const removeIds = new Set<number>([fsSection.id])
  let changed = true
  while (changed) {
    changed = false
    for (const s of sections) {
      if (!removeIds.has(s.id) && removeIds.has(s.pParent)) {
        removeIds.add(s.id)
        changed = true
      }
    }
  }

  // Parse MaxIntSecID from ProductInterior element
  const interiorMatch = rawXml.match(/<ProductInterior\b[^>]*\bMaxIntSecID="(\d+)"/)
  const maxId = interiorMatch ? parseInt(interiorMatch[1]) : Math.max(...sections.map(s => s.id))
  const newId = maxId + 1

  // Build the merged CR section to replace the FS subtree
  // Copy X and DX from the FS section (width doesn't change)
  const fsX = sectionAttr(fsSection.rawTag, 'X')
  const fsDX = sectionAttr(fsSection.rawTag, 'DX')
  const newDY = fsSection.dy
  const newDB = 333  // rod thickness in 0.1mm
  const newDA = newDY - newDB

  const newSection = `        <Section nSide="1" ID="${newId}" pParent="${fsSection.pParent}" pAChild="0" pCChild="0" Locked="A" AdjL="0" AdjR="0" ParentABC="${fsSection.parentABC}" ATray="0" CTray="0" Split="H" DivideType="CR" LockParentID="0" LockPosition="0" DepthAdj="0" InsetAdj="0" SplitBack="False" SplitTop="False" SplitBottom="False" SplitEnds="False" NoShelfHolesA="False" NoShelfHolesC="False" ROTrayOR="0" ROShelfA="0" ROShelfC="0" ROGuideOR="0" ClosetRodOR="0" ShelfPinsOR="0" ROTrayFrontFastenersOR="0" NoShotgunBore="False" X="${fsX}" Y="${fsSection.y}" DX="${fsDX}" DY="${newDY}" DA="${newDA}" DB="${newDB}" />`

  // Remove section lines by ID, then insert new section before </ProductInterior>
  let xml = rawXml
  for (const id of removeIds) {
    // Match the full <Section ... /> line (self-closing) with optional leading whitespace
    const sectionRegex = new RegExp(`\\s*<Section\\b[^>]*\\bID="${id}"[^/]*/>\n?`)
    xml = xml.replace(sectionRegex, '')
  }

  // Insert new section before </ProductInterior>
  xml = xml.replace('</ProductInterior>', newSection + '\n      </ProductInterior>')

  // Update MaxIntSecID
  if (interiorMatch) {
    xml = xml.replace(
      /(<ProductInterior\b[^>]*\bMaxIntSecID=")(\d+)(")/,
      `$1${newId}$3`,
    )
  }

  console.log(`[SHELF] Removed FS section (ID=${fsSection.id}) and ${removeIds.size - 1} descendants, merged into CR section ID=${newId}`)
  return xml
}

/**
 * Format a number to match Mozaik XML output: max 4 decimals, strip trailing zeros.
 * Must match desWriter.ts `num()` format for regex matching.
 */
function numStr(n: number): string {
  if (Number.isInteger(n)) return String(n)
  return parseFloat(n.toFixed(4)).toString()
}

/** Escape special regex characters in a string. */
function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
}

/**
 * Update Z attribute values in rawInnerXml for specific parts.
 * Matches <CabProdPart> elements by Name + Z value, replaces Z with newZ.
 *
 * Handles multiple parts with the same Name at the same Z
 * (e.g., 3 Hangers all at Z=1066.7 — all updated together).
 */
function updatePartZInRawXml(
  rawXml: string,
  changes: Array<{ partName: string; oldZ: number; newZ: number }>,
): string {
  let xml = rawXml
  for (const { partName, oldZ, newZ } of changes) {
    if (Math.abs(oldZ - newZ) < 0.01) continue

    const oldZStr = escapeRegex(numStr(oldZ))
    const newZStr = numStr(newZ)
    const nameEsc = escapeRegex(partName)

    // Match CabProdPart with this Name, then find and replace Z attribute value.
    // Pattern: <CabProdPart ... Name="partName" ... Z="oldZ" ...>
    // The Name and Z attrs can appear in any order in the tag.
    const regex = new RegExp(
      `(<CabProdPart\\b[^>]*?\\bName="${nameEsc}"[^>]*?\\bZ=")${oldZStr}(")`,
      'g',
    )
    xml = xml.replace(regex, `$1${newZStr}$2`)

    // Also try the reverse order (Z before Name) for robustness
    const regexRev = new RegExp(
      `(<CabProdPart\\b[^>]*?\\bZ=")${oldZStr}("[^>]*?\\bName="${nameEsc}")`,
      'g',
    )
    xml = xml.replace(regexRev, `$1${newZStr}$2`)
  }
  return xml
}

// ── ProductInterior section parsing & update ──────────────────────────

/** Parsed section from ProductInterior XML. */
interface ParsedSection {
  id: number
  pParent: number
  parentABC: string  // 'A', 'C', or 'N' — which side of parent's split
  divideType: string
  dy: number
  da: number
  db: number
  y: number
  rawTag: string  // original XML tag for replacement
}

/** Extract an attribute value from an XML tag string. */
function sectionAttr(tag: string, name: string): string {
  const m = tag.match(new RegExp(`\\b${name}="([^"]*)"`))
  return m ? m[1] : ''
}

/** Parse all <Section> elements from rawInnerXml. */
function parseSections(rawXml: string): ParsedSection[] {
  const sections: ParsedSection[] = []
  const regex = /<Section\s[^>]*>/g
  let match
  while ((match = regex.exec(rawXml)) !== null) {
    const tag = match[0]
    sections.push({
      id: parseInt(sectionAttr(tag, 'ID') || '0'),
      pParent: parseInt(sectionAttr(tag, 'pParent') || '0'),
      parentABC: sectionAttr(tag, 'ParentABC') || 'N',
      divideType: sectionAttr(tag, 'DivideType') || 'N',
      dy: parseInt(sectionAttr(tag, 'DY') || '0'),
      da: parseInt(sectionAttr(tag, 'DA') || '0'),
      db: parseInt(sectionAttr(tag, 'DB') || '0'),
      y: parseInt(sectionAttr(tag, 'Y') || '0'),
      rawTag: tag,
    })
  }
  return sections
}

/** Replace an attribute value in an XML tag string. */
function replAttrInTag(tag: string, name: string, value: number): string {
  return tag.replace(
    new RegExp(`(\\b${name}=")[^"]*"`),
    `$1${value}"`,
  )
}

/**
 * Compute tree depth of a section via pParent chain (distance to root).
 */
function sectionDepth(section: ParsedSection, all: ParsedSection[]): number {
  let depth = 0, id = section.pParent
  while (id !== 0 && depth < 20) {
    depth++
    const parent = all.find(s => s.id === id)
    if (!parent) break
    id = parent.pParent
  }
  return depth
}

/**
 * Find a child section by scanning pParent + ParentABC.
 *
 * pAChild/pCChild IDs on FS sections can be stale (referencing deleted IDs).
 * The reliable path is: child.pParent === parent.id && child.parentABC === side.
 */
function findChild(
  sections: ParsedSection[],
  parentId: number,
  side: 'A' | 'C',
): ParsedSection | undefined {
  return sections.find(s => s.pParent === parentId && s.parentABC === side)
}

/**
 * Update ProductInterior section dimensions when a shelf moves.
 *
 * Mozaik uses the section tree (DY/DA/DB/Y in 0.1mm units) to compute
 * shelf positions, overriding CabProdPart Z values. When a shelf moves
 * by delta mm, the FS section's DA changes and child sections adjust.
 *
 * Child resolution uses pParent + ParentABC (not pAChild/pCChild which
 * can reference stale IDs — e.g. 87 DH has pAChild=4 but real A-child is ID=8).
 *
 * Values are SET for consistency (not incremented) to match Mozaik's pattern:
 *   DA === A-child.DY,  C-child.DY = parent.DY - DA - DB
 */
function updateSectionDimensions(
  rawXml: string,
  product: MozProduct,
  shelfPartIndex: number,
  delta: number,
): string {
  if (Math.abs(delta) < 0.1) return rawXml

  const sections = parseSections(rawXml)
  if (sections.length === 0) return rawXml

  const deltaUnits = Math.round(delta * 10) // mm → 0.1mm

  // Find FS (Fixed Shelf) sections
  const fsSections = sections.filter(s => s.divideType === 'FS')
  if (fsSections.length === 0) return rawXml

  // Sort shelves by Z (lowest first)
  const shelves = findFixedShelves(product)
    .map(i => ({ index: i, z: product.parts[i].z }))
    .sort((a, b) => a.z - b.z)

  // Sort FS sections by tree depth (deepest first = lowest shelf)
  const fsByDepth = [...fsSections].sort(
    (a, b) => sectionDepth(b, sections) - sectionDepth(a, sections),
  )

  // Map moved shelf to its FS section by ordering
  const shelfOrder = shelves.findIndex(s => s.index === shelfPartIndex)
  if (shelfOrder < 0 || shelfOrder >= fsByDepth.length) return rawXml

  const targetFS = fsByDepth[shelfOrder]
  const modified = new Set<number>()

  // 1. Target FS section: update DA (A-child allocation)
  targetFS.da += deltaUnits
  modified.add(targetFS.id)

  // 2. A-child: SET DY to match parent's DA (consistent section tree)
  const aChild = findChild(sections, targetFS.id, 'A')
  if (aChild) {
    aChild.dy = targetFS.da
    modified.add(aChild.id)

    // 3. If A-child is also FS, its C-grandchild absorbs the DY growth
    if (aChild.divideType === 'FS') {
      const grandC = findChild(sections, aChild.id, 'C')
      if (grandC) {
        grandC.dy = aChild.dy - aChild.da - aChild.db
        modified.add(grandC.id)
      }
    }
  }

  // 4. C-child: SET DY to remainder, SET Y to after A-child + shelf
  const cChild = findChild(sections, targetFS.id, 'C')
  if (cChild) {
    cChild.dy = targetFS.dy - targetFS.da - targetFS.db
    cChild.y = (aChild?.y ?? targetFS.y) + targetFS.da + targetFS.db
    modified.add(cChild.id)
  }

  // Apply changes by replacing attribute values in XML
  let xml = rawXml
  for (const section of sections) {
    if (!modified.has(section.id)) continue
    const origTag = section.rawTag
    let newTag = origTag
    newTag = replAttrInTag(newTag, 'DY', section.dy)
    newTag = replAttrInTag(newTag, 'DA', section.da)
    newTag = replAttrInTag(newTag, 'Y', section.y)
    if (newTag !== origTag) {
      xml = xml.replace(origTag, newTag)
    }
  }

  return xml
}

/**
 * Move a shelf and its associated rod/hangers to a new Z position.
 * Returns a new MozProduct with updated parts and rawInnerXml.
 */
export function moveShelfGroup(
  product: MozProduct,
  shelfPartIndex: number,
  newZ: number,
): MozProduct {
  const group = findShelfGroup(product, shelfPartIndex)
  if (!group) return product

  const bounds = computeShelfBounds(product, shelfPartIndex)
  const clampedZ = Math.max(bounds.minZ, Math.min(bounds.maxZ, snapToGrid(newZ)))
  const delta = clampedZ - group.shelfZ

  if (Math.abs(delta) < 0.1) return product

  // Collect all indices that need Z shift
  const moveIndices = new Set([group.shelfIndex, ...group.rodIndices, ...group.hangerIndices])

  // Build XML change list before modifying parts
  const xmlChanges: Array<{ partName: string; oldZ: number; newZ: number }> = []
  for (const idx of moveIndices) {
    const part = product.parts[idx]
    xmlChanges.push({ partName: part.name, oldZ: part.z, newZ: part.z + delta })
  }

  // Update parts
  const newParts = product.parts.map((p, i) =>
    moveIndices.has(i) ? { ...p, z: p.z + delta } : p,
  )

  // Update rawInnerXml: CabProdPart Z values + ProductInterior section dimensions
  let newRawInnerXml = product.rawInnerXml
    ? updatePartZInRawXml(product.rawInnerXml, xmlChanges)
    : ''
  newRawInnerXml = updateSectionDimensions(newRawInnerXml, product, shelfPartIndex, delta)

  return {
    ...product,
    parts: newParts,
    rawInnerXml: newRawInnerXml,
  }
}
