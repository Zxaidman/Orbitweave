export type Axis = 'x' | 'y' | 'z';
export type Face = 'U' | 'D' | 'L' | 'R' | 'F' | 'B';
export type Slice = 'M' | 'E' | 'S';
export type MoveTarget = Face | Slice;
export type MoveDirection = 1 | -1;
export type Vec3 = readonly [number, number, number];
export type Mat3 = readonly [
  number, number, number,
  number, number, number,
  number, number, number,
];

export interface Move {
  face: MoveTarget;
  direction: MoveDirection;
}

export interface Cubie {
  id: string;
  home: Vec3;
  position: Vec3;
  orientation: Mat3;
}

export const IDENTITY: Mat3 = [
  1, 0, 0,
  0, 1, 0,
  0, 0, 1,
];

export const FACE_COLORS: Record<Face, string> = {
  U: '#f8fafc',
  D: '#facc15',
  L: '#fb923c',
  R: '#ef4444',
  F: '#22c55e',
  B: '#3b82f6',
};

export const FACE_ORDER: readonly Face[] = ['U', 'R', 'F', 'D', 'L', 'B'];
export const SLICE_ORDER: readonly Slice[] = ['M', 'E', 'S'];
export const MOVE_ORDER: readonly MoveTarget[] = [...FACE_ORDER, ...SLICE_ORDER];

interface MoveMeta {
  axis: Axis;
  layer: -1 | 0 | 1;
  clockwiseQuarter: 1 | -1;
}

const MOVE_META: Record<MoveTarget, MoveMeta> = {
  U: { axis: 'y', layer: 1, clockwiseQuarter: -1 },
  D: { axis: 'y', layer: -1, clockwiseQuarter: 1 },
  R: { axis: 'x', layer: 1, clockwiseQuarter: -1 },
  L: { axis: 'x', layer: -1, clockwiseQuarter: 1 },
  F: { axis: 'z', layer: 1, clockwiseQuarter: -1 },
  B: { axis: 'z', layer: -1, clockwiseQuarter: 1 },
  M: { axis: 'x', layer: 0, clockwiseQuarter: 1 },
  E: { axis: 'y', layer: 0, clockwiseQuarter: 1 },
  S: { axis: 'z', layer: 0, clockwiseQuarter: -1 },
};

const axisIndex: Record<Axis, 0 | 1 | 2> = { x: 0, y: 1, z: 2 };

export function moveTargetForAxisLayer(axis: Axis, layer: -1 | 0 | 1): MoveTarget {
  if (axis === 'x') return layer === -1 ? 'L' : layer === 0 ? 'M' : 'R';
  if (axis === 'y') return layer === -1 ? 'D' : layer === 0 ? 'E' : 'U';
  return layer === -1 ? 'B' : layer === 0 ? 'S' : 'F';
}

export function stickerSliceTargets(position: Vec3, faceNormal: Vec3): readonly [MoveTarget, MoveTarget] {
  const normalAxis: Axis =
    faceNormal[0] !== 0 ? 'x' :
    faceNormal[1] !== 0 ? 'y' :
    'z';

  const tangentAxes = (['x', 'y', 'z'] as const).filter((axis) => axis !== normalAxis);
  const firstAxis = tangentAxes[0]!;
  const secondAxis = tangentAxes[1]!;
  const firstLayer = position[axisIndex[firstAxis]] as -1 | 0 | 1;
  const secondLayer = position[axisIndex[secondAxis]] as -1 | 0 | 1;

  return [
    moveTargetForAxisLayer(firstAxis, firstLayer),
    moveTargetForAxisLayer(secondAxis, secondLayer),
  ];
}

export interface MoveRotation {
  axis: Axis;
  layer: -1 | 0 | 1;
  quarter: 1 | -1;
}

export function getMoveRotation(move: Move): MoveRotation {
  const meta = MOVE_META[move.face];
  return {
    axis: meta.axis,
    layer: meta.layer,
    quarter: (meta.clockwiseQuarter * move.direction) as 1 | -1,
  };
}

export function createSolvedCube(): Cubie[] {
  const cubies: Cubie[] = [];

  for (let x = -1; x <= 1; x += 1) {
    for (let y = -1; y <= 1; y += 1) {
      for (let z = -1; z <= 1; z += 1) {
        if (x === 0 && y === 0 && z === 0) continue;
        const home: Vec3 = [x, y, z];
        cubies.push({
          id: `${x},${y},${z}`,
          home,
          position: home,
          orientation: IDENTITY,
        });
      }
    }
  }

  return cubies;
}

