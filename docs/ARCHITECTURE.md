# Orbitweave — Architecture

Version: **0.1.0**

## Design goal

The renderer must never become the source of truth for puzzle mechanics.

```text
Pointer / touch / keyboard
          │
          ▼
   transformation command
          │
          ▼
     canonical state
       ╱        ╲
      ▼          ▼
  3D cube     orbit graph
```

## Cube representation

The engine represents the physical cube as 26 visible cubies around an omitted core.

Each cubie stores:

- immutable home coordinate;
- current integer coordinate;
- current 3×3 integer orientation matrix.

A face move selects all cubies on one ±1 coordinate layer, then applies a ±90° rotation matrix to both position and orientation.

Benefits:

- all states are legal by construction;
- four identical quarter turns return exactly to the start without floating-point error;
- rendering transforms can be derived directly;
- graph projection can use physical piece positions without duplicating permutation tables.

## Rendering

Three.js rendering is isolated inside `components/cube`.

The cube renderer interpolates between the previous and current integer transforms for visual animation. The canonical puzzle state itself never contains floating-point animation data.

The orbit graph is SVG. CSS transitions animate graph-node movement after the canonical state changes.

## State management

Zustand owns runtime interaction state:

- current canonical cubies;
- previous render snapshot;
- puzzle starting state;
- undo stack;
- redo stack;
- move counter;
- camera/orbit mode;
- selected graph node.

Undo/redo stores immutable snapshots. This is intentionally simple for `v0.1.0`; a later release can switch to command replay if puzzle states grow substantially.

## Input boundary

All inputs ultimately call one operation:

```ts
applyMove({ face, direction })
```

This is the important invariant that keeps cube and graph synchronization deterministic.

## Testing strategy

The pure puzzle engine has no React/Three.js dependencies and is tested independently.

Current invariants:

- solved state is detected;
- each face repeated four times is identity;
- each face followed by its inverse is identity;
- scramble generation avoids same-face repetition;
- graph projection contains exactly 20 movable pieces;
- solved graph adjacency contains 24 corner↔edge links.

## Deployment

Astro outputs a static `dist/` site, so Vercel does not require server functions for this release.

## Known v0.1.0 limitations

- Direct cube swipe direction is intentionally forgiving rather than simulating a physically grabbed row with continuous 3D rotation.
- Node swipes use the node's primary incident face; the six outer face handles and selected-node face controls provide full graph-side move access.
- No cloud account, leaderboard, campaign, level editor, or solver/hint system is included yet.
- The generated release bundle contains source history but not `node_modules` or built output.
