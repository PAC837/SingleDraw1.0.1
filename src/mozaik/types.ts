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
  ptType: number       // 0 = corner/straight, 1 = corner fillet
  data: number         // fillet radius (when ptType=1)
  edgeType: number
  sideName: string
  xEq?: string         // X_Eq parametric formula (e.g., "W-CornerEndWRight")
  yEq?: string         // Y_Eq parametric formula
  dataEq?: string      // Data_Eq parametric formula (e.g., "CornerRadius")
}

// ── Manufacturing operations from <PartOpsXml> ────────────────────

export interface MozOperationHole {
  type: 'hole'
  x: number; y: number; depth: number; diameter: number
  flipSideOp: boolean
}

export interface MozOperationLineBore {
  type: 'linebore'
  x: number; y: number; depth: number; diameter: number
  quan: number; ang: number
  flipSideOp: boolean
}

export interface MozOperationPocket {
  type: 'pocket'
  x: number; y: number; depth: number
  closedShape: boolean
  toolPathNodes: { x: number; y: number }[]
}

export type MozOperation = MozOperationHole | MozOperationLineBore | MozOperationPocket

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
  operations: MozOperation[]
  suPartName: string   // SketchUp model filename, e.g. "Black Closet Rod (Oval).skp"
}

/** Mozaik product parameter override from <CabProdParm>. */
export interface CabProdParm {
  name: string
  type: number      // 0 = numeric, 1 = boolean
  value: string
  desc: string
  category: number
  options: string
  maxVal: number
  minVal: number
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
  isRectShape: boolean // false for L-shaped corner products (CRN)
  topShapePoints: MozShapePoint[]  // from <TopShapeXml> — product-level outline with equations
  parameters: CabProdParm[]  // parsed from <CabProdParms>
  rawAttributes: Record<string, string>
  rawInnerXml: string  // everything between <Product> and </Product> from MOZ file
  /** Cached CRN dependency map — computed once from original product, reused on resize */
  _crnDeps?: {
    originalW: number
    originalD: number
    parts: Array<{
      x: { dep: 'W' | 'D' | null; orig: number }
      y: { dep: 'W' | 'D' | null; orig: number }
      l: { dep: 'W' | 'D' | null; orig: number }
      w: { dep: 'W' | 'D' | null; orig: number }
      sp: Array<{ x: { dep: 'W' | 'D' | null; orig: number }; y: { dep: 'W' | 'D' | null; orig: number } }>
    }>
  }
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
  | { type: 'fixture'; fixtureIdTag: number }

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
  unitHeight: number           // mm — floor section height
  wallSectionHeight: number    // mm — wall-mounted section height
  wallMountTopAt: number       // mm — distance from floor to top of wall-mounted unit (auto-syncs with unitHeight)
  wallHeight: number           // mm — wall height for room creation / updates
  productConfigOpen: boolean
  libraryOpen: boolean
  cameraResetKey: number
  selectedProducts: number[]
  flipOps: boolean
  edgeOpacity: number           // 0–1 — black edge line opacity in solid mode
  polygonOffsetFactor: number   // 0–10 — depth offset factor for solid faces
  polygonOffsetUnits: number    // 0–10 — depth offset units for solid faces
  renderPreset: string | null   // active preset name, null = custom/manual
  ambientIntensity: number        // 0–2 — ambient light intensity
  directionalIntensity: number    // 0–2 — key light intensity
  warmth: number                  // -1 to 1 — hemisphere light color temperature
  exposure: number                // 0.5–2 — tone mapping exposure
  toneMapping: number             // Three.js ToneMapping enum value
  bgColor: string                 // canvas background hex color
  hdriEnabled: boolean             // drei Environment HDRI lighting toggle
  hdriIntensity: number            // environment intensity (0–2)
  adminOpen: boolean               // admin panel visible
  showOperations: boolean           // show drill holes / shelf pins on parts
  libraryConfig: LibraryConfig     // persisted library product config
  hoveredPart: { productIndex: number; partIndex: number } | null  // part inspector highlight
}

// ── Library config types ────────────────────────────────────────────

/** Mapping from height preset to MOZ filename for a product variant group. */
export interface ProductVariantMapping {
  groupName: string                    // e.g., "DH" (auto-detected base name)
  genericFile: string                  // MOZ filename used as preview/default
  variants: Record<string, string>     // height label → MOZ filename, e.g. { "84": "84 DH.moz", "96": "96 DH.moz" }
}

// ── Controlled Library Method ──────────────────────────────────────

/** A unit type column definition (built-in or user-defined). */
export interface UnitTypeColumn {
  id: string            // 'floor' | 'wall' | ... | 'user-1' .. 'user-5'
  label: string         // display name (editable for user columns)
  isBuiltin: boolean
}

/** Product assignments: MOZ filename → array of unit type column IDs checked. */
export type ProductAssignments = Record<string, string[]>

/** A dynamic product group — products sharing suffix + root folder + column. */
export interface DynamicProductGroup {
  groupName: string              // the suffix, e.g., "DH"
  unitTypeId: string             // which column they're grouped under
  rootFolderName: string         // top-level Library.ndx folder name
  memberFiles: string[]          // MOZ filenames in this group
  heightMap: Record<number, string>  // inch label → MOZ filename
}

/** Persisted library configuration (IndexedDB). Version 2 adds controlled library. */
export interface LibraryConfig {
  activeProducts: string[]             // derived: products with any assignment
  variantMappings: ProductVariantMapping[]
  unitTypeColumns?: UnitTypeColumn[]     // 15 columns (10 built-in + 5 user)
  productAssignments?: ProductAssignments // product → column IDs
  version?: number                       // 2 for controlled library
}

/** Check if product name indicates a wall-mount section (PAC Library convention). */
export function isWallMount(prodName: string): boolean {
  const s = prodName.toUpperCase()
  return s.startsWith('WALL ') || s.includes(' WM ') || s.startsWith('WM ')
}
