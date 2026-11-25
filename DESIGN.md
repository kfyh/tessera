# Tetris PWA — Manual & Design Document

A mobile-first, offline-capable Tetris Progressive Web App (PWA) built with **TypeScript**, **PixiJS**, and **Vite**. The app boots directly into active gameplay with responsive touch controls, keyboard support, and a procedural canvas-textured renderer.

---

## 1. Quick Start & Commands

| Command | Description |
| :--- | :--- |
| `npm run dev` | Starts the Vite dev HTTP server (`vite --host`) on port `5173`, accessible on your local network for phone testing. |
| `npm run build` | Runs `tsc --noEmit` followed by `vite build` to output the production bundle to `dist/`. |
| `npm run preview` | Serves the production `dist/` build over LAN (`vite preview --host` on port `4173`). |
| `npm run typecheck` | Runs TypeScript type-checking (`tsc --noEmit`). |

---

## 2. Player Manual & Controls

### Launching
- Opening the app loads **straight into an active game** with no title screen.
- On **Game Over** or **Pause**, an overlay displays your current stats with a **PLAY AGAIN** / **RESUME** button.

### Touch Controls (Mobile)
Arranged from left to right along the bottom bar:

| Button | Action | Behavior |
| :---: | :--- | :--- |
| **◀** | Move Left | Moves 1 column left; holding repeats every `75ms` after a `170ms` initial delay. |
| **▶** | Move Right | Moves 1 column right; holding repeats every `75ms` after a `170ms` initial delay. |
| *(gap)* | Spacer | Visual separation between movement and rotation/drop controls. |
| **↻** | Rotate | Rotates the piece clockwise (with horizontal wall kicks). |
| **▼** | Down / Fast Drop | **Tap:** drops 1 row.<br>**Hold (0.3s):** engages **20×** fall speed until the piece hits a block or you release. |
| **II** | Pause / Resume | Located in the top-right HUD. |

### Keyboard Controls (Desktop)

| Key(s) | Action |
| :--- | :--- |
| `ArrowLeft` / `A` | Move Left |
| `ArrowRight` / `D` | Move Right |
| `ArrowDown` / `S` | Soft / Fast Drop (`20×` while held) |
| `ArrowUp` / `W` / `X` | Rotate Clockwise |
| `Space` | Hard Drop (moves to lowest row and waits the freeze delay before locking); also resumes/restarts from overlays |
| `P` / `Escape` | Pause / Resume |
| `R` | Restart Game |

> [!NOTE]
> **Input Clearing on Piece Placement:** Whenever a piece locks, all active touch holds and held keyboard keys are cleared. You must lift and press again to control the newly spawned piece.

---

## 3. Gameplay Mechanics & Formulas

### Playfield & Piece Generation
- **Grid:** `10` columns × `20` rows (`COLS = 10`, `ROWS = 20`).
- **Randomizer:** Standard **7-bag** shuffler (`createBag()`), ensuring every set of 7 pieces contains one of each tetromino (`I`, `O`, `T`, `S`, `Z`, `J`, `L`).
- **Rotation:** Clockwise matrix rotation (`rotateMatrixCW`) with horizontal wall-kick offsets `[0, -1, 1, -2, 2]`.

### Gravity, Control Freeze & Locking
- **Base Fall Interval:** Levels control fall speed only:
  $$\text{intervalMs}(\text{level}) = \max\bigl(70,\; \operatorname{round}(800 \times 0.84^{\text{level} - 1})\bigr)$$
- **Control-Press Freeze:** Pressing Left, Right, Rotate, or Hard Drop sets `freezeTimerMs = 280` ms (`CONTROL_FREEZE_MS`), pausing automatic downward gravity so you can adjust placement at high speeds. While grounded, this reset is capped at `12` times per piece (`MAX_GROUND_FREEZES`) so pieces cannot stall indefinitely.
- **Fast Drop (`20×`):** When `softDropHeld` is active, the freeze timer is bypassed and gravity runs at `intervalMs / 20` until the piece hits a block/floor or the control is released.

