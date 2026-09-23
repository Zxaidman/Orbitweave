import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { MOUSE, Quaternion, Matrix4, Vector3, TOUCH } from 'three';
import { useEffect, useMemo, useRef, useState } from 'react';
import type { Group } from 'three';
import {
  FACE_COLORS,
  faceForNormal,
  homeStickerNormals,
  transformVec,
  type Cubie,
  type Mat3,
  type MoveDirection,
  type Vec3,
} from '@/game/cube';
import { useGameStore } from '@/store/gameStore';

const SPACING = 1.04;
const STICKER_PLANE = SPACING + 0.493;
const ANIMATION_SECONDS = 0.22;
const DRAG_THRESHOLD_PX = 14;

interface AnimatedCubieProps {
  previous: Cubie;
  current: Cubie;
  animationKey: number;
  orbitMode: boolean;
  onGestureActiveChange: (active: boolean) => void;
}

interface StickerGesture {
  pointerId: number;
  x: number;
  y: number;
  face: ReturnType<typeof faceForNormal>;
  hitPoint: Vector3;
  outwardNormal: Vector3;
  committed: boolean;
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

function turnDirectionForDrag(
  gesture: StickerGesture,
  clientX: number,
  clientY: number,
  cameraQuaternion: Quaternion,
): MoveDirection | null {
  const dx = clientX - gesture.x;
  const dy = clientY - gesture.y;
  if (Math.hypot(dx, dy) < DRAG_THRESHOLD_PX) return null;

  const cameraRight = new Vector3(1, 0, 0).applyQuaternion(cameraQuaternion);
  const cameraUp = new Vector3(0, 1, 0).applyQuaternion(cameraQuaternion);
  const dragWorld = cameraRight
    .clone()
    .multiplyScalar(dx)
    .add(cameraUp.clone().multiplyScalar(-dy));

  if (dragWorld.lengthSq() < 0.0001) return null;
  dragWorld.normalize();

  const faceCenter = gesture.outwardNormal.clone().multiplyScalar(STICKER_PLANE);
  const radial = gesture.hitPoint.clone().sub(faceCenter);
  radial.addScaledVector(gesture.outwardNormal, -radial.dot(gesture.outwardNormal));

  if (radial.lengthSq() < 0.015) {
    radial.copy(cameraRight);
    radial.addScaledVector(gesture.outwardNormal, -radial.dot(gesture.outwardNormal));
    if (radial.lengthSq() < 0.015) {
      radial.copy(cameraUp);
      radial.addScaledVector(gesture.outwardNormal, -radial.dot(gesture.outwardNormal));
    }
  }

  if (radial.lengthSq() < 0.0001) return null;
  radial.normalize();

  const positiveTangent = new Vector3()
    .crossVectors(gesture.outwardNormal, radial)
    .normalize();
  const tangentDot = dragWorld.dot(positiveTangent);

  return tangentDot < 0 ? 1 : -1;
}

function AnimatedCubie({
  previous,
  current,
  animationKey,
  orbitMode,
  onGestureActiveChange,
}: AnimatedCubieProps) {
  const groupRef = useRef<Group>(null);
  const startedAt = useRef(0);
  const pointerStart = useRef<StickerGesture | null>(null);
  const applyMove = useGameStore((state) => state.applyMove);
  const camera = useThree((state) => state.camera);

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

    group.position.set(
      (previous.position[0] + (current.position[0] - previous.position[0]) * t) * SPACING,
      (previous.position[1] + (current.position[1] - previous.position[1]) * t) * SPACING,
      (previous.position[2] + (current.position[2] - previous.position[2]) * t) * SPACING,
    );
    group.quaternion.copy(previousQuaternion).slerp(currentQuaternion, t);
  });

  const clearGesture = () => {
    pointerStart.current = null;
    onGestureActiveChange(false);
  };

  const commitStickerDrag = (event: any) => {
    const gesture = pointerStart.current;
    if (!gesture || gesture.committed || orbitMode || event.pointerId !== gesture.pointerId) return;

    const direction = turnDirectionForDrag(
      gesture,
      event.clientX,
      event.clientY,
      camera.quaternion,
    );
    if (!direction) return;

    gesture.committed = true;
    applyMove({ face: gesture.face, direction });
  };

  const startStickerDrag = (event: any, homeNormal: Vec3) => {
    if (orbitMode || event.button === 2) return;
    if (event.pointerType === 'mouse' && event.button !== 0) return;

    event.preventDefault();
    event.stopPropagation();

    const logicalNormal = transformVec(current.orientation, homeNormal);
    const objectQuaternion = new Quaternion();
    event.object.getWorldQuaternion(objectQuaternion);
    const outwardNormal = new Vector3(0, 0, 1)
      .applyQuaternion(objectQuaternion)
      .normalize();

    pointerStart.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      face: faceForNormal(logicalNormal),
      hitPoint: event.point.clone(),
      outwardNormal,
      committed: false,
    };

    event.currentTarget.setPointerCapture?.(event.pointerId);
    onGestureActiveChange(true);
  };

  const finishStickerDrag = (event: any) => {
    const gesture = pointerStart.current;
    if (!gesture || event.pointerId !== gesture.pointerId) return;

    event.preventDefault();
    event.stopPropagation();
    commitStickerDrag(event);
    event.currentTarget.releasePointerCapture?.(event.pointerId);
    clearGesture();
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
            onPointerMove={commitStickerDrag}
            onPointerUp={finishStickerDrag}
            onPointerCancel={clearGesture}
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
  const orbitMode = useGameStore((state) => state.orbitMode);
  const [gestureActive, setGestureActive] = useState(false);

  const previousById = useMemo(
    () => new Map(previousCubies.map((cubie) => [cubie.id, cubie])),
    [previousCubies],
  );

  return (
    <>
      <ambientLight intensity={1.45} />
      <directionalLight position={[5, 8, 6]} intensity={2.2} castShadow />
      <directionalLight position={[-5, -2, -4]} intensity={0.7} />

      <group rotation={[-0.08, 0.18, 0]}>
        {cubies.map((cubie) => (
          <AnimatedCubie
            key={cubie.id}
            previous={previousById.get(cubie.id) ?? cubie}
            current={cubie}
            animationKey={animationKey}
            orbitMode={orbitMode}
            onGestureActiveChange={setGestureActive}
          />
        ))}
      </group>

      <OrbitControls
        makeDefault
        enabled={!gestureActive}
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
