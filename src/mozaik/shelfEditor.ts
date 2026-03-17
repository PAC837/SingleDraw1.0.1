/**
 * Shelf editor logic for the Elevation Viewer.
 *
 * Finds shelf groups (shelf + rod + hangers that move together),
 * computes movement bounds, applies Z shifts, and updates rawInnerXml
 * for round-trip export fidelity.
 */

import type { MozProduct, MozPart } from './types'
import { parseSections, sectionAttr, updateSectionDimensions } from './sectionEditor'
import { updatePartZByIndex } from './xmlMutations'

// Re-export for backward compatibility (dimensionReducer imports from here)
export { removePartByIndexFromRawXml } from './xmlMutations'

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

/** Determine if a part is an adjustable shelf. */
function isAdjustableShelf(part: MozPart): boolean {
  const t = part.type.toLowerCase()
  return t === 'adjustableshelf' || t === 'adjustable shelf'
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
 * Find the "group" for an adjustable shelf (just the shelf itself, no rods/hangers).
 */
export function findAdjShelfGroup(product: MozProduct, shelfPartIndex: number): ShelfGroup | null {
  const shelf = product.parts[shelfPartIndex]
  if (!shelf || !isAdjustableShelf(shelf)) return null
  return { shelfIndex: shelfPartIndex, rodIndices: [], hangerIndices: [], shelfZ: shelf.z }
}

/** A vertical zone between structural boundaries. */
export interface ElevationZone {
  minZ: number      // top of lower boundary
  maxZ: number      // bottom of upper boundary
  hasDrawers: boolean
}

/**
 * Compute all vertical zones in a product, classified as open or blocked.
 * Zones are the vertical spans between structural boundaries (bottom/toe, fixed shelves, top).
 */
export function computeZones(product: MozProduct): ElevationZone[] {
  // Collect structural boundary Z values
  let floorZ = 0
  let ceilingZ = product.height
  const fixedShelfZs: number[] = []

  for (const p of product.parts) {
    const t = p.type.toLowerCase()
    if (t === 'bottom' || t === 'toe') {
      const topOfPart = p.z + 19
      if (topOfPart > floorZ) floorZ = topOfPart
    } else if (t === 'top') {
      if (p.z < ceilingZ) ceilingZ = p.z
    } else if (isFixedShelf(p)) {
      fixedShelfZs.push(p.z)
    }
  }

  // Sort boundary Z values and build zone list
  const boundaries = [floorZ, ...fixedShelfZs.sort((a, b) => a - b), ceilingZ]
  // Deduplicate
  const unique = boundaries.filter((z, i) => i === 0 || z > boundaries[i - 1])

  // Collect drawer faces
  const drawers = product.parts
    .filter(p => p.type.toLowerCase() === 'drawer')
    .map(p => ({ z: p.z, top: p.z + p.w }))

  const zones: ElevationZone[] = []
  for (let i = 0; i < unique.length - 1; i++) {
    const minZ = unique[i]
    const maxZ = unique[i + 1]
    // Zone has drawers if any drawer face overlaps it
    const hasDrawers = drawers.some(d => d.top > minZ + 1 && d.z < maxZ - 1)
    zones.push({ minZ, maxZ, hasDrawers })
  }
  return zones
}

/**
 * Compute bounds for an adjustable shelf with opening-aware logic.
 * Adj shelves can pass through fixed shelves as long as the zone on
 * the other side is open (no drawers).
 */
export function computeAdjShelfBounds(product: MozProduct, shelfPartIndex: number): ShelfBounds {
  const shelf = product.parts[shelfPartIndex]
  if (!shelf) return { minZ: 0, maxZ: product.height }

  const zones = computeZones(product)
  if (zones.length === 0) return { minZ: 0, maxZ: product.height }

  // Find which zone the shelf is currently in
  const currentIdx = zones.findIndex(z => shelf.z >= z.minZ - 0.5 && shelf.z <= z.maxZ + 0.5)
  if (currentIdx < 0) return computeShelfBounds(product, shelfPartIndex)

  // Expand downward through contiguous open zones
  let minZ = zones[currentIdx].minZ
  for (let i = currentIdx - 1; i >= 0; i--) {
    if (zones[i].hasDrawers) break
    minZ = zones[i].minZ
  }

  // Expand upward through contiguous open zones
  let maxZ = zones[currentIdx].maxZ
  for (let i = currentIdx + 1; i < zones.length; i++) {
    if (zones[i].hasDrawers) break
    maxZ = zones[i].maxZ
  }

  return {
    minZ: minZ + MIN_CLEARANCE,
    maxZ: maxZ - MIN_CLEARANCE,
  }
}

/**
 * Move an adjustable shelf to a new Z position.
 * Updates parts and rawInnerXml (section dimensions are a no-op for adj shelves).
 */
export function moveAdjShelfGroup(
  product: MozProduct,
  shelfPartIndex: number,
  newZ: number,
): MozProduct {
  const group = findAdjShelfGroup(product, shelfPartIndex)
  if (!group) return product

  const bounds = computeAdjShelfBounds(product, shelfPartIndex)
  const clampedZ = Math.max(bounds.minZ, Math.min(bounds.maxZ, snapToGrid(newZ)))
  const delta = clampedZ - group.shelfZ

  if (Math.abs(delta) < 0.1) return product

  const newParts = product.parts.map((p, i) =>
    i === shelfPartIndex ? { ...p, z: p.z + delta } : p,
  )

  let newRawInnerXml = product.rawInnerXml
    ? updatePartZByIndex(product.rawInnerXml, [{ partIndex: shelfPartIndex, newZ: product.parts[shelfPartIndex].z + delta }])
    : ''
  // updateSectionDimensions is a safe no-op for adj shelves (no FS section match)
  newRawInnerXml = updateSectionDimensions(newRawInnerXml, product, shelfPartIndex, delta)

  return { ...product, parts: newParts, rawInnerXml: newRawInnerXml }
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

  // Build index-based XML change list before modifying parts
  const xmlChanges: Array<{ partIndex: number; newZ: number }> = []
  for (const idx of moveIndices) {
    xmlChanges.push({ partIndex: idx, newZ: product.parts[idx].z + delta })
  }

  // Update parts
  const newParts = product.parts.map((p, i) =>
    moveIndices.has(i) ? { ...p, z: p.z + delta } : p,
  )

  // Update rawInnerXml: CabProdPart Z values + ProductInterior section dimensions
  let newRawInnerXml = product.rawInnerXml
    ? updatePartZByIndex(product.rawInnerXml, xmlChanges)
    : ''
  newRawInnerXml = updateSectionDimensions(newRawInnerXml, product, shelfPartIndex, delta)

  return {
    ...product,
    parts: newParts,
    rawInnerXml: newRawInnerXml,
  }
}
