import { describe, expect, it } from 'vitest';
import {
  FACE_ORDER,
  applyMove,
  createScramble,
  createSolvedCube,
  inverseMove,
  isSolved,
  sameMatrix,
  sameVec,
  type Move,
} from '../src/game/cube';
import { graphEdges, graphNodes } from '../src/game/graph';

describe('cube engine', () => {
  it('starts solved', () => {
    expect(isSolved(createSolvedCube())).toBe(true);
  });

  it.each(FACE_ORDER)('%s repeated four times returns to solved', (face) => {
    let state = createSolvedCube();
    const move: Move = { face, direction: 1 };
    for (let index = 0; index < 4; index += 1) state = applyMove(state, move);
    expect(isSolved(state)).toBe(true);
  });

  it.each(FACE_ORDER)('%s followed by inverse restores every movable piece', (face) => {
    const solved = createSolvedCube();
    const move: Move = { face, direction: 1 };
    const restored = applyMove(applyMove(solved, move), inverseMove(move));

    expect(restored).toHaveLength(solved.length);
    for (const cubie of restored) {
      const original = solved.find((candidate) => candidate.id === cubie.id);
      expect(original).toBeDefined();
      expect(sameVec(cubie.position, original!.position)).toBe(true);
      expect(sameMatrix(cubie.orientation, original!.orientation)).toBe(true);
    }
  });

  it('creates scrambles without repeating the same face consecutively', () => {
    const scramble = createScramble(50, (() => {
      let seed = 123456;
      return () => {
        seed = (seed * 16807) % 2147483647;
        return (seed - 1) / 2147483646;
      };
    })());

    expect(scramble).toHaveLength(50);
    for (let index = 1; index < scramble.length; index += 1) {
      expect(scramble[index]?.face).not.toBe(scramble[index - 1]?.face);
    }
  });
});

describe('orbit graph', () => {
  it('contains exactly the 20 movable corner and edge pieces', () => {
    const nodes = graphNodes(createSolvedCube());
    expect(nodes).toHaveLength(20);
  });

  it('links adjacent corner/edge pieces', () => {
    const edges = graphEdges(createSolvedCube());
    expect(edges).toHaveLength(24);
  });
});
