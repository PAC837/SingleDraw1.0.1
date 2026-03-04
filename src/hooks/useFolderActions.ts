/**
 * Custom hook encapsulating all folder-linking callbacks,
 * folder restoration on mount, and file export actions.
 */

import { useCallback, useEffect } from 'react'
import { useAppState, useAppDispatch } from '../store'
import { parseMoz } from '../mozaik/mozParser'
import { writeMoz } from '../export/mozWriter'
import { writeDes } from '../export/desWriter'
import { findNextRoomNumber, exportDesRoom } from '../export/jobFolder'
import { saveFolderHandle, loadFolderHandle } from '../export/folderStore'

/** Scan a folder for image files and return sorted filenames. */
async function scanTextureFolder(folder: FileSystemDirectoryHandle): Promise<string[]> {
  const files: string[] = []
  for await (const entry of folder.values()) {
    if (entry.kind === 'file' && /\.(jpg|jpeg|png)$/i.test(entry.name)) {
      files.push(entry.name)
    }
  }
  return files.sort()
}

/** Scan a named subfolder for type subfolders containing texture images. */
async function scanSubfolderTextures(
  folder: FileSystemDirectoryHandle, subfolderName: string,
): Promise<Record<string, string[]>> {
  let subFolder: FileSystemDirectoryHandle
  try {
    subFolder = await folder.getDirectoryHandle(subfolderName)
  } catch {
    return {}
  }
  const result: Record<string, string[]> = {}
  for await (const entry of subFolder.values()) {
    if (entry.kind !== 'directory') continue
    try {
      const typeDir = await subFolder.getDirectoryHandle(entry.name)
      const files: string[] = []
      for await (const file of typeDir.values()) {
        if (file.kind === 'file' && /\.(jpg|jpeg|png)$/i.test(file.name)) files.push(file.name)
      }
      if (files.length > 0) result[entry.name] = files.sort()
    } catch { /* skip inaccessible subfolder */ }
  }
  return result
}

/** Scan a library folder for .moz product files. Checks Products/ subfolder first. */
async function scanLibraryFolder(folder: FileSystemDirectoryHandle): Promise<string[]> {
  let targetFolder = folder
  try {
    targetFolder = await folder.getDirectoryHandle('Products')
  } catch { /* No Products subfolder — scan root instead */ }

  const files: string[] = []
  for await (const entry of targetFolder.values()) {
    if (entry.kind === 'file' && /\.moz$/i.test(entry.name)) {
      files.push(entry.name)
    }
  }
  return files.sort()
}

