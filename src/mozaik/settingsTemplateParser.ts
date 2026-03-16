/**
 * Parser for Mozaik Settings Template files (.mzkrst and RoomSettingsTemplates.dat).
 *
 * File formats:
 * - RoomSettingsTemplates.dat: preamble "8\n" + XML with <RoomSettingsTemplates> root (multi-template)
 * - .mzkrst export: preamble "Mozaik Room Settings Template Export\n8\n" + XML (single or multi)
 *
 * The <RoomSet> element contains 60+ hardware/door/material attributes plus 14 child elements.
 * We parse typed fields for frequently-changed hardware attrs and keep raw XML for round-trip.
 */

import { parseXmlString, getAttrStr, getAttrBool, getAttrInt, getChildren, getAllAttrs } from './xmlUtils'

// ── Types ────────────────────────────────────────────────────────────

/** Hardware selections on the RoomSet element. */
export interface RoomSetHardware {
  drawerBox: string
  drawerGuide: string
  drawerGuideSlowCloseOn: boolean
  drawerGuideSpacerState: number
  roTray: string
  roTrayGuide: string
  roTrayGuideSlowCloseOn: boolean
  roTrayGuideSpacerState: number
  roShelfGuide: string
  drwPulls: string
  basePulls: string
  wallPulls: string
  baseHinges: string
  wallHinges: string
  closetRod: string
  shelfPins: string
  locks: string
  legs: string
  spotLights: string
  linearLights: string
}

/** Door/drawer type selections on the RoomSet element. */
export interface RoomSetDoors {
  nonColumnBaseDoor: string
  nonColumnWallDoor: string
  nonColumnTopDrawer: string
  nonColumnMidDrawer: string
  nonColumnBotDrawer: string
  endDoorW: string
  endDoorB: string
  endDoorT: string
  backDoor: string
}

/** A single parsed settings template. */
export interface RoomSettingsTemplate {
  name: string
  sourceTemplateID: number
  hardware: RoomSetHardware
  doors: RoomSetDoors
  autofillLib: string
  roomDoorLibName: string
  pricingColumns: string
  /** Verbatim inner XML of <RoomSet> children (door settings, material templates). */
  rawChildrenXml: string
  /** All RoomSet attributes as-is for lossless round-trip. */
  rawAttributes: Record<string, string>
}

/** The master settings file container. */
export interface RoomSettingsFile {
  defaultTemplateID: number
  maxTemplateID: number
  templates: RoomSettingsTemplate[]
  /** Original preamble text before XML (for round-trip). */
  preamble: string
}

// ── Shared extraction ────────────────────────────────────────────────

/**
 * Extract a RoomSettingsTemplate from a <RoomSet> element.
 * Reused by both the .mzkrst parser and the DES parser.
 */
