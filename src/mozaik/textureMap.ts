/**
 * Parses Mozaik Textures.dat to build a TextureId → filename lookup map.
 * Textures.dat has a 1-line numeric header then XML.
 */

import texturesDatRaw from '../../Mozaik Samples/Data/Textures.dat?raw'

export interface TextureEntry {
  id: number
  displayName: string
  imageFile: string    // e.g., "02 Snow Day.jpg"
  uvw: number          // tile width in mm (e.g., 609.6)
  uvh: number          // tile height in mm
  sheen: number
  grain: number
}

let cachedMap: Map<number, TextureEntry> | null = null

/** Parse Textures.dat XML and return Map<textureId, TextureEntry>. Cached after first call. */
export function getTextureMap(): Map<number, TextureEntry> {
  if (cachedMap) return cachedMap

  const map = new Map<number, TextureEntry>()

  // Strip numeric header line(s) before XML declaration
  const xmlStart = texturesDatRaw.indexOf('<?xml')
  const xmlText = xmlStart >= 0 ? texturesDatRaw.slice(xmlStart) : texturesDatRaw

  const parser = new DOMParser()
  const doc = parser.parseFromString(xmlText, 'text/xml')
  const textures = doc.querySelectorAll('Texture')

  for (const el of textures) {
    const id = parseInt(el.getAttribute('Id') ?? '0', 10)
    const imageFile = el.getAttribute('ImageFile') ?? ''
    if (!id || !imageFile) continue

    map.set(id, {
      id,
      displayName: el.getAttribute('DisplayName') ?? '',
      imageFile,
      uvw: parseFloat(el.getAttribute('UVW') ?? '609.6'),
      uvh: parseFloat(el.getAttribute('UVH') ?? '609.6'),
      sheen: parseInt(el.getAttribute('Sheen') ?? '0', 10),
      grain: parseInt(el.getAttribute('Grain') ?? '0', 10),
    })
  }

  console.log(`[TEXTURE] Parsed ${map.size} texture entries from Textures.dat`)
  cachedMap = map
  return map
}
