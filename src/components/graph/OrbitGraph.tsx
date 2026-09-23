import { useMemo, useRef, useState } from 'react';
import type { PointerEvent as ReactPointerEvent } from 'react';
import { FACE_COLORS, type Axis, type Face, type MoveDirection, type MoveTarget } from '@/game/cube';
import { buildOrbitTracks, type OrbitTrack, type OrbitTrackId } from '@/game/graph';
import { useGameStore } from '@/store/gameStore';

const VIEW = 520;
const TRACK_RADIUS = 104;
const TRACK_OFFSET = 22;
const DRAG_COMMIT_RADIANS = 0.12;
const DRAG_RELEASE_RADIANS = 0.07;

interface Point {
  x: number;
  y: number;
}

interface GroupLayout {
  axis: Axis;
  center: Point;
  offsetAngle: number;
  trackIds: readonly OrbitTrackId[];
}

interface TrackLayout extends Point {
  radius: number;
}

const GROUP_LAYOUTS: readonly GroupLayout[] = [
  { axis: 'y', center: { x: 260, y: 158 }, offsetAngle: 0, trackIds: ['U', 'E', 'D'] },
  { axis: 'x', center: { x: 168, y: 330 }, offsetAngle: -60, trackIds: ['L', 'M', 'R'] },
  { axis: 'z', center: { x: 352, y: 330 }, offsetAngle: 60, trackIds: ['B', 'S', 'F'] },
] as const;

const GROUP_NODE_ANGLES = [-90, 0, 90, 180] as const;
const NODE_SPREAD = [-8, 0, 8] as const;

const TRACK_LABEL_ANGLES: Record<MoveTarget, number> = {
  U: -132,
  D: -48,
  L: 148,
  R: 32,
  B: 212,
  F: -32,
  M: -90,
  E: -90,
  S: -90,
};

function polarPoint(center: Point, radius: number, angleDegrees: number): Point {
  const angle = (angleDegrees * Math.PI) / 180;
  return {
    x: center.x + Math.cos(angle) * radius,
    y: center.y + Math.sin(angle) * radius,
  };
}

function createTrackLayouts(): Map<OrbitTrackId, TrackLayout> {
  const layouts = new Map<OrbitTrackId, TrackLayout>();

  for (const group of GROUP_LAYOUTS) {
    const angle = (group.offsetAngle * Math.PI) / 180;
    const vx = Math.cos(angle) * TRACK_OFFSET;
    const vy = Math.sin(angle) * TRACK_OFFSET;

    group.trackIds.forEach((id, index) => {
      const offsetIndex = index - 1;
      layouts.set(id, {
        x: group.center.x + vx * offsetIndex,
        y: group.center.y + vy * offsetIndex,
        radius: TRACK_RADIUS,
      });
    });
  }

  return layouts;
}

const TRACK_LAYOUTS = createTrackLayouts();

interface DragState {
  trackId: OrbitTrackId;
  move: MoveTarget;
  centerClientX: number;
  centerClientY: number;
  startAngle: number;
  committed: boolean;
}

function normalizeAngleDelta(delta: number): number {
  let normalized = delta;
  if (normalized > Math.PI) normalized -= Math.PI * 2;
  if (normalized < -Math.PI) normalized += Math.PI * 2;
  return normalized;
}

function clientCenter(
  svg: SVGSVGElement,
  layout: TrackLayout,
): { x: number; y: number } {
  const rect = svg.getBoundingClientRect();
  return {
    x: rect.left + (layout.x / VIEW) * rect.width,
    y: rect.top + (layout.y / VIEW) * rect.height,
  };
}

