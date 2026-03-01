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
  followAngle?: boolean   // UI-only: slope top edge to match taller neighbors
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
  startHeight: number     // effective height at wall start corner
  endHeight: number       // effective height at wall end corner
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
  suPartName: string   // SketchUp model filename, e.g. "Black Closet Rod (Oval).skp"
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
  rawInnerXml: string  // everything between <Product> and </Product> from MOZ file
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
  primaryTextureId: number | null   // from MaterialTemplateSelection (cabinet parts)
  wallTextureId: number | null      // from RoomSet WallsTextureId
  rawText: string      // original file text for round-trip
}

/** Scene visibility toggles. */
export interface Visibility {
  walls: Record<number, boolean>  // wallNumber → visible (missing key = true)
  allWalls: boolean
  floor: boolean
  products: boolean
  inserts: boolean
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

/** Drag target for wall editor interactions. */
export type DragTarget =
  | { type: 'joint'; jointIndex: number }
  | { type: 'endpoint'; wallNumber: number; corner: 0 | 1 }

/** Top-level application state. */
export interface AppState {
  room: MozRoom | null
  standaloneProducts: MozFile[]
  overlays: DebugOverlays
  selectedWall: number | null
  wallEditorActive: boolean
  dragTarget: DragTarget | null
  useInches: boolean
  renderMode: RenderMode
  jobFolder: FileSystemDirectoryHandle | null
  textureFolder: FileSystemDirectoryHandle | null
  availableTextures: string[]       // filenames scanned from texture folder
  selectedTexture: string | null    // user-picked filename (overrides DES primaryTextureId)
  singleDrawFloorTextures: Record<string, string[]>  // type → filenames from SingleDraw_Floor/
  selectedFloorType: string | null
  selectedFloorTexture: string | null
  singleDrawWallTextures: Record<string, string[]>  // type → filenames from SingleDraw_Walls/
  selectedWallType: string | null
  selectedWallTexture: string | null
  singleDrawTextures: Record<string, string[]>   // brand → filenames from SingleDraw_Textures/
  selectedSingleDrawBrand: string | null
  selectedSingleDrawTexture: string | null
  libraryFolder: FileSystemDirectoryHandle | null
  availableLibraryFiles: string[]   // sorted .moz filenames from library folder
  sketchUpFolder: FileSystemDirectoryHandle | null  // Mozaik shared folder — deep-scanned for .skp files
  modelsFolder: FileSystemDirectoryHandle | null    // flat folder of .glb files for rendering
  visibility: Visibility
  visibilityMenuOpen: boolean
  placementMode: 'floor' | 'wall'
  unitHeight: number           // mm — height of units being placed
  wallMountTopAt: number       // mm — distance from floor to top of wall-mounted unit
  wallHeight: number           // mm — wall height for room creation / updates
  productConfigOpen: boolean
  cameraResetKey: number
}
