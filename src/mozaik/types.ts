// ── Room types (from DES files) ─────────────────────────────────────

/** Raw Mozaik room parameters. All values in mm. */
export interface MozRoomParms {
  H_Walls: number
  WallThickness: number
  H_Soffit: number
  H_BaseCab: number
  H_WallCab: number
  D_Wall: number
  D_Base: number
  D_Tall: number
  StartingCabNo: number
  [key: string]: number // allow extension for other parms
}

/** A single wall from <Wall> element. All mm + degrees. */
export interface MozWall {
  idTag: number
  wallNumber: number
  posX: number
  posY: number
  ang: number          // degrees (0, 90, 180, 270 typically)
  len: number
  height: number
  thickness: number
  invisible: boolean
  bulge: number
  shapeType: number
  cathedralHeight: number
}

/** Computed wall geometry (derived, not stored in file). */
export interface WallGeometry {
  wallNumber: number
  idTag: number
  start: [number, number]     // [x, y] in Mozaik XY
  end: [number, number]       // [x, y] in Mozaik XY
  tangent: [number, number]   // unit vector along wall
  normal: [number, number]    // inward normal (into room)
  height: number
  thickness: number
}

/** Wall joint from <WallJoint> element. */
export interface MozWallJoint {
  wall1: number
  wall2: number
  wall1Corner: number  // 0=start, 1=end
  wall2Corner: number
  isInterior: boolean
  miterBack: boolean   // True = miter joint, False = butt joint
}

/** An opening/fixture from <Fixt> element. */
export interface MozFixture {
  name: string
  idTag: number
  type: number
  subType: number
  wall: number         // WallNumber reference
  onWallFront: boolean
  width: number
  height: number
  depth: number
  x: number            // distance along wall from wall start
  elev: number         // elevation from floor
  rot: number
}

// ── Product types (from MOZ files + DES <Product> elements) ─────────

/** Mozaik rotation specification: per-part axis order + angles. */
export interface MozRotation {
  a1: number   // degrees around R1 axis
  a2: number   // degrees around R2 axis
  a3: number   // degrees around R3 axis
  r1: 'X' | 'Y' | 'Z'
  r2: 'X' | 'Y' | 'Z'
  r3: 'X' | 'Y' | 'Z'
}

/** 2D shape point from <ShapePoint>. */
export interface MozShapePoint {
  id: number
  x: number
  y: number
  edgeType: number
  sideName: string
}

/** A single cabinet part from <CabProdPart>. */
export interface MozPart {
  name: string
  reportName: string
  type: string         // "Metal", "Toe", "Bottom", "Top", "FEnd", etc.
  x: number
  y: number
  z: number
  w: number            // width/thickness
  l: number            // length
  rotation: MozRotation
  quan: number
  layer: number
  shapePoints: MozShapePoint[]
}

/** Product-level data from <Product> in DES or MOZ root. */
export interface MozProduct {
  uniqueId: string
  prodName: string
  idTag: number
  sourceLib: string
  width: number
  height: number
  depth: number
  x: number
  elev: number
  rot: number
  wall: string         // wall reference, e.g., "3_1" or "0"
  parts: MozPart[]
  rawAttributes: Record<string, string>
}

/** MOZ file wrapper (binary header + XML product). */
export interface MozFile {
  headerLine1: string  // "2"
  headerLine2: string  // "11"
  headerLine3: string  // "Mozaik Product Properties File"
  product: MozProduct
  rawXml: string       // original XML string for round-trip
}

// ── App state types ─────────────────────────────────────────────────

/** Complete DES room. */
export interface MozRoom {
  uniqueId: string
  name: string
  roomType: number
  parms: MozRoomParms
  walls: MozWall[]
  wallJoints: MozWallJoint[]
  fixtures: MozFixture[]
  products: MozProduct[]
  rawText: string      // original file text for round-trip
}

/** Debug overlay toggles. */
export interface DebugOverlays {
  originMarker: boolean
  axisGizmo: boolean
  floorGrid: boolean
  wallNormals: boolean
  boundingBoxes: boolean
  doubleSidedWalls: boolean
  probeScene: boolean
}

/** Render mode for 3D materials. */
export type RenderMode = 'ghosted' | 'solid' | 'wireframe'

/** Top-level application state. */
export interface AppState {
  room: MozRoom | null
  standaloneProducts: MozFile[]
  overlays: DebugOverlays
  selectedWall: number | null
  useInches: boolean
  renderMode: RenderMode
  jobFolder: FileSystemDirectoryHandle | null
}
