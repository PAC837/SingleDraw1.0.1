/**
 * Fixture reducer — add, remove, move, update fixtures.
 */
import type { AppState } from '../mozaik/types'
import type { Action } from '../store'

export function fixtureReducer(state: AppState, action: Action): AppState | null {
  switch (action.type) {
    case 'ADD_FIXTURE': {
      if (!state.room) return state
      return {
        ...state,
        room: { ...state.room, fixtures: [...state.room.fixtures, action.fixture], rawText: '' },
      }
    }
    case 'REMOVE_FIXTURE': {
      if (!state.room) return state
      return {
        ...state,
        room: {
          ...state.room,
          fixtures: state.room.fixtures.filter(f => f.idTag !== action.fixtureIdTag),
          rawText: '',
        },
      }
    }
    case 'MOVE_FIXTURE': {
      if (!state.room) return state
      const fixtures = state.room.fixtures.map(f => f.idTag === action.fixtureIdTag ? { ...f, x: action.x } : f)
      return { ...state, room: { ...state.room, fixtures, rawText: '' } }
    }
    case 'UPDATE_FIXTURE': {
      if (!state.room) return state
      const uf = state.room.fixtures.map(f => f.idTag === action.fixtureIdTag ? { ...f, ...action.fields } : f)
      return { ...state, room: { ...state.room, fixtures: uf, rawText: '' } }
    }
    default:
      return null
  }
}