export function OrbitGraph() {
  const cubies = useGameStore((state) => state.cubies);
  const applyMove = useGameStore((state) => state.applyMove);
  const tracks = useMemo(() => buildOrbitTracks(cubies), [cubies]);
  const drag = useRef<DragState | null>(null);
  const [activeTrackId, setActiveTrackId] = useState<OrbitTrackId | null>(null);

  const commitDrag = (
    event: ReactPointerEvent<SVGCircleElement>,
    threshold: number,
  ) => {
    const state = drag.current;
    if (!state || state.committed) return;

    const endAngle = Math.atan2(
      event.clientY - state.centerClientY,
      event.clientX - state.centerClientX,
    );
    const delta = normalizeAngleDelta(endAngle - state.startAngle);
    if (Math.abs(delta) < threshold) return;

    const direction: MoveDirection = delta > 0 ? 1 : -1;
    applyMove({ face: state.move, direction });
    state.committed = true;
  };

  const beginTrackDrag = (
    event: ReactPointerEvent<SVGCircleElement>,
    track: OrbitTrack,
    layout: TrackLayout,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    event.currentTarget.setPointerCapture(event.pointerId);

    const svg = event.currentTarget.ownerSVGElement;
    if (!svg) return;
    const center = clientCenter(svg, layout);

    drag.current = {
      trackId: track.id,
      move: track.move,
      centerClientX: center.x,
      centerClientY: center.y,
      startAngle: Math.atan2(event.clientY - center.y, event.clientX - center.x),
      committed: false,
    };
    setActiveTrackId(track.id);
  };

  const finishTrackDrag = (event: ReactPointerEvent<SVGCircleElement>) => {
    commitDrag(event, DRAG_RELEASE_RADIANS);
    drag.current = null;
    setActiveTrackId(null);
  };

  return (
    <div className="graph-shell">
      <svg
        className="orbit-graph"
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        role="img"
        aria-label="Three linked orbit groups representing cube slice movement"
      >
        <defs>
          <filter id="orbit-node-glow" x="-80%" y="-80%" width="260%" height="260%">
            <feGaussianBlur stdDeviation="2.4" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        {GROUP_LAYOUTS.map((group) => (
          <text
            key={`axis-${group.axis}`}
            className="orbit-axis-label"
            x={group.center.x}
            y={group.center.y}
            textAnchor="middle"
            dominantBaseline="central"
          >
            {group.axis.toUpperCase()}
          </text>
        ))}

        <g className="orbit-tracks">
          {tracks.map((track) => {
            const layout = TRACK_LAYOUTS.get(track.id);
            if (!layout) return null;
            const active = activeTrackId === track.id;

            return (
              <g
                key={track.id}
                className={`orbit-track ${track.interactive ? 'interactive' : 'structural'}${active ? ' active' : ''}`}
              >
                <circle
                  className="orbit-track-line"
                  cx={layout.x}
                  cy={layout.y}
                  r={layout.radius}
                />

                {track.groups.map((group, groupIndex) => {
                  const baseAngle = GROUP_NODE_ANGLES[groupIndex] ?? 0;
                  return group.stickers.map((sticker, stickerIndex) => {
                    const angle = baseAngle + (NODE_SPREAD[stickerIndex] ?? 0);
                    const point = polarPoint(layout, layout.radius, angle);
                    return (
                      <circle
                        key={sticker.id}
                        className="orbit-sticker"
                        cx={point.x}
                        cy={point.y}
                        r="4.7"
                        fill={sticker.color}
                        pointerEvents="none"
                      />
                    );
                  });
                })}

                {(() => {
                  const labelPoint = polarPoint(layout, layout.radius, TRACK_LABEL_ANGLES[track.move]);
                  const isFace = (['U', 'D', 'L', 'R', 'F', 'B'] as readonly string[]).includes(track.move);
                  const fill = isFace ? FACE_COLORS[track.move as Face] : '#94a3b8';
                  return (
                    <g className="orbit-face-label" pointerEvents="none">
                      <circle cx={labelPoint.x} cy={labelPoint.y} r="11" fill={fill} />
                      <text
                        x={labelPoint.x}
                        y={labelPoint.y}
                        textAnchor="middle"
                        dominantBaseline="central"
                      >
                        {track.move}
                      </text>
                    </g>
                  );
                })()}

                {(
                  <circle
                    className="orbit-track-hit"
                    cx={layout.x}
                    cy={layout.y}
                    r={layout.radius}
                    onPointerDown={(event) => beginTrackDrag(event, track, layout)}
                    onPointerMove={(event) => commitDrag(event, DRAG_COMMIT_RADIANS)}
                    onPointerUp={finishTrackDrag}
                    onPointerCancel={() => {
                      drag.current = null;
                      setActiveTrackId(null);
                    }}
                  />
                )}
              </g>
            );
          })}
        </g>
      </svg>

      <div className="graph-instructions">
        <small>
          Three axis groups × three offset slice circles. Each circle shows four groups of three traveling stickers.
          Drag a labeled outer circle for one legal 90° face turn.
        </small>
      </div>
    </div>
  );
}
