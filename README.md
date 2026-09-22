# Orbitweave

**Orbitweave** is a web puzzle where a mechanically legal 3×3 cube and a circular orbit graph are two synchronized interfaces to the same puzzle state.

A cube turn immediately changes the graph. A graph turn performs the same legal cube transformation. The long-term design can introduce more advanced graph transformations, but the initial prototype intentionally keeps the mapping one graph action → one standard Rubik-style face turn.

## Version

`0.1.1` — Dependency compatibility patch for the Cube + Orbit Graph Prototype


## v0.1.1 patch

`v0.1.1` pins React and React DOM to `19.2.8`, which is inside the peer-dependency range required by `@react-three/fiber@9.7.0` (`>=19 <19.3`). It also aligns the React type packages to the 19.2 line. This fixes the `npm install` dependency-resolution failure present in `v0.1.0`.

## Stack

- Astro 7
- React 19 + TypeScript
- Three.js through React Three Fiber
- React Three Drei for camera/orbit controls
- Zustand for runtime game state
- Vitest for puzzle-engine tests
- Static output suitable for Vercel

## Requirements

- Node.js `22.12.0` or newer even-numbered supported release
- npm

The repository includes `.nvmrc` with Node `22.20.0` as a known-compatible baseline.

## Run locally

```bash
npm install
npm run dev
```

Production checks:

```bash
npm run test
npm run check
npm run build
```

Preview the production build:

```bash
npm run preview
```

## Controls

### Cube

- Drag a colored sticker: turn that face clockwise/counter-clockwise based on drag direction.
- Right mouse drag: inspect the cube camera.
- `Orbit view`: enables left-drag camera orbit for deliberate inspection.
- Two-finger gesture on touch devices: camera zoom/orbit.

### Orbit graph

- Drag a colored face handle around the outer orbit to perform that face turn.
- Select a piece node to reveal the legal cube faces containing that piece.
- Tangentially swipe a selected node for its primary legal graph action.

### Keyboard

- `U R F D L B`: clockwise face turns.
- `Shift` + face key: inverse turn.
- `Ctrl/Cmd + Z`: undo.
- `Ctrl/Cmd + Shift + Z`: redo.

## Puzzle rules in v0.1.0

- The cube is mechanically constrained to legal 3×3 face turns.
- The graph contains the 20 movable physical pieces: 8 corners + 12 edges.
- Graph edges represent current corner↔edge adjacency on the cube surface.
- Each graph node carries 2–3 colored orientation pips, so piece orientation changes are visible as well as permutation changes.
- Top, middle, and bottom piece layers are projected onto three concentric graph tracks.
- Cube and graph never maintain separate authoritative state; both render from one canonical puzzle model.
- A puzzle is solved only when all movable pieces return to solved position and orientation.

## Deployment to Vercel

1. Push this repository to GitHub.
2. Import the repository in Vercel.
3. Vercel should auto-detect Astro.
4. Build command: `npm run build`.
5. Output directory: `dist`.

No server runtime or database is required for `v0.1.0`.

## Git bundle import

For the `v0.1.1` dependency patch, start from a local repository already containing `v0.1.0` (`ed28194`).

```powershell
cd C:\path\to\Orbitweave
git pull "$HOME\Downloads\orbitweave-v0.1.1.bundle" main --ff-only
git fetch "$HOME\Downloads\orbitweave-v0.1.1.bundle" refs/tags/v0.1.1:refs/tags/v0.1.1
git push origin main
git push origin v0.1.1
```

## Project structure

```text
src/
├── components/
│   ├── cube/       # Three.js cube renderer + direct pointer interaction
│   ├── game/       # Game shell, HUD, keyboard input
│   └── graph/      # Linked SVG orbit graph
├── game/
│   ├── cube.ts     # Canonical legal cube transformation engine
│   └── graph.ts    # Graph projection + adjacency rules
├── store/
│   └── gameStore.ts
├── styles/
│   └── global.css
└── pages/
    └── index.astro
```

See `docs/ARCHITECTURE.md` and `docs/GAME_DESIGN.md` for the implementation decisions and extension points.
