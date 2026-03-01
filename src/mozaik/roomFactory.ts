/**
 * Factory functions for creating rooms programmatically.
 * Produces valid MozRoom objects that render through the existing pipeline.
 */

import type { MozRoom, MozWall, MozWallJoint, MozRoomParms, MozFixture } from './types'

export interface CreateRoomParams {
  width: number       // mm, front wall length (X-axis)
  depth: number       // mm, side wall length (Y-axis)
  height?: number     // mm, default 2438.4 (96")
  thickness?: number  // mm, default 101.6 (4")
}

/** Create a complete MozRoom for a 4-wall rectangular room. Mozaik convention (left→back→right→front), origin at front-left-bottom. */
export function createRectangularRoom(params: CreateRoomParams): MozRoom {
  const width = params.width
  const depth = params.depth
  const height = params.height ?? 2438.4
  const thickness = params.thickness ?? 101.6

  const walls = createWalls(width, depth, height, thickness)
  const joints = createWallJoints(4)
  const parms = createDefaultParms(height, thickness)

  return {
    uniqueId: String(Date.now() % 100000000),
    name: `${Math.round(width)}x${Math.round(depth)} Room`,
    roomType: 0,
    parms,
    walls,
    wallJoints: joints,
    fixtures: [],
    products: [],
    primaryTextureId: null,
    wallTextureId: null,
    rawText: '',
  }
}

/** Create 4 walls for a rectangular room. Matches Mozaik's wall convention (left→back→right→front). */
function createWalls(width: number, depth: number, height: number, thickness: number): MozWall[] {
  return [
    // Wall 1: left wall — front to back along +Y
    createWall(1, 0, 0, 90, depth, height, thickness),
    // Wall 2: back wall — left to right along +X
    createWall(2, 0, depth, 0, width, height, thickness),
    // Wall 3: right wall — back to front along -Y
    createWall(3, width, depth, 270, depth, height, thickness),
    // Wall 4: front wall — right to left along -X
    createWall(4, width, 0, 180, width, height, thickness),
  ]
}

function createWall(
  wallNumber: number, posX: number, posY: number, ang: number,
  len: number, height: number, thickness: number,
): MozWall {
  return {
    idTag: wallNumber,
    wallNumber,
    posX,
    posY,
    ang,
    len,
    height,
    thickness,
    invisible: false,
    bulge: 0,
    shapeType: 0,
    cathedralHeight: 0,
  }
}

/** Create sequential butt joints connecting wall.end → next wall.start in a closed loop. */
function createWallJoints(wallCount: number): MozWallJoint[] {
  const joints: MozWallJoint[] = []
  for (let i = 1; i <= wallCount; i++) {
    const next = i < wallCount ? i + 1 : 1
    joints.push({
      wall1: i,
      wall2: next,
      wall1Corner: 1,   // end of wall i
      wall2Corner: 0,   // start of wall next
      isInterior: false,
      miterBack: false,  // butt joint
    })
  }
  return joints
}

function createDefaultParms(height: number, thickness: number): MozRoomParms {
  return {
    H_Walls: height,
    WallThickness: thickness,
    H_Soffit: 152.4,
    H_BaseCab: 876.3,
    H_WallCab: 914.4,
    D_Wall: 304.8,
    D_Base: 609.6,
    D_Tall: 609.6,
    StartingCabNo: 1,
  }
}

export function createOpening(wall: number, x: number, width: number, height: number, idTag: number): MozFixture {
  return {
    name: 'Opening',
    idTag,
    type: 7,
    subType: 2,
    wall,
    onWallFront: true,
    width,
    height,
    depth: 50.8,
    x,
    elev: 0,
    rot: 0,
  }
}

export function createDoor(wall: number, x: number, width: number, height: number, idTag: number): MozFixture {
  return {
    name: 'Door',
    idTag,
    type: 7,
    subType: 0,
    wall,
    onWallFront: true,
    width,
    height,
    depth: 101.6,
    x,
    elev: 0,
    rot: 0,
  }
}

