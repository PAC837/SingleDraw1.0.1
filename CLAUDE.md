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

## Mozaik File Rules

When reading any Mozaik file (DES/MOZ/MOS/SBK/BAK), always announce:
- file name, file type, what is being extracted (walls, transforms, rotations, etc.)

If a needed file is missing: **stop and ask the user**. Specify exactly what is needed and why. Never fabricate Mozaik data.

## Key Invariants

- **Round-trip fidelity**: import → export → re-import must yield identical values (epsilon = 0 unless Mozaik quantizes, only relax if proven).
- **Canonical storage**: all transforms stored in raw Mozaik mm, unchanged.
- **Wall IDs**: preserve original DES wall IDs; compute normalized plan ordering separately for UI display.

## Sample Files

`Mozaik Samples/` contains test data:
- **MOZ products:** `96 DH.moz` (double hang), `FS 96.moz` (filler strip), `FS 96 LED Left.moz`, `87 4S 6DR (5-5-5-9-9-9) HIGH.moz`
- **DES rooms:** `SingleDraw V1-0-1 Test Room/Room0.des`, `Room1.des`, `Room2.des`
- **Reference:** `S031 Fresno.step` (CAD comparison model)
