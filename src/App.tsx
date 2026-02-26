import { useCallback } from 'react'
import { StoreProvider, useAppState, useAppDispatch } from './store'
import type { DebugOverlays } from './mozaik/types'
import Scene from './render/Scene'
import UIPanel from './render/UIPanel'
import RoomWalls from './render/RoomWalls'
import WallOpenings from './render/WallOpenings'
import ProductView from './render/ProductView'
import DebugOverlaysComponent from './render/DebugOverlays'
import ProbeScene from './render/ProbeScene'
import { writeMoz } from './export/mozWriter'
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

  return (
    <div className="flex h-screen w-screen bg-[var(--bg-dark)]">
      <UIPanel
        room={state.room}
        products={state.standaloneProducts}
        overlays={state.overlays}
        selectedWall={state.selectedWall}
        useInches={state.useInches}
        onToggleOverlay={toggleOverlay}
        onToggleUnits={() => dispatch({ type: 'TOGGLE_UNITS' })}
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
              />
            )
          })}

          {/* Render standalone MOZ products */}
          {state.standaloneProducts.map((mf, i) => (
            <ProductView key={`moz-${i}`} product={mf.product} />
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
