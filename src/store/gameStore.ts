import { create } from 'zustand';
import {
  applyMove as applyCubeMove,
  createScramble,
  createSolvedCube,
  isSolved,
  moveToNotation,
  type Cubie,
  type Move,
} from '@/game/cube';

interface Snapshot {
  cubies: Cubie[];
  moveCount: number;
}

interface GameState {
  cubies: Cubie[];
  previousCubies: Cubie[];
  startCubies: Cubie[];
  scramble: Move[];
  history: Snapshot[];
  future: Snapshot[];
  moveCount: number;
  animationKey: number;
  lastMove: Move | null;
  orbitMode: boolean;
  selectedNodeId: string | null;
  applyMove: (move: Move) => void;
  undo: () => void;
  redo: () => void;
  restart: () => void;
  newPuzzle: () => void;
  setOrbitMode: (enabled: boolean) => void;
  setSelectedNode: (id: string | null) => void;
}

const DEFAULT_SCRAMBLE: Move[] = [
  { face: 'R', direction: 1 },
  { face: 'U', direction: 1 },
  { face: 'F', direction: -1 },
  { face: 'L', direction: 1 },
  { face: 'D', direction: -1 },
  { face: 'B', direction: 1 },
  { face: 'R', direction: -1 },
  { face: 'U', direction: 1 },
];

function applySequence(cubies: Cubie[], moves: readonly Move[]): Cubie[] {
  return moves.reduce((state, move) => applyCubeMove(state, move), cubies);
}

const initialStart = applySequence(createSolvedCube(), DEFAULT_SCRAMBLE);

export const useGameStore = create<GameState>((set, get) => ({
  cubies: initialStart,
  previousCubies: initialStart,
  startCubies: initialStart,
  scramble: DEFAULT_SCRAMBLE,
  history: [],
  future: [],
  moveCount: 0,
  animationKey: 0,
  lastMove: null,
  orbitMode: false,
  selectedNodeId: null,

  applyMove: (move) => {
    const state = get();
    const next = applyCubeMove(state.cubies, move);
    set({
      previousCubies: state.cubies,
      cubies: next,
      history: [...state.history, { cubies: state.cubies, moveCount: state.moveCount }],
      future: [],
      moveCount: state.moveCount + 1,
      animationKey: state.animationKey + 1,
      lastMove: move,
    });
  },

  undo: () => {
    const state = get();
    const previous = state.history.at(-1);
    if (!previous) return;

    set({
      previousCubies: state.cubies,
      cubies: previous.cubies,
      history: state.history.slice(0, -1),
      future: [...state.future, { cubies: state.cubies, moveCount: state.moveCount }],
      moveCount: previous.moveCount,
      animationKey: state.animationKey + 1,
      lastMove: null,
    });
  },

  redo: () => {
    const state = get();
    const next = state.future.at(-1);
    if (!next) return;

    set({
      previousCubies: state.cubies,
      cubies: next.cubies,
      history: [...state.history, { cubies: state.cubies, moveCount: state.moveCount }],
      future: state.future.slice(0, -1),
      moveCount: next.moveCount,
      animationKey: state.animationKey + 1,
      lastMove: null,
    });
  },

  restart: () => {
    const state = get();
    set({
      previousCubies: state.cubies,
      cubies: state.startCubies,
      history: [],
      future: [],
      moveCount: 0,
      animationKey: state.animationKey + 1,
      lastMove: null,
      selectedNodeId: null,
    });
  },

  newPuzzle: () => {
    const state = get();
    const scramble = createScramble(18);
    const startCubies = applySequence(createSolvedCube(), scramble);
    set({
      previousCubies: state.cubies,
      cubies: startCubies,
      startCubies,
      scramble,
      history: [],
      future: [],
      moveCount: 0,
      animationKey: state.animationKey + 1,
      lastMove: null,
      selectedNodeId: null,
    });
  },

  setOrbitMode: (orbitMode) => set({ orbitMode }),
  setSelectedNode: (selectedNodeId) => set({ selectedNodeId }),
}));

export function useSolved(): boolean {
  return useGameStore((state) => isSolved(state.cubies));
}

export function useScrambleNotation(): string {
  return useGameStore((state) => state.scramble.map(moveToNotation).join(' '));
}
