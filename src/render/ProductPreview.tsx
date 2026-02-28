/**
 * Catalog-style 2D front-view wireframe of a product.
 * Shows side panels, shelves, rods, and toe kick as a simplified SVG.
 */

import { useMemo } from 'react'
import type { MozProduct, MozPart } from '../mozaik/types'

interface ProductPreviewProps {
  product: MozProduct
}

type PartCategory = 'side' | 'structural' | 'shelf' | 'rod' | 'toe' | 'drawer' | 'door'

interface CategorizedPart {
  category: PartCategory
  z: number       // vertical position (mm from bottom)
  height: number  // visible height in front view (mm)
  x: number       // horizontal position (mm from left)
  width: number   // horizontal span (mm)
}

function categorizePart(part: MozPart): PartCategory | null {
  const name = part.name.toLowerCase()
  const type = part.type.toLowerCase()

  if (name.includes('rod')) return 'rod'
  if (type === 'toe') return 'toe'
  if (type === 'fend' || type === 'bend' || name.includes('end')) return 'side'
  if (type === 'bottom' || type === 'top') return 'structural'
  if (type === 'fixedshelf' || type === 'adjshelf') return 'shelf'
  if (type === 'drawer') return 'drawer'
  if (type === 'door') return 'door'
  return null
}

const SVG_WIDTH = 130
const MARGIN = 6
const PANEL_THICK = 19  // mm — standard wood panel
const ROD_THICK = 4     // px — rod tube thickness in SVG
const ROD_INSET = 3     // px — rod inset from inner edges

// Hanger / t-shirt shape constants (tuned via dev sliders)
const HANGER_SKEW = -5        // skewX degrees for 3D perspective
const SHOULDER_W = 23         // shoulder span (px)
const SHOULDER_DROP = 15      // hanger V depth below rod (px)
const SLEEVE_OUT = 12         // sleeve extension outward (px)
const SLEEVE_DOWN = 20        // sleeve drop from shoulder (px)
const ARMPIT_GAP = 9          // gap below sleeve to body (px)
const BODY_NARROW = 0         // hem narrowing inward (px)
const DROP_PCT = 85           // shirt length as % of available space
const HANGER_OFFSETS = [-15, -3, 14]  // horizontal offsets for 3 hangers

