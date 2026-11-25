import './style.css';
import { TetrisGame } from './game/TetrisGame';
import { TetrisRenderer } from './game/TetrisRenderer';

async function bootstrap(): Promise<void> {
  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => undefined);
  }

  const gameStage = document.getElementById('game-stage')!;
  const nextStage = document.getElementById('next-stage')!;
  const scoreEl = document.getElementById('score-val')!;
  const levelEl = document.getElementById('level-val')!;
  const linesEl = document.getElementById('lines-val')!;
  const tetrisEl = document.getElementById('tetris-val')!;
  const blockEl = document.getElementById('block-val')!;
  const pauseBtn = document.getElementById('pause-btn')!;
  const fullscreenBtn = document.getElementById('fullscreen-btn')!;
  const overlay = document.getElementById('overlay')!;
  const overlayTitle = document.getElementById('overlay-title')!;
  const overlaySub = document.getElementById('overlay-sub')!;
  const overlayBtn = document.getElementById('overlay-btn')!;

  const game = new TetrisGame();
  const renderer = new TetrisRenderer();
  await renderer.init(gameStage, nextStage);

  const heldKeys = new Set<string>();
  const blockedKeys = new Set<string>();
  const clearTouchHolds: Array<() => void> = [];

  game.setOnPiecePlaced(() => {
    for (const code of heldKeys) {
      blockedKeys.add(code);
    }
    for (const stopHold of clearTouchHolds) {
      stopHold();
    }
  });

  const themeMedia = window.matchMedia('(prefers-color-scheme: light)');
  themeMedia.addEventListener('change', (e) => {
    renderer.setLightTheme(e.matches);
  });

  const syncHud = () => {
    const snap = game.getSnapshot();
    scoreEl.textContent = String(snap.score);
    levelEl.textContent = String(snap.level);
    linesEl.textContent = String(snap.linesCleared);
    tetrisEl.textContent = String(snap.tetrisCount);
    blockEl.textContent = String(snap.maxBlockSize);

    if (snap.gameOver) {
      overlay.classList.remove('hidden');
      overlayTitle.textContent = 'GAME OVER';
      overlaySub.textContent = `Score ${snap.score} • Level ${snap.level} • 4-Lines ${snap.tetrisCount} • Max Block ${snap.maxBlockSize}`;
      overlayBtn.textContent = 'PLAY AGAIN';
    } else if (snap.paused) {
      overlay.classList.remove('hidden');
      overlayTitle.textContent = 'PAUSED';
      overlaySub.textContent = 'Tap Resume or press P';
      overlayBtn.textContent = 'RESUME';
    } else {
      overlay.classList.add('hidden');
    }
  };

  pauseBtn.addEventListener('click', () => {
    game.togglePause();
    syncHud();
  });

  if (!document.fullscreenEnabled) {
    fullscreenBtn.style.display = 'none';
  } else {
    const syncFullscreenBtn = () => {
      const isFs = Boolean(document.fullscreenElement);
      fullscreenBtn.textContent = isFs ? '✕' : '⛶';
      fullscreenBtn.setAttribute('aria-label', isFs ? 'Exit Fullscreen' : 'Enter Fullscreen');
    };
    fullscreenBtn.addEventListener('click', async () => {
      try {
        if (document.fullscreenElement) {
          await document.exitFullscreen();
        } else {
          await document.documentElement.requestFullscreen({ navigationUI: 'hide' });
        }
      } catch {
        // Ignore if fullscreen is blocked by browser policy
      }
    });
    document.addEventListener('fullscreenchange', () => {
      syncFullscreenBtn();
      renderer.resize(gameStage);
    });
    syncFullscreenBtn();
  }

  overlayBtn.addEventListener('click', () => {
    const snap = game.getSnapshot();
    if (snap.gameOver) {
      game.reset();
    } else {
      game.setPaused(false);
    }
    syncHud();
  });

  // Keyboard controls
  window.addEventListener('keydown', (e) => {
    if (blockedKeys.has(e.code)) {
      e.preventDefault();
      return;
    }
    heldKeys.add(e.code);

    const snap = game.getSnapshot();
    if (snap.gameOver && (e.code === 'Space' || e.code === 'Enter')) {
      e.preventDefault();
      game.reset();
      syncHud();
      return;
    }

    switch (e.code) {
      case 'ArrowLeft':
      case 'KeyA':
        e.preventDefault();
        game.moveLeft();
        break;
      case 'ArrowRight':
      case 'KeyD':
        e.preventDefault();
        game.moveRight();
        break;
      case 'ArrowDown':
      case 'KeyS':
        e.preventDefault();
        if (!e.repeat) {
          game.setSoftDropHeld(true);
        }
        break;
      case 'ArrowUp':
      case 'KeyW':
      case 'KeyX':
        e.preventDefault();
        game.rotateCW();
        break;
      case 'Space':
        e.preventDefault();
        if (snap.paused) {
          game.setPaused(false);
        } else {
          game.hardDrop();
        }
        break;
      case 'KeyP':
      case 'Escape':
        e.preventDefault();
        game.togglePause();
        break;
      case 'KeyR':
        e.preventDefault();
        game.reset();
        break;
    }
  });

  window.addEventListener('keyup', (e) => {
    heldKeys.delete(e.code);
    blockedKeys.delete(e.code);
    if (e.code === 'ArrowDown' || e.code === 'KeyS') {
      game.setSoftDropHeld(false);
    }
  });

  window.addEventListener('blur', () => {
    heldKeys.clear();
    blockedKeys.clear();
    game.setSoftDropHeld(false);
    for (const stopHold of clearTouchHolds) {
      stopHold();
    }
  });

  // Touch / pointer controls with press-and-hold repeat for directional buttons
  const bindHoldButton = (id: string, action: () => void, repeatable: boolean) => {
    const btn = document.getElementById(id)!;
    let holdTimeout: number | undefined;
    let repeatInterval: number | undefined;

    const stop = () => {
      btn.classList.remove('pressed');
      if (holdTimeout !== undefined) window.clearTimeout(holdTimeout);
      if (repeatInterval !== undefined) window.clearInterval(repeatInterval);
      holdTimeout = undefined;
      repeatInterval = undefined;
    };

    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      try {
        btn.setPointerCapture(e.pointerId);
      } catch {
        // Ignore if pointer capture is unavailable
      }
      btn.classList.add('pressed');
      action();
      if (repeatable) {
        holdTimeout = window.setTimeout(() => {
          repeatInterval = window.setInterval(action, 75);
        }, 170);
      }
    });

    btn.addEventListener('pointerup', stop);
    btn.addEventListener('pointercancel', stop);
    clearTouchHolds.push(stop);
  };

  bindHoldButton('btn-left', () => game.moveLeft(), true);
  bindHoldButton('btn-right', () => game.moveRight(), true);
  bindHoldButton('btn-rotate', () => game.rotateCW(), false);

  const downBtn = document.getElementById('btn-down')!;
  let downHoldTimer: number | undefined;
  const stopDown = () => {
    downBtn.classList.remove('pressed');
    if (downHoldTimer !== undefined) {
      window.clearTimeout(downHoldTimer);
      downHoldTimer = undefined;
    }
    game.setSoftDropHeld(false);
  };
  downBtn.addEventListener('contextmenu', (e) => e.preventDefault());
  downBtn.addEventListener('pointerdown', (e) => {
    e.preventDefault();
    try {
      downBtn.setPointerCapture(e.pointerId);
    } catch {
      // Ignore if pointer capture is unavailable
    }
    downBtn.classList.add('pressed');
    game.softDropStep();
    if (downHoldTimer !== undefined) {
      window.clearTimeout(downHoldTimer);
    }
    downHoldTimer = window.setTimeout(() => {
      downHoldTimer = undefined;
      game.setFastDrop(true);
    }, 300);
  });
  downBtn.addEventListener('pointerup', stopDown);
  downBtn.addEventListener('pointercancel', stopDown);
  clearTouchHolds.push(stopDown);

  window.addEventListener('resize', () => {
    renderer.resize(gameStage);
  });

  // Main game loop (starts immediately into the game)
  let lastTime = performance.now();
  const loop = (now: number) => {
    const delta = Math.min(100, now - lastTime);
    lastTime = now;

    game.update(delta);
    const snap = game.getSnapshot();
    renderer.render(snap);
    syncHud();

    requestAnimationFrame(loop);
  };

  requestAnimationFrame(loop);
}

bootstrap();
