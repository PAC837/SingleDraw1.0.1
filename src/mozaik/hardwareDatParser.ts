/**
 * Parser for Mozaik Hardware.dat file.
 *
 * File format: preamble "10\n" + XML with <Hardware> root.
 * Contains <Guide>, <Pull>, <Hinge>, <ShelfPin>, <ClosetRod>, <Lock>, <Leg>, <Light> elements.
 * Each element has a Name attribute used as the selection value in RoomSet.
 */

import { parseXmlString, getAttrStr, getAttrInt, getChildren } from './xmlUtils'

export interface HardwareGuideOption {
  name: string
  guideType: number   // 0=roller, 1=undermount, 2=metal drawer
  comment: string
}

export interface HardwarePullOption {
  name: string
  pullType: number
}

export interface HardwareHingeOption {
  name: string
}

/** Parsed hardware catalog — option lists for each hardware category. */
export interface HardwareCatalog {
  guides: HardwareGuideOption[]
  pulls: HardwarePullOption[]
  hinges: HardwareHingeOption[]
  shelfPins: string[]
  closetRods: string[]
  locks: string[]
  legs: string[]
  lights: string[]
}

/**
 * Parse a Mozaik Hardware.dat file into a HardwareCatalog.
 * Handles the numeric preamble before the XML content.
 */
export function parseHardwareDat(text: string): HardwareCatalog {
  const xmlStart = text.indexOf('<?xml')
  const xml = xmlStart >= 0 ? text.slice(xmlStart) : text

  const doc = parseXmlString(xml)
  const root = doc.documentElement
  if (root.tagName !== 'Hardware') {
    throw new Error(`Expected <Hardware> root, got <${root.tagName}>`)
  }

  const guides: HardwareGuideOption[] = []
  for (const el of getChildren(root, 'Guide')) {
    guides.push({
      name: getAttrStr(el, 'Name'),
      guideType: getAttrInt(el, 'GuideType'),
      comment: getAttrStr(el, 'Comment'),
    })
  }

  const pulls: HardwarePullOption[] = []
  for (const el of getChildren(root, 'Pull')) {
    pulls.push({
      name: getAttrStr(el, 'Name'),
      pullType: getAttrInt(el, 'PullType'),
    })
  }

  const hinges: HardwareHingeOption[] = []
  for (const el of getChildren(root, 'Hinge')) {
    hinges.push({ name: getAttrStr(el, 'Name') })
  }

  const extract = (tag: string) => getChildren(root, tag).map(el => getAttrStr(el, 'Name'))
  const shelfPins = extract('ShelfPin')
  const closetRods = extract('ClosetRod')
  const locks = extract('Lock')
  const legs = extract('Leg')
  const lights = extract('Light')

  console.log(`[HARDWARE] Parsed Hardware.dat: ${guides.length} guides, ${pulls.length} pulls, ${hinges.length} hinges, ${shelfPins.length} shelf pins, ${closetRods.length} rods, ${locks.length} locks, ${legs.length} legs, ${lights.length} lights`)

  return { guides, pulls, hinges, shelfPins, closetRods, locks, legs, lights }
}