export default function ProductPreview({ product }: ProductPreviewProps) {
  const parts = useMemo(() => {
    const result: CategorizedPart[] = []

    for (const part of product.parts) {
      const cat = categorizePart(part)
      if (!cat) continue

      switch (cat) {
        case 'side':
          result.push({
            category: 'side',
            z: 0,
            height: product.height,
            x: part.x,
            width: PANEL_THICK,
          })
          break
        case 'structural':
          result.push({
            category: 'structural',
            z: part.z,
            height: PANEL_THICK,
            x: 0,
            width: product.width,
          })
          break
        case 'shelf':
          result.push({
            category: 'shelf',
            z: part.z,
            height: PANEL_THICK,
            x: 0,
            width: product.width,
          })
          break
        case 'rod':
          result.push({
            category: 'rod',
            z: part.z,
            height: part.w,  // rod diameter
            x: 0,
            width: product.width,
          })
          break
        case 'toe':
          result.push({
            category: 'toe',
            z: 0,
            height: part.w,  // toe visible face height
            x: 0,
            width: product.width,
          })
          break
        case 'drawer':
          result.push({
            category: 'drawer',
            z: part.z,
            height: part.w,  // drawer face height
            x: 0,
            width: part.l,   // drawer face width
          })
          break
        case 'door':
          result.push({
            category: 'door',
            z: part.z,
            height: part.w,  // door height
            x: 0,
            width: part.l,   // door width
          })
          break
      }
    }

    return result
  }, [product])

  // Deduplicate: only keep one side panel per side (left/right)
  const sides = parts.filter(p => p.category === 'side')
  const structurals = parts.filter(p => p.category === 'structural')
  const shelves = parts.filter(p => p.category === 'shelf')
  const rods = parts.filter(p => p.category === 'rod')
  const drawers = parts.filter(p => p.category === 'drawer')
  const doors = parts.filter(p => p.category === 'door')
  const toes = parts.filter(p => p.category === 'toe')

  // Determine side panel presence (left and/or right)
  const hasLeftSide = sides.some(s => s.x < product.width / 2)
  const hasRightSide = sides.some(s => s.x >= product.width / 2)

  // Scale to fit SVG
  const drawW = SVG_WIDTH - MARGIN * 2
  const scale = drawW / product.width
  const drawH = product.height * scale
  const svgH = drawH + MARGIN * 2

  const panelPx = Math.max(PANEL_THICK * scale, 3)  // sides + floor/top: at least 3px
  const sideW = panelPx + 1
  const structuralH = panelPx                       // floor/top same as sides
  const shelfH = Math.max(Math.round(panelPx * 0.75), 2) // middle shelves: 3/4 thickness

  // Convert Mozaik Z (bottom=0) to SVG Y (top=0)
  const toY = (z: number, h: number) => MARGIN + drawH - (z * scale) - (h * scale)

  // Inner content area (between side panels)
  const innerLeft = MARGIN + (hasLeftSide ? sideW : 0)
  const innerRight = MARGIN + drawW - (hasRightSide ? sideW : 0)
  const innerW = innerRight - innerLeft

  // Deduplicate structural shelves (floor/top) by Z position (within 5mm tolerance)
  const uniqueStructurals = structurals.reduce<CategorizedPart[]>((acc, s) => {
    if (!acc.some(existing => Math.abs(existing.z - s.z) < 5)) acc.push(s)
    return acc
  }, [])

  // Deduplicate middle shelves by Z position (within 5mm tolerance)
  const uniqueShelves = shelves.reduce<CategorizedPart[]>((acc, s) => {
    if (!acc.some(existing => Math.abs(existing.z - s.z) < 5)) acc.push(s)
    return acc
  }, [])

  // Deduplicate rods by Z position
  const uniqueRods = rods.reduce<CategorizedPart[]>((acc, r) => {
    if (!acc.some(existing => Math.abs(existing.z - r.z) < 5)) acc.push(r)
    return acc
  }, [])

  // Deduplicate drawers by Z position
  const uniqueDrawers = drawers.reduce<CategorizedPart[]>((acc, d) => {
    if (!acc.some(existing => Math.abs(existing.z - d.z) < 5)) acc.push(d)
    return acc
  }, [])

  // Deduplicate doors by Z position
  const uniqueDoors = doors.reduce<CategorizedPart[]>((acc, d) => {
    if (!acc.some(existing => Math.abs(existing.z - d.z) < 5)) acc.push(d)
    return acc
  }, [])

  // Collect obstacle Z positions for hanger drop calculation
  const obstacleZs = [
    0, // floor
    ...uniqueStructurals.map(s => s.z + PANEL_THICK),
    ...uniqueShelves.map(s => s.z + PANEL_THICK),
    ...toes.map(t => t.height),
    ...uniqueRods.map(r => r.z),
  ]

  return (
    <svg
      width={SVG_WIDTH}
      height={svgH}
      className="rounded"
      style={{ background: '#ffffff' }}
    >
      {/* Outer product border */}
      <rect
        x={MARGIN} y={MARGIN}
        width={drawW} height={drawH}
        fill="none" stroke="#000" strokeWidth={1.5}
      />

      {/* Left side panel */}
      {hasLeftSide && (
        <rect
          x={MARGIN} y={MARGIN}
          width={sideW} height={drawH}
          fill="#000" stroke="none"
        />
      )}

      {/* Right side panel */}
      {hasRightSide && (
        <rect
          x={MARGIN + drawW - sideW} y={MARGIN}
          width={sideW} height={drawH}
          fill="#000" stroke="none"
        />
      )}

      {/* Toe kick */}
      {toes.length > 0 && (() => {
        const toe = toes[0]
        const toeH = Math.max(toe.height * scale, 3)
        return (
          <rect
            x={innerLeft} y={toY(toe.z, toe.height)}
            width={innerW} height={toeH}
            fill="#ccc" stroke="#000" strokeWidth={0.5}
          />
        )
      })()}

      {/* Structural shelves (floor/top) */}
      {uniqueStructurals.map((s, i) => (
        <rect
          key={`structural-${i}`}
          x={innerLeft} y={toY(s.z, PANEL_THICK)}
          width={innerW} height={structuralH}
          fill="#000" stroke="#333" strokeWidth={0.5}
        />
      ))}

      {/* Middle shelves */}
      {uniqueShelves.map((s, i) => (
        <rect
          key={`shelf-${i}`}
          x={innerLeft} y={toY(s.z, PANEL_THICK)}
          width={innerW} height={shelfH}
          fill="#000" stroke="#333" strokeWidth={0.5}
        />
      ))}

      {/* Doors */}
      {uniqueDoors.map((d, i) => {
        const doorH = Math.max(d.height * scale, 4)
        const doorY = toY(d.z, d.height)
        const handleX = innerLeft + innerW * 0.25
        return (
          <g key={`door-${i}`}>
            <rect
              x={innerLeft} y={doorY}
              width={innerW} height={doorH}
              fill="#f5f5f5" stroke="#000" strokeWidth={0.8}
            />
            {/* Handle dot */}
            <circle cx={handleX} cy={doorY + doorH / 2} r={1.5} fill="#999" />
          </g>
        )
      })}

      {/* Rods + perspective hangers */}
      {uniqueRods.map((r, i) => {
        const cy = toY(r.z, 0)
        const x1 = innerLeft + ROD_INSET
        const x2 = innerRight - ROD_INSET

        // Find nearest obstacle below this rod for garment drop length
        const belowZs = obstacleZs.filter(z => z < r.z - 5)
        const floorBelow = belowZs.length > 0 ? Math.max(...belowZs) : 0
        const dropPx = (r.z - floorBelow) * scale * (DROP_PCT / 100)
        const garmentDrop = Math.min(dropPx, 140)

        // 3 hangers, all tilted the same way like pushed to one side
        const cx = (innerLeft + innerRight) / 2
        const armpitDown = SLEEVE_DOWN + ARMPIT_GAP

        return (
          <g key={`rod-${i}`}>
            {/* Hangers + t-shirts (behind rod) */}
            {garmentDrop >= 8 && HANGER_OFFSETS.map((off, hi) => {
              const hx = cx + off
              const hemY = cy + garmentDrop
              const sy = cy + SHOULDER_DROP // shoulder Y
              const lS = hx - SHOULDER_W / 2  // left shoulder X
              const rS = hx + SHOULDER_W / 2  // right shoulder X
              return (
                <g key={`hanger-${hi}`} transform={`skewX(${HANGER_SKEW})`}
                   style={{ transformOrigin: `${hx}px ${cy}px` }}>
                  {/* Hook — curved arc above rod */}
                  <path
                    d={`M ${hx - 1} ${cy} Q ${hx + 3} ${cy - 6} ${hx} ${cy - 1}`}
                    fill="none" stroke="#aaa" strokeWidth={1.2}
                  />
                  {/* Hanger wire — V shoulders + bottom bar */}
                  <path
                    d={`M ${lS} ${sy} L ${hx} ${cy} L ${rS} ${sy} L ${lS} ${sy} Z`}
                    fill="none" stroke="#aaa" strokeWidth={1}
                  />
                  {/* T-shirt silhouette */}
                  <path
                    d={`M ${lS} ${sy}
                        L ${lS - SLEEVE_OUT} ${sy + SLEEVE_DOWN}
                        L ${lS} ${sy + armpitDown}
                        L ${lS + BODY_NARROW} ${hemY}
                        L ${rS - BODY_NARROW} ${hemY}
                        L ${rS} ${sy + armpitDown}
                        L ${rS + SLEEVE_OUT} ${sy + SLEEVE_DOWN}
                        L ${rS} ${sy} Z`}
                    fill="#f0f0f0" stroke="#bbb" strokeWidth={1.2}
                  />
                </g>
              )
            })}
            {/* Rod body */}
            <line
              x1={x1} y1={cy} x2={x2} y2={cy}
              stroke="#000" strokeWidth={ROD_THICK}
              strokeLinecap="round"
            />
            {/* Highlight — lighter stripe above center for cylinder illusion */}
            <line
              x1={x1 + 1} y1={cy - 1} x2={x2 - 1} y2={cy - 1}
              stroke="#999" strokeWidth={1}
              strokeLinecap="round"
            />
          </g>
        )
      })}

      {/* Drawer fronts (topmost layer) */}
      {uniqueDrawers.map((d, i) => {
        const drawerH = Math.max(d.height * scale, 3)
        const drawerY = toY(d.z, d.height)
        const pullW = 3
        const pullCx = innerLeft + innerW / 2
        return (
          <g key={`drawer-${i}`}>
            <rect
              x={innerLeft} y={drawerY}
              width={innerW} height={drawerH}
              fill="#eee" stroke="#000" strokeWidth={0.8}
            />
            {/* Pull/knob indicator — small centered horizontal line */}
            <line
              x1={pullCx - pullW} y1={drawerY + drawerH / 2}
              x2={pullCx + pullW} y2={drawerY + drawerH / 2}
              stroke="#999" strokeWidth={1} strokeLinecap="round"
            />
          </g>
        )
      })}
    </svg>
  )
}
