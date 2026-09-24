import { describe, expect, it } from 'vitest';
import {
  FACE_ORDER,
  SLICE_ORDER,
  applyMove,
  createScramble,
  createSolvedCube,
  inverseMove,
  isSolved,
  sameMatrix,
  sameVec,
  stickerSliceTargets,
  moveTargetForAxisLayer,
  type Move,
} from '../src/game/cube';
import {
  buildOrbitTracks,
  orbitTrackStickerCount,
} from '../src/game/graph';

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

  it('maps axis layers to the nine legal slice targets', () => {
    expect(moveTargetForAxisLayer('x', -1)).toBe('L');
    expect(moveTargetForAxisLayer('x', 0)).toBe('M');
    expect(moveTargetForAxisLayer('x', 1)).toBe('R');
    expect(moveTargetForAxisLayer('y', -1)).toBe('D');
    expect(moveTargetForAxisLayer('y', 0)).toBe('E');
    expect(moveTargetForAxisLayer('y', 1)).toBe('U');
    expect(moveTargetForAxisLayer('z', -1)).toBe('B');
    expect(moveTargetForAxisLayer('z', 0)).toBe('S');
    expect(moveTargetForAxisLayer('z', 1)).toBe('F');
  });

  it('derives two legal row/column slices from a selected front-face sticker', () => {
    expect(stickerSliceTargets([1, 1, 1], [0, 0, 1])).toEqual(['R', 'U']);
    expect(stickerSliceTargets([0, 1, 1], [0, 0, 1])).toEqual(['M', 'U']);
    expect(stickerSliceTargets([0, 0, 1], [0, 0, 1])).toEqual(['M', 'E']);
  });

  it('derives two legal row/column slices on side and top faces', () => {
    expect(stickerSliceTargets([1, 0, 0], [1, 0, 0])).toEqual(['E', 'S']);
    expect(stickerSliceTargets([0, 1, 0], [0, 1, 0])).toEqual(['M', 'S']);
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
  it('builds three axis groups with three slice circles each', () => {
    const tracks = buildOrbitTracks(createSolvedCube());

    expect(tracks).toHaveLength(9);
    expect(tracks.filter((track) => track.axis === 'x')).toHaveLength(3);
    expect(tracks.filter((track) => track.axis === 'y')).toHaveLength(3);
    expect(tracks.filter((track) => track.axis === 'z')).toHaveLength(3);
  });

  it('puts four groups of three stickers on every circle', () => {
    const tracks = buildOrbitTracks(createSolvedCube());

    for (const track of tracks) {
      expect(track.groups).toHaveLength(4);
      expect(track.groups.map((group) => group.stickers.length)).toEqual([3, 3, 3, 3]);
      expect(orbitTrackStickerCount(track)).toBe(12);
    }
  });

  it('makes all nine slice circles actionable', () => {
    const tracks = buildOrbitTracks(createSolvedCube());
    const interactive = tracks.filter((track) => track.interactive);

    expect(interactive).toHaveLength(9);
    expect(interactive.map((track) => track.move).sort())
      .toEqual([...FACE_ORDER, ...SLICE_ORDER].sort());
  });

  it.each(SLICE_ORDER)('%s repeated four times returns to solved', (slice) => {
    let state = createSolvedCube();
    const move: Move = { face: slice, direction: 1 };
    for (let index = 0; index < 4; index += 1) state = applyMove(state, move);
    expect(isSolved(state)).toBe(true);
  });

  it.each(SLICE_ORDER)('%s followed by inverse restores the cube state', (slice) => {
    const solved = createSolvedCube();
    const move: Move = { face: slice, direction: 1 };
    const restored = applyMove(applyMove(solved, move), inverseMove(move));

    for (const cubie of restored) {
      const original = solved.find((candidate) => candidate.id === cubie.id);
      expect(original).toBeDefined();
      expect(sameVec(cubie.position, original!.position)).toBe(true);
      expect(sameMatrix(cubie.orientation, original!.orientation)).toBe(true);
    }
  });

  it('preserves twelve stickers per circle after a legal move', () => {
    const moved = applyMove(createSolvedCube(), { face: 'R', direction: 1 });
    const tracks = buildOrbitTracks(moved);

    for (const track of tracks) expect(orbitTrackStickerCount(track)).toBe(12);
  });
});
