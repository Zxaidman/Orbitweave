import { useMemo, useRef } from 'react';
import {
  FACE_COLORS,
  faceForNormal,
  homeStickerNormals,
  type Face,
  type MoveDirection,
} from '@/game/cube';
import { graphEdges, graphNodes, incidentFaces } from '@/game/graph';
import { useGameStore } from '@/store/gameStore';

const VIEW = 390;
const CENTER = VIEW / 2;
const HANDLE_RADIUS = 176;

const handleAngles: Record<Face, number> = {
  U: -90,
  R: -30,
  F: 30,
  D: 90,
  L: 150,
  B: 210,
};

function primaryColor(homeNormals: ReturnType<typeof homeStickerNormals>): string {
  const preferred = homeNormals.find((normal) => normal[1] !== 0)
    ?? homeNormals.find((normal) => normal[2] !== 0)
    ?? homeNormals[0];
  return preferred ? FACE_COLORS[faceForNormal(preferred)] : '#e2e8f0';
}

function pointOnCircle(angleDegrees: number, radius: number) {
  const angle = (angleDegrees * Math.PI) / 180;
  return {
    x: CENTER + Math.cos(angle) * radius,
    y: CENTER + Math.sin(angle) * radius,
  };
}

export function OrbitGraph() {
  const cubies = useGameStore((state) => state.cubies);
  const selectedNodeId = useGameStore((state) => state.selectedNodeId);
  const setSelectedNode = useGameStore((state) => state.setSelectedNode);
  const applyMove = useGameStore((state) => state.applyMove);

  const nodes = useMemo(() => graphNodes(cubies), [cubies]);
  const edges = useMemo(() => graphEdges(cubies), [cubies]);
  const nodeById = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes]);
  const drag = useRef<{ id: string; x: number; y: number } | null>(null);
  const handleDrag = useRef<{ face: Face; angle: number } | null>(null);

  const selected = selectedNodeId ? nodeById.get(selectedNodeId) : null;
  const selectedFaces = selected ? incidentFaces(selected.cubie.position) : [];

  const beginNodeDrag = (event: React.PointerEvent<SVGCircleElement>, id: string) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    drag.current = { id, x: event.clientX, y: event.clientY };
    setSelectedNode(id);
  };

  const finishNodeDrag = (event: React.PointerEvent<SVGCircleElement>) => {
    const start = drag.current;
    drag.current = null;
    if (!start) return;

    const node = nodeById.get(start.id);
    if (!node) return;

    const dx = event.clientX - start.x;
    const dy = event.clientY - start.y;
    if (Math.hypot(dx, dy) < 14) return;

    const faces = incidentFaces(node.cubie.position);
    const face = faces[0];
    if (!face) return;

    const radialX = node.x;
    const radialY = node.y;
    const tangentX = -radialY;
    const tangentY = radialX;
    const tangentDot = dx * tangentX + dy * tangentY;
    const direction: MoveDirection = tangentDot >= 0 ? 1 : -1;
    applyMove({ face, direction });
  };

  const beginHandleDrag = (event: React.PointerEvent<SVGGElement>, face: Face) => {
    event.currentTarget.setPointerCapture(event.pointerId);
    const rect = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    handleDrag.current = { face, angle: Math.atan2(event.clientY - cy, event.clientX - cx) };
  };

  const finishHandleDrag = (event: React.PointerEvent<SVGGElement>) => {
    const start = handleDrag.current;
    handleDrag.current = null;
    if (!start) return;
    const rect = event.currentTarget.ownerSVGElement?.getBoundingClientRect();
    if (!rect) return;
    const cx = rect.left + rect.width / 2;
    const cy = rect.top + rect.height / 2;
    const endAngle = Math.atan2(event.clientY - cy, event.clientX - cx);
    let delta = endAngle - start.angle;
    if (delta > Math.PI) delta -= Math.PI * 2;
    if (delta < -Math.PI) delta += Math.PI * 2;
    if (Math.abs(delta) < 0.08) return;
    applyMove({ face: start.face, direction: delta > 0 ? 1 : -1 });
  };

  return (
    <div className="graph-shell">
      <svg
        className="orbit-graph"
        viewBox={`0 0 ${VIEW} ${VIEW}`}
        role="img"
        aria-label="Orbit graph linked to the cube state"
      >
        <defs>
          <filter id="glow" x="-50%" y="-50%" width="200%" height="200%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
          </filter>
        </defs>

        <g className="graph-rings">
          <circle cx={CENTER} cy={CENTER} r="74" />
          <circle cx={CENTER} cy={CENTER} r="112" />
          <circle cx={CENTER} cy={CENTER} r="150" />
          <circle cx={CENTER} cy={CENTER} r="176" className="outer-ring" />
        </g>

        <g className="graph-edges">
          {edges.map((edge) => {
            const a = nodeById.get(edge.from);
            const b = nodeById.get(edge.to);
            if (!a || !b) return null;
            return (
              <line
                key={`${edge.from}-${edge.to}`}
                x1={CENTER + a.x}
                y1={CENTER + a.y}
                x2={CENTER + b.x}
                y2={CENTER + b.y}
              />
            );
          })}
        </g>

        <g className="graph-nodes">
          {nodes.map((node) => {
            const color = primaryColor(homeStickerNormals(node.cubie));
            const isSelected = node.id === selectedNodeId;
            return (
              <g key={node.id}>
                <circle
                  cx={CENTER + node.x}
                  cy={CENTER + node.y}
                  r={isSelected ? 10 : 8}
                  fill={color}
                  className={isSelected ? 'node selected' : 'node'}
                  onPointerDown={(event) => beginNodeDrag(event, node.id)}
                  onPointerUp={finishNodeDrag}
                  onPointerCancel={() => { drag.current = null; }}
                />
              </g>
            );
          })}
        </g>

        <g className="graph-handles">
          {(Object.keys(handleAngles) as Face[]).map((face) => {
            const point = pointOnCircle(handleAngles[face], HANDLE_RADIUS);
            return (
              <g
                key={face}
                className="face-handle"
                transform={`translate(${point.x} ${point.y})`}
                onPointerDown={(event) => beginHandleDrag(event, face)}
                onPointerUp={finishHandleDrag}
                onPointerCancel={() => { handleDrag.current = null; }}
              >
                <circle r="14" fill={FACE_COLORS[face]} />
                <text textAnchor="middle" dominantBaseline="central">{face}</text>
              </g>
            );
          })}
        </g>
      </svg>

      <div className="graph-instructions">
        {selected ? (
          <>
            <span>Selected piece</span>
            <div className="selected-face-actions">
              {selectedFaces.map((face) => (
                <button key={face} type="button" onClick={() => applyMove({ face, direction: 1 })}>
                  {face}
                </button>
              ))}
            </div>
            <small>Swipe the node tangentially, or choose one of its legal faces.</small>
          </>
        ) : (
          <small>Drag a colored face handle around the orbit, or select a piece node.</small>
        )}
      </div>
    </div>
  );
}