export function extractRoomSet(roomSetEl: Element, templateName: string): RoomSettingsTemplate {
  const rawAttributes = getAllAttrs(roomSetEl)

  const hardware: RoomSetHardware = {
    drawerBox: getAttrStr(roomSetEl, 'DrawerBox'),
    drawerGuide: getAttrStr(roomSetEl, 'DrawerGuide'),
    drawerGuideSlowCloseOn: getAttrBool(roomSetEl, 'DrawerGuideSlowCloseOn'),
    drawerGuideSpacerState: getAttrInt(roomSetEl, 'DrawerGuideSpacerState'),
    roTray: getAttrStr(roomSetEl, 'ROTray'),
    roTrayGuide: getAttrStr(roomSetEl, 'ROTrayGuide'),
    roTrayGuideSlowCloseOn: getAttrBool(roomSetEl, 'ROTrayGuideSlowCloseOn'),
    roTrayGuideSpacerState: getAttrInt(roomSetEl, 'ROTrayGuideSpacerState'),
    roShelfGuide: getAttrStr(roomSetEl, 'ROShelfGuide'),
    drwPulls: getAttrStr(roomSetEl, 'DrwPulls'),
    basePulls: getAttrStr(roomSetEl, 'BasePulls'),
    wallPulls: getAttrStr(roomSetEl, 'WallPulls'),
    baseHinges: getAttrStr(roomSetEl, 'BaseHinges'),
    wallHinges: getAttrStr(roomSetEl, 'WallHinges'),
    closetRod: getAttrStr(roomSetEl, 'ClosetRod'),
    shelfPins: getAttrStr(roomSetEl, 'ShelfPins'),
    locks: getAttrStr(roomSetEl, 'Locks'),
    legs: getAttrStr(roomSetEl, 'Legs'),
    spotLights: getAttrStr(roomSetEl, 'SpotLights'),
    linearLights: getAttrStr(roomSetEl, 'LinearLights'),
  }

  const doors: RoomSetDoors = {
    nonColumnBaseDoor: getAttrStr(roomSetEl, 'NonColumnBaseDoor'),
    nonColumnWallDoor: getAttrStr(roomSetEl, 'NonColumnWallDoor'),
    nonColumnTopDrawer: getAttrStr(roomSetEl, 'NonColumnTopDrawer'),
    nonColumnMidDrawer: getAttrStr(roomSetEl, 'NonColumnMidDrawer'),
    nonColumnBotDrawer: getAttrStr(roomSetEl, 'NonColumnBotDrawer'),
    endDoorW: getAttrStr(roomSetEl, 'EndDoorW'),
    endDoorB: getAttrStr(roomSetEl, 'EndDoorB'),
    endDoorT: getAttrStr(roomSetEl, 'EndDoorT'),
    backDoor: getAttrStr(roomSetEl, 'BackDoor'),
  }

  // Capture all child elements as raw XML for round-trip
  const serializer = new XMLSerializer()
  const childParts: string[] = []
  for (let i = 0; i < roomSetEl.children.length; i++) {
    childParts.push('    ' + serializer.serializeToString(roomSetEl.children[i]))
  }
  const rawChildrenXml = childParts.join('\n')

  return {
    name: templateName,
    sourceTemplateID: getAttrInt(roomSetEl, 'SourceTemplateID'),
    hardware,
    doors,
    autofillLib: getAttrStr(roomSetEl, 'AutofillLib'),
    roomDoorLibName: getAttrStr(roomSetEl, 'RoomDoorLibName'),
    pricingColumns: getAttrStr(roomSetEl, 'PricingColumns'),
    rawChildrenXml,
    rawAttributes,
  }
}

// ── File parsing ─────────────────────────────────────────────────────

/**
 * Parse a settings file (RoomSettingsTemplates.dat or .mzkrst export).
 * Auto-detects format from the preamble.
 */
export function parseSettingsFile(text: string): RoomSettingsFile {
  // Find where the XML starts
  const xmlStart = text.indexOf('<?xml')
  if (xmlStart === -1) throw new Error('No XML declaration found in settings file')

  const preamble = text.slice(0, xmlStart).trimEnd()
  const xml = text.slice(xmlStart)
  const doc = parseXmlString(xml)
  const root = doc.documentElement

  if (root.tagName !== 'RoomSettingsTemplates') {
    throw new Error(`Expected <RoomSettingsTemplates> root, got <${root.tagName}>`)
  }

  const defaultTemplateID = getAttrInt(root, 'DefaultRoomSettingsTemplateID', 0)
  const maxTemplateID = getAttrInt(root, 'MaxRoomSettingsTemplateID', 0)

  const templates: RoomSettingsTemplate[] = []
  for (const tmplEl of getChildren(root, 'RoomSettingsTemplate')) {
    const name = getAttrStr(tmplEl, 'Name')
    const roomSetEls = getChildren(tmplEl, 'RoomSet')
    if (roomSetEls.length === 0) continue
    templates.push(extractRoomSet(roomSetEls[0], name))
  }

  console.log(`[SETTINGS] Parsed settings file: ${templates.length} templates (default ID: ${defaultTemplateID}, max ID: ${maxTemplateID})`)
  for (const t of templates) {
    console.log(`  - "${t.name}" (ID: ${t.sourceTemplateID}) DrawerGuide="${t.hardware.drawerGuide}" DrawerBox="${t.hardware.drawerBox}"`)
  }

  return { defaultTemplateID, maxTemplateID, templates, preamble }
}
