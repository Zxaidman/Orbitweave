import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { Euler, MOUSE, Matrix4, Quaternion, TOUCH, Vector3 } from 'three';
import { useEffect, useMemo, useRef } from 'react';
import type { Group } from 'three';
import {
  FACE_COLORS,
  applyMove as applyCubeMove,
  faceForNormal,
  getMoveRotation,
  homeStickerNormals,
  stickerSliceTargets,
  transformVec,
  type Axis,
  type Cubie,
  type Mat3,
  type Move,
  type Vec3,
} from '@/game/cube';
import { useGameStore } from '@/store/gameStore';

const SPACING = 1.04;
const ANIMATION_SECONDS = 0.2;
const DRAG_THRESHOLD = 10;
const CUBE_ROTATION = new Euler(-0.08, 0.18, 0);

const AXIS_INDEX: Record<Axis, 0 | 1 | 2> = { x: 0, y: 1, z: 2 };
const AXIS_VECTOR: Record<Axis, Vector3> = {
  x: new Vector3(1, 0, 0),
  y: new Vector3(0, 1, 0),
  z: new Vector3(0, 0, 1),
};

interface StickerGesture {
  x: number;
  y: number;
  position: Vec3;
  faceNormal: Vec3;
  committed: boolean;
}

interface AnimatedCubieProps {
  previous: Cubie;
  current: Cubie;
  animationKey: number;
  lastMove: Move | null;
  orbitMode: boolean;
}

function mat3ToQuaternion(matrix: Mat3): Quaternion {
  const m = new Matrix4();
  m.set(
    matrix[0], matrix[1], matrix[2], 0,
    matrix[3], matrix[4], matrix[5], 0,
    matrix[6], matrix[7], matrix[8], 0,
    0, 0, 0, 1,
  );
  return new Quaternion().setFromRotationMatrix(m);
}

function localStickerQuaternion(normal: Vec3): Quaternion {
  return new Quaternion().setFromUnitVectors(
    new Vector3(0, 0, 1),
    new Vector3(normal[0], normal[1], normal[2]),
  );
}

