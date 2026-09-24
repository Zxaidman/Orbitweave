import { useEffect } from 'react';
import { CubeScene } from '@/components/cube/CubeScene';
import { OrbitGraph } from '@/components/graph/OrbitGraph';
import { FACE_COLORS, FACE_ORDER, MOVE_ORDER, type MoveDirection, type MoveTarget } from '@/game/cube';
import { useGameStore, useScrambleNotation, useSolved } from '@/store/gameStore';

function FaceControls() {
  const applyMove = useGameStore((state) => state.applyMove);

  return (
    <div className="face-controls" aria-label="Cube turn controls">
      {FACE_ORDER.map((face) => (
        <div className="face-control" key={face}>
          <span className="face-dot" style={{ background: FACE_COLORS[face] }} />
          <button type="button" onClick={() => applyMove({ face, direction: 1 })} aria-label={`${face} clockwise`}>
            {face}
          </button>
          <button type="button" onClick={() => applyMove({ face, direction: -1 })} aria-label={`${face} counter-clockwise`}>
            {face}′
          </button>
        </div>
      ))}
    </div>
  );
}

function Header() {
  const moveCount = useGameStore((state) => state.moveCount);
  const historyLength = useGameStore((state) => state.history.length);
  const futureLength = useGameStore((state) => state.future.length);
  const orbitMode = useGameStore((state) => state.orbitMode);
  const setOrbitMode = useGameStore((state) => state.setOrbitMode);
  const undo = useGameStore((state) => state.undo);
  const redo = useGameStore((state) => state.redo);
  const restart = useGameStore((state) => state.restart);
  const newPuzzle = useGameStore((state) => state.newPuzzle);
  const solved = useSolved();

  return (
    <header className="game-header">
      <div className="brand-lockup">
        <div className="brand-mark" aria-hidden="true"><span /><span /><span /></div>
        <div>
          <h1>Orbitweave</h1>
          <p>One puzzle. Two ways to see it.</p>
        </div>
      </div>

      <div className="status-strip" aria-live="polite">
        <span className={solved ? 'status solved' : 'status'}>
          <i /> {solved ? 'Solved' : 'In progress'}
        </span>
        <span><strong>{moveCount}</strong> moves</span>
      </div>

      <div className="header-actions">
        <button type="button" className={orbitMode ? 'toggle active' : 'toggle'} onClick={() => setOrbitMode(!orbitMode)}>
          {orbitMode ? 'Orbit on' : 'Orbit view'}
        </button>
        <button type="button" onClick={undo} disabled={historyLength === 0}>Undo</button>
        <button type="button" onClick={redo} disabled={futureLength === 0}>Redo</button>
        <button type="button" onClick={restart}>Restart</button>
        <button type="button" className="primary" onClick={newPuzzle}>New puzzle</button>
      </div>
    </header>
  );
}

function KeyboardController() {
  const applyMove = useGameStore((state) => state.applyMove);
  const undo = useGameStore((state) => state.undo);
  const redo = useGameStore((state) => state.redo);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement | null)?.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;

      const key = event.key.toUpperCase();
      if ((MOVE_ORDER as readonly string[]).includes(key)) {
        event.preventDefault();
        const direction: MoveDirection = event.shiftKey ? -1 : 1;
        applyMove({ face: key as MoveTarget, direction });
        return;
      }

      if ((event.ctrlKey || event.metaKey) && key === 'Z') {
        event.preventDefault();
        if (event.shiftKey) redo(); else undo();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [applyMove, undo, redo]);

  return null;
}

export function Game() {
  const scramble = useScrambleNotation();
  const solved = useSolved();

  return (
    <main className="app-shell">
      <KeyboardController />
      <Header />

      <section className="puzzle-grid" aria-label="Orbitweave puzzle board">
        <article className="panel cube-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Physical view</span>
              <h2>3×3 Cube</h2>
            </div>
            <span className="hint">Swipe any sticker · its selected row or column follows the drag</span>
          </div>
          <CubeScene />
        </article>

        <article className="panel graph-panel">
          <div className="panel-heading">
            <div>
              <span className="eyebrow">Structural view</span>
              <h2>Orbit Graph</h2>
            </div>
            <span className="hint">3 groups × 3 slice circles · graph turns mirror cube turns</span>
          </div>
          <OrbitGraph />
        </article>
      </section>

      <section className="control-deck">
        <div className="scramble-card">
          <span className="eyebrow">Current puzzle</span>
          <p className="scramble" title={scramble}>{scramble}</p>
        </div>
        <FaceControls />
        <div className="keyboard-card">
          <span className="eyebrow">Keyboard</span>
          <p><kbd>U</kbd> <kbd>R</kbd> <kbd>F</kbd> <kbd>D</kbd> <kbd>L</kbd> <kbd>B</kbd> <kbd>M</kbd> <kbd>E</kbd> <kbd>S</kbd></p>
          <small>Outer faces + middle slices · hold <kbd>Shift</kbd> for inverse turns.</small>
        </div>
      </section>

      {solved && (
        <section className="win-toast" role="status">
          <div className="win-orbit" aria-hidden="true"><span /><span /><span /></div>
          <div>
            <strong>Pattern resolved.</strong>
            <span>The cube and orbit graph have returned to the same solved state.</span>
          </div>
        </section>
      )}
    </main>
  );
}
