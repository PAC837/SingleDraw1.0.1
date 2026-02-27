/**
 * Hook to load a GLB 3D model from the models folder.
 * Parts with SUPartName reference SketchUp models; user converts them to .glb.
 * Looks directly in the flat models folder root for .glb files.
 * Returns a cloned Three.js Group ready to render, or null if unavailable.
 */

import { useEffect, useState } from 'react'
import { Box3, Group, Vector3 } from 'three'
import { GLTFLoader } from 'three/examples/jsm/loaders/GLTFLoader.js'

// Cache parsed GLTF scenes by glb filename
const modelCache = new Map<string, Group>()
const pendingLoads = new Map<string, Promise<Group | null>>()
const warnedMissing = new Set<string>()
const missingListeners = new Set<() => void>()

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

    // Validate model has visible geometry — reject broken/empty/tiny models
    const bbox = new Box3().setFromObject(scene)
    const size = new Vector3()
    bbox.getSize(size)
    const maxDim = Math.max(size.x, size.y, size.z)
    if (maxDim < 1) {
      console.warn(`[MODEL] "${glbFilename}" has no visible geometry (bbox ${size.x.toFixed(1)}×${size.y.toFixed(1)}×${size.z.toFixed(1)}) — using placeholder`)
      return null
    }

    modelCache.set(glbFilename, scene)
    console.log(`[MODEL] Loaded "${glbFilename}" from ${folder.name} (${(buffer.byteLength / 1024).toFixed(0)} KB, bbox ${size.x.toFixed(1)}×${size.y.toFixed(1)}×${size.z.toFixed(1)})`)
    return scene
  } catch {
    // File not found in folder
  }

  if (!warnedMissing.has(glbFilename)) {
    warnedMissing.add(glbFilename)
    missingListeners.forEach(fn => fn())
    console.warn(`[MODEL] "${glbFilename}" not found in models folder`)
  }
  return null
}

/** React hook: returns list of GLB filenames that were requested but not found. */
export function useMissingModels(): string[] {
  const [, setTick] = useState(0)
  useEffect(() => {
    const listener = () => setTick(t => t + 1)
    missingListeners.add(listener)
    return () => { missingListeners.delete(listener) }
  }, [])
  return Array.from(warnedMissing)
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
