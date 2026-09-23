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
  type MoveTarget,
} from '../src/game/cube';
import { buildOrbitTracks, orbitTrackStickerCount } from '../src/game/graph';

describe('cube engine', () => {
  const ALL_TURNS: readonly MoveTarget[] = [...FACE_ORDER, 'M', 'E', 'S'];
  it('starts solved', () => {
    expect(isSolved(createSolvedCube())).toBe(true);
  });

  it.each(ALL_TURNS)('%s repeated four times returns to solved', (face) => {
    let state = createSolvedCube();
    const move: Move = { face, direction: 1 };
    for (let index = 0; index < 4; index += 1) state = applyMove(state, move);
    expect(isSolved(state)).toBe(true);
  });

  it.each(ALL_TURNS)('%s followed by inverse restores every movable piece', (face) => {
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
  it('contains three axis groups of three slice tracks', () => {
    const tracks = buildOrbitTracks(createSolvedCube());
    expect(tracks).toHaveLength(9);
    expect(tracks.map((track) => track.id)).toEqual(['U', 'E', 'D', 'L', 'M', 'R', 'B', 'S', 'F']);
  });

  it('puts four groups of three traveling stickers on every slice circle', () => {
    const tracks = buildOrbitTracks(createSolvedCube());

    for (const track of tracks) {
      expect(track.groups).toHaveLength(4);
      expect(track.groups.map((group) => group.stickers.length)).toEqual([3, 3, 3, 3]);
      expect(orbitTrackStickerCount(track)).toBe(12);
    }
  });

  it('makes every offset circle a legal move track', () => {
    const tracks = buildOrbitTracks(createSolvedCube());
    expect(tracks.every((track) => track.interactive)).toBe(true);
    expect(tracks.map((track) => track.move)).toEqual(['U', 'E', 'D', 'L', 'M', 'R', 'B', 'S', 'F']);
  });

  it('cycles the U orbit sticker groups when the U face turns', () => {
    const solved = createSolvedCube();
    const before = buildOrbitTracks(solved).find((track) => track.id === 'U');
    const after = buildOrbitTracks(applyMove(solved, { face: 'U', direction: 1 }))
      .find((track) => track.id === 'U');

    expect(before).toBeDefined();
    expect(after).toBeDefined();

    const beforeColors = before!.groups.map((group) => group.stickers.map((sticker) => sticker.homeFace));
    const afterColors = after!.groups.map((group) => group.stickers.map((sticker) => sticker.homeFace));
    expect(afterColors).not.toEqual(beforeColors);
  });
});
