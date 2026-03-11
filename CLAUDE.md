# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Moz Importer is a **truth harness** for verifying Mozaik CAD file import/export fidelity. It loads Mozaik closet design files (DES rooms, MOZ/MOS products), renders them in Three.js, and exports back with zero drift. This is **not** a closet designer — if a change doesn't improve coordinate, rotation, wall, opening, or round-trip truth, reject it.

Full specification: [SPEC.md](SPEC.md)

## Development Commands

```
npm install          # install dependencies
npm run dev          # start Vite dev server
npm run build        # production build
npx tsc --noEmit     # type-check without emitting
```

## Architecture

```
src/
├── mozaik/    # DES/MOZ XML parsers + schema normalization
├── math/      # basis transforms, rotations, wall normals
├── render/    # R3F scene, debug overlays, UI panels
├── export/    # round-trip writeback to Mozaik format
└── tests/     # probe scenes + numeric diff reports
```

**Tech stack:** Vite + React + TypeScript, React Three Fiber + Drei, Tailwind CSS

## Code Constraints

- Every file **under 500 lines** (prefer < 300). No monolithic components.
- Split by responsibility per the directory layout above.

## Coordinate Systems

**Canonical Mozaik space** (source of truth — stored, exported, never modified):
- X = width, Y = depth, Z = height. Units = millimeters. Origin = room front-left-bottom.
- Never clamp, recenter, or "fix" coordinates.

**Three.js rendering** (view layer only):
- Default basis mapping: `(Xm, Ym, Zm) → (Xm, Zm, -Ym)`
- Apply the same basis change to rotations (not just positions).

## Design System

**Theme:** Always dark. No light mode. No component libraries (Material UI, Chakra, etc.) — Tailwind only.

**Color tokens** (CSS variables in `src/index.css`):
| Token | Value | Use |
|-------|-------|-----|
| `--accent` | `#AAFF00` | Primary actions, active borders, highlights |
| `--bg-dark` | `#111111` | App background |
| `--bg-panel` | `#1a1a1a` | Panels, cards, floating elements |
| `--text-primary` | `#ffffff` | Body text |
| `--text-secondary` | `#999999` | Labels, secondary text |

**Supporting grays:** Borders `#333`/`#555`, inputs/buttons `#1e1e1e`/`#222`, hover `bg-gray-700`, disabled `opacity-40 cursor-not-allowed`.

**Wall color is `#e8e0d8`** — DO NOT CHANGE.

**Typography scale:**
- Title: `text-xl font-bold`
- Section header: `text-xs font-semibold uppercase tracking-wider text-[var(--accent)]`
- Body: `text-sm`
- Labels: `text-xs`
- Tiny: `text-[10px]`
- Font: `system-ui, -apple-system, sans-serif` (no custom fonts)

**Component patterns:**
- **Toolbar buttons:** `w-16 h-16 rounded-full`, border `2px solid #555` (inactive) / `2px solid var(--accent)` (active), icon `#aaa` → `var(--accent)`
- **Floating panels:** `bg-[var(--bg-panel)] rounded-lg shadow-lg border border-[#333]`, max-height `calc(100vh - 80px)`, `overflow-y-auto`
- **Section headers:** `text-xs font-semibold uppercase tracking-wider text-[var(--accent)] border-b border-[var(--accent)] pb-1 mb-3`
- **Primary buttons:** `bg-[var(--accent)] text-black font-medium px-3 py-2 rounded hover:opacity-90`
- **Secondary buttons:** `bg-gray-800 text-white border border-gray-600 px-3 py-1.5 rounded hover:bg-gray-700 transition-colors`
- **Toggle buttons:** inactive `bg-[#333] text-[#aaa]`, active `bg-[var(--accent)] text-black font-medium`
- **Inputs:** `text-xs px-2 py-1 bg-gray-800 border border-[var(--accent)] text-white rounded`
- **Checkboxes:** `accent-[var(--accent)] cursor-pointer`
- **SVG icons:** inline with dynamic color props, `strokeWidth="1.5"`

**Layout:**
- Sidebar: `w-80`, sections separated by `border-b border-gray-800`, padding `p-4`
- Card padding: `p-2`, flex gap: `gap-2` (standard) / `gap-1` (tight)
- All transitions: `transition-colors` or `transition-all`

## Library.ndx (Product Organization)

**Library.ndx** is the source of truth for how products are organized into folders in a Mozaik product library. Always look for it in the library folder root (alongside the `Products/` subfolder).

**XML structure:**
- Root: `<ProductLibrary>` containing `<Node>` elements
- Folders: `<Node Name="FS 96 Sections" ID="1276" ParentID="1241" IsFolder="True">`
- Products: `<Node Name="96 DH" ID="730" ParentID="1276" IsFolder="False">`
- Product Name → MOZ filename: `"96 DH"` → `"96 DH.moz"`
- Hierarchy is max 3 levels deep (root category → sub-category → products)
- `ParentID="0"` = root-level folder