export function useFolderActions() {
  const state = useAppState()
  const dispatch = useAppDispatch()

  // Restore persisted folder handles on mount
  useEffect(() => {
    loadFolderHandle('jobFolder').then((folder) => {
      if (folder) {
        dispatch({ type: 'SET_JOB_FOLDER', folder })
        console.log(`[JOB] Restored job folder: ${folder.name}`)
      }
    })
    loadFolderHandle('textureFolder').then(async (folder) => {
      if (!folder) return
      dispatch({ type: 'SET_TEXTURE_FOLDER', folder })
      console.log(`[TEXTURE] Restored texture folder: ${folder.name}`)
      try {
        const filenames = await scanTextureFolder(folder)
        dispatch({ type: 'SET_AVAILABLE_TEXTURES', filenames })
        console.log(`[TEXTURE] Scanned ${filenames.length} textures`)
      } catch (e) { console.warn('[TEXTURE] Scan failed on restore:', e) }
      try {
        const floorTextures = await scanSubfolderTextures(folder, 'SingleDraw_Floor')
        dispatch({ type: 'SET_SINGLEDRAW_FLOOR_TEXTURES', textures: floorTextures })
        console.log(`[TEXTURE] Floor types: ${Object.keys(floorTextures).length}`)
      } catch (e) { console.warn('[TEXTURE] Floor scan failed:', e) }
      try {
        const wallTextures = await scanSubfolderTextures(folder, 'SingleDraw_Walls')
        dispatch({ type: 'SET_SINGLEDRAW_WALL_TEXTURES', textures: wallTextures })
        console.log(`[TEXTURE] Wall types: ${Object.keys(wallTextures).length}`)
      } catch (e) { console.warn('[TEXTURE] Wall scan failed:', e) }
      try {
        const sdTextures = await scanSubfolderTextures(folder, 'SingleDraw_Textures')
        dispatch({ type: 'SET_SINGLEDRAW_TEXTURES', textures: sdTextures })
        console.log(`[TEXTURE] SingleDraw brands: ${Object.keys(sdTextures).length}`)
      } catch (e) { console.warn('[TEXTURE] SingleDraw scan failed:', e) }
    })
    loadFolderHandle('libraryFolder').then(async (folder) => {
      if (!folder) return
      dispatch({ type: 'SET_LIBRARY_FOLDER', folder })
      console.log(`[LIBRARY] Restored library folder: ${folder.name}`)
      try {
        const filenames = await scanLibraryFolder(folder)
        dispatch({ type: 'SET_AVAILABLE_LIBRARY_FILES', filenames })
        console.log(`[LIBRARY] Scanned ${filenames.length} .moz files`)
      } catch (e) { console.warn('[LIBRARY] Scan failed on restore:', e) }
    })
    loadFolderHandle('sketchUpFolder').then((folder) => {
      if (folder) {
        dispatch({ type: 'SET_SKETCHUP_FOLDER', folder })
        console.log(`[SKETCHUP] Restored SketchUp folder: ${folder.name}`)
      }
    })
    loadFolderHandle('modelsFolder').then((folder) => {
      if (folder) {
        dispatch({ type: 'SET_MODELS_FOLDER', folder })
        console.log(`[MODELS] Restored models folder: ${folder.name}`)
      }
    })
  }, [dispatch])

  const linkJobFolder = useCallback(async () => {
    try {
      const folder = await window.showDirectoryPicker({ mode: 'readwrite' })
      dispatch({ type: 'SET_JOB_FOLDER', folder })
      await saveFolderHandle('jobFolder', folder)
      console.log(`[JOB] Linked job folder: ${folder.name}`)
    } catch {
      console.log('[JOB] Folder picker cancelled')
    }
  }, [dispatch])

  const linkTextureFolder = useCallback(async () => {
    try {
      const folder = await window.showDirectoryPicker({ mode: 'read' })
      dispatch({ type: 'SET_TEXTURE_FOLDER', folder })
      await saveFolderHandle('textureFolder', folder)
      console.log(`[TEXTURE] Linked texture folder: ${folder.name}`)
      const filenames = await scanTextureFolder(folder)
      dispatch({ type: 'SET_AVAILABLE_TEXTURES', filenames })
      dispatch({ type: 'SET_SELECTED_TEXTURE', filename: null })
      console.log(`[TEXTURE] Scanned ${filenames.length} textures`)
      try {
        const floorTextures = await scanSubfolderTextures(folder, 'SingleDraw_Floor')
        dispatch({ type: 'SET_SINGLEDRAW_FLOOR_TEXTURES', textures: floorTextures })
        dispatch({ type: 'SET_FLOOR_TYPE', floorType: null })
        console.log(`[TEXTURE] Floor types: ${Object.keys(floorTextures).length}`)
      } catch (e) { console.warn('[TEXTURE] Floor scan failed:', e) }
      try {
        const wallTextures = await scanSubfolderTextures(folder, 'SingleDraw_Walls')
        dispatch({ type: 'SET_SINGLEDRAW_WALL_TEXTURES', textures: wallTextures })
        dispatch({ type: 'SET_WALL_TYPE', wallType: null })
        console.log(`[TEXTURE] Wall types: ${Object.keys(wallTextures).length}`)
      } catch (e) { console.warn('[TEXTURE] Wall scan failed:', e) }
      try {
        const sdTextures = await scanSubfolderTextures(folder, 'SingleDraw_Textures')
        dispatch({ type: 'SET_SINGLEDRAW_TEXTURES', textures: sdTextures })
        dispatch({ type: 'SET_SINGLEDRAW_BRAND', brand: null })
        console.log(`[TEXTURE] SingleDraw brands: ${Object.keys(sdTextures).length}`)
      } catch (e) { console.warn('[TEXTURE] SingleDraw scan failed:', e) }
    } catch {
      console.log('[TEXTURE] Folder picker cancelled')
    }
  }, [dispatch])

  const linkLibraryFolder = useCallback(async () => {
    try {
      const folder = await window.showDirectoryPicker({ mode: 'read' })
      dispatch({ type: 'SET_LIBRARY_FOLDER', folder })
      await saveFolderHandle('libraryFolder', folder)
      console.log(`[LIBRARY] Linked library folder: ${folder.name}`)
      const filenames = await scanLibraryFolder(folder)
      dispatch({ type: 'SET_AVAILABLE_LIBRARY_FILES', filenames })
      console.log(`[LIBRARY] Scanned ${filenames.length} .moz files`)
    } catch {
      console.log('[LIBRARY] Folder picker cancelled')
    }
  }, [dispatch])

  const linkSketchUpFolder = useCallback(async () => {
    try {
      const folder = await window.showDirectoryPicker({ mode: 'read' })
      dispatch({ type: 'SET_SKETCHUP_FOLDER', folder })
      await saveFolderHandle('sketchUpFolder', folder)
      console.log(`[SKETCHUP] Linked SketchUp folder: ${folder.name}`)
    } catch {
      console.log('[SKETCHUP] Folder picker cancelled')
    }
  }, [dispatch])

  const linkModelsFolder = useCallback(async () => {
    try {
      const folder = await window.showDirectoryPicker({ mode: 'read' })
      dispatch({ type: 'SET_MODELS_FOLDER', folder })
      await saveFolderHandle('modelsFolder', folder)
      console.log(`[MODELS] Linked models folder: ${folder.name}`)
    } catch {
      console.log('[MODELS] Folder picker cancelled')
    }
  }, [dispatch])

  const generateGlbScript = useCallback(async () => {
    if (!state.sketchUpFolder) return
    try {
      const skpFiles: string[] = []
      async function scanRecursive(dir: FileSystemDirectoryHandle) {
        for await (const entry of dir.values()) {
          if (entry.kind === 'file' && /\.skp$/i.test(entry.name)) {
            skpFiles.push(entry.name)
          } else if (entry.kind === 'directory') {
            try {
              const subDir = await dir.getDirectoryHandle(entry.name)
              await scanRecursive(subDir)
            } catch { /* skip inaccessible */ }
          }
        }
      }
      await scanRecursive(state.sketchUpFolder)

      let alreadyConverted = 0
      if (state.modelsFolder) {
        const glbFiles = new Set<string>()
        for await (const entry of state.modelsFolder.values()) {
          if (entry.kind === 'file' && /\.glb$/i.test(entry.name)) {
            glbFiles.add(entry.name.toLowerCase())
          }
        }
        alreadyConverted = skpFiles.filter(f => glbFiles.has(f.replace(/\.skp$/i, '.glb').toLowerCase())).length
      }
      const toConvert = skpFiles.length - alreadyConverted

      const script = `# SketchUp Ruby — Batch convert ALL SKP to GLB
# Paste this into Window > Ruby Console (or Extensions > Developer > Ruby Console)
src = UI.select_directory(title: "Select Mozaik shared folder (source)")
out = UI.select_directory(title: "Select GLB output folder")
if src && out
  files = Dir.glob(File.join(src, "**", "*.skp"))
  total = files.length
  done = 0
  files.each_with_index do |f, i|
    base = File.basename(f).sub(/\\.skp$/i, ".glb")
    dest = File.join(out, base)
    if File.exist?(dest)
      puts "  skip \#{base}"
      next
    end
    Sketchup.open_file(f)
    Sketchup.active_model.export(dest, false)
    done += 1
    puts "  [\#{i+1}/\#{total}] \#{base}"
  end
  UI.messagebox("Done! Converted \#{done} of \#{total} files to GLB.")
end`

      await navigator.clipboard.writeText(script)
      alert(`Script copied to clipboard!\n\n${skpFiles.length} .skp files found across all subfolders, ${alreadyConverted} already have .glb, ${toConvert} to convert.\n\nPaste into SketchUp Ruby Console.`)
      console.log(`[GLB] Generated recursive script: ${skpFiles.length} .skp files (${alreadyConverted} already converted)`)
    } catch (e) {
      console.error('[GLB] Failed to generate script:', e)
      alert(`Failed to scan SketchUp folder: ${e}`)
    }
  }, [state.sketchUpFolder, state.modelsFolder])

  const loadFromLibrary = useCallback(async (filenames: string[]) => {
    if (!state.libraryFolder || filenames.length === 0) return

    const alreadyLoaded = new Set(state.standaloneProducts.map(mf => mf.product.prodName))
    const toLoad = filenames.filter(f => !alreadyLoaded.has(f.replace(/\.moz$/i, '')))
    if (toLoad.length === 0) {
      console.log(`[LIBRARY] All ${filenames.length} products already loaded — skipping`)
      return
    }

    let targetFolder: FileSystemDirectoryHandle = state.libraryFolder
    try {
      targetFolder = await state.libraryFolder.getDirectoryHandle('Products')
    } catch { /* root fallback */ }

    const results = await Promise.allSettled(
      toLoad.map(async (filename) => {
        const fileHandle = await targetFolder.getFileHandle(filename)
        const file = await fileHandle.getFile()
        const text = await file.text()
        return parseMoz(text)
      })
    )

    let loaded = 0
    for (const r of results) {
      if (r.status === 'fulfilled') {
        dispatch({ type: 'LOAD_MOZ', file: r.value })
        loaded++
        console.log(`[LIBRARY] Loaded "${r.value.product.prodName}"`)
      } else {
        console.error(`[LIBRARY] Failed to load:`, r.reason)
      }
    }
    console.log(`[LIBRARY] Batch loaded ${loaded}/${toLoad.length} products (${filenames.length - toLoad.length} already loaded)`)
  }, [dispatch, state.libraryFolder, state.standaloneProducts])

  const exportDes = useCallback(async () => {
    if (!state.room || !state.jobFolder) return
    try {
      const content = writeDes(state.room, state.flipOps)
      const nextNum = await findNextRoomNumber(state.jobFolder)
      const filename = await exportDesRoom(state.jobFolder, content, nextNum)
      console.log(`[EXPORT] Exported ${filename} to ${state.jobFolder.name}`)
      alert(`Exported ${filename}`)
    } catch (e) {
      console.error('[EXPORT] DES export failed:', e)
      alert(`Export failed: ${e}`)
    }
  }, [state.room, state.jobFolder])

  const exportMoz = useCallback(
    (index: number) => {
      const mozFile = state.standaloneProducts[index]
      if (!mozFile) return
      const output = writeMoz(mozFile)
      const blob = new Blob([output], { type: 'text/xml' })
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${mozFile.product.prodName}_export.moz`
      a.click()
      URL.revokeObjectURL(url)
      console.log(`[EXPORT] Exported ${mozFile.product.prodName}`)
    },
    [state.standaloneProducts],
  )

  return {
    linkJobFolder,
    linkTextureFolder,
    linkLibraryFolder,
    linkSketchUpFolder,
    linkModelsFolder,
    generateGlbScript,
    loadFromLibrary,
    exportDes,
    exportMoz,
  }
}
