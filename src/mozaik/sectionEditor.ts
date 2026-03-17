/**
 * ProductInterior section parsing and dimension updates for shelf movement.
 */
import type { MozProduct } from './types'

/** Parsed section from ProductInterior XML. */
export interface ParsedSection {
  id: number
  pParent: number
  parentABC: string
  divideType: string
  dy: number
  da: number
  db: number
  y: number
  rawTag: string
}

/** Extract an attribute value from an XML tag string. */
export function sectionAttr(tag: string, name: string): string {
  const m = tag.match(new RegExp(`\\b${name}="([^"]*)"`))
  return m ? m[1] : ''
}

/** Parse all <Section> elements from rawInnerXml. */
export function parseSections(rawXml: string): ParsedSection[] {
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

/** Compute tree depth of a section via pParent chain. */
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

/** Find a child section by pParent + ParentABC. */
function findChild(
  sections: ParsedSection[],
  parentId: number,
  side: 'A' | 'C',
): ParsedSection | undefined {
  return sections.find(s => s.pParent === parentId && s.parentABC === side)
}

/** Find all fixed shelf part indices in a product. */
function findFixedShelvesLocal(product: MozProduct): number[] {
  return product.parts
    .map((p, i) => {
      const t = p.type.toLowerCase()
      return (t === 'fixedshelf' || t === 'fixed shelf' || p.reportName.includes('F.Shelf')) ? i : -1
    })
    .filter(i => i >= 0)
}

/**
 * Update ProductInterior section dimensions when a shelf moves.
 */
export function updateSectionDimensions(
  rawXml: string,
  product: MozProduct,
  shelfPartIndex: number,
  delta: number,
): string {
  if (Math.abs(delta) < 0.1) return rawXml

  const sections = parseSections(rawXml)
  if (sections.length === 0) return rawXml

  const deltaUnits = Math.round(delta * 10)

  const fsSections = sections.filter(s => s.divideType === 'FS')
  if (fsSections.length === 0) return rawXml

  const shelves = findFixedShelvesLocal(product)
    .map(i => ({ index: i, z: product.parts[i].z }))
    .sort((a, b) => a.z - b.z)

  const fsByDepth = [...fsSections].sort(
    (a, b) => sectionDepth(b, sections) - sectionDepth(a, sections),
  )

  const shelfOrder = shelves.findIndex(s => s.index === shelfPartIndex)
  if (shelfOrder < 0 || shelfOrder >= fsByDepth.length) return rawXml

  const targetFS = fsByDepth[shelfOrder]
  const modified = new Set<number>()

  targetFS.da += deltaUnits
  modified.add(targetFS.id)

  const aChild = findChild(sections, targetFS.id, 'A')
  if (aChild) {
    aChild.dy = targetFS.da
    modified.add(aChild.id)
    if (aChild.divideType === 'FS') {
      const grandC = findChild(sections, aChild.id, 'C')
      if (grandC) {
        grandC.dy = aChild.dy - aChild.da - aChild.db
        modified.add(grandC.id)
      }
    }
  }

  const cChild = findChild(sections, targetFS.id, 'C')
  if (cChild) {
    cChild.dy = targetFS.dy - targetFS.da - targetFS.db
    cChild.y = (aChild?.y ?? targetFS.y) + targetFS.da + targetFS.db
    modified.add(cChild.id)
  }

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