export function createDoubleDoor(wall: number, x: number, width: number, height: number, idTag: number): MozFixture {
  return {
    name: 'DoubleDoor',
    idTag,
    type: 7,
    subType: 1,
    wall,
    onWallFront: true,
    width,
    height,
    depth: 101.6,
    x,
    elev: 0,
    rot: 0,
  }
}

export function createWindow(wall: number, x: number, width: number, height: number, elev: number, idTag: number): MozFixture {
  return {
    name: 'Window',
    idTag,
    type: 6,
    subType: 0,
    wall,
    onWallFront: true,
    width,
    height,
    depth: 50.8,
    x,
    elev,
    rot: 0,
  }
}

/** Reach-in closet: wide front, shallow depth, opening on front wall. */
export function createReachInRoom(height = 2438.4, thickness = 101.6): MozRoom {
  const width = 2438.4   // 96"
  const depth = 762       // 30"
  const room = createRectangularRoom({ width, depth, height, thickness })
  // Opening centered on front wall (wall 4), 36" wide × 80" tall
  const openingW = 914.4   // 36"
  const openingX = (width - openingW) / 2
  room.fixtures = [createOpening(4, openingX, openingW, 2032, 5)]
  room.name = 'Reach-In'
  return room
}

/** Walk-in closet: 12' × 12', opening on front wall. */
export function createWalkInRoom(height = 2438.4, thickness = 101.6): MozRoom {
  const width = 3657.6   // 144"
  const depth = 3657.6   // 144"
  const room = createRectangularRoom({ width, depth, height, thickness })
  const openingW = 914.4
  const openingX = (width - openingW) / 2
  room.fixtures = [createOpening(4, openingX, openingW, 2032, 5)]
  room.name = 'Walk-In'
  return room
}

/** Walk-in deep: 8' wide × 12' deep, opening on front wall. */
export function createWalkInDeepRoom(height = 2438.4, thickness = 101.6): MozRoom {
  const width = 2438.4   // 96"
  const depth = 3657.6   // 144"
  const room = createRectangularRoom({ width, depth, height, thickness })
  const openingW = 914.4
  const openingX = (width - openingW) / 2
  room.fixtures = [createOpening(4, openingX, openingW, 2032, 5)]
  room.name = 'Walk-In Deep'
  return room
}

/** Angled room: 5-wall room with one angled wall section. */
export function createAngledRoom(height = 2438.4, thickness = 101.6): MozRoom {
  // L-shape with angled corner: left wall, back wall, angled wall, right side, front wall
  const w = 3048    // 120" total width
  const d = 2438.4  // 96" depth
  const cut = 1219.2 // 48" corner cut
  const angLen = Math.sqrt(cut * cut + cut * cut)  // ~67.88" diagonal

  const walls: MozWall[] = [
    // Wall 1: left — full depth along +Y
    createWall(1, 0, 0, 90, d, height, thickness),
    // Wall 2: back — partial width along +X
    createWall(2, 0, d, 0, w - cut, height, thickness),
    // Wall 3: angled — 45° cut from back-right to front-right
    createWall(3, w - cut, d, 315, angLen, height, thickness),
    // Wall 4: right — partial depth along -Y
    createWall(4, w, d - cut, 270, d - cut, height, thickness),
    // Wall 5: front — full width along -X
    createWall(5, w, 0, 180, w, height, thickness),
  ]

  const joints = createWallJoints(5)
  joints.forEach(j => { j.miterBack = true })
  const parms = createDefaultParms(height, thickness)
  const openingW = 914.4
  const openingX = (w - openingW) / 2

  return {
    uniqueId: String(Date.now() % 100000000),
    name: 'Angled',
    roomType: 0,
    parms,
    walls,
    wallJoints: joints,
    fixtures: [createOpening(5, openingX, openingW, 2032, 6)],
    products: [],
    primaryTextureId: null,
    wallTextureId: null,
    rawText: '',
  }
}
