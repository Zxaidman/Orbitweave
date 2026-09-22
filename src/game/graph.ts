import type { Cubie, Face, Vec3 } from './cube';
import { isMovablePiece } from './cube';

export interface GraphNode {
  id: string;
  x: number;
  y: number;
  radius: number;
  angle: number;
  cubie: Cubie;
}

export interface GraphEdge {
  from: string;
  to: string;
}

const RING_RADIUS = {
  top: 74,
  middle: 112,
  bottom: 150,
} as const;

export function graphNodes(cubies: readonly Cubie[]): GraphNode[] {
  return cubies.filter(isMovablePiece).map((cubie) => {
    const [x, y, z] = cubie.position;
    const radius = y === 1 ? RING_RADIUS.top : y === -1 ? RING_RADIUS.bottom : RING_RADIUS.middle;
    const angle = Math.atan2(z, x);

    return {
      id: cubie.id,
      x: Math.cos(angle) * radius,
      y: Math.sin(angle) * radius,
      radius,
      angle,
      cubie,
    };
  });
}

export function graphEdges(cubies: readonly Cubie[]): GraphEdge[] {
  const movable = cubies.filter(isMovablePiece);
  const edges: GraphEdge[] = [];

  for (let a = 0; a < movable.length; a += 1) {
    for (let b = a + 1; b < movable.length; b += 1) {
      const left = movable[a];
      const right = movable[b];
      if (!left || !right) continue;
      if (distanceSquared(left.position, right.position) === 1) {
        edges.push({ from: left.id, to: right.id });
      }
    }
  }

  return edges;
}

export function incidentFaces(position: Vec3): Face[] {
  const [x, y, z] = position;
  const faces: Face[] = [];
  if (y === 1) faces.push('U');
  if (y === -1) faces.push('D');
  if (x === 1) faces.push('R');
  if (x === -1) faces.push('L');
  if (z === 1) faces.push('F');
  if (z === -1) faces.push('B');
  return faces;
}

export function distanceSquared(a: Vec3, b: Vec3): number {
  const dx = a[0] - b[0];
  const dy = a[1] - b[1];
  const dz = a[2] - b[2];
  return dx * dx + dy * dy + dz * dz;
}
