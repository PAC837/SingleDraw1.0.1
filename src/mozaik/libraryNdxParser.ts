/**
 * Parser for Mozaik Library.ndx files.
 * Library.ndx defines the folder hierarchy for product libraries using
 * <Node> elements with Name, ID, ParentID, IsFolder attributes.
 * Product node Name → MOZ filename: "96 DH" → "96 DH.moz"
 */

export interface LibraryFolder {
  name: string
  id: number
  parentId: number
  children: LibraryFolder[]
  products: string[]  // product names (MOZ filenames without .moz)
}

interface RawNode {
  name: string
  id: number
  parentId: number
  isFolder: boolean
}

/** Parse Library.ndx XML into a hierarchical folder tree. */
export function parseLibraryNdx(xml: string): LibraryFolder[] {
  // Library.ndx starts with a version number line (e.g., "4") before the XML declaration
  const xmlStart = xml.indexOf('<?xml')
  const cleanXml = xmlStart >= 0 ? xml.slice(xmlStart) : xml

  const parser = new DOMParser()
  const doc = parser.parseFromString(cleanXml, 'text/xml')

  // Check for parse errors
  if (doc.querySelector('parsererror')) {
    console.warn('[LIBRARY.NDX] XML parse error — file may be malformed')
    return []
  }

  const nodeEls = doc.querySelectorAll('Node')

  const folders: RawNode[] = []
  const products: RawNode[] = []

  nodeEls.forEach(el => {
    const name = el.getAttribute('Name') ?? ''
    const id = parseInt(el.getAttribute('ID') ?? '0')
    const parentId = parseInt(el.getAttribute('ParentID') ?? '0')
    const isFolder = el.getAttribute('IsFolder') === 'True'
    const node: RawNode = { name, id, parentId, isFolder }
    if (isFolder) folders.push(node)
    else products.push(node)
  })

  // Build folder map
  const folderMap = new Map<number, LibraryFolder>()
  for (const f of folders) {
    folderMap.set(f.id, { name: f.name, id: f.id, parentId: f.parentId, children: [], products: [] })
  }

  // Assign products to their parent folders
  const orphanProducts: string[] = []
  for (const p of products) {
    const parent = folderMap.get(p.parentId)
    if (parent) parent.products.push(p.name)
    else orphanProducts.push(p.name)
  }

  // Link child folders to parents
  for (const folder of folderMap.values()) {
    if (folder.parentId === 0) continue
    const parent = folderMap.get(folder.parentId)
    if (parent) parent.children.push(folder)
  }

  // Collect root-level folders (parentId = 0), preserving Library.ndx file order
  const roots = Array.from(folderMap.values())
    .filter(f => f.parentId === 0)

  // Add uncategorized bucket if there are orphan products
  if (orphanProducts.length > 0) {
    roots.push({
      name: 'Uncategorized',
      id: -1,
      parentId: 0,
      children: [],
      products: orphanProducts.sort((a, b) => a.localeCompare(b)),
    })
  }

  return roots
}

/** Recursively collect all product names under a folder (including sub-folders). */
export function collectAllProducts(folder: LibraryFolder): string[] {
  const result = [...folder.products]
  for (const child of folder.children) {
    result.push(...collectAllProducts(child))
  }
  return result
}

/** Count total products in a folder tree (including sub-folders). */
export function countProducts(folder: LibraryFolder): number {
  let count = folder.products.length
  for (const child of folder.children) count += countProducts(child)
  return count
}
