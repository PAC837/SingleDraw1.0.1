import { useCallback, useEffect, useMemo, useState } from 'react'
import { StoreProvider, useAppState, useAppDispatch } from './store'
import type { DebugOverlays, RenderMode } from './mozaik/types'
import Scene from './render/Scene'
import UIPanel from './render/UIPanel'
import RoomWalls from './render/RoomWalls'
import ProductView from './render/ProductView'
import DebugOverlaysComponent from './render/DebugOverlays'
import ProbeScene from './render/ProbeScene'
import FloorPlane from './render/FloorPlane'
import RoomFloor from './render/RoomFloor'
import HomeButton from './render/HomeButton'
import WallEditorButton from './render/WallEditorButton'
import VisibilityMenu from './render/VisibilityMenu'
import RenderModeButton from './render/RenderModeButton'
import ProductConfigButton from './render/ProductConfigButton'
import WallEditorPanel from './render/WallEditorPanel'
import PlanViewOverlay from './render/PlanViewOverlay'
import MiniRoomPreview from './render/MiniRoomPreview'
import AutoEndPanels from './render/AutoEndPanels'
import AdvancedSettingsButton from './render/AdvancedSettingsButton'
import UnitTypePills from './render/UnitTypePills'
import AdminButton from './render/AdminButton'
import AdminPanel from './render/AdminPanel'
import PartInspector from './render/PartInspector'
import { loadLibraryConfig } from './export/libraryConfigStore'
import { useControlledLibrary } from './hooks/useControlledLibrary'
import { createRectangularRoom, createReachInRoom, createWalkInRoom, createWalkInDeepRoom, createAngledRoom } from './mozaik/roomFactory'
import { computeProductWorldOffset, computeWallGeometries } from './math/wallMath'
import { mozPosToThree } from './math/basis'
import { lookupTextureByFilename } from './render/useProductTexture'
import { useMissingModels } from './render/useProductModel'
import { useFolderActions } from './hooks/useFolderActions'
import { useProductActions } from './hooks/useProductActions'

