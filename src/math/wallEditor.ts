/**
 * Pure functions for interactive wall editing.
 * All inputs/outputs in Mozaik coordinate space (mm, degrees).
 */

import type { MozWall, MozWallJoint, MozProduct } from '../mozaik/types'
import { DEG2RAD, RAD2DEG } from './constants'
import { wallEndpoint } from './wallMath'

/** Snap angle to nearest 90° multiple if within threshold. */
export function snapAngle(angleDeg: number, threshold = 5): number {
  const nearest90 = Math.round(angleDeg / 90) * 90
  return Math.abs(angleDeg - nearest90) <= threshold ? nearest90 : angleDeg
}

/** Rebuild sequential joints for a closed wall chain, preserving old miterBack state. */
export function rebuildJoints(walls: MozWall[], oldJoints?: MozWallJoint[]): MozWallJoint[] {
  const oldMap = new Map<string, boolean>()
  if (oldJoints) {
    for (const j of oldJoints) oldMap.set(`${j.wall1}-${j.wall2}`, j.miterBack)
  }
  const joints: MozWallJoint[] = []
  for (let i = 0; i < walls.length; i++) {
    const next = (i + 1) % walls.length
    const w1 = walls[i].wallNumber
    const w2 = walls[next].wallNumber
    joints.push({
      wall1: w1,
      wall2: w2,
      wall1Corner: 1,
      wall2Corner: 0,
      isInterior: false,
      miterBack: oldMap.get(`${w1}-${w2}`) ?? true,
    })
  }
  return joints
}

/** Toggle miterBack on a specific joint. */
export function toggleJointMiter(joints: MozWallJoint[], jointIndex: number): MozWallJoint[] {
  return joints.map((j, i) =>
    i === jointIndex ? { ...j, miterBack: !j.miterBack } : j
  )
}

/**
 * Update a wall's length and reconnect the chain.
 * The next wall adjusts its start, angle, and length to reach the wall-after-next's start.
 */
export function updateWallLength(walls: MozWall[], wallNumber: number, newLen: number): MozWall[] {
  const MIN_LEN = 50
  const idx = walls.findIndex(w => w.wallNumber === wallNumber)
  if (idx < 0 || newLen < MIN_LEN) return walls

  const wall = walls[idx]
  const angRad = wall.ang * DEG2RAD

  // New endpoint along the same angle
  const newEndX = wall.posX + newLen * Math.cos(angRad)
  const newEndY = wall.posY + newLen * Math.sin(angRad)

  // Next wall must reconnect to the wall-after-next's start
  const nextIdx = (idx + 1) % walls.length
  const nextNextIdx = (idx + 2) % walls.length
  const targetX = walls[nextNextIdx].posX
  const targetY = walls[nextNextIdx].posY

  const dx = targetX - newEndX
  const dy = targetY - newEndY
  const nextLen = Math.sqrt(dx * dx + dy * dy)

  if (nextLen < MIN_LEN) return walls

  let nextAng = Math.atan2(dy, dx) * RAD2DEG
  const snapped = snapAngle(nextAng)

  // Use snapped angle only if it stays within 1mm of target
  const snapRad = snapped * DEG2RAD
  const snapEndX = newEndX + nextLen * Math.cos(snapRad)
  const snapEndY = newEndY + nextLen * Math.sin(snapRad)
  const snapError = Math.sqrt((snapEndX - targetX) ** 2 + (snapEndY - targetY) ** 2)
  if (snapError < 1.0) nextAng = snapped

  return walls.map((w, i) => {
    if (i === idx) return { ...w, len: newLen }
    if (i === nextIdx) return { ...w, posX: newEndX, posY: newEndY, ang: nextAng, len: nextLen }
    return w
  })
}

/** Update a wall's height. Returns new walls array. */
export function updateWallHeight(walls: MozWall[], wallNumber: number, newHeight: number): MozWall[] {
  return walls.map(w => w.wallNumber === wallNumber ? { ...w, height: newHeight } : w)
}

/**
 * Move a joint (the shared corner between two walls).
 * jointIndex = index into the joints array.
 * Recomputes both connected walls' geometry to pass through the new point.
 */
