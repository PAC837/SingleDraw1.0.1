/**
 * Pre-configured render setting combos with lighting.
 */
import { LinearToneMapping, ACESFilmicToneMapping } from 'three'
import type { RenderMode } from '../mozaik/types'

export const RENDER_PRESETS: Record<string, {
  label: string; mode: RenderMode; edgeOpacity: number; factor: number; units: number
  ambient: number; directional: number; warmth: number; exposure: number; toneMapping: number; bgColor: string
}> = {
  'ghosted-default': { label: 'Ghosted (Default)', mode: 'ghosted',   edgeOpacity: 0,    factor: 1, units: 1,
    ambient: 0.6, directional: 0.7, warmth: 0,    exposure: 1,   toneMapping: LinearToneMapping,      bgColor: '#ffffff' },
  'clean-solid':     { label: 'Clean Solid',       mode: 'solid',     edgeOpacity: 0,    factor: 1, units: 1,
    ambient: 0.6, directional: 0.7, warmth: 0,    exposure: 1,   toneMapping: LinearToneMapping,      bgColor: '#ffffff' },
  'cad-edges':       { label: 'CAD Edges',         mode: 'solid',     edgeOpacity: 0.8,  factor: 1, units: 1,
    ambient: 0.8, directional: 0.5, warmth: -0.3, exposure: 1,   toneMapping: LinearToneMapping,      bgColor: '#f0f0f0' },
  'warm-studio':     { label: 'Warm Studio',       mode: 'solid',     edgeOpacity: 0.3,  factor: 1, units: 1,
    ambient: 0.5, directional: 0.8, warmth: 0.5,  exposure: 1.2, toneMapping: ACESFilmicToneMapping,  bgColor: '#ffffff' },
  'cool-daylight':   { label: 'Cool Daylight',     mode: 'solid',     edgeOpacity: 0.5,  factor: 1, units: 1,
    ambient: 0.7, directional: 0.6, warmth: -0.5, exposure: 1,   toneMapping: LinearToneMapping,      bgColor: '#ffffff' },
  'blueprint':       { label: 'Blueprint',         mode: 'wireframe', edgeOpacity: 0,    factor: 1, units: 1,
    ambient: 0.6, directional: 0.7, warmth: 0,    exposure: 1,   toneMapping: LinearToneMapping,      bgColor: '#1a1a2e' },
  'x-ray':           { label: 'X-Ray',             mode: 'ghosted',   edgeOpacity: 0.5,  factor: 1, units: 1,
    ambient: 0.6, directional: 0.7, warmth: 0,    exposure: 1,   toneMapping: LinearToneMapping,      bgColor: '#ffffff' },
  'showroom':        { label: 'Showroom',          mode: 'solid',     edgeOpacity: 0.2,  factor: 1, units: 1,
    ambient: 0.4, directional: 0.9, warmth: 0.3,  exposure: 1.1, toneMapping: ACESFilmicToneMapping,  bgColor: '#ffffff' },
  'dramatic':        { label: 'Dramatic',          mode: 'solid',     edgeOpacity: 0.8,  factor: 1, units: 1,
    ambient: 0.2, directional: 1.2, warmth: 0.2,  exposure: 0.9, toneMapping: ACESFilmicToneMapping,  bgColor: '#2a2a2a' },
  'presentation':    { label: 'Presentation',      mode: 'solid',     edgeOpacity: 0.3,  factor: 1, units: 1,
    ambient: 0.6, directional: 0.7, warmth: 0.1,  exposure: 1,   toneMapping: ACESFilmicToneMapping,  bgColor: '#ffffff' },
}