**Key folders (PAC Library V2):**
- Floor Standing Panels (standard, LED, hanging, back)
- Floor Standing Sections (84/87/96/108 sub-folders + corners)
- Wall Mounted Panels (76/72/48 sub-folders + LED)
- Wall Mounted Sections (76/72/48 + corners)
- Islands, Upper Stack, Hutch, Bench, Desk, Sub Assemblies, Misc, Custom

**Also contains:** ModularHeight (93 values), ModularDepth (5 values), ModularFFHeight (57 values)

**Parser:** `src/mozaik/libraryNdxParser.ts` — `parseLibraryNdx(xml)` returns `LibraryFolder[]` tree
**Admin panel:** `src/render/AdminPanel.tsx` — reads Library.ndx and displays folder-based product tree

**Do NOT auto-categorize** products by filename patterns. Always use Library.ndx as the authority.

## Mozaik File Rules

When reading any Mozaik file (DES/MOZ/MOS/SBK/BAK), always announce:
- file name, file type, what is being extracted (walls, transforms, rotations, etc.)

If a needed file is missing: **stop and ask the user**. Specify exactly what is needed and why. Never fabricate Mozaik data.

## Mozaik Part & Product Positioning

**Part geometry:**
- Part dimensions: `L` = length (longest span), `W` = width (shorter span)
- BoxGeometry: `args={[L, thick, W]}` — thick = 19mm (wood panels) or 3mm (metal brackets)
- Part center offset: `Vector3(L/2, W/2, thick/2)` rotated by part quaternion, then added to part `(x, y, z)`