export function moveJoint(
  walls: MozWall[],
  joints: MozWallJoint[],
  jointIndex: number,
  newX: number,
  newY: number,
): MozWall[] {
  const joint = joints[jointIndex]
  if (!joint) return walls

  const w1Idx = walls.findIndex(w => w.wallNumber === joint.wall1)
  const w2Idx = walls.findIndex(w => w.wallNumber === joint.wall2)
  if (w1Idx < 0 || w2Idx < 0) return walls

  const w1 = walls[w1Idx]
  const w2 = walls[w2Idx]

  // Wall1: keep start fixed, end moves to (newX, newY)
  const dx1 = newX - w1.posX
  const dy1 = newY - w1.posY
  let ang1 = Math.atan2(dy1, dx1) * RAD2DEG
  ang1 = snapAngle(ang1)
  const len1 = Math.sqrt(dx1 * dx1 + dy1 * dy1)

  // After snapping, recompute the actual joint position
  const ang1Rad = ang1 * DEG2RAD
  const actualX = w1.posX + len1 * Math.cos(ang1Rad)
  const actualY = w1.posY + len1 * Math.sin(ang1Rad)

  // Wall2: start moves to actual joint point, end stays at the next wall's start
  const nextJointIdx = (jointIndex + 1) % joints.length
  const nextJoint = joints[nextJointIdx]
  const nextWall = walls.find(w => w.wallNumber === nextJoint?.wall2)
  // If wall2's end connects to another wall, we need that wall's start
  const w2End = nextWall ? [nextWall.posX, nextWall.posY] : wallEndpoint(w2)

  const dx2 = w2End[0] - actualX
  const dy2 = w2End[1] - actualY
  let ang2 = Math.atan2(dy2, dx2) * RAD2DEG
  ang2 = snapAngle(ang2)
  const len2 = Math.sqrt(dx2 * dx2 + dy2 * dy2)

  return walls.map((w, i) => {
    if (i === w1Idx) return { ...w, ang: ang1, len: len1 }
    if (i === w2Idx) return { ...w, posX: actualX, posY: actualY, ang: ang2, len: len2 }
    return w
  })
}

/**
 * Split a wall at its center into two walls.
 * Returns updated walls, joints, and products arrays.
 */
export function splitWallAtCenter(
  walls: MozWall[],
  joints: MozWallJoint[],
  products: MozProduct[],
  wallNumber: number,
): { walls: MozWall[]; joints: MozWallJoint[]; products: MozProduct[] } {
  const idx = walls.findIndex(w => w.wallNumber === wallNumber)
  if (idx < 0) return { walls, joints, products }

  const wall = walls[idx]
  const halfLen = wall.len / 2
  const angRad = wall.ang * DEG2RAD
  const midX = wall.posX + halfLen * Math.cos(angRad)
  const midY = wall.posY + halfLen * Math.sin(angRad)

  const wallA: MozWall = { ...wall, len: halfLen }
  const wallB: MozWall = { ...wall, posX: midX, posY: midY, len: halfLen }

  // Build new array in spatial order, then renumber sequentially 1, 2, 3...
  const rawWalls = [...walls.slice(0, idx), wallA, wallB, ...walls.slice(idx + 1)]
  const newWalls = rawWalls.map((w, i) => ({ ...w, wallNumber: i + 1, idTag: i + 1 }))

  // Remap product wall references to new sequential numbers
  const newProducts = products.map(p => {
    if (!p.wall || p.wall === '0') return p
    const [wn, ...rest] = p.wall.split('_')
    const oldNum = parseInt(wn, 10)
    const section = rest.length ? rest.join('_') : '1'

    if (oldNum === wallNumber) {
      // Product was on the split wall — assign to first or second half
      if (p.x < halfLen) {
        return { ...p, wall: `${idx + 1}_${section}` }
      } else {
        return { ...p, wall: `${idx + 2}_${section}`, x: p.x - halfLen }
      }
    }

    // Other walls: find their old position and compute new number
    const oldIdx = walls.findIndex(w => w.wallNumber === oldNum)
    if (oldIdx < 0) return p
    const newNum = oldIdx < idx ? oldIdx + 1 : oldIdx + 2
    return { ...p, wall: `${newNum}_${section}` }
  })

  const newJoints = rebuildJoints(newWalls)
  return { walls: newWalls, joints: newJoints, products: newProducts }
}

/** Toggle followAngle on a wall. Returns new walls array. */
export function toggleFollowAngle(walls: MozWall[], wallNumber: number): MozWall[] {
  return walls.map(w =>
    w.wallNumber === wallNumber ? { ...w, followAngle: !w.followAngle } : w
  )
}
