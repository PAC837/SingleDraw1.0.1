/**
 * Interactive 2D SVG front elevation view of a DH section.
 * Shows structural parts (shelves, rods, hangers, toe, bottom, top)
 * with draggable fixed shelves that snap to a 32mm grid.
 */

import { useCallback, useMemo, useRef, useState } from 'react'
import type { MozProduct, MozPart } from '../mozaik/types'
import { findShelfGroup, findAdjShelfGroup, findFixedShelves, computeShelfBounds, computeAdjShelfBounds, computeZones, snapToGrid } from '../mozaik/shelfEditor'
import { formatDim } from '../math/units'

interface ElevationSVGProps {
  product: MozProduct
  useInches: boolean
  selectedPart: { index: number; category: PartCategory } | null
  onMoveShelf: (shelfPartIndex: number, newZ: number) => void
  onSelectPart: (part: { index: number; category: PartCategory } | null) => void
  onDragStart?: () => void
  onDragEnd?: () => void
}

// Layout constants
const SVG_PAD = 40        // padding around the drawing
const LABEL_W = 70        // width reserved for dimension labels
const GRID_STEP = 32      // mm grid step
const SHELF_THICK_PX = 6  // visual thickness for shelves/panels
const ROD_RADIUS_PX = 8   // visual radius for closet rods

type PartCategory = 'toe' | 'bottom' | 'top' | 'fixedshelf' | 'adjustableshelf' | 'rod' | 'hanger' | 'fend' | 'drawer' | 'other'

function categorize(part: MozPart): PartCategory {
  const t = part.type.toLowerCase()
  const n = part.name.toLowerCase()
  if (t === 'toe' || n.includes('toe')) return 'toe'
  if (t === 'bottom') return 'bottom'
  if (t === 'top') return 'top'
  if (t === 'fixedshelf' || t === 'fixed shelf' || part.reportName.includes('F.Shelf')) return 'fixedshelf'
  if (t === 'adjustableshelf' || t === 'adjustable shelf') return 'adjustableshelf'
  if (t === 'drawer') return 'drawer'
  if (t === 'drawerfront' || t === 'drawerback' || t === 'drawerside' || t === 'drawerbottom') return 'other'
  if (n.includes('rod') || part.reportName.toLowerCase().includes('rod')) return 'rod'
  if (n.includes('hanger') || part.reportName.toLowerCase().includes('hanger')) return 'hanger'
  if (t === 'fend') return 'fend'
  return 'other'
}

export { type PartCategory }

