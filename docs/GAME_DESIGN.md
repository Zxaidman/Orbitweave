# Orbitweave — Game Design Specification

Version: **0.1.0**

## Core premise

Orbitweave is one puzzle exposed through two synchronized representations:

1. A physically understandable 3×3 cube.
2. An abstract circular orbit graph built from the same movable pieces.

The player may work mostly from the cube, mostly from the graph, or alternate between both. Neither representation is a secondary status display.

## Canonical rules

- Only legal quarter-turn cube transformations are allowed in `v0.1.0`.
- The graph exposes the same transformations instead of creating arbitrary impossible cube states.
- Every player action resolves into a transformation command before state changes.
- The cube and graph render from the same state after every command.

## Graph model

The graph tracks 20 movable pieces:

- 8 corner pieces
- 12 edge pieces

Cube centers are intentionally omitted from the graph because they do not change permutation under standard 3×3 turns.

Three concentric tracks project the current cube layer:

- inner orbit → current upper layer
- middle orbit → current equatorial layer
- outer orbit → current lower layer

Graph connections link corner and edge pieces that are adjacent in the current cube state.

## v0.1.0 interaction grammar

The first release uses the simplest shared rule:

> One graph action performs exactly one standard face turn.

This guarantees that graph interaction can never create an impossible cube configuration.

The graph supports:

- six draggable face handles for guaranteed access to U/R/F/D/L/B;
- direct piece-node selection;
- legal face actions for the selected physical piece;
- tangential node swipes for the node's primary legal action.

## Future grammar

Later versions can add level-defined graph transformations that expand to short legal move sequences, for example:

```text
Graph action A → R U R′
```

Those actions must still pass through the canonical puzzle engine. They should never mutate only the graph.

## Level system direction

A future level is defined by:

- starting puzzle state;
- goal rule;
- allowed transformations;
- enabled interfaces;
- optional move/time constraints.

This allows:

- unrestricted hybrid puzzles;
- cube-only input with graph information;
- graph-only input with cube information;
- special levels with additional graph operations;
- alternative goals beyond the standard solved cube.

## Success in v0.1.0

A puzzle succeeds when all movable corner/edge pieces return to both:

- their solved positions; and
- their solved orientations.

The UI reports a single shared solved state because the cube and graph are not independent puzzles.
