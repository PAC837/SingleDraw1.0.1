/**
 * Wall editor reducer — wall geometry, joints, and follow-angle cases.
 */
import type { AppState } from '../mozaik/types'
import type { Action } from '../store'
import { updateWallLength, updateWallHeight, moveJoint, splitWallAtCenter, rebuildJoints, toggleFollowAngle, toggleJointMiter } from '../math/wallEditor'

export function wallReducer(state: AppState, action: Action): AppState | null {
  switch (action.type) {
    case 'TOGGLE_WALL_EDITOR':
      return { ...state, wallEditorActive: !state.wallEditorActive, selectedWall: null, dragTarget: null, visibilityMenuOpen: false }
    case 'SET_DRAG_TARGET':
      return { ...state, dragTarget: action.target }
    case 'UPDATE_WALL': {
      if (!state.room) return state
      let newWalls = state.room.walls
      if (action.fields.len !== undefined) {
        newWalls = updateWallLength(newWalls, action.wallNumber, action.fields.len)
      }
      if (action.fields.height !== undefined) {
        newWalls = updateWallHeight(newWalls, action.wallNumber, action.fields.height)
      }
      const directFields: Partial<Pick<import('../mozaik/types').MozWall, 'posX' | 'posY' | 'ang'>> = {}
      if (action.fields.posX !== undefined) directFields.posX = action.fields.posX
      if (action.fields.posY !== undefined) directFields.posY = action.fields.posY
      if (action.fields.ang !== undefined) directFields.ang = action.fields.ang
      if (Object.keys(directFields).length > 0) {
        newWalls = newWalls.map(w =>
          w.wallNumber === action.wallNumber ? { ...w, ...directFields } : w
        )
      }
      const newJoints = rebuildJoints(newWalls, state.room.wallJoints)
      return {
        ...state,
        room: { ...state.room, walls: newWalls, wallJoints: newJoints, rawText: '' },
      }
    }
    case 'SPLIT_WALL': {
      if (!state.room) return state
      const result = splitWallAtCenter(
        state.room.walls, state.room.wallJoints, state.room.products, action.wallNumber,
      )
      return {
        ...state,
        room: { ...state.room, walls: result.walls, wallJoints: result.joints, products: result.products, rawText: '' },
        selectedWall: null,
      }
    }
    case 'MOVE_JOINT': {
      if (!state.room) return state
      const movedWalls = moveJoint(
        state.room.walls, state.room.wallJoints, action.jointIndex, action.newX, action.newY,
      )
      const movedJoints = rebuildJoints(movedWalls, state.room.wallJoints)
      return {
        ...state,
        room: { ...state.room, walls: movedWalls, wallJoints: movedJoints, rawText: '' },
      }
    }
    case 'TOGGLE_FOLLOW_ANGLE': {
      if (!state.room) return state
      const faWalls = toggleFollowAngle(state.room.walls, action.wallNumber)
      return {
        ...state,
        room: { ...state.room, walls: faWalls, rawText: '' },
      }
    }
    case 'TOGGLE_JOINT_MITER': {
      if (!state.room) return state
      const mjJoint = state.room.wallJoints[action.jointIndex]
      if (!mjJoint) return state
      const mjJoints = toggleJointMiter(state.room.wallJoints, action.jointIndex)
      return {
        ...state,
        room: { ...state.room, wallJoints: mjJoints, rawText: '' },
      }
    }
    default:
      return null
  }
}
