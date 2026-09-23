import {
  FACE_COLORS,
  faceForNormal,
  homeStickerNormals,
  transformVec,
  type Axis,
  type Cubie,
  type Face,
  type Vec3,
} from './cube';

export type OrbitTrackId = Face | 'M' | 'E' | 'S';

export interface OrbitSticker {
  id: string;
  cubieId: string;
  homeFace: Face;
  currentFace: Face;
  color: string;
}

export interface OrbitStickerGroup {
  face: Face;
  stickers: OrbitSticker[];
}

export interface OrbitTrack {
  id: OrbitTrackId;
  axis: Axis;
  layer: -1 | 0 | 1;
  face: Face | null;
  interactive: boolean;
  groups: OrbitStickerGroup[];
}

interface TrackDefinition {
  id: OrbitTrackId;
  axis: Axis;
  layer: -1 | 0 | 1;
  face: Face | null;
}

export const ORBIT_TRACK_DEFINITIONS: readonly TrackDefinition[] = [
  { id: 'U', axis: 'y', layer: 1, face: 'U' },
  { id: 'E', axis: 'y', layer: 0, face: null },
  { id: 'D', axis: 'y', layer: -1, face: 'D' },
  { id: 'L', axis: 'x', layer: -1, face: 'L' },
  { id: 'M', axis: 'x', layer: 0, face: null },
  { id: 'R', axis: 'x', layer: 1, face: 'R' },
  { id: 'B', axis: 'z', layer: -1, face: 'B' },
  { id: 'S', axis: 'z', layer: 0, face: null },
  { id: 'F', axis: 'z', layer: 1, face: 'F' },
] as const;

const AXIS_INDEX: Record<Axis, 0 | 1 | 2> = { x: 0, y: 1, z: 2 };

const SIDE_FACE_CYCLES: Record<Axis, readonly Face[]> = {
  x: ['U', 'F', 'D', 'B'],
  y: ['F', 'R', 'B', 'L'],
  z: ['U', 'R', 'D', 'L'],
};

function sortValue(axis: Axis, currentFace: Face, position: Vec3): number {
  const [x, y, z] = position;

  if (axis === 'y') {
    return currentFace === 'F' || currentFace === 'B' ? x : z;
  }

  if (axis === 'x') {
    return currentFace === 'U' || currentFace === 'D' ? z : y;
  }

  return currentFace === 'U' || currentFace === 'D' ? x : y;
}

function buildTrack(cubies: readonly Cubie[], definition: TrackDefinition): OrbitTrack {
  const axisIndex = AXIS_INDEX[definition.axis];
  const grouped = new Map<Face, Array<{ sticker: OrbitSticker; sort: number }>>();

  for (const face of SIDE_FACE_CYCLES[definition.axis]) grouped.set(face, []);

  for (const cubie of cubies) {
    if (cubie.position[axisIndex] !== definition.layer) continue;

    for (const homeNormal of homeStickerNormals(cubie)) {
      const currentNormal = transformVec(cubie.orientation, homeNormal);

      // Each slice circle displays the four side strips that travel around its
      // rotation axis: 4 groups × 3 stickers. Stickers parallel to the axis
      // belong to the slice's face plane, not to these traveling strips.
      if (currentNormal[axisIndex] !== 0) continue;

      const currentFace = faceForNormal(currentNormal);
      const homeFace = faceForNormal(homeNormal);
      const bucket = grouped.get(currentFace);
      if (!bucket) continue;

      bucket.push({
        sticker: {
          id: `${definition.id}:${cubie.id}:${homeNormal.join(',')}`,
          cubieId: cubie.id,
          homeFace,
          currentFace,
          color: FACE_COLORS[homeFace],
        },
        sort: sortValue(definition.axis, currentFace, cubie.position),
      });
    }
  }

  const groups = SIDE_FACE_CYCLES[definition.axis].map((face) => ({
    face,
    stickers: (grouped.get(face) ?? [])
      .sort((left, right) => left.sort - right.sort)
      .map((entry) => entry.sticker),
  }));

  return {
    id: definition.id,
    axis: definition.axis,
    layer: definition.layer,
    face: definition.face,
    interactive: definition.face !== null,
    groups,
  };
}

export function buildOrbitTracks(cubies: readonly Cubie[]): OrbitTrack[] {
  return ORBIT_TRACK_DEFINITIONS.map((definition) => buildTrack(cubies, definition));
}

export function orbitTrackStickerCount(track: OrbitTrack): number {
  return track.groups.reduce((total, group) => total + group.stickers.length, 0);
}
