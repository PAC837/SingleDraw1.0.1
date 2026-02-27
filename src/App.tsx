import { useCallback, useEffect, useMemo } from 'react'
import { StoreProvider, useAppState, useAppDispatch } from './store'
import type { DebugOverlays, RenderMode } from './mozaik/types'
import Scene from './render/Scene'
import UIPanel from './render/UIPanel'
import RoomWalls from './render/RoomWalls'
import WallOpenings from './render/WallOpenings'
import ProductView from './render/ProductView'
import DebugOverlaysComponent from './render/DebugOverlays'
import ProbeScene from './render/ProbeScene'
import FloorPlane from './render/FloorPlane'
import RoomFloor from './render/RoomFloor'
import CameraClipPlane from './render/CameraClipPlane'
import { parseMoz } from './mozaik/mozParser'
import { createRectangularRoom } from './mozaik/roomFactory'
import { findNextAvailableX, placeProductOnWall, usableWallLength } from './mozaik/wallPlacement'
import { writeMoz } from './export/mozWriter'
import { writeDes } from './export/desWriter'
import { findNextRoomNumber, exportDesRoom } from './export/jobFolder'
import { saveFolderHandle, loadFolderHandle } from './export/folderStore'
import { computeProductWorldOffset, computeWallGeometries } from './math/wallMath'
import { mozPosToThree } from './math/basis'
import { lookupTextureByFilename } from './render/useProductTexture'

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

/** Scan a texture folder's "Floors" subfolder for floor texture images. */
async function scanFloorTextures(folder: FileSystemDirectoryHandle): Promise<string[]> {
  let floorsFolder: FileSystemDirectoryHandle
  try {
    floorsFolder = await folder.getDirectoryHandle('Floor')
  } catch {
    return []
  }
  const files: string[] = []
  for await (const entry of floorsFolder.values()) {
    if (entry.kind === 'file' && /\.(jpg|jpeg|png)$/i.test(entry.name)) {
      files.push(entry.name)
    }
  }
  return files.sort()
}

/** Scan a texture folder's "Walls" subfolder for wall texture images. */
async function scanWallTextures(folder: FileSystemDirectoryHandle): Promise<string[]> {
  let wallsFolder: FileSystemDirectoryHandle
  try {
    wallsFolder = await folder.getDirectoryHandle('Walls')
  } catch {
    return []
  }
  const files: string[] = []
  for await (const entry of wallsFolder.values()) {
    if (entry.kind === 'file' && /\.(jpg|jpeg|png)$/i.test(entry.name)) {
      files.push(entry.name)
    }
  }
  return files.sort()
}

/** Scan a library folder for .moz product files. Checks Products/ subfolder first. */
async function scanLibraryFolder(folder: FileSystemDirectoryHandle): Promise<string[]> {
  // Mozaik libraries store .moz files in a "Products" subfolder
  let targetFolder = folder
  try {
    targetFolder = await folder.getDirectoryHandle('Products')
  } catch {
    // No Products subfolder — scan root instead
  }

  const files: string[] = []
  for await (const entry of targetFolder.values()) {
    if (entry.kind === 'file' && /\.moz$/i.test(entry.name)) {
      files.push(entry.name)
    }
  }
  return files.sort()
}

