/**
 * WallEditorSection — WallEditorPanel + MiniRoomPreview (conditional on wallEditorActive).
 */
import { useAppState, useAppDispatch } from '../store'
import WallEditorPanel from './WallEditorPanel'
import MiniRoomPreview from './MiniRoomPreview'

interface Props {
  roomCenter: [number, number, number]
  selectWall: (wallNumber: number) => void
}

export default function WallEditorSection({ roomCenter, selectWall }: Props) {
  const state = useAppState()
  const dispatch = useAppDispatch()

  if (!state.wallEditorActive || !state.room) return null

  return (
    <>
      {state.selectedWall !== null && (() => {
        const wall = state.room!.walls.find(w => w.wallNumber === state.selectedWall)
        if (!wall) return null
        const wallIdx = state.room!.walls.findIndex(w => w.wallNumber === state.selectedWall)
        const prevWall = state.room!.walls[(wallIdx - 1 + state.room!.walls.length) % state.room!.walls.length]
        const nextWall = state.room!.walls[(wallIdx + 1) % state.room!.walls.length]
        const hasTallerNeighbor = prevWall.height > wall.height || nextWall.height > wall.height
        const wallFixtures = state.room!.fixtures.filter(f => f.wall === wall.wallNumber)
        const maxIdTag = Math.max(
          0,
          ...state.room!.walls.map(w => w.idTag),
          ...state.room!.fixtures.map(f => f.idTag),
          ...state.room!.products.map(p => p.idTag),
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
            hasProducts={state.room!.products.length > 0}
          />
        )
      })()}

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
    </>
  )
}