function AppInner() {
  const state = useAppState()
  const dispatch = useAppDispatch()
  const missingModels = useMissingModels()
  const [hoveredWall, setHoveredWall] = useState<number | null>(null)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  // Folder & export actions (persisted folder linking, library loading, DES/MOZ export)
  const {
    linkJobFolder, linkTextureFolder, linkLibraryFolder,
    linkSketchUpFolder, linkModelsFolder,
    generateGlbScript, loadFromLibrary, exportDes, exportMoz,
  } = useFolderActions()

  // Product placement, manipulation, collision-clamped movement, bump
  const {
    handlePlaceProduct, handleUpdateProductDimension, handleResizeProductWidth, handleRemoveProduct,
    handleRemoveProducts, selectProduct, handleUpdateProductElev, handleUpdateProductX,
    handleBumpLeft, handleBumpRight,
  } = useProductActions()

  // Controlled Library Method: folder tree, dynamic groups, unit type pills
  const { folderTree, columns, assignments, dynamicGroups, handlePlaceGroup } =
    useControlledLibrary(handlePlaceProduct)

  // Build product parameter map for admin panel (filename → CabProdParm[])
  const productParams = useMemo(() => {
    const map: Record<string, import('./mozaik/types').CabProdParm[]> = {}
    for (const mf of state.standaloneProducts) {
      const filename = mf.product.prodName + '.moz'
      if (mf.product.parameters.length > 0) {
        map[filename] = mf.product.parameters
      }
    }
    return map
  }, [state.standaloneProducts])

  // Keyboard shortcuts: Ctrl+Z undo, Delete batch-remove, Escape clear selection
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'z') {
        e.preventDefault()
        dispatch({ type: 'UNDO' })
      }
      if (e.key === 'Delete' && state.selectedProducts.length > 0) {
        e.preventDefault()
        handleRemoveProducts([...state.selectedProducts])
      }
      if (e.key === 'Escape' && state.selectedProducts.length > 0) {
        e.preventDefault()
        dispatch({ type: 'CLEAR_SELECTION' })
      }
    }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [dispatch, state.selectedProducts, handleRemoveProducts])

  // Load persisted library config on startup
  useEffect(() => {
    loadLibraryConfig().then(config => {
      if (config) dispatch({ type: 'SET_LIBRARY_CONFIG', config })
    })
  }, [dispatch])

  // Auto-load active products from persisted config when library folder is ready
  useEffect(() => {
    if (state.libraryFolder && state.libraryConfig.activeProducts.length > 0) {
      loadFromLibrary(state.libraryConfig.activeProducts)
    }
  }, [state.libraryFolder, state.libraryConfig.activeProducts, loadFromLibrary])

  const toggleOverlay = useCallback(
    (key: keyof DebugOverlays) => dispatch({ type: 'TOGGLE_OVERLAY', key }),
    [dispatch],
  )

  const selectWall = useCallback(
    (wallNumber: number) => dispatch({ type: 'SELECT_WALL', wallNumber }),
    [dispatch],
  )

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

  // Resolve texture: user override → DES primaryTextureId → none
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
        edgeOpacity={state.edgeOpacity}
        onSetEdgeOpacity={(value: number) => dispatch({ type: 'SET_EDGE_OPACITY', value })}
        polygonOffsetFactor={state.polygonOffsetFactor}
        onSetPolygonOffsetFactor={(value: number) => dispatch({ type: 'SET_POLYGON_OFFSET_FACTOR', value })}
        polygonOffsetUnits={state.polygonOffsetUnits}
        onSetPolygonOffsetUnits={(value: number) => dispatch({ type: 'SET_POLYGON_OFFSET_UNITS', value })}
        renderPreset={state.renderPreset}
        onSetRenderPreset={(preset: string) => dispatch({ type: 'SET_RENDER_PRESET', preset })}
        ambientIntensity={state.ambientIntensity}
        onSetAmbientIntensity={(value: number) => dispatch({ type: 'SET_AMBIENT_INTENSITY', value })}
        directionalIntensity={state.directionalIntensity}
        onSetDirectionalIntensity={(value: number) => dispatch({ type: 'SET_DIRECTIONAL_INTENSITY', value })}
        warmth={state.warmth}
        onSetWarmth={(value: number) => dispatch({ type: 'SET_WARMTH', value })}
        exposure={state.exposure}
        onSetExposure={(value: number) => dispatch({ type: 'SET_EXPOSURE', value })}
        toneMapping={state.toneMapping}
        onSetToneMapping={(value: number) => dispatch({ type: 'SET_TONE_MAPPING', value })}
        bgColor={state.bgColor}
        onSetBgColor={(value: string) => dispatch({ type: 'SET_BG_COLOR', value })}
        hdriEnabled={state.hdriEnabled}
        onToggleHdri={() => dispatch({ type: 'TOGGLE_HDRI' })}
        hdriIntensity={state.hdriIntensity}
        onSetHdriIntensity={(value: number) => dispatch({ type: 'SET_HDRI_INTENSITY', value })}
      />
      <div className="flex-1 relative">
        <Scene
          orbitTarget={roomCenter}
          orthographic={state.wallEditorActive}
          roomWalls={state.wallEditorActive ? state.room?.walls : undefined}
          resetKey={state.cameraResetKey}
          onPointerMissed={() => {
            window.dispatchEvent(new Event('canvas-bg-click'))
            if (state.selectedWall !== null) dispatch({ type: 'SELECT_WALL', wallNumber: null })
            if (state.selectedProducts.length > 0) dispatch({ type: 'CLEAR_SELECTION' })
          }}
          ambientIntensity={state.ambientIntensity}
          directionalIntensity={state.directionalIntensity}
          warmth={state.warmth}
          exposure={state.exposure}
          toneMapping={state.toneMapping}
          bgColor={state.bgColor}
          hdriEnabled={state.hdriEnabled}
          hdriIntensity={state.hdriIntensity}
        >
          <DebugOverlaysComponent overlays={state.overlays} room={state.room} />

          {state.overlays.probeScene && <ProbeScene />}

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
              {state.wallEditorActive && (
                <PlanViewOverlay
                  room={state.room}
                  useInches={state.useInches}
                  dragTarget={state.dragTarget}
                  onSetDragTarget={(target) => dispatch({ type: 'SET_DRAG_TARGET', target })}
                  onMoveJoint={(jointIndex, newX, newY) => dispatch({ type: 'MOVE_JOINT', jointIndex, newX, newY })}
                  onMoveFixture={(fixtureIdTag, x) => dispatch({ type: 'MOVE_FIXTURE', fixtureIdTag, x })}
                  onUpdateFixture={(fixtureIdTag, fields) => dispatch({ type: 'UPDATE_FIXTURE', fixtureIdTag, fields })}
                  onExitPlanView={() => dispatch({ type: 'TOGGLE_WALL_EDITOR' })}
                />
              )}
            </>
          )}

          {/* Render room products — placed on their referenced walls */}
          {state.visibility.products && state.room?.products.map((product, i) => {
            const offset = computeProductWorldOffset(product, state.room!.walls, state.room!.wallJoints)
            if (!offset) console.warn(`[RENDER] Product "${product.prodName}" on wall "${product.wall}" — offset is null!`)
            const isSelected = state.selectedProducts.includes(i)
            const isLastSelected = isSelected && i === state.selectedProducts[state.selectedProducts.length - 1]
            return (
              <ProductView
                key={`room-${i}`}
                product={product}
                productIndex={i}
                worldOffset={offset?.position}
                wallAngleDeg={offset?.wallAngleDeg}
                renderMode={state.renderMode}
                showBoundingBox={state.overlays.boundingBoxes}
                selected={isSelected}
                onSelect={selectProduct}
                onResize={isLastSelected ? handleUpdateProductDimension : undefined}
                onResizeWidth={isLastSelected ? handleResizeProductWidth : undefined}
                onUpdateElev={isLastSelected ? handleUpdateProductElev : undefined}
                onUpdateX={isLastSelected ? handleUpdateProductX : undefined}
                onBumpLeft={isLastSelected ? handleBumpLeft : undefined}
                onBumpRight={isLastSelected ? handleBumpRight : undefined}
                onRemove={isLastSelected ? () => handleRemoveProducts([...state.selectedProducts]) : undefined}
                edgeOpacity={state.edgeOpacity}
                polyFactor={state.polygonOffsetFactor}
                polyUnits={state.polygonOffsetUnits}
                textureFolder={state.textureFolder}
                textureId={resolvedTextureId}
                textureFilename={resolvedTextureFilename}
                showOperations={state.showOperations}
                singleDrawBrand={state.selectedSingleDrawBrand}
                singleDrawTexture={state.selectedSingleDrawTexture}
                modelsFolder={state.modelsFolder}
                hoveredPart={state.hoveredPart}
              />
            )
          })}

          {/* Auto end panels — computed from product arrangement on walls */}
          {state.visibility.products && state.room && state.room.products.length > 0 && (
            <AutoEndPanels
              room={state.room}
              renderMode={state.renderMode}
              flipOps={state.flipOps}
              edgeOpacity={state.edgeOpacity}
              polyFactor={state.polygonOffsetFactor}
              polyUnits={state.polygonOffsetUnits}
              textureFolder={state.textureFolder}
              textureId={resolvedTextureId}
              textureFilename={resolvedTextureFilename}
              singleDrawBrand={state.selectedSingleDrawBrand}
              singleDrawTexture={state.selectedSingleDrawTexture}
              showOperations={state.showOperations}
            />
          )}

          {/* Render standalone MOZ products — only when no room (preview mode) */}
          {!state.room && state.standaloneProducts.map((mf, i) => (
            <ProductView
              key={`moz-${i}`}
              product={mf.product}
              renderMode={state.renderMode}
              showBoundingBox={state.overlays.boundingBoxes}
              edgeOpacity={state.edgeOpacity}
              polyFactor={state.polygonOffsetFactor}
              polyUnits={state.polygonOffsetUnits}
              textureFolder={state.textureFolder}
              textureId={resolvedTextureId}
              textureFilename={resolvedTextureFilename}
              showOperations={state.showOperations}
              singleDrawBrand={state.selectedSingleDrawBrand}
              singleDrawTexture={state.selectedSingleDrawTexture}
              modelsFolder={state.modelsFolder}
              hoveredPart={state.hoveredPart}
            />
          ))}
        </Scene>

        <div className="absolute top-3 left-3 z-10 flex items-start gap-2">
          <HomeButton
            active={state.wallEditorActive || state.productConfigOpen || state.visibilityMenuOpen || state.libraryOpen || state.adminOpen}
            onGoHome={() => dispatch({ type: 'GO_HOME' })}
          />
          <ProductConfigButton
            open={state.productConfigOpen}
            placementMode={state.placementMode}
            unitHeight={state.unitHeight}
            wallSectionHeight={state.wallSectionHeight}
            wallMountTopAt={state.wallMountTopAt}
            wallHeight={state.wallHeight}
            useInches={state.useInches}
            onToggle={() => dispatch({ type: 'TOGGLE_PRODUCT_CONFIG' })}
            onSetMode={(mode) => dispatch({ type: 'SET_PLACEMENT_MODE', mode })}
            onSetUnitHeight={(height) => dispatch({ type: 'SET_UNIT_HEIGHT', height })}
            onSetWallSectionHeight={(height) => dispatch({ type: 'SET_WALL_SECTION_HEIGHT', height })}
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
          <AdvancedSettingsButton
            open={advancedOpen}
            flipOps={state.flipOps}
            showOperations={state.showOperations}
            onToggle={() => setAdvancedOpen(o => !o)}
            onToggleFlipOps={() => dispatch({ type: 'TOGGLE_FLIP_OPS' })}
            onToggleShowOps={() => dispatch({ type: 'TOGGLE_SHOW_OPERATIONS' })}
            onAlignWallTops={() => dispatch({ type: 'ALIGN_WALL_TOPS' })}
          />
          <AdminButton
            open={state.adminOpen}
            onToggle={() => dispatch({ type: 'TOGGLE_ADMIN' })}
          />
        </div>

        <div className="absolute top-[96px] left-3 z-10">
          <UnitTypePills
            columns={columns}
            assignments={assignments}
            dynamicGroups={dynamicGroups}
            products={state.standaloneProducts}
            selectedWall={state.selectedWall}
            unitHeight={state.unitHeight}
            wallSectionHeight={state.wallSectionHeight}
            onPlaceProduct={(productIndex) => {
              if (state.selectedWall !== null) handlePlaceProduct(productIndex, state.selectedWall)
            }}
            onPlaceGroup={handlePlaceGroup}
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
              hasProducts={state.room.products.length > 0}
            />
          )
        })()}

        {state.wallEditorActive && state.room && (
          <MiniRoomPreview
            room={state.room}
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

        <PartInspector />

        {state.adminOpen && (
          <AdminPanel
            folderTree={folderTree}
            availableLibraryFiles={state.availableLibraryFiles}
            libraryConfig={state.libraryConfig}
            productParams={productParams}
            libraryFolder={state.libraryFolder}
            onUpdateConfig={(config) => dispatch({ type: 'SET_LIBRARY_CONFIG', config })}
            onRemoveProduct={(filename) => dispatch({ type: 'REMOVE_MOZ', filename })}
            onLoadProducts={loadFromLibrary}
            onClose={() => dispatch({ type: 'TOGGLE_ADMIN' })}
          />
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