function AnimatedCubie({
  previous,
  current,
  animationKey,
  lastMove,
  orbitMode,
}: AnimatedCubieProps) {
  const groupRef = useRef<Group>(null);
  const startedAt = useRef(0);
  const pointerStart = useRef<StickerGesture | null>(null);
  const applyMove = useGameStore((state) => state.applyMove);
  const camera = useThree((state) => state.camera);
  const size = useThree((state) => state.size);

  const previousQuaternion = useMemo(
    () => mat3ToQuaternion(previous.orientation),
    [previous.orientation],
  );
  const currentQuaternion = useMemo(
    () => mat3ToQuaternion(current.orientation),
    [current.orientation],
  );
  const stickers = useMemo(() => homeStickerNormals(current), [current.home]);

  useEffect(() => {
    startedAt.current = performance.now() / 1000;
  }, [animationKey]);

  useFrame(() => {
    const group = groupRef.current;
    if (!group) return;

    const elapsed = performance.now() / 1000 - startedAt.current;
    const raw = Math.min(1, Math.max(0, elapsed / ANIMATION_SECONDS));
    const t = 1 - Math.pow(1 - raw, 3);

    if (lastMove) {
      const rotation = getMoveRotation(lastMove);
      const index = AXIS_INDEX[rotation.axis];

      if (previous.position[index] === rotation.layer) {
        const axis = AXIS_VECTOR[rotation.axis];
        const angle = rotation.quarter * (Math.PI / 2) * t;
        const turnQuaternion = new Quaternion().setFromAxisAngle(axis, angle);

        group.position
          .set(previous.position[0], previous.position[1], previous.position[2])
          .applyAxisAngle(axis, angle)
          .multiplyScalar(SPACING);
        group.quaternion.copy(turnQuaternion).multiply(previousQuaternion);
        return;
      }
    }

    group.position.set(
      (previous.position[0] + (current.position[0] - previous.position[0]) * t) * SPACING,
      (previous.position[1] + (current.position[1] - previous.position[1]) * t) * SPACING,
      (previous.position[2] + (current.position[2] - previous.position[2]) * t) * SPACING,
    );
    group.quaternion.copy(previousQuaternion).slerp(currentQuaternion, t);
  });

  const projectPosition = (position: Vec3): { x: number; y: number } => {
    const projected = new Vector3(...position)
      .multiplyScalar(SPACING)
      .applyEuler(CUBE_ROTATION)
      .project(camera);

    return {
      x: (projected.x + 1) * size.width * 0.5,
      y: (1 - projected.y) * size.height * 0.5,
    };
  };

  const chooseStickerMove = (
    position: Vec3,
    faceNormal: Vec3,
    dragX: number,
    dragY: number,
  ): Move | null => {
    const dragLength = Math.hypot(dragX, dragY);
    if (dragLength < DRAG_THRESHOLD) return null;

    const dragUnitX = dragX / dragLength;
    const dragUnitY = dragY / dragLength;
    const before = projectPosition(position);
    const targets = stickerSliceTargets(position, faceNormal);

    let bestMove: Move | null = null;
    let bestScore = -Infinity;

    for (const target of targets) {
      for (const direction of [1, -1] as const) {
        const probe: Cubie = { ...current, position };
        const turned = applyCubeMove([probe], { face: target, direction })[0];
        if (!turned) continue;

        const after = projectPosition(turned.position);
        const moveX = after.x - before.x;
        const moveY = after.y - before.y;
        const moveLength = Math.hypot(moveX, moveY);
        if (moveLength < 0.001) continue;

        const score =
          dragUnitX * (moveX / moveLength) +
          dragUnitY * (moveY / moveLength);

        if (score > bestScore) {
          bestScore = score;
          bestMove = { face: target, direction };
        }
      }
    }

    return bestMove;
  };

  const startStickerDrag = (event: any, homeNormal: Vec3) => {
    if (orbitMode || event.button === 2) return;

    event.stopPropagation();

    pointerStart.current = {
      x: event.clientX,
      y: event.clientY,
      position: [...current.position] as Vec3,
      faceNormal: transformVec(current.orientation, homeNormal),
      committed: false,
    };

    event.target.setPointerCapture?.(event.pointerId);
  };

  const updateStickerDrag = (event: any) => {
    const start = pointerStart.current;
    if (!start || start.committed || orbitMode) return;

    event.stopPropagation();

    const dragX = event.clientX - start.x;
    const dragY = event.clientY - start.y;
    if (Math.hypot(dragX, dragY) < DRAG_THRESHOLD) return;

    const move = chooseStickerMove(
      start.position,
      start.faceNormal,
      dragX,
      dragY,
    );

    if (!move) return;

    start.committed = true;
    applyMove(move);
  };

  const finishStickerDrag = (event: any) => {
    updateStickerDrag(event);
    pointerStart.current = null;
    event.target.releasePointerCapture?.(event.pointerId);
  };

  return (
    <group ref={groupRef}>
      <mesh castShadow receiveShadow>
        <boxGeometry args={[0.96, 0.96, 0.96]} />
        <meshStandardMaterial color="#111827" roughness={0.42} metalness={0.05} />
      </mesh>

      {stickers.map((normal) => {
        const face = faceForNormal(normal);
        const q = localStickerQuaternion(normal);

        return (
          <mesh
            key={`${current.id}-${normal.join(',')}`}
            position={[normal[0] * 0.493, normal[1] * 0.493, normal[2] * 0.493]}
            quaternion={q}
            onPointerDown={(event) => startStickerDrag(event, normal)}
            onPointerMove={updateStickerDrag}
            onPointerUp={finishStickerDrag}
            onPointerCancel={() => { pointerStart.current = null; }}
          >
            <boxGeometry args={[0.78, 0.78, 0.028]} />
            <meshStandardMaterial color={FACE_COLORS[face]} roughness={0.34} />
          </mesh>
        );
      })}
    </group>
  );
}

function CubeWorld() {
  const cubies = useGameStore((state) => state.cubies);
  const previousCubies = useGameStore((state) => state.previousCubies);
  const animationKey = useGameStore((state) => state.animationKey);
  const lastMove = useGameStore((state) => state.lastMove);
  const orbitMode = useGameStore((state) => state.orbitMode);

  const previousById = useMemo(
    () => new Map(previousCubies.map((cubie) => [cubie.id, cubie])),
    [previousCubies],
  );

  return (
    <>
      <ambientLight intensity={1.45} />
      <directionalLight position={[5, 8, 6]} intensity={2.2} castShadow />
      <directionalLight position={[-5, -2, -4]} intensity={0.7} />

      <group rotation={CUBE_ROTATION}>
        {cubies.map((cubie) => (
          <AnimatedCubie
            key={cubie.id}
            previous={previousById.get(cubie.id) ?? cubie}
            current={cubie}
            animationKey={animationKey}
            lastMove={lastMove}
            orbitMode={orbitMode}
          />
        ))}
      </group>

      <OrbitControls
        makeDefault
        enablePan={false}
        enableZoom
        enableRotate
        minDistance={5.4}
        maxDistance={11}
        mouseButtons={{
          LEFT: orbitMode ? MOUSE.ROTATE : MOUSE.PAN,
          MIDDLE: MOUSE.DOLLY,
          RIGHT: MOUSE.ROTATE,
        }}
        touches={{
          ONE: orbitMode ? TOUCH.ROTATE : TOUCH.PAN,
          TWO: TOUCH.DOLLY_ROTATE,
        }}
      />
    </>
  );
}

export function CubeScene() {
  return (
    <div className="cube-canvas" onContextMenu={(event) => event.preventDefault()}>
      <Canvas
        camera={{ position: [6.6, 5.7, 7.2], fov: 34 }}
        dpr={[1, 1.75]}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        shadows
      >
        <CubeWorld />
      </Canvas>
    </div>
  );
}