export default function ElevationSVG({ product, useInches, selectedPart, onMoveShelf, onSelectPart, onDragStart, onDragEnd }: ElevationSVGProps) {
  const svgRef = useRef<SVGSVGElement>(null)
  const [dragState, setDragState] = useState<{
    shelfIndex: number
    startY: number
    startZ: number
    currentZ: number
  } | null>(null)

  const prodW = product.width
  const prodH = product.height

  // SVG viewbox: scale product to fit within available space
  const svgW = 500
  const svgH = 600
  const drawW = svgW - SVG_PAD * 2 - LABEL_W
  const drawH = svgH - SVG_PAD * 2
  const scale = Math.min(drawW / prodW, drawH / prodH)
  const drawLeft = SVG_PAD + LABEL_W
  const drawBottom = SVG_PAD + drawH

  // Convert Mozaik coordinates to SVG coordinates
  const toSvgX = useCallback((mx: number) => drawLeft + mx * scale, [drawLeft, scale])
  const toSvgY = useCallback((mz: number) => drawBottom - mz * scale, [drawBottom, scale])
  const toMozZ = useCallback((svgY: number) => (drawBottom - svgY) / scale, [drawBottom, scale])

  // Find all fixed shelves
  const shelfIndices = useMemo(() => findFixedShelves(product), [product])

  // Categorize all parts
  const categorized = useMemo(() =>
    product.parts.map((part, i) => ({ part, index: i, category: categorize(part) })),
    [product],
  )

  // Compute opening zones for visual highlights
  const zones = useMemo(() => computeZones(product), [product])

  // Get shelf group for drag preview
  const dragGroup = useMemo(() => {
    if (!dragState) return null
    return findShelfGroup(product, dragState.shelfIndex)
      ?? findAdjShelfGroup(product, dragState.shelfIndex)
  }, [product, dragState])

  // Compute effective Z for a part (accounting for drag)
  const effectiveZ = useCallback((partIndex: number, baseZ: number): number => {
    if (!dragState || !dragGroup) return baseZ
    const delta = dragState.currentZ - dragState.startZ
    const isInGroup = partIndex === dragGroup.shelfIndex ||
      dragGroup.rodIndices.includes(partIndex) ||
      dragGroup.hangerIndices.includes(partIndex)
    return isInGroup ? baseZ + delta : baseZ
  }, [dragState, dragGroup])

  // Pointer handlers for shelf dragging
  const handlePointerDown = useCallback((e: React.PointerEvent, shelfIndex: number, category: PartCategory) => {
    e.preventDefault()
    e.stopPropagation()
    const svgEl = svgRef.current
    if (!svgEl) return
    onSelectPart({ index: shelfIndex, category })
    const shelf = product.parts[shelfIndex]
    setDragState({ shelfIndex, startY: e.clientY, startZ: shelf.z, currentZ: shelf.z })
    onDragStart?.()
    ;(e.target as Element).setPointerCapture(e.pointerId)
  }, [product, onDragStart])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragState) return
    const deltaY = e.clientY - dragState.startY
    const deltaMozZ = -deltaY / scale // SVG Y is inverted
    const rawZ = dragState.startZ + deltaMozZ
    const snappedZ = snapToGrid(rawZ)
    const dragPart = product.parts[dragState.shelfIndex]
    const isAdj = dragPart && (dragPart.type.toLowerCase() === 'adjustableshelf' || dragPart.type.toLowerCase() === 'adjustable shelf')
    const bounds = isAdj
      ? computeAdjShelfBounds(product, dragState.shelfIndex)
      : computeShelfBounds(product, dragState.shelfIndex)
    const clampedZ = Math.max(bounds.minZ, Math.min(bounds.maxZ, snappedZ))
    setDragState(prev => prev ? { ...prev, currentZ: clampedZ } : null)
  }, [dragState, scale, product])

  const handlePointerUp = useCallback(() => {
    if (!dragState) return
    if (Math.abs(dragState.currentZ - dragState.startZ) > 0.1) {
      onMoveShelf(dragState.shelfIndex, dragState.currentZ)
    }
    setDragState(null)
    onDragEnd?.()
  }, [dragState, onMoveShelf, onDragEnd])

  // 32mm grid lines
  const gridLines = useMemo(() => {
    const lines: number[] = []
    for (let z = GRID_STEP; z < prodH; z += GRID_STEP) {
      lines.push(z)
    }
    return lines
  }, [prodH])

  return (
    <svg
      ref={svgRef}
      viewBox={`0 0 ${svgW} ${svgH}`}
      className="w-full h-full"
      style={{ background: '#111' }}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerUp}
    >
      {/* 32mm grid lines */}
      {gridLines.map(z => (
        <line
          key={`grid-${z}`}
          x1={drawLeft}
          y1={toSvgY(z)}
          x2={drawLeft + prodW * scale}
          y2={toSvgY(z)}
          stroke="#222"
          strokeWidth={0.5}
          strokeDasharray="2,4"
        />
      ))}

      {/* Product outline */}
      <rect
        x={toSvgX(0)}
        y={toSvgY(prodH)}
        width={prodW * scale}
        height={prodH * scale}
        fill="none"
        stroke="#444"
        strokeWidth={1}
      />

      {/* Opening zone highlights */}
      {zones.filter(z => !z.hasDrawers).map((zone, i) => (
        <rect key={`zone-${i}`} x={toSvgX(0)} y={toSvgY(zone.maxZ)}
          width={prodW * scale} height={(zone.maxZ - zone.minZ) * scale}
          fill="#AAFF00" fillOpacity={0.04} stroke="#AAFF00"
          strokeWidth={0.5} strokeOpacity={0.15} strokeDasharray="6,4" pointerEvents="none" />
      ))}

      {/* FEnd panels (side panels) */}
      {categorized
        .filter(c => c.category === 'fend')
        .map(({ part, index }) => {
          const z = effectiveZ(index, part.z)
          const partH = part.l // FEnd length = height
          const partW = part.w * scale
          return (
            <rect
              key={`fend-${index}`}
              x={toSvgX(part.x)}
              y={toSvgY(z + partH)}
              width={Math.max(partW, 3)}
              height={partH * scale}
              fill="#555"
              stroke="#666"
              strokeWidth={0.5}
            />
          )
        })}

      {/* Toe kick — always anchored at floor (z=0) */}
      {categorized
        .filter(c => c.category === 'toe')
        .map(({ part, index }) => {
          const toeH = part.w || 96 // toe height (W = vertical span after rotation)
          return (
            <rect
              key={`toe-${index}`}
              x={toSvgX(part.x)}
              y={toSvgY(toeH)}
              width={part.l * scale}
              height={toeH * scale}
              fill="#3a3530"
              stroke="#555"
              strokeWidth={0.5}
            />
          )
        })}

      {/* Closet rods (clickable/selectable) */}
      {categorized
        .filter(c => c.category === 'rod')
        .map(({ part, index }) => {
          const z = effectiveZ(index, part.z)
          const cy = toSvgY(z)
          const isSelected = selectedPart?.index === index
          const strokeColor = isSelected ? 'var(--accent)' : '#888'
          const fillColor = isSelected ? '#334400' : '#555'
          return (
            <g key={`rod-${index}`}
              style={{ cursor: 'pointer' }}
              onClick={() => onSelectPart({ index, category: 'rod' })}
            >
              {/* Rod line */}
              <line
                x1={toSvgX((prodW - part.l) / 2)}
                y1={cy}
                x2={toSvgX((prodW + part.l) / 2)}
                y2={cy}
                stroke={strokeColor}
                strokeWidth={isSelected ? 4 : 3}
                strokeLinecap="round"
              />
              {/* Rod circle endcaps */}
              <circle cx={toSvgX((prodW - part.l) / 2)} cy={cy} r={ROD_RADIUS_PX} fill={fillColor} stroke={strokeColor} strokeWidth={isSelected ? 1.5 : 1} />
              <circle cx={toSvgX((prodW + part.l) / 2)} cy={cy} r={ROD_RADIUS_PX} fill={fillColor} stroke={strokeColor} strokeWidth={isSelected ? 1.5 : 1} />
            </g>
          )
        })}

      {/* Hangers (clickable/selectable) */}
      {categorized
        .filter(c => c.category === 'hanger')
        .map(({ part, index }) => {
          const z = effectiveZ(index, part.z)
          const x = toSvgX(part.x)
          const y = toSvgY(z)
          const hangerH = part.l * scale * 0.3
          const isSelected = selectedPart?.index === index
          const strokeColor = isSelected ? 'var(--accent)' : '#777'
          return (
            <g key={`hanger-${index}`}
              style={{ cursor: 'pointer' }}
              onClick={() => onSelectPart({ index, category: 'hanger' })}
            >
              <line x1={x} y1={y} x2={x} y2={y - hangerH} stroke={strokeColor} strokeWidth={isSelected ? 2 : 1.5} />
              <line x1={x - 4} y1={y} x2={x + 4} y2={y} stroke={strokeColor} strokeWidth={isSelected ? 2 : 1.5} />
            </g>
          )
        })}

      {/* Fixed shelves (draggable) */}
      {categorized
        .filter(c => c.category === 'fixedshelf')
        .map(({ part, index }) => {
          const z = effectiveZ(index, part.z)
          const isSelected = selectedPart?.index === index
          const isDragging = dragState?.shelfIndex === index
          const shelfY = toSvgY(z)
          return (
            <g key={`shelf-${index}`}>
              {/* Shelf body */}
              <rect
                x={toSvgX(0)}
                y={shelfY - SHELF_THICK_PX / 2}
                width={prodW * scale}
                height={SHELF_THICK_PX}
                fill={isDragging ? 'var(--accent)' : isSelected ? '#88cc00' : '#aaa'}
                fillOpacity={isDragging ? 0.8 : isSelected ? 0.7 : 0.6}
                stroke={isSelected || isDragging ? 'var(--accent)' : '#ccc'}
                strokeWidth={isSelected || isDragging ? 1.5 : 0.5}
                style={{ cursor: 'grab' }}
                onPointerDown={(e) => handlePointerDown(e, index, 'fixedshelf')}
                onClick={() => onSelectPart({ index, category: 'fixedshelf' })}
              />
              {/* Dimension label */}
              <text
                x={drawLeft - 8}
                y={shelfY + 4}
                textAnchor="end"
                fill={isSelected || isDragging ? 'var(--accent)' : '#999'}
                fontSize={11}
                fontFamily="system-ui, sans-serif"
              >
                {formatDim(z, useInches)}
              </text>
              {/* Dashed guide line during drag */}
              {isDragging && (
                <line
                  x1={SVG_PAD}
                  y1={shelfY}
                  x2={drawLeft + prodW * scale + 10}
                  y2={shelfY}
                  stroke="var(--accent)"
                  strokeWidth={0.5}
                  strokeDasharray="4,3"
                />
              )}
            </g>
          )
        })}

      {/* Adjustable shelves (draggable, dashed style) */}
      {categorized
        .filter(c => c.category === 'adjustableshelf')
        .map(({ part, index }) => {
          const z = effectiveZ(index, part.z)
          const shelfY = toSvgY(z)
          const isSelected = selectedPart?.index === index
          const isDragging = dragState?.shelfIndex === index
          return (
            <g key={`adj-shelf-${index}`}>
              <rect
                x={toSvgX(0)}
                y={shelfY - SHELF_THICK_PX / 2}
                width={prodW * scale}
                height={SHELF_THICK_PX}
                fill={isDragging ? 'var(--accent)' : isSelected ? '#88cc00' : '#888'}
                fillOpacity={isDragging ? 0.8 : 0.4}
                stroke={isSelected || isDragging ? 'var(--accent)' : '#999'}
                strokeWidth={isSelected || isDragging ? 1.5 : 0.5}
                strokeDasharray={isDragging ? 'none' : '4,3'}
                style={{ cursor: 'grab' }}
                onPointerDown={(e) => handlePointerDown(e, index, 'adjustableshelf')}
                onClick={() => onSelectPart({ index, category: 'adjustableshelf' })}
              />
              {(isSelected || isDragging) && (
                <text x={drawLeft - 8} y={shelfY + 4} textAnchor="end"
                  fill={isDragging ? 'var(--accent)' : '#999'} fontSize={11} fontFamily="system-ui, sans-serif">
                  {formatDim(z, useInches)}
                </text>
              )}
              {isDragging && (
                <line x1={SVG_PAD} y1={shelfY} x2={drawLeft + prodW * scale + 10} y2={shelfY}
                  stroke="var(--accent)" strokeWidth={0.5} strokeDasharray="4,3" />
              )}
            </g>
          )
        })}

      {/* Drawer faces */}
      {categorized
        .filter(c => c.category === 'drawer')
        .map(({ part, index }) => {
          const z = effectiveZ(index, part.z)
          const faceH = part.w  // drawer face height (W after A1=90 rotation)
          const faceW = part.l  // drawer face width
          const isSelected = selectedPart?.index === index
          const strokeColor = isSelected ? 'var(--accent)' : '#777'
          // Clamp drawer face to product outline (ignore overlay overhang)
          const clampedX = Math.max(0, part.x)
          const rightEdge = Math.min(part.x + faceW, prodW)
          const clampedW = Math.max(0, rightEdge - clampedX)
          const svgX = toSvgX(clampedX)
          const svgY = toSvgY(z + faceH)
          const svgW = clampedW * scale
          const svgH = faceH * scale
          const pullY = svgY + svgH / 2
          const pullHalfW = Math.min(svgW * 0.15, 12)
          return (
            <g key={`drawer-${index}`}
              style={{ cursor: 'pointer' }}
              onClick={() => onSelectPart({ index, category: 'drawer' })}
            >
              <rect
                x={svgX}
                y={svgY}
                width={svgW}
                height={svgH}
                fill={isSelected ? '#556600' : '#8B6914'}
                stroke={strokeColor}
                strokeWidth={isSelected ? 2 : 1.5}
              />
              {/* Pull indicator */}
              <line
                x1={svgX + svgW / 2 - pullHalfW}
                y1={pullY}
                x2={svgX + svgW / 2 + pullHalfW}
                y2={pullY}
                stroke={isSelected ? 'var(--accent)' : '#bbb'}
                strokeWidth={2}
                strokeLinecap="round"
              />
              {/* Height label */}
              <text
                x={drawLeft - 8}
                y={pullY + 3}
                textAnchor="end"
                fill={isSelected ? 'var(--accent)' : '#aaa'}
                fontSize={9}
                fontFamily="system-ui, sans-serif"
              >
                {formatDim(faceH, useInches)}
              </text>
              {/* Width label */}
              <text
                x={svgX + svgW + 4}
                y={pullY + 3}
                fill={isSelected ? 'var(--accent)' : '#888'}
                fontSize={8}
                fontFamily="system-ui, sans-serif"
              >
                w: {formatDim(faceW, useInches)}
              </text>
            </g>
          )
        })}

      {/* Floor dimension label */}
      <text
        x={drawLeft - 8}
        y={toSvgY(0) + 4}
        textAnchor="end"
        fill="#666"
        fontSize={10}
        fontFamily="system-ui, sans-serif"
      >
        0
      </text>

      {/* Top dimension label */}
      <text
        x={drawLeft - 8}
        y={toSvgY(prodH) + 4}
        textAnchor="end"
        fill="#666"
        fontSize={10}
        fontFamily="system-ui, sans-serif"
      >
        {formatDim(prodH, useInches)}
      </text>

      {/* Product name label */}
      <text
        x={toSvgX(prodW / 2)}
        y={SVG_PAD - 10}
        textAnchor="middle"
        fill="var(--accent)"
        fontSize={13}
        fontWeight={600}
        fontFamily="system-ui, sans-serif"
      >
        {product.prodName}
      </text>

      {/* Width dimension below */}
      <text
        x={toSvgX(prodW / 2)}
        y={drawBottom + 20}
        textAnchor="middle"
        fill="#999"
        fontSize={10}
        fontFamily="system-ui, sans-serif"
      >
        {formatDim(prodW, useInches)}
      </text>
    </svg>
  )
}
