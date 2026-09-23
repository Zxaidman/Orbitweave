import { useMemo, useRef } from 'react';
import type { Axis, Face, MoveDirection } from '@/game/cube';
import {
  buildOrbitTracks,
  type OrbitTrack,
  type OrbitTrackId,
} from '@/game/graph';
import { useGameStore } from '@/store/gameStore';

const VIEW_WIDTH = 560;
const VIEW_HEIGHT = 500;
const TRACK_RADIUS = 116;
const NODE_RADIUS = 6.2;
const DRAG_THRESHOLD = 8;

interface TrackLayout {
  id: OrbitTrackId;
  axis: Axis;
  cx: number;
  cy: number;
}

interface TrackGesture {
  face: Face;
  startX: number;
  startY: number;
  centerX: number;
  centerY: number;
  committed: boolean;
  pointerId: number;
}

const GROUP_LAYOUTS: ReadonlyArray<{
  axis: Axis;
  center: readonly [number, number];
  offset: readonly [number, number];
  ids: readonly [OrbitTrackId, OrbitTrackId, OrbitTrackId];
}> = [
  {
    axis: 'y',
    center: [280, 164],
    offset: [0, 14],
    ids: ['U', 'E', 'D'],
  },
  {
    axis: 'x',
    center: [207, 302],
    offset: [-12, 7],
    ids: ['L', 'M', 'R'],
  },
  {
    axis: 'z',
    center: [353, 302],
    offset: [12, 7],
    ids: ['B', 'S', 'F'],
  },
];

const GROUP_ANGLES = [-90, 0, 90, 180] as const;
const STICKER_ANGLE_OFFSETS = [-7.5, 0, 7.5] as const;

function createLayouts(): Map<OrbitTrackId, TrackLayout> {
  const layouts = new Map<OrbitTrackId, TrackLayout>();

  for (const group of GROUP_LAYOUTS) {
    group.ids.forEach((id, index) => {
      const relative = index - 1;
      layouts.set(id, {
        id,
        axis: group.axis,
        cx: group.center[0] + group.offset[0] * relative,
        cy: group.center[1] + group.offset[1] * relative,
      });
    });
  }

  return layouts;
}

const TRACK_LAYOUTS = createLayouts();

function pointOnCircle(cx: number, cy: number, radius: number, angleDegrees: number) {
  const angle = (angleDegrees * Math.PI) / 180;
  return {
    x: cx + Math.cos(angle) * radius,
    y: cy + Math.sin(angle) * radius,
  };
}

function clientToSvg(
  event: React.PointerEvent<SVGElement>,
  svg: SVGSVGElement,
): { x: number; y: number } {
  const rect = svg.getBoundingClientRect();

  return {
    x: ((event.clientX - rect.left) / rect.width) * VIEW_WIDTH,
    y: ((event.clientY - rect.top) / rect.height) * VIEW_HEIGHT,
  };
}

