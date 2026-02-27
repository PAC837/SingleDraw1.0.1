/**
 * Factory functions for creating rooms programmatically.
 * Produces valid MozRoom objects that render through the existing pipeline.
 */

import type { MozRoom, MozWall, MozWallJoint, MozRoomParms } from './types'

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
