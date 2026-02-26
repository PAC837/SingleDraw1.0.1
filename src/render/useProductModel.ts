/**
 * Hook to load a GLB 3D model from the models folder.
 * Parts with SUPartName reference SketchUp models; user converts them to .glb.
 * Looks directly in the flat models folder root for .glb files.
 * Returns a cloned Three.js Group ready to render, or null if unavailable.
 */

import { useEffect, useState } from 'react'
import { Group } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

// Cache parsed GLTF scenes by glb filename
const modelCache = new Map<string, Group>()
const pendingLoads = new Map<string, Promise<Group | null>>()
const warnedMissing = new Set<string>()

const loader = new GLTFLoader()

/** Convert SUPartName (.skp) to .glb filename. */
function toGlbFilename(suPartName: string): string {
  return suPartName.replace(/\.skp$/i, '.glb')
}

async function loadModelFromFolder(
  folder: FileSystemDirectoryHandle,
  glbFilename: string,
): Promise<Group | null> {
  const cached = modelCache.get(glbFilename)
  if (cached) return cached

  try {
    const fileHandle = await folder.getFileHandle(glbFilename)
    const file = await fileHandle.getFile()
    const buffer = await file.arrayBuffer()

    const gltf = await new Promise<{ scene: Group }>((resolve, reject) => {
      loader.parse(buffer, '', resolve, reject)
    })

    const scene = gltf.scene
    modelCache.set(glbFilename, scene)
    console.log(`[MODEL] Loaded "${glbFilename}" from ${folder.name} (${(buffer.byteLength / 1024).toFixed(0)} KB)`)
    return scene
  } catch {
    // File not found in folder
  }

  if (!warnedMissing.has(glbFilename)) {
    warnedMissing.add(glbFilename)
    console.warn(`[MODEL] "${glbFilename}" not found in models folder`)
  }
  return null
}

/**
 * Load a GLB model for a part's SUPartName from the models folder.
 * Looks directly in the folder root for .glb files.
 * Returns a cloned Group (so each instance is independent), or null.
 */
export function useProductModel(
  modelsFolder: FileSystemDirectoryHandle | null,
  suPartName: string,
): Group | null {
  const [model, setModel] = useState<Group | null>(null)

  useEffect(() => {
    if (!modelsFolder || !suPartName) {
      setModel(null)
      return
    }

    const glbFilename = toGlbFilename(suPartName)

    // Check cache first
    const cached = modelCache.get(glbFilename)
    if (cached) {
      setModel(cached.clone())
      return
    }

    // Avoid duplicate concurrent loads
    let cancelled = false
    const existing = pendingLoads.get(glbFilename)
    const loadPromise = existing ?? loadModelFromFolder(modelsFolder, glbFilename)
    if (!existing) pendingLoads.set(glbFilename, loadPromise)

    loadPromise.then((scene) => {
      pendingLoads.delete(glbFilename)
      if (!cancelled) setModel(scene ? scene.clone() : null)
    })

    return () => { cancelled = true }
  }, [modelsFolder, suPartName])

  return model
}
