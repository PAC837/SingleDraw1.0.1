import { useCallback, useEffect, useMemo, useState } from 'react'
import { StoreProvider, useAppState, useAppDispatch } from './store'
import type { DebugOverlays, RenderMode } from './mozaik/types'
import Scene from './render/Scene'
import UIPanel from './render/UIPanel'
import RoomWalls from './render/RoomWalls'
// WallOpenings removed — fixture openings now rendered as wall geometry cutouts in RoomWalls
import ProductView from './render/ProductView'
import DebugOverlaysComponent from './render/DebugOverlays'
import ProbeScene from './render/ProbeScene'
import FloorPlane from './render/FloorPlane'
import RoomFloor from './render/RoomFloor'
import CameraClipPlane from './render/CameraClipPlane'
import HomeButton from './render/HomeButton'
import WallEditorButton from './render/WallEditorButton'
import VisibilityMenu from './render/VisibilityMenu'
import RenderModeButton from './render/RenderModeButton'
import ProductConfigButton from './render/ProductConfigButton'
import WallEditorPanel from './render/WallEditorPanel'
import PlanViewOverlay from './render/PlanViewOverlay'
import MiniRoomPreview from './render/MiniRoomPreview'
import { parseMoz } from './mozaik/mozParser'
import { createRectangularRoom, createReachInRoom, createWalkInRoom, createWalkInDeepRoom, createAngledRoom } from './mozaik/roomFactory'
import { findNextAvailableX, placeProductOnWall, usableWallLength } from './mozaik/wallPlacement'
import { writeMoz } from './export/mozWriter'
import { writeDes } from './export/desWriter'
import { findNextRoomNumber, exportDesRoom } from './export/jobFolder'
import { saveFolderHandle, loadFolderHandle } from './export/folderStore'
import { computeProductWorldOffset, computeWallGeometries } from './math/wallMath'
import { mozPosToThree } from './math/basis'
import { lookupTextureByFilename } from './render/useProductTexture'
import { useMissingModels } from './render/useProductModel'

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
  const missingModels = useMissingModels()
  const [hoveredWall, setHoveredWall] = useState<number | null>(null)

  // Restore persisted folder handles on mount
  useEffect(() => {
    loadFolderHandle('textureFolder').then(async (folder) => {
      if (folder) {
        dispatch({ type: 'SET_TEXTURE_FOLDER', folder })
        console.log(`[TEXTURE] Restored texture folder: ${folder.name}`)
        const filenames = await scanTextureFolder(folder)
        dispatch({ type: 'SET_AVAILABLE_TEXTURES', filenames })
        console.log(`[TEXTURE] Scanned ${filenames.length} textures`)
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

  const loadFromLibrary = useCallback(async (filenames: string[]) => {
    if (!state.libraryFolder || filenames.length === 0) return

    // Skip products already loaded (match by prodName derived from filename)
    const alreadyLoaded = new Set(state.standaloneProducts.map(mf => mf.product.prodName))
    const toLoad = filenames.filter(f => !alreadyLoaded.has(f.replace(/\.moz$/i, '')))
    if (toLoad.length === 0) {
      console.log(`[LIBRARY] All ${filenames.length} products already loaded — skipping`)
      return
    }

    // Mozaik libraries store .moz files in a "Products" subfolder
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
      const room = createRectangularRoom({ width, depth, height: state.wallHeight })
      dispatch({ type: 'CREATE_ROOM', room })
      console.log(`[ROOM] Created ${width}×${depth}mm room`)
    },
    [dispatch, state.wallHeight],
  )

  const handleCreatePresetRoom = useCallback(
    (preset: 'reach-in' | 'walk-in' | 'walk-in-deep' | 'angled') => {
      const h = state.wallHeight
      const factories = {
        'reach-in': createReachInRoom,
        'walk-in': createWalkInRoom,
        'walk-in-deep': createWalkInDeepRoom,
        'angled': createAngledRoom,
      }
      const room = factories[preset](h)
      dispatch({ type: 'CREATE_ROOM', room })
      console.log(`[ROOM] Created ${preset} preset (wall height ${Math.round(h)}mm)`)
    },
    [dispatch, state.wallHeight],
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
      const elev = state.placementMode === 'floor' ? 0
        : Math.max(0, state.wallMountTopAt - state.unitHeight)
      const placed = placeProductOnWall(mozFile.product, wallNumber, nextX, elev)
      dispatch({ type: 'PLACE_PRODUCT', product: placed })
      console.log(`[ROOM] Placed "${mozFile.product.prodName}" on wall ${wallNumber} at x=${nextX} elev=${elev}`)
    },
    [dispatch, state.room, state.standaloneProducts, state.placementMode, state.wallMountTopAt, state.unitHeight],
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
  }, [wallGeometries, state.room?.parms.H_Walls, state.room?.walls])

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
        singleDrawFloorTextures={state.singleDrawFloorTextures}
        selectedFloorType={state.selectedFloorType}
        selectedFloorTexture={state.selectedFloorTexture}
        onSetFloorType={(floorType: string | null) => dispatch({ type: 'SET_FLOOR_TYPE', floorType })}
        onSelectFloorTexture={(filename: string | null) => dispatch({ type: 'SET_SELECTED_FLOOR_TEXTURE', filename })}
        singleDrawWallTextures={state.singleDrawWallTextures}
        selectedWallType={state.selectedWallType}
        selectedWallTexture={state.selectedWallTexture}
        onSetWallType={(wallType: string | null) => dispatch({ type: 'SET_WALL_TYPE', wallType })}
        onSelectWallTexture={(filename: string | null) => dispatch({ type: 'SET_SELECTED_WALL_TEXTURE', filename })}
        singleDrawTextures={state.singleDrawTextures}
        selectedSingleDrawBrand={state.selectedSingleDrawBrand}
        selectedSingleDrawTexture={state.selectedSingleDrawTexture}
        onSetSingleDrawBrand={(brand: string | null) => dispatch({ type: 'SET_SINGLEDRAW_BRAND', brand })}
        onSetSingleDrawTexture={(filename: string | null) => dispatch({ type: 'SET_SINGLEDRAW_TEXTURE', filename })}
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
      <div className="flex-1 relative">
        <Scene orbitTarget={roomCenter} orthographic={state.wallEditorActive} resetKey={state.cameraResetKey} onPointerMissed={() => {
          if (state.selectedWall !== null) dispatch({ type: 'SELECT_WALL', wallNumber: null })
        }}>
          <DebugOverlaysComponent overlays={state.overlays} room={state.room} />

          {state.overlays.probeScene && <ProbeScene />}

          <CameraClipPlane roomCenter={roomCenter} enabled={state.renderMode === 'solid'} />
          {state.visibility.floor && <FloorPlane />}

          {state.room && state.room.walls.length > 0 && (
            <>
              {state.visibility.floor && (
                <RoomFloor
                  room={state.room}
                  textureFolder={state.textureFolder}
                  selectedFloorType={state.selectedFloorType}
                  selectedFloorTexture={state.selectedFloorTexture}
                />
              )}
              <RoomWalls
                room={state.room}
                doubleSided={state.overlays.doubleSidedWalls}
                selectedWall={state.selectedWall}
                hoveredWall={hoveredWall}
                onSelectWall={selectWall}
                renderMode={state.renderMode}
                textureFolder={state.textureFolder}
                selectedWallType={state.selectedWallType}
                selectedWallTexture={state.selectedWallTexture}
                hiddenWalls={
                  state.visibility.allWalls
                    ? state.visibility.walls
                    : Object.fromEntries(state.room.walls.map(w => [w.wallNumber, false]))
                }
              />
              {/* Fixture openings are now rendered as wall geometry cutouts in RoomWalls */}
              {state.wallEditorActive && (
                <PlanViewOverlay
                  room={state.room}
                  useInches={state.useInches}
                  dragTarget={state.dragTarget}
                  onSetDragTarget={(target) => dispatch({ type: 'SET_DRAG_TARGET', target })}
                  onMoveJoint={(jointIndex, newX, newY) => dispatch({ type: 'MOVE_JOINT', jointIndex, newX, newY })}
                />
              )}
            </>
          )}

          {/* Render room products — placed on their referenced walls */}
          {state.visibility.products && state.room?.products.map((product, i) => {
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
                singleDrawBrand={state.selectedSingleDrawBrand}
                singleDrawTexture={state.selectedSingleDrawTexture}
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
              singleDrawBrand={state.selectedSingleDrawBrand}
              singleDrawTexture={state.selectedSingleDrawTexture}
              modelsFolder={state.modelsFolder}
            />
          ))}
        </Scene>

        <div className="absolute top-3 left-3 z-10 flex items-start gap-2">
          <HomeButton
            active={state.wallEditorActive || state.productConfigOpen || state.visibilityMenuOpen}
            onGoHome={() => dispatch({ type: 'GO_HOME' })}
          />
          <ProductConfigButton
            open={state.productConfigOpen}
            placementMode={state.placementMode}
            unitHeight={state.unitHeight}
            wallMountTopAt={state.wallMountTopAt}
            wallHeight={state.wallHeight}
            useInches={state.useInches}
            onToggle={() => dispatch({ type: 'TOGGLE_PRODUCT_CONFIG' })}
            onSetMode={(mode) => dispatch({ type: 'SET_PLACEMENT_MODE', mode })}
            onSetUnitHeight={(height) => dispatch({ type: 'SET_UNIT_HEIGHT', height })}
            onSetTopAt={(height) => dispatch({ type: 'SET_WALL_MOUNT_TOP_AT', height })}
            onSetWallHeight={(height) => dispatch({ type: 'SET_WALL_HEIGHT', height })}
            onCreatePresetRoom={handleCreatePresetRoom}
          />
          <WallEditorButton
            active={state.wallEditorActive}
            disabled={!state.room}
            onToggle={() => dispatch({ type: 'TOGGLE_WALL_EDITOR' })}
          />
          <VisibilityMenu
            open={state.visibilityMenuOpen}
            visibility={state.visibility}
            walls={state.room?.walls ?? []}
            onToggle={() => dispatch({ type: 'TOGGLE_VISIBILITY_MENU' })}
            onToggleVisibility={(key) => dispatch({ type: 'TOGGLE_VISIBILITY', key })}
            onToggleWall={(wallNumber) => dispatch({ type: 'TOGGLE_WALL_VISIBILITY', wallNumber })}
            onHoverWall={setHoveredWall}
          />
          <RenderModeButton
            mode={state.renderMode}
            onCycle={() => {
              const next: RenderMode = state.renderMode === 'ghosted' ? 'solid' : state.renderMode === 'solid' ? 'wireframe' : 'ghosted'
              dispatch({ type: 'SET_RENDER_MODE', mode: next })
            }}
          />
        </div>

        {state.wallEditorActive && state.selectedWall !== null && state.room && (() => {
          const wall = state.room.walls.find(w => w.wallNumber === state.selectedWall)
          if (!wall) return null
          const wallIdx = state.room.walls.findIndex(w => w.wallNumber === state.selectedWall)
          const prevWall = state.room.walls[(wallIdx - 1 + state.room.walls.length) % state.room.walls.length]
          const nextWall = state.room.walls[(wallIdx + 1) % state.room.walls.length]
          const hasTallerNeighbor = prevWall.height > wall.height || nextWall.height > wall.height
          const wallFixtures = state.room.fixtures.filter(f => f.wall === wall.wallNumber)
          const maxIdTag = Math.max(
            0,
            ...state.room.walls.map(w => w.idTag),
            ...state.room.fixtures.map(f => f.idTag),
            ...state.room.products.map(p => p.idTag),
          )
          return (
            <WallEditorPanel
              wall={wall}
              useInches={state.useInches}
              hasTallerNeighbor={hasTallerNeighbor}
              fixtures={wallFixtures}
              onUpdateLength={(len) => dispatch({ type: 'UPDATE_WALL', wallNumber: wall.wallNumber, fields: { len } })}
              onUpdateHeight={(height) => dispatch({ type: 'UPDATE_WALL', wallNumber: wall.wallNumber, fields: { height } })}
              onSplitWall={() => dispatch({ type: 'SPLIT_WALL', wallNumber: wall.wallNumber })}
              onToggleFollowAngle={() => dispatch({ type: 'TOGGLE_FOLLOW_ANGLE', wallNumber: wall.wallNumber })}
              onAddFixture={(fixture) => dispatch({ type: 'ADD_FIXTURE', fixture })}
              onRemoveFixture={(idTag) => dispatch({ type: 'REMOVE_FIXTURE', fixtureIdTag: idTag })}
              nextIdTag={maxIdTag + 1}
            />
          )
        })()}

        {state.wallEditorActive && state.room && (
          <MiniRoomPreview
            room={state.room}
            renderMode={state.renderMode}
            roomCenter={roomCenter}
            selectedWall={state.selectedWall}
            onSelectWall={selectWall}
            textureFolder={state.textureFolder}
            selectedFloorType={state.selectedFloorType}
            selectedFloorTexture={state.selectedFloorTexture}
            selectedWallType={state.selectedWallType}
            selectedWallTexture={state.selectedWallTexture}
          />
        )}

        {missingModels.length > 0 && (
          <div className="absolute bottom-2 left-2 right-2 bg-yellow-900/80 text-yellow-200 text-xs p-2 rounded max-h-24 overflow-y-auto font-mono">
            <div className="font-bold mb-1">Missing GLB models ({missingModels.length}):</div>
            {missingModels.map(name => <div key={name}>{name}</div>)}
          </div>
        )}
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