function AppInner() {
  const state = useAppState()
  const dispatch = useAppDispatch()

  // Restore persisted folder handles on mount
  useEffect(() => {
    loadFolderHandle('textureFolder').then(async (folder) => {
      if (folder) {
        dispatch({ type: 'SET_TEXTURE_FOLDER', folder })
        console.log(`[TEXTURE] Restored texture folder: ${folder.name}`)
        const filenames = await scanTextureFolder(folder)
        dispatch({ type: 'SET_AVAILABLE_TEXTURES', filenames })
        console.log(`[TEXTURE] Scanned ${filenames.length} textures`)
        const floorFiles = await scanFloorTextures(folder)
        dispatch({ type: 'SET_AVAILABLE_FLOOR_TEXTURES', filenames: floorFiles })
        console.log(`[TEXTURE] Floor textures (Floors/ subfolder): ${floorFiles.length}`)
        const wallFiles = await scanWallTextures(folder)
        dispatch({ type: 'SET_AVAILABLE_WALL_TEXTURES', filenames: wallFiles })
        console.log(`[TEXTURE] Wall textures (Walls/ subfolder): ${wallFiles.length}`)
      }
    })
    loadFolderHandle('jobFolder').then((folder) => {
      if (folder) {
        dispatch({ type: 'SET_JOB_FOLDER', folder })
        console.log(`[JOB] Restored job folder: ${folder.name}`)
      }
    })
    loadFolderHandle('libraryFolder').then(async (folder) => {
      if (folder) {
        dispatch({ type: 'SET_LIBRARY_FOLDER', folder })
        console.log(`[LIBRARY] Restored library folder: ${folder.name}`)
        const filenames = await scanLibraryFolder(folder)
        dispatch({ type: 'SET_AVAILABLE_LIBRARY_FILES', filenames })
        console.log(`[LIBRARY] Scanned ${filenames.length} .moz files`)
      }
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

  const toggleOverlay = useCallback(
    (key: keyof DebugOverlays) => dispatch({ type: 'TOGGLE_OVERLAY', key }),
    [dispatch],
  )

  const selectWall = useCallback(
    (wallNumber: number) => dispatch({ type: 'SELECT_WALL', wallNumber }),
    [dispatch],
  )

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
      const floorFiles = await scanFloorTextures(folder)
      dispatch({ type: 'SET_AVAILABLE_FLOOR_TEXTURES', filenames: floorFiles })
      dispatch({ type: 'SET_SELECTED_FLOOR_TEXTURE', filename: null })
      console.log(`[TEXTURE] Floor textures (Floors/ subfolder): ${floorFiles.length}`)
      const wallFiles = await scanWallTextures(folder)
      dispatch({ type: 'SET_AVAILABLE_WALL_TEXTURES', filenames: wallFiles })
      dispatch({ type: 'SET_SELECTED_WALL_TEXTURE', filename: null })
      console.log(`[TEXTURE] Wall textures (Walls/ subfolder): ${wallFiles.length}`)
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
      // Deep-scan the SketchUp folder recursively for all .skp files
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

      // Check the GLB models folder for already-converted files
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

  const loadFromLibrary = useCallback(async (filename: string) => {
    if (!state.libraryFolder) return
    try {
      // Mozaik libraries store .moz files in a "Products" subfolder
      let targetFolder: FileSystemDirectoryHandle = state.libraryFolder
      try {
        targetFolder = await state.libraryFolder.getDirectoryHandle('Products')
      } catch { /* root fallback */ }
      const fileHandle = await targetFolder.getFileHandle(filename)
      const file = await fileHandle.getFile()
      const text = await file.text()
      const mozFile = parseMoz(text)
      dispatch({ type: 'LOAD_MOZ', file: mozFile })
      console.log(`[LIBRARY] Loaded "${mozFile.product.prodName}" from ${filename}`)
    } catch (e) {
      console.error(`[LIBRARY] Failed to load "${filename}":`, e)
    }
  }, [dispatch, state.libraryFolder])

  const exportDes = useCallback(async () => {
    if (!state.room || !state.jobFolder) return
    try {
      const content = writeDes(state.room)
      const nextNum = await findNextRoomNumber(state.jobFolder)
      const filename = await exportDesRoom(state.jobFolder, content, nextNum)
      console.log(`[EXPORT] Exported ${filename} to ${state.jobFolder.name}`)
      alert(`Exported ${filename}`)
    } catch (e) {
      console.error('[EXPORT] DES export failed:', e)
      alert(`Export failed: ${e}`)
    }
  }, [state.room, state.jobFolder])

  const selectTexture = useCallback(
    (filename: string | null) => dispatch({ type: 'SET_SELECTED_TEXTURE', filename }),
    [dispatch],
  )

  const handleCreateRoom = useCallback(
    (width: number, depth: number) => {
      const room = createRectangularRoom({ width, depth })
      dispatch({ type: 'CREATE_ROOM', room })
      console.log(`[ROOM] Created ${width}×${depth}mm room`)
    },
    [dispatch],
  )

  const handlePlaceProduct = useCallback(
    (productIndex: number, wallNumber: number) => {
      if (!state.room) return
      const mozFile = state.standaloneProducts[productIndex]
      if (!mozFile) return
      const usable = usableWallLength(wallNumber, state.room.walls, state.room.wallJoints)
      const nextX = findNextAvailableX(state.room.products, wallNumber, mozFile.product.width, usable)
      if (nextX === null) {
        alert('No space on this wall for that product')
        return
      }
      const placed = placeProductOnWall(mozFile.product, wallNumber, nextX)
      dispatch({ type: 'PLACE_PRODUCT', product: placed })
      console.log(`[ROOM] Placed "${mozFile.product.prodName}" on wall ${wallNumber} at x=${nextX}`)
    },
    [dispatch, state.room, state.standaloneProducts],
  )

  const handleUpdateProductDimension = useCallback(
    (index: number, field: 'width' | 'depth', value: number) => {
      dispatch({ type: 'UPDATE_ROOM_PRODUCT', index, field, value })
    },
    [dispatch],
  )

  const handleRemoveProduct = useCallback(
    (index: number) => {
      dispatch({ type: 'REMOVE_ROOM_PRODUCT', index })
    },
    [dispatch],
  )

  // Resolve texture: user override → DES primaryTextureId → none
  // If user picked a filename, reverse-lookup its textureId for UVW/UVH tiling
  const primaryTextureId = state.room?.primaryTextureId ?? null
  const resolvedTextureId = state.selectedTexture
    ? (lookupTextureByFilename(state.selectedTexture)?.id ?? null)
    : primaryTextureId
  const resolvedTextureFilename = state.selectedTexture ?? null

  // Pre-compute wall geometries for product wall-normal lookup
  const wallGeometries = useMemo(
    () => state.room ? computeWallGeometries(state.room.walls) : [],
    [state.room?.walls],
  )

  // Orbit target: center of the room footprint (or origin if no room)
  const roomCenter = useMemo((): [number, number, number] => {
    if (!state.room || state.room.walls.length === 0) return [0, 0, 0]
    const geos = wallGeometries.length > 0 ? wallGeometries : computeWallGeometries(state.room.walls)
    const cx = geos.reduce((s, g) => s + g.start[0], 0) / geos.length
    const cy = geos.reduce((s, g) => s + g.start[1], 0) / geos.length
    const h = state.room.parms.H_Walls / 2
    const center = mozPosToThree(cx, cy, h)
    return [center.x, center.y, center.z]
  }, [wallGeometries, state.room?.parms.H_Walls])

  return (
    <div className="flex h-screen w-screen bg-[var(--bg-dark)]">
      <UIPanel
        room={state.room}
        products={state.standaloneProducts}
        overlays={state.overlays}
        selectedWall={state.selectedWall}
        useInches={state.useInches}
        renderMode={state.renderMode}
        jobFolder={state.jobFolder}
        textureFolder={state.textureFolder}
        availableTextures={state.availableTextures}
        selectedTexture={state.selectedTexture}
        onToggleOverlay={toggleOverlay}
        onToggleUnits={() => dispatch({ type: 'TOGGLE_UNITS' })}
        onSetRenderMode={(mode: RenderMode) => dispatch({ type: 'SET_RENDER_MODE', mode })}
        onLinkJobFolder={linkJobFolder}
        onLinkTextureFolder={linkTextureFolder}
        onSelectTexture={selectTexture}
        availableFloorTextures={state.availableFloorTextures}
        selectedFloorTexture={state.selectedFloorTexture}
        onSelectFloorTexture={(filename: string | null) => dispatch({ type: 'SET_SELECTED_FLOOR_TEXTURE', filename })}
        availableWallTextures={state.availableWallTextures}
        selectedWallTexture={state.selectedWallTexture}
        onSelectWallTexture={(filename: string | null) => dispatch({ type: 'SET_SELECTED_WALL_TEXTURE', filename })}
        onExportDes={exportDes}
        onExportMoz={exportMoz}
        libraryFolder={state.libraryFolder}
        availableLibraryFiles={state.availableLibraryFiles}
        onLinkLibraryFolder={linkLibraryFolder}
        onLoadFromLibrary={loadFromLibrary}
        onGenerateGlbScript={generateGlbScript}
        sketchUpFolder={state.sketchUpFolder}
        onLinkSketchUpFolder={linkSketchUpFolder}
        modelsFolder={state.modelsFolder}
        onLinkModelsFolder={linkModelsFolder}
        onCreateRoom={handleCreateRoom}
        onPlaceProduct={handlePlaceProduct}
        onUpdateProductDimension={handleUpdateProductDimension}
        onRemoveProduct={handleRemoveProduct}
      />
      <div className="flex-1">
        <Scene orbitTarget={roomCenter}>
          <DebugOverlaysComponent overlays={state.overlays} room={state.room} />

          {state.overlays.probeScene && <ProbeScene />}

          <CameraClipPlane roomCenter={roomCenter} enabled={state.renderMode === 'solid'} />
          <FloorPlane />

          {state.room && state.room.walls.length > 0 && (
            <>
              <RoomFloor
                room={state.room}
                textureFolder={state.textureFolder}
                selectedFloorTexture={state.selectedFloorTexture}
              />
              <RoomWalls
                room={state.room}
                doubleSided={state.overlays.doubleSidedWalls}
                selectedWall={state.selectedWall}
                onSelectWall={selectWall}
                renderMode={state.renderMode}
                textureFolder={state.textureFolder}
                selectedWallTexture={state.selectedWallTexture}
              />
              <WallOpenings room={state.room} />
            </>
          )}

          {/* Render room products — placed on their referenced walls */}
          {state.room?.products.map((product, i) => {
            const offset = computeProductWorldOffset(product, state.room!.walls, state.room!.wallJoints)
            if (!offset) console.warn(`[RENDER] Product "${product.prodName}" on wall "${product.wall}" — offset is null!`)
            return (
              <ProductView
                key={`room-${i}`}
                product={product}
                worldOffset={offset?.position}
                wallAngleDeg={offset?.wallAngleDeg}
                renderMode={state.renderMode}
                showBoundingBox={state.overlays.boundingBoxes}
                textureFolder={state.textureFolder}
                textureId={resolvedTextureId}
                textureFilename={resolvedTextureFilename}
                modelsFolder={state.modelsFolder}
              />
            )
          })}

          {/* Render standalone MOZ products — only when no room (preview mode) */}
          {!state.room && state.standaloneProducts.map((mf, i) => (
            <ProductView
              key={`moz-${i}`}
              product={mf.product}
              renderMode={state.renderMode}
              showBoundingBox={state.overlays.boundingBoxes}
              textureFolder={state.textureFolder}
              textureId={resolvedTextureId}
              textureFilename={resolvedTextureFilename}
              modelsFolder={state.modelsFolder}
            />
          ))}
        </Scene>
      </div>
    </div>
  )
}

export default function App() {
  return (
    <StoreProvider>
      <AppInner />
    </StoreProvider>
  )
}
