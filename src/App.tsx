import { useCallback } from 'react'
import { StoreProvider, useAppState, useAppDispatch } from './store'
import type { DebugOverlays, RenderMode } from './mozaik/types'
import Scene from './render/Scene'
import UIPanel from './render/UIPanel'
import RoomWalls from './render/RoomWalls'
import WallOpenings from './render/WallOpenings'
import ProductView from './render/ProductView'
import DebugOverlaysComponent from './render/DebugOverlays'
import ProbeScene from './render/ProbeScene'
import { writeMoz } from './export/mozWriter'
import { writeDes } from './export/desWriter'
import { pickJobFolder, findNextRoomNumber, exportDesRoom } from './export/jobFolder'
import { computeProductWorldOffset } from './math/wallMath'

function AppInner() {
  const state = useAppState()
  const dispatch = useAppDispatch()

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
      const folder = await pickJobFolder()
      dispatch({ type: 'SET_JOB_FOLDER', folder })
      console.log(`[JOB] Linked job folder: ${folder.name}`)
    } catch (e) {
      console.log('[JOB] Folder picker cancelled')
    }
  }, [dispatch])

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
        onToggleOverlay={toggleOverlay}
        onToggleUnits={() => dispatch({ type: 'TOGGLE_UNITS' })}
        onSetRenderMode={(mode: RenderMode) => dispatch({ type: 'SET_RENDER_MODE', mode })}
        onLinkJobFolder={linkJobFolder}
        onExportDes={exportDes}
        onExportMoz={exportMoz}
      />
      <div className="flex-1">
        <Scene>
          <DebugOverlaysComponent overlays={state.overlays} room={state.room} />

          {state.overlays.probeScene && <ProbeScene />}

          {state.room && state.room.walls.length > 0 && (
            <>
              <RoomWalls
                room={state.room}
                doubleSided={state.overlays.doubleSidedWalls}
                selectedWall={state.selectedWall}
                onSelectWall={selectWall}
                renderMode={state.renderMode}
              />
              <WallOpenings room={state.room} />
            </>
          )}

          {/* Render room products — placed on their referenced walls */}
          {state.room?.products.map((product, i) => {
            const offset = state.room
              ? computeProductWorldOffset(product, state.room.walls, state.room.wallJoints)
              : null
            return (
              <ProductView
                key={`room-${i}`}
                product={product}
                worldOffset={offset?.position}
                wallAngleDeg={offset?.wallAngleDeg}
                renderMode={state.renderMode}
                showBoundingBox={state.overlays.boundingBoxes}
              />
            )
          })}

          {/* Render standalone MOZ products */}
          {state.standaloneProducts.map((mf, i) => (
            <ProductView
              key={`moz-${i}`}
              product={mf.product}
              renderMode={state.renderMode}
              showBoundingBox={state.overlays.boundingBoxes}
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