### Scoring & Stats
- **Line Clears:** `100 / 300 / 500 / 800 × level` for `1 / 2 / 3 / 4` simultaneous lines.
- **Drop Points:** `+1` per row soft/fast-dropped; `+2` per row hard-dropped.
- **HUD Stats:**
  - **SCORE:** Total points.
  - **LEVEL:** Current speed level.
  - **LINES:** Total lines cleared.
  - **TETRIS:** Count of 4-line clears (`cleared === 4`).
  - **NEXT:** Live preview of the upcoming tetromino.

### Level Progression
Levels advance by **lines cleared per level** following a Fibonacci sequence:

| Level Transition | Lines Required (This Level) | Cumulative Lines | Fall Interval |
| :---: | :---: | :---: | :---: |
| `1 → 2` | 20 | 20 | `800 ms` (Lv 1) |
| `2 → 3` | 20 | 40 | `672 ms` (Lv 2) |
| `3 → 4` | 40 | 80 | `564 ms` (Lv 3) |
| `4 → 5` | 60 | 140 | `474 ms` (Lv 4) |
| `5 → 6` | 100 | 240 | `398 ms` (Lv 5) |
| `6 → 7` | 160 | 400 | `335 ms` (Lv 6) |
| `7 → 8` | 260 | 660 | `281 ms` (Lv 7) |
| `8 → 9` | 420 | 1,080 | `236 ms` (Lv 8) |

Subsequent levels continue the sequence (`prev + curr`).

---

## 4. Architecture & File Map

```text
/workspace
├── index.html                  # App shell, HUD, canvas containers, touch controls, PWA meta tags
├── package.json                # Dependencies (pixi.js, vite, typescript) & npm scripts
├── tsconfig.json               # Strict TypeScript configuration
├── vite.config.ts              # Vite config with host: true (LAN access on port 5173)
├── public/
│   ├── manifest.webmanifest    # Standalone portrait PWA manifest
│   ├── sw.js                   # Service worker (tetris-pwa-v2) for offline shell caching
│   └── icons/
│       ├── icon-192.png        # 192×192 maskable/any PWA icon
│       └── icon-512.png        # 512×512 maskable/any PWA icon
└── src/
    ├── main.ts                 # Bootstrap, game loop (rAF), input bindings, HUD sync, SW registration
    ├── style.css               # Mobile-first layout, safe-area insets, touch-action: none rules
    ├── vite-env.d.ts           # Vite client type declarations
    └── game/
        ├── types.ts            # Board constants (COLS, ROWS) & TypeScript interfaces
        ├── tetrominoes.ts      # Piece matrices, colors, 7-bag generator, CW rotation
        ├── textures.ts         # Procedural HTML5 <canvas> block & grid textures -> Pixi Texture
        ├── TetrisGame.ts       # Pure game state, gravity, freeze, scoring, Fibonacci levels
        └── TetrisRenderer.ts   # PixiJS Applications (board + next preview) & pooled Sprites
```

### Rendering Pipeline
1. [textures.ts](file:///workspace/src/game/textures.ts) draws a `64×64` grayscale beveled block and a `64×64` subtle grid cell onto offscreen `<canvas>` elements and converts them via `Texture.from()`.
2. [TetrisRenderer.ts](file:///workspace/src/game/TetrisRenderer.ts) initializes two PixiJS `Application` instances (`boardApp` and `nextApp`) with `autoDensity: true` and `resolution` capped at `2`.
3. `boardApp` pre-allocates pooled `Sprite`s across 4 layers (`gridLayer`, `lockedLayer`, `ghostLayer` at `alpha = 0.22`, and `activeLayer`) and updates positions/visibility/`tint` each frame with zero per-frame allocations.

### PWA & Offline Caching
- [manifest.webmanifest](file:///workspace/public/manifest.webmanifest) configures `display: "standalone"`, `orientation: "portrait"`, and `#0b0f19` theme/background colors.
- [sw.js](file:///workspace/public/sw.js) pre-caches the app shell (`/` , `/index.html`, `/manifest.webmanifest`, and icons) using a network-first strategy with offline cache fallback, while bypassing `/src/`, `/@`, and `/node_modules/` so Vite dev reloads on mobile always receive fresh code.