export function rotationMatrix(axis: Axis, quarter: 1 | -1): Mat3 {
  if (axis === 'x') {
    return quarter === 1
      ? [1, 0, 0, 0, 0, -1, 0, 1, 0]
      : [1, 0, 0, 0, 0, 1, 0, -1, 0];
  }

  if (axis === 'y') {
    return quarter === 1
      ? [0, 0, 1, 0, 1, 0, -1, 0, 0]
      : [0, 0, -1, 0, 1, 0, 1, 0, 0];
  }

  return quarter === 1
    ? [0, -1, 0, 1, 0, 0, 0, 0, 1]
    : [0, 1, 0, -1, 0, 0, 0, 0, 1];
}

export function transformVec(matrix: Mat3, vector: Vec3): Vec3 {
  const [x, y, z] = vector;
  return [
    matrix[0] * x + matrix[1] * y + matrix[2] * z,
    matrix[3] * x + matrix[4] * y + matrix[5] * z,
    matrix[6] * x + matrix[7] * y + matrix[8] * z,
  ];
}

export function multiplyMat3(a: Mat3, b: Mat3): Mat3 {
  const out = new Array<number>(9).fill(0);

  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      out[row * 3 + col] =
        a[row * 3]! * b[col]! +
        a[row * 3 + 1]! * b[3 + col]! +
        a[row * 3 + 2]! * b[6 + col]!;
    }
  }

  return out as unknown as Mat3;
}

export function applyMove(cubies: readonly Cubie[], move: Move): Cubie[] {
  const { axis, layer, quarter } = getMoveRotation(move);
  const rotation = rotationMatrix(axis, quarter);
  const index = axisIndex[axis];

  return cubies.map((cubie) => {
    if (cubie.position[index] !== layer) return cubie;

    return {
      ...cubie,
      position: transformVec(rotation, cubie.position),
      orientation: multiplyMat3(rotation, cubie.orientation),
    };
  });
}

export function inverseMove(move: Move): Move {
  return { face: move.face, direction: move.direction === 1 ? -1 : 1 };
}

export function isMovablePiece(cubie: Cubie): boolean {
  const nonZero = cubie.home.filter((value) => value !== 0).length;
  return nonZero >= 2;
}

export function isSolved(cubies: readonly Cubie[]): boolean {
  return cubies
    .filter(isMovablePiece)
    .every(
      (cubie) =>
        sameVec(cubie.position, cubie.home) && sameMatrix(cubie.orientation, IDENTITY),
    );
}

export function sameVec(a: Vec3, b: Vec3): boolean {
  return a[0] === b[0] && a[1] === b[1] && a[2] === b[2];
}

export function sameMatrix(a: Mat3, b: Mat3): boolean {
  return a.every((value, index) => value === b[index]);
}

export function faceForNormal(normal: Vec3): Face {
  if (normal[1] === 1) return 'U';
  if (normal[1] === -1) return 'D';
  if (normal[0] === 1) return 'R';
  if (normal[0] === -1) return 'L';
  if (normal[2] === 1) return 'F';
  return 'B';
}

export function homeStickerNormals(cubie: Cubie): Vec3[] {
  const [x, y, z] = cubie.home;
  const normals: Vec3[] = [];

  if (x !== 0) normals.push([Math.sign(x), 0, 0]);
  if (y !== 0) normals.push([0, Math.sign(y), 0]);
  if (z !== 0) normals.push([0, 0, Math.sign(z)]);

  return normals;
}

export function parseMove(input: string): Move | null {
  const normalized = input.trim().toUpperCase();
  const face = normalized[0] as MoveTarget | undefined;
  const valid = face && MOVE_ORDER.includes(face);
  if (!face || !valid) return null;
  return { face, direction: normalized.endsWith("'") ? -1 : 1 };
}

export function moveToNotation(move: Move): string {
  return `${move.face}${move.direction === -1 ? "'" : ''}`;
}

export function createScramble(length = 18, random = Math.random): Move[] {
  const moves: Move[] = [];
  let previousFace: Face | null = null;

  while (moves.length < length) {
    const face = FACE_ORDER[Math.floor(random() * FACE_ORDER.length)] ?? 'U';
    if (face === previousFace) continue;
    const direction: MoveDirection = random() < 0.5 ? 1 : -1;
    moves.push({ face, direction });
    previousFace = face;
  }

  return moves;
}
