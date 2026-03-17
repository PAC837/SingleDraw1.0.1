import { useCallback, useMemo, useState } from 'react'
import { StoreProvider, useAppState, useAppDispatch } from './store'
import type { RenderMode, DebugOverlays } from './mozaik/types'
import Scene from './render/Scene'
import UIPanel from './render/UIPanel'
import RoomWalls from './render/RoomWalls'
import ProductView from './render/ProductView'
import DebugOverlaysComponent from './render/DebugOverlays'
import ProbeScene from './render/ProbeScene'
import FloorPlane from './render/FloorPlane'
import RoomFloor from './render/RoomFloor'
import AutoEndPanels from './render/AutoEndPanels'
import UnitTypePills from './render/UnitTypePills'
import PlanViewOverlay from './render/PlanViewOverlay'
import AppToolbar from './render/AppToolbar'
import AppOverlays from './render/AppOverlays'
import WallEditorSection from './render/WallEditorSection'
import { useControlledLibrary } from './hooks/useControlledLibrary'
import { createRectangularRoom, createReachInRoom, createWalkInRoom, createWalkInDeepRoom, createAngledRoom } from './mozaik/roomFactory'
import { computeProductWorldOffset, computeWallGeometries } from './math/wallMath'
import { mozPosToThree } from './math/basis'
import { lookupTextureByFilename } from './render/useProductTexture'
import { useMissingModels } from './render/useProductModel'
import { useFolderActions } from './hooks/useFolderActions'
import { useProductActions } from './hooks/useProductActions'
import { useAppInitialization } from './hooks/useAppInitialization'
import { useAppKeyboardShortcuts } from './hooks/useAppKeyboardShortcuts'

function AppInner() {
  const state = useAppState()
  const dispatch = useAppDispatch()
  const missingModels = useMissingModels()
  const [hoveredWall, setHoveredWall] = useState<number | null>(null)
  const [advancedOpen, setAdvancedOpen] = useState(false)

  const {
    linkJobFolder, linkTextureFolder, linkLibraryFolder,
    linkSketchUpFolder, linkModelsFolder,
    generateGlbScript, loadFromLibrary, exportDes, exportMoz,
  } = useFolderActions()

  const {
    handlePlaceProduct, handleUpdateProductDimension, handleResizeProductWidth, handleRemoveProduct,
    handleRemoveProducts, selectProduct, handleUpdateProductElev, handleUpdateProductX,
    handleBumpLeft, handleBumpRight,
  } = useProductActions()

  // Initialization effects (panel-close, library config, settings config, auto-load)
  useAppInitialization(setAdvancedOpen, loadFromLibrary)

  // Keyboard shortcuts (Ctrl+Z, Delete, Escape, arrow keys)
  useAppKeyboardShortcuts(handleRemoveProducts)

  const handleInspectPart = useCallback(
    (productIndex: number, partIndex: number) => {
      dispatch({ type: 'INSPECT_PART', part: { productIndex, partIndex } })
    },
    [dispatch],
  )

  const handleOpenElevation = useCallback(
    (productIndex: number) => {
      dispatch({ type: 'OPEN_ELEVATION_VIEWER', productIndex })
    },
    [dispatch],
  )

  const { folderTree, columns, assignments, dynamicGroups, handlePlaceGroup } =
    useControlledLibrary(handlePlaceProduct)

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

  const primaryTextureId = state.room?.primaryTextureId ?? null
  const resolvedTextureId = state.selectedTexture
    ? (lookupTextureByFilename(state.selectedTexture)?.id ?? null)
    : primaryTextureId
  const resolvedTextureFilename = state.selectedTexture ?? null

  const wallGeometries = useMemo(
    () => state.room ? computeWallGeometries(state.room.walls) : [],
    [state.room?.walls],
  )

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
                dragActive={!!state.dragProduct}
                dragHoveredWall={state.dragHoveredWall}
                onDragHoverWall={(wallNumber) => dispatch({ type: 'SET_DRAG_HOVERED_WALL', wallNumber })}
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
                  onDragStart={() => dispatch({ type: 'BEGIN_DRAG' })}
                  onDragEnd={() => dispatch({ type: 'END_DRAG' })}
                />
              )}
            </>
          )}

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
                onDragStart={isLastSelected ? () => dispatch({ type: 'BEGIN_DRAG' }) : undefined}
                onDragEnd={isLastSelected ? () => dispatch({ type: 'END_DRAG' }) : undefined}
                edgeOpacity={state.edgeOpacity}
                polyFactor={state.polygonOffsetFactor}
                polyUnits={state.polygonOffsetUnits}
                textureFolder={state.textureFolder}
                textureId={resolvedTextureId}
                textureFilename={resolvedTextureFilename}
                showOperations={state.showOperations}
                fastenerLargeDia={state.fastenerLargeDia}
                fastenerSmallDia={state.fastenerSmallDia}
                showShapeDebug={state.showShapeDebug}
                singleDrawBrand={state.selectedSingleDrawBrand}
                singleDrawTexture={state.selectedSingleDrawTexture}
                modelsFolder={state.modelsFolder}
                hoveredPart={state.hoveredPart}
                inspectedPart={state.inspectedPart}
                onInspectPart={handleInspectPart}
                onOpenElevation={handleOpenElevation}
              />
            )
          })}

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
              fastenerLargeDia={state.fastenerLargeDia}
              fastenerSmallDia={state.fastenerSmallDia}
              singleDrawBrand={state.selectedSingleDrawBrand}
              singleDrawTexture={state.selectedSingleDrawTexture}
              modelsFolder={state.modelsFolder}
              hoveredPart={state.hoveredPart}
              inspectedPart={state.inspectedPart}
              onInspectPart={handleInspectPart}
            />
          ))}
        </Scene>

        <AppToolbar
          advancedOpen={advancedOpen}
          setAdvancedOpen={setAdvancedOpen}
          hoveredWall={hoveredWall}
          setHoveredWall={setHoveredWall}
          handleCreatePresetRoom={handleCreatePresetRoom}
        />

        <div className="absolute top-[96px] left-3 z-10" style={{ display: state.productConfigOpen ? 'none' : undefined }}>
          <UnitTypePills
            columns={columns}
            assignments={assignments}
            dynamicGroups={dynamicGroups}
            products={state.standaloneProducts}
            unitHeight={state.unitHeight}
            wallSectionHeight={state.wallSectionHeight}
            hutchSectionHeight={state.hutchSectionHeight}
            baseCabHeight={state.baseCabHeight}
            spinning3DCards={state.spinning3DCards}
            onStartDrag={(product, productIndex, group, unitTypeId) =>
              dispatch({ type: 'START_PRODUCT_DRAG', product, productIndex, group, unitTypeId })
            }
          />
        </div>

        <WallEditorSection roomCenter={roomCenter} selectWall={selectWall} />

        <AppOverlays
          missingModels={missingModels}
          folderTree={folderTree}
          productParams={productParams}
          loadFromLibrary={loadFromLibrary}
          handlePlaceProduct={handlePlaceProduct}
          handlePlaceGroup={handlePlaceGroup}
        />
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
