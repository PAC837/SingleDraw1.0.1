/**
 * Serialize a RoomSettingsTemplate back to <RoomSet>...</RoomSet> XML for DES export.
 *
 * Strategy: typed hardware/door fields override rawAttributes; rawChildrenXml passes through
 * verbatim for door settings and material templates that rarely change.
 */

import type { RoomSettingsTemplate } from '../mozaik/settingsTemplateParser'
import { ROOM_SET_XML } from './desTemplate'

/** Escape XML special characters in attribute values. */
function esc(value: string | number | boolean): string {
  return String(value).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
}

/** Mozaik PascalCase booleans. */
function boolStr(b: boolean): string {
  return b ? 'True' : 'False'
}

/**
 * Serialize a RoomSettingsTemplate to a <RoomSet ...>...</RoomSet> XML block.
 * Typed fields override rawAttributes for the fields the user can edit.
 */
export function serializeRoomSetXml(settings: RoomSettingsTemplate): string {
  // Start from raw attributes (preserves ALL original attrs for round-trip)
  const attrs = { ...settings.rawAttributes }

  // Override with typed hardware fields
  const hw = settings.hardware
  attrs['DrawerBox'] = hw.drawerBox
  attrs['DrawerGuide'] = hw.drawerGuide
  attrs['DrawerGuideSlowCloseOn'] = boolStr(hw.drawerGuideSlowCloseOn)
  attrs['DrawerGuideSpacerState'] = String(hw.drawerGuideSpacerState)
  attrs['ROTray'] = hw.roTray
  attrs['ROTrayGuide'] = hw.roTrayGuide
  attrs['ROTrayGuideSlowCloseOn'] = boolStr(hw.roTrayGuideSlowCloseOn)
  attrs['ROTrayGuideSpacerState'] = String(hw.roTrayGuideSpacerState)
  attrs['ROShelfGuide'] = hw.roShelfGuide
  attrs['DrwPulls'] = hw.drwPulls
  attrs['BasePulls'] = hw.basePulls
  attrs['WallPulls'] = hw.wallPulls
  attrs['BaseHinges'] = hw.baseHinges
  attrs['WallHinges'] = hw.wallHinges
  attrs['ClosetRod'] = hw.closetRod
  attrs['ShelfPins'] = hw.shelfPins
  attrs['Locks'] = hw.locks
  attrs['Legs'] = hw.legs
  attrs['SpotLights'] = hw.spotLights
  attrs['LinearLights'] = hw.linearLights

  // Override with typed door fields
  const dr = settings.doors
  attrs['NonColumnBaseDoor'] = dr.nonColumnBaseDoor
  attrs['NonColumnWallDoor'] = dr.nonColumnWallDoor
  attrs['NonColumnTopDrawer'] = dr.nonColumnTopDrawer
  attrs['NonColumnMidDrawer'] = dr.nonColumnMidDrawer
  attrs['NonColumnBotDrawer'] = dr.nonColumnBotDrawer
  attrs['EndDoorW'] = dr.endDoorW
  attrs['EndDoorB'] = dr.endDoorB
  attrs['EndDoorT'] = dr.endDoorT
  attrs['BackDoor'] = dr.backDoor

  // Other typed fields
  attrs['SourceTemplateID'] = String(settings.sourceTemplateID)
  attrs['AutofillLib'] = settings.autofillLib
  attrs['RoomDoorLibName'] = settings.roomDoorLibName
  attrs['PricingColumns'] = settings.pricingColumns

  const attrStr = Object.entries(attrs)
    .map(([k, v]) => `${k}="${esc(v)}"`)
    .join(' ')

  return `  <RoomSet ${attrStr}>\n${settings.rawChildrenXml}\n  </RoomSet>`
}

/** Fallback: return the original hardcoded ROOM_SET_XML constant. */
export function defaultRoomSetXml(): string {
  return ROOM_SET_XML
}