**Texture grain direction:**
- Grain ALWAYS runs along part L axis unless "cross-grain" is selected in Mozaik
- Mozaik texture images have grain along the V (vertical) axis in the image
- Fix: texture rotated 90° (`tex.rotation = π/2`) with swapped repeat `(partW/uvw, partL/uvh)`
- UVW/UVH from Textures.dat = tile dimensions in mm (typically 609.6mm = 24")

**Product placement on walls:**
- `product.x` = distance along wall from usable start (inside corner after joint trim)
- `product.elev` = elevation above floor (Z in Mozaik)
- `product.wall` = `"wallNumber_section"` format (e.g., "3_1"). Section is typically 1.
- World offset = `trimStart + product.x` along wall tangent, plus `wallThickness/2 + productDepth` along inward normal
- Products auto-place left-to-right, cannot overlap bounding boxes, cannot extend past wall edges

## Auto End Panels & Product Collision

**Auto end panels** (`src/mozaik/autoEndPanels.ts`):
- Panels are computed on-the-fly, NOT stored — derived from product arrangement
- PANEL_THICK = 19mm (3/4" standard wood)
- Panel height & depth match adjacent section
- Same-depth sections: shared panel when gap = 19mm, separate panels when gap >= 38mm
- Different-depth sections: always separate panels
- `computeAutoEndPanels()` runs reactively (useMemo) whenever products change
- Rendered by `src/render/AutoEndPanels.tsx`, exported via `src/export/desWriter.ts`

**Panel export templates** (`src/export/panelTemplate.ts`):
- Two panel types: Floor Panel (FS 96 pattern) and Wall Mount Panel (Wall Mount 76 pattern)
- Selection: `elev === 0` → Floor Panel, `elev > 0` → Wall Mount Panel
- Floor: ProductType SubType=21, toe notch + baseboard notch, MatORSel, Flags all 1s
- Wall: ProductType SubType=22, French cleat notch, LegCounts, Flags="0010000000000011"
- Full Mozaik-compatible XML with all required container elements (crash without them)
- DES loading is NOT used — Room1.des is a reference structure only. All workflow is create → place → export.

**Product collision** (`src/mozaik/wallPlacement.ts`):
- `computeProductXBounds()` returns valid `{minX, maxX}` for a product
- Enforces PANEL_THICK gap from wall edges and between adjacent products
- Move handle (center ball) clamps to bounds — sections cannot overlap
- Collision clamping in `useProductActions` hook (not store reducer)

**Bump buttons** (`src/render/ProductResizeHandles.tsx`):
- Red spheres at top-left and top-right corners of front face
- Click top-left → snap to leftmost valid position (bump left)
- Click top-right → snap to rightmost valid position (bump right)

## Wall Editor & Plan View

**Wall editor files:**
- `src/math/wallEditor.ts` — wall split, length/height update, joint rebuild logic
- `src/render/PlanViewOverlay.tsx` — dimension labels + draggable joint handles (R3F overlay)
- `src/render/WallEditorPanel.tsx` — floating panel for wall length/height inputs, corner join/unjoin buttons
- `src/render/WallEditorButton.tsx` — toolbar toggle button
- `src/render/MiniRoomPreview.tsx` — mini 3D preview shown during plan view (bottom-right)

**Joint rules:**
- New joints default to `miterBack: true` (mitered). Users toggle via wall editor panel L/R buttons.
- `rebuildJoints()` regenerates the joint array whenever walls change (split, move, resize)
- Joint connects `wall[i].end → wall[i+1].start` in ring order
- Mitered corners: both walls extend diagonally to corner polygon intersection points
- Butt (unjoined) corners: both walls have flat perpendicular faces (open corner)
- Top-of-slope corners always render mitered visually (no butt gap regardless of miterBack)

**Follow-angle walls:**
- `wall.followAngle = true` slopes the wall between neighbor heights
- `startHeight = max(ownHeight, prevHeight)`, `endHeight = max(ownHeight, nextHeight)`
- All corners toggleable (no auto-unjoin, no disabled buttons)
- DES export: top-of-slope joints forced `miterBack="True"`, bottom-of-slope forced `"False"`
- Top of slope = corner where neighbor is taller than the follow-angle wall

**Plan view camera (OrthoCamera in Scene.tsx):**
- Orthographic camera looking straight down (Y-up → camera.up = (0,0,-1))
- OrbitControls with `enableRotate=false` for pan/zoom only
- Settle frames enforce camera position for first few frames after mount/target change
- **Do NOT add polar angle props to OrbitControls** — breaks the 3D view
- Cleanup restores perspective camera centered on room via `targetRef`

**Unit display:**
- `formatDim()` in `src/math/units.ts` — fractional inches (nearest 1/16) or mm
- `mmToInches()` / `inchesToMm()` for input field conversion in WallEditorPanel

## TopShapeXml Formula Rules (CRN Products)

**TopShapeXml** defines the product-level outline shape for non-rectangular (CRN/corner) products. Points may have parametric equations (X_Eq, Y_Eq, Data_Eq) referencing W, D, and CabProdParms.

**Non-equation points track W/D implicitly:**
- Points at X ≈ W (original product width) → X tracks W on resize (becomes new W)
- Points at Y ≈ D (original product depth) → Y tracks D on resize (becomes new D)
- Points at 0 → stay at 0 (constants)
- This applies to ALL TopShape points, not just those with explicit equations

**Part shape inheritance:**
- L-shaped parts (Bottom, Top, FixedShelf, AdjustableShelf) inherit the TopShape outline
- Part PartShapeXml has the same point count and topology as TopShapeXml
- Manufacturing offsets (≤1mm typically) exist between part points and TopShape points
- Shelves have full L-shaped PartShapeXml in the MOZ file (10 points, not 4)
- Shelves have A1=180 rotation (R1='Y') — X axis is mirrored relative to product
- Topology mapper detects A1=180 and mirrors X coords (`partL - sp.x`) before matching
- `applyPropagatedEqs()` un-mirrors on resize: `partX = newPartL - (topXEval + offset)`
- Y axis is NOT mirrored (rotation around Y preserves Y)

**Equation tokens:**
- `W`, `D` — product width and depth
- `CornerEndWLeft`, `CornerEndWRight` — corner arm widths (~356mm)
- `CornerRadius` — inner corner fillet radius (~60mm)
- `CornerMargin` — fit gap between parts (~6.35mm / 0.25")
- `Uend.th` — FEnd panel thickness (19mm default, from material library)
- `DSlopW`, `DSlopD` — user parameters for dado/slope (~0.254mm / 0.01" typically)

**Always ask the user** when encountering unfamiliar formula tokens, part relationships, or resize behaviors. The MOZ parser, operation mapping, part positioning, and formula system all need continuous refinement.

## Key Invariants

- **Round-trip fidelity**: import → export → re-import must yield identical values (epsilon = 0 unless Mozaik quantizes, only relax if proven).
- **Canonical storage**: all transforms stored in raw Mozaik mm, unchanged.
- **Wall IDs**: preserve original DES wall IDs; compute normalized plan ordering separately for UI display.

## Testing & Verification

- After completing any feature or bug fix, always tell the user exactly what to test and how to verify the change. Include specific steps: what to click, what to look for, expected vs. previous behavior.

## Sample Files

`Mozaik Samples/` contains test data:
- **MOZ products:** `96 DH.moz` (double hang), `FS 96.moz` (filler strip), `FS 96 LED Left.moz`, `87 4S 6DR (5-5-5-9-9-9) HIGH.moz`
- **DES rooms:** `SingleDraw V1-0-1 Test Room/Room0.des`, `Room1.des`, `Room2.des`
- **Reference:** `S031 Fresno.step` (CAD comparison model)
