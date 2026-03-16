/**
 * Parser for Mozaik .guide files (drawer guide configuration).
 *
 * File format: 2-line text preamble ("Mozaik Guide Export\n10\n"),
 * then XML with <Guide> root containing <MetalDrawerGuideConfiguration> entries.
 *
 * Each configuration maps drawer front dimensions to drawer box dimensions
 * (height, depth, clearances) for a specific drawer slide product.
 */

import { parseXmlString, getAttrFloat, getAttrStr, getAttrBool, getChildren } from './xmlUtils'

/** A single drawer slide configuration (one size variant). */
export interface DrawerGuideConfig {
  partNumber: string       // e.g., "Optimiz-R 89_350 (WEBKIT1220072)"
  description: string      // e.g., "Richelieu Optimiz-R"
  use: boolean             // whether this config is active
  boxHeight: number        // mm — drawer box interior height
  boxDepth: number         // mm — drawer box interior depth
  widthMinusBack: number   // mm — back panel = opening width - this
  widthMinusBottom: number // mm — bottom panel = opening width - this
  widthMinusFront: number  // mm — front panel adjustment
  isTray: boolean          // whether this is a tray (vs standard drawer)
  cost: number             // per unit cost
  applyBanding: boolean    // edge banding on drawer parts
}

/** Root drawer guide with global clearances and all configurations. */
export interface DrawerGuide {
  name: string             // guide name, e.g., "_PAC Richie OPTIMIZ-R (Metal)"
  comment: string          // user notes / material requirements
  botCl: number            // mm — bottom clearance (drawer face to box bottom)
  topCl: number            // mm — top clearance (drawer face to box top)
  sideCl: number           // mm — side clearance
  backClearance: number    // mm — back clearance
  guideType: number        // 2 = metal drawer guide
  configs: DrawerGuideConfig[]
}

/**
 * Parse a Mozaik .guide file into a DrawerGuide.
 * Handles the 2-line text preamble before the XML content.
 */
export function parseGuide(text: string): DrawerGuide {
  // Strip preamble lines before <?xml
  const xmlStart = text.indexOf('<?xml')
  const xml = xmlStart >= 0 ? text.slice(xmlStart) : text

  const doc = parseXmlString(xml)
  const root = doc.documentElement
  if (root.tagName !== 'Guide') {
    throw new Error(`Expected <Guide> root, got <${root.tagName}>`)
  }

  const configs: DrawerGuideConfig[] = []
  for (const el of getChildren(root, 'MetalDrawerGuideConfiguration')) {
    configs.push({
      partNumber: getAttrStr(el, 'PartNumber'),
      description: getAttrStr(el, 'Description'),
      use: getAttrBool(el, 'Use'),
      boxHeight: getAttrFloat(el, 'BoxHeight'),
      boxDepth: getAttrFloat(el, 'BoxDepth'),
      widthMinusBack: getAttrFloat(el, 'InsideOpeningWidthMinusForBack'),
      widthMinusBottom: getAttrFloat(el, 'InsideOpeningWidthMinusForBottom'),
      widthMinusFront: getAttrFloat(el, 'InsideOpeningWidthMinusForFront'),
      isTray: getAttrBool(el, 'IsTray'),
      cost: getAttrFloat(el, 'Cost'),
      applyBanding: getAttrBool(el, 'ApplyBanding'),
    })
  }

  const guide: DrawerGuide = {
    name: getAttrStr(root, 'Name'),
    comment: getAttrStr(root, 'Comment'),
    botCl: getAttrFloat(root, 'BotCl'),
    topCl: getAttrFloat(root, 'TopCl'),
    sideCl: getAttrFloat(root, 'SideCl'),
    backClearance: getAttrFloat(root, 'BackClearance'),
    guideType: getAttrFloat(root, 'GuideType'),
    configs,
  }

  const active = configs.filter(c => c.use)
  console.log(`[GUIDE] Parsed "${guide.name}": ${configs.length} configs (${active.length} active)`)
  return guide
}

/**
 * Parse front height and depth from a guide config part number.
 * Naming convention: "Optimiz-R 89_350 (WEBKIT...)" → { frontH: 89, depth: 350 }
 */
function parsePartNumber(partNumber: string): { frontH: number; depth: number } | null {
  const match = partNumber.match(/(\d+)_(\d+)/)
  if (!match) return null
  return { frontH: parseInt(match[1], 10), depth: parseInt(match[2], 10) }
}

/**
 * Look up the best matching drawer box configuration for a given front height.
 * Only considers active (Use=true) configs.
 * Returns the config with the closest front height match, or null if none.
 */
export function lookupDrawerBox(
  guide: DrawerGuide,
  frontHeight: number,
): DrawerGuideConfig | null {
  const active = guide.configs.filter(c => c.use)
  if (active.length === 0) return null

  let best: DrawerGuideConfig | null = null
  let bestDiff = Infinity

  for (const cfg of active) {
    const parsed = parsePartNumber(cfg.partNumber)
    if (!parsed) continue
    const diff = Math.abs(parsed.frontH - frontHeight)
    if (diff < bestDiff) {
      bestDiff = diff
      best = cfg
    }
  }

  return best
}
