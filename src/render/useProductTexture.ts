/**
 * Hook to load a Mozaik texture from the linked texture folder.
 * Returns a Three.js Texture (or null while loading / if unavailable).
 */

import { useEffect, useState } from 'react'
import { TextureLoader, RepeatWrapping, SRGBColorSpace } from 'three'
import type { Texture } from 'three'
import { getTextureMap } from '../mozaik/textureMap'
import type { TextureEntry } from '../mozaik/textureMap'

// Cache loaded textures by textureId to avoid reloading
const textureCache = new Map<number, Texture>()
const pendingLoads = new Map<number, Promise<Texture | null>>()

/** Look up a texture entry by ID from the parsed Textures.dat map. */
export function lookupTexture(textureId: number): TextureEntry | undefined {
  return getTextureMap().get(textureId)
}

/**
 * Load a texture from the user's linked texture folder.
 * Returns null if folder is not linked, texture ID is unknown, or file is missing.
 */
export function useProductTexture(
  textureFolder: FileSystemDirectoryHandle | null,
  textureId: number | null,
): Texture | null {
  const [texture, setTexture] = useState<Texture | null>(null)

  useEffect(() => {
    if (!textureFolder || !textureId) {
      setTexture(null)
      return
    }

    // Check cache first
    const cached = textureCache.get(textureId)
    if (cached) {
      setTexture(cached)
      return
    }

    // Avoid duplicate concurrent loads
    let cancelled = false
    const existing = pendingLoads.get(textureId)
    const loadPromise = existing ?? loadTextureFromFolder(textureFolder, textureId)
    if (!existing) pendingLoads.set(textureId, loadPromise)

    loadPromise.then((tex) => {
      pendingLoads.delete(textureId)
      if (!cancelled) setTexture(tex)
    })

    return () => { cancelled = true }
  }, [textureFolder, textureId])

  return texture
}

/** Reverse-lookup: find a TextureEntry by its image filename. */
export function lookupTextureByFilename(filename: string): TextureEntry | undefined {
  const map = getTextureMap()
  for (const entry of map.values()) {
    if (entry.imageFile.toLowerCase() === filename.toLowerCase()) return entry
  }
  return undefined
}

/**
 * Load a texture by filename from the user's linked texture folder.
 * Returns null if folder/filename is not available.
 */
export function useTextureByFilename(
  textureFolder: FileSystemDirectoryHandle | null,
  filename: string | null,
): Texture | null {
  const [texture, setTexture] = useState<Texture | null>(null)

  useEffect(() => {
    if (!textureFolder || !filename) {
      setTexture(null)
      return
    }

    // Check cache by filename
    const cacheKey = `file:${filename}`
    const cached = fileTextureCache.get(cacheKey)
    if (cached) {
      setTexture(cached)
      return
    }

    let cancelled = false
    loadTextureByFilename(textureFolder, filename).then((tex) => {
      if (!cancelled) setTexture(tex)
    })

    return () => { cancelled = true }
  }, [textureFolder, filename])

  return texture
}

// Cache for filename-based loading (separate from ID-based cache)
const fileTextureCache = new Map<string, Texture>()

async function loadTextureByFilename(
  folder: FileSystemDirectoryHandle,
  filename: string,
): Promise<Texture | null> {
  const cacheKey = `file:${filename}`
  const cached = fileTextureCache.get(cacheKey)
  if (cached) return cached

  try {
    const fileHandle = await folder.getFileHandle(filename)
    const file = await fileHandle.getFile()
    const url = URL.createObjectURL(file)

    const loader = new TextureLoader()
    const tex = await new Promise<Texture>((resolve, reject) => {
      loader.load(url, resolve, undefined, reject)
    })

    tex.colorSpace = SRGBColorSpace
    tex.wrapS = RepeatWrapping
    tex.wrapT = RepeatWrapping
    tex.needsUpdate = true

    fileTextureCache.set(cacheKey, tex)
    console.log(`[TEXTURE] Loaded by filename: "${filename}"`)
    return tex
  } catch (e) {
    console.warn(`[TEXTURE] Failed to load "${filename}":`, e)
    return null
  }
}

async function loadTextureFromFolder(
  folder: FileSystemDirectoryHandle,
  textureId: number,
): Promise<Texture | null> {
  const entry = lookupTexture(textureId)
  if (!entry) {
    console.warn(`[TEXTURE] Unknown texture ID: ${textureId}`)
    return null
  }

  try {
    const fileHandle = await folder.getFileHandle(entry.imageFile)
    const file = await fileHandle.getFile()
    const url = URL.createObjectURL(file)

    const loader = new TextureLoader()
    const tex = await new Promise<Texture>((resolve, reject) => {
      loader.load(url, resolve, undefined, reject)
    })

    tex.colorSpace = SRGBColorSpace
    tex.wrapS = RepeatWrapping
    tex.wrapT = RepeatWrapping
    // Default repeat — individual parts will clone and adjust per their dimensions
    tex.needsUpdate = true

    textureCache.set(textureId, tex)
    console.log(`[TEXTURE] Loaded "${entry.imageFile}" (ID=${textureId}, tile=${entry.uvw}×${entry.uvh}mm)`)

    // Don't revoke URL — Three.js may need it for GPU upload
    return tex
  } catch (e) {
    console.warn(`[TEXTURE] Failed to load "${entry.imageFile}":`, e)
    return null
  }
}