export function OrbitGraph() {
  const cubies = useGameStore((state) => state.cubies);
  const applyMove = useGameStore((state) => state.applyMove);
  const tracks = useMemo(() => buildOrbitTracks(cubies), [cubies]);
  const gesture = useRef<TrackGesture | null>(null);

  const beginTrackDrag = (
    event: React.PointerEvent<SVGElement>,
    track: OrbitTrack,
    layout: TrackLayout,
  ) => {
    if (!track.face) return;

    event.preventDefault();
    event.stopPropagation();

    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;

    const point = clientToSvg(event, svg);
    gesture.current = {
      face: track.face,
      startX: point.x,
      startY: point.y,
      centerX: layout.cx,
      centerY: layout.cy,
      committed: false,
      pointerId: event.pointerId,
    };

    event.currentTarget.setPointerCapture?.(event.pointerId);
  };

  const updateTrackDrag = (event: React.PointerEvent<SVGElement>) => {
    const current = gesture.current;
    if (!current || current.committed || current.pointerId !== event.pointerId) return;

    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;

    const point = clientToSvg(event, svg);
    const dx = point.x - current.startX;
    const dy = point.y - current.startY;

    if (Math.hypot(dx, dy) < DRAG_THRESHOLD) return;

    const radialX = current.startX - current.centerX;
    const radialY = current.startY - current.centerY;
    const tangentX = -radialY;
    const tangentY = radialX;
    const tangentDot = dx * tangentX + dy * tangentY;

    const direction: MoveDirection = tangentDot >= 0 ? 1 : -1;
    current.committed = true;
    applyMove({ face: current.face, direction });
  };

  const finishTrackDrag = (event: React.PointerEvent<SVGElement>) => {
    updateTrackDrag(event);
    gesture.current = null;
    event.currentTarget.releasePointerCapture?.(event.pointerId);
  };

  return (
    <div className="graph-shell">
      <svg
        className="orbit-graph"
        viewBox={`0 0 ${VIEW_WIDTH} ${VIEW_HEIGHT}`}
        role="img"
        aria-label="Nine linked slice circles arranged as three offset orbit groups"
      >
        <defs>
          <filter id="orbit-node-glow" x="-100%" y="-100%" width="300%" height="300%">
            <feGaussianBlur stdDeviation="2.2" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <g className="orbit-track-lines">
          {tracks.map((track) => {
            const layout = TRACK_LAYOUTS.get(track.id);
            if (!layout) return null;

            return (
              <g key={track.id} className={track.interactive ? 'orbit-track interactive' : 'orbit-track middle'}>
                <circle
                  cx={layout.cx}
                  cy={layout.cy}
                  r={TRACK_RADIUS}
                  className="orbit-track-visible"
                />
                {track.interactive && (
                  <circle
                    cx={layout.cx}
                    cy={layout.cy}
                    r={TRACK_RADIUS}
                    className="orbit-track-hit"
                    onPointerDown={(event) => beginTrackDrag(event, track, layout)}
                    onPointerMove={updateTrackDrag}
                    onPointerUp={finishTrackDrag}
                    onPointerCancel={() => { gesture.current = null; }}
                  />
                )}
              </g>
            );
          })}
        </g>

        <g className="orbit-stickers">
          {tracks.flatMap((track) => {
            const layout = TRACK_LAYOUTS.get(track.id);
            if (!layout) return [];

            return track.groups.flatMap((group, groupIndex) =>
              group.stickers.map((sticker, stickerIndex) => {
                const angle =
                  GROUP_ANGLES[groupIndex]! +
                  STICKER_ANGLE_OFFSETS[stickerIndex % STICKER_ANGLE_OFFSETS.length]!;
                const point = pointOnCircle(layout.cx, layout.cy, TRACK_RADIUS, angle);

                return (
                  <circle
                    key={sticker.id}
                    cx={point.x}
                    cy={point.y}
                    r={NODE_RADIUS}
                    fill={sticker.color}
                    className={track.interactive ? 'orbit-sticker interactive' : 'orbit-sticker'}
                    onPointerDown={
                      track.interactive
                        ? (event) => beginTrackDrag(event, track, layout)
                        : undefined
                    }
                    onPointerMove={track.interactive ? updateTrackDrag : undefined}
                    onPointerUp={track.interactive ? finishTrackDrag : undefined}
                    onPointerCancel={
                      track.interactive
                        ? () => { gesture.current = null; }
                        : undefined
                    }
                  >
                    <title>{`${track.id} slice · ${group.face} strip · ${sticker.homeFace} sticker`}</title>
                  </circle>
                );
              }),
            );
          })}
        </g>

        <g className="orbit-track-labels" pointerEvents="none">
          {tracks.map((track) => {
            if (!track.face) return null;
            const layout = TRACK_LAYOUTS.get(track.id);
            if (!layout) return null;
            const label = pointOnCircle(layout.cx, layout.cy, TRACK_RADIUS + 18, -90);

            return (
              <g key={`label-${track.id}`} transform={`translate(${label.x} ${label.y})`}>
                <circle r="10" />
                <text textAnchor="middle" dominantBaseline="central">{track.face}</text>
              </g>
            );
          })}
        </g>
      </svg>

      <div className="graph-instructions">
        <small>
          Three offset-circle groups · each circle carries four groups of three stickers.
          Drag a sticker or labeled outer slice clockwise/counter-clockwise to make the same legal cube turn.
        </small>
      </div>
    </div>
  );
}
