/**
 * AppToolbar — Home, ProductConfig, WallEditor, Visibility, RenderMode, AdvancedSettings, Admin buttons.
 */
import { useAppState, useAppDispatch } from '../store'
import type { RenderMode } from '../mozaik/types'
import HomeButton from './HomeButton'
import ProductConfigButton from './ProductConfigButton'
import WallEditorButton from './WallEditorButton'
import VisibilityMenu from './VisibilityMenu'
import RenderModeButton from './RenderModeButton'
import AdvancedSettingsButton from './AdvancedSettingsButton'
import AdminButton from './AdminButton'

interface Props {
  advancedOpen: boolean
  setAdvancedOpen: (fn: (o: boolean) => boolean) => void
  hoveredWall: number | null
  setHoveredWall: (wall: number | null) => void
  handleCreatePresetRoom: (preset: 'reach-in' | 'walk-in' | 'walk-in-deep' | 'angled') => void
}

export default function AppToolbar({ advancedOpen, setAdvancedOpen, hoveredWall, setHoveredWall, handleCreatePresetRoom }: Props) {
  const state = useAppState()
  const dispatch = useAppDispatch()

  return (
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
        fixedShelfHeight={state.fixedShelfHeight}
        baseCabHeight={state.baseCabHeight}
        hutchSectionHeight={state.hutchSectionHeight}
        toeRecess={state.toeRecess}
        toeHeight={state.toeHeight}
        useInches={state.useInches}
        onToggle={() => {
          if (!state.productConfigOpen) window.dispatchEvent(new Event('panel-will-open'))
          dispatch({ type: 'TOGGLE_PRODUCT_CONFIG' })
        }}
        onSetMode={(mode) => dispatch({ type: 'SET_PLACEMENT_MODE', mode })}
        onSetUnitHeight={(height) => dispatch({ type: 'SET_UNIT_HEIGHT', height })}
        onSetFixedShelfHeight={(height) => dispatch({ type: 'SET_FIXED_SHELF_HEIGHT', height })}
        onSetBaseCabHeight={(height) => dispatch({ type: 'SET_BASE_CAB_HEIGHT', height })}
        onSetHutchSectionHeight={(height) => dispatch({ type: 'SET_HUTCH_SECTION_HEIGHT', height })}
        onSetWallSectionHeight={(height) => dispatch({ type: 'SET_WALL_SECTION_HEIGHT', height })}
        onSetWallHeight={(height) => dispatch({ type: 'SET_WALL_HEIGHT', height })}
        onSetToeRecess={(value) => dispatch({ type: 'SET_TOE_RECESS', value })}
        onSetToeHeight={(value) => dispatch({ type: 'SET_TOE_HEIGHT', value })}
        onCreatePresetRoom={handleCreatePresetRoom}
      />
      <WallEditorButton
        active={state.wallEditorActive}
        disabled={!state.room}
        onToggle={() => {
          if (!state.wallEditorActive) window.dispatchEvent(new Event('panel-will-open'))
          dispatch({ type: 'TOGGLE_WALL_EDITOR' })
        }}
      />
      <VisibilityMenu
        open={state.visibilityMenuOpen}
        visibility={state.visibility}
        walls={state.room?.walls ?? []}
        onToggle={() => {
          if (!state.visibilityMenuOpen) window.dispatchEvent(new Event('panel-will-open'))
          dispatch({ type: 'TOGGLE_VISIBILITY_MENU' })
        }}
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
        showShapeDebug={state.showShapeDebug}
        spinning3DCards={state.spinning3DCards}
        onToggle={() => {
          if (!advancedOpen) window.dispatchEvent(new Event('panel-will-open'))
          setAdvancedOpen(o => !o)
        }}
        onToggleFlipOps={() => dispatch({ type: 'TOGGLE_FLIP_OPS' })}
        onToggleShowOps={() => dispatch({ type: 'TOGGLE_SHOW_OPERATIONS' })}
        onToggleShapeDebug={() => dispatch({ type: 'TOGGLE_SHAPE_DEBUG' })}
        onToggleSpinning3DCards={() => dispatch({ type: 'TOGGLE_SPINNING_3D_CARDS' })}
        onAlignWallTops={() => dispatch({ type: 'ALIGN_WALL_TOPS' })}
      />
      <AdminButton
        open={state.adminOpen}
        onToggle={() => {
          if (!state.adminOpen) window.dispatchEvent(new Event('panel-will-open'))
          dispatch({ type: 'TOGGLE_ADMIN' })
        }}
      />
    </div>
  )
}
