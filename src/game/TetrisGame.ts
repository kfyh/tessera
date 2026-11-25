import { createBag, rotateMatrixCW, TETROMINOES } from './tetrominoes';
import {
  COLS,
  ROWS,
  type ActivePiece,
  type BoardCell,
  type GameSnapshot,
  type TetrominoKey,
} from './types';

const LINE_SCORES = [0, 100, 300, 500, 800] as const;
const CONTROL_FREEZE_MS = 280;
const MAX_GROUND_FREEZES = 12;

export class TetrisGame {
  private board: (BoardCell | null)[][] = [];
  private bag: TetrominoKey[] = [];
  private active: ActivePiece | null = null;
  private nextKey: TetrominoKey = 'T';
  private nextPieceId = 1;

  private score = 0;
  private level = 1;
  private tetrisCount = 0;
  private linesCleared = 0;
  private linesIntoLevel = 0;
  private maxBlockSize = 0;
  private paused = false;
  private gameOver = false;

  private gravityTimerMs = 0;
  private freezeTimerMs = 0;
  private groundFreezeCount = 0;
  private softDropHeld = false;
  private onPiecePlaced?: () => void;

  constructor(onPiecePlaced?: () => void) {
    this.onPiecePlaced = onPiecePlaced;
    this.reset();
  }

  public setOnPiecePlaced(cb: () => void): void {
    this.onPiecePlaced = cb;
  }

  public reset(): void {
    this.board = Array.from({ length: ROWS }, () => Array<BoardCell | null>(COLS).fill(null));
    this.bag = createBag();
    this.score = 0;
    this.level = 1;
    this.tetrisCount = 0;
    this.linesCleared = 0;
    this.linesIntoLevel = 0;
    this.maxBlockSize = 0;
    this.paused = false;
    this.gameOver = false;
    this.gravityTimerMs = 0;
    this.freezeTimerMs = 0;
    this.groundFreezeCount = 0;
    this.softDropHeld = false;

    this.nextKey = this.drawFromBag();
    this.spawnNext();
    this.onPiecePlaced?.();
  }

  public togglePause(): void {
    if (this.gameOver) return;
    this.paused = !this.paused;
  }

  public setPaused(paused: boolean): void {
    if (this.gameOver) return;
    this.paused = paused;
  }

  public update(deltaMs: number): void {
    if (this.paused || this.gameOver || !this.active) return;

    const fastDrop = this.softDropHeld;
    if (!fastDrop && this.freezeTimerMs > 0) {
      this.freezeTimerMs = Math.max(0, this.freezeTimerMs - deltaMs);
      return;
    }

    this.gravityTimerMs += deltaMs;
    const interval = fastDrop ? this.getDropIntervalMs() / 20 : this.getDropIntervalMs();

    while (this.gravityTimerMs >= interval) {
      this.gravityTimerMs -= interval;
      if (!this.tryMove(0, 1)) {
        this.softDropHeld = false;
        this.lockActivePiece();
        break;
      }
      if (fastDrop) {
        this.addScore(1);
      }
    }
  }

  public moveLeft(): boolean {
    if (!this.canControl()) return false;
    this.applyControlFreeze();
    return this.tryMove(-1, 0);
  }

  public moveRight(): boolean {
    if (!this.canControl()) return false;
    this.applyControlFreeze();
    return this.tryMove(1, 0);
  }

  public softDropStep(): void {
    if (!this.canControl()) return;
    this.freezeTimerMs = 0;
    if (this.tryMove(0, 1)) {
      this.addScore(1);
      this.gravityTimerMs = 0;
    } else {
      this.softDropHeld = false;
      this.lockActivePiece();
    }
  }

  public setFastDrop(active: boolean): void {
    if (!active) {
      this.softDropHeld = false;
      return;
    }
    if (!this.canControl()) return;
    this.softDropHeld = true;
    this.freezeTimerMs = 0;
    this.gravityTimerMs = this.getDropIntervalMs() / 20;
  }

  public setSoftDropHeld(held: boolean): void {
    if (!held) {
      this.softDropHeld = false;
      return;
    }
    this.setFastDrop(true);
    this.softDropStep();
  }

  public hardDrop(): void {
    if (!this.canControl() || !this.active) return;
    let dropped = 0;
    while (this.tryMove(0, 1)) {
      dropped++;
    }
    if (dropped > 0) {
      this.addScore(dropped * 2);
    }
    this.applyControlFreeze();
    this.gravityTimerMs = this.getDropIntervalMs();
  }

  public rotateCW(): boolean {
    if (!this.canControl() || !this.active) return false;
    this.applyControlFreeze();

    if (this.active.key === 'O') return true;

    const rotated = rotateMatrixCW(this.active.matrix);
    const kicks = this.active.key === 'I' ? [0, -1, 1, -2, 2] : [0, -1, 1, -2, 2];

    for (const dx of kicks) {
      if (!this.collides(this.active.x + dx, this.active.y, rotated)) {
        this.active.x += dx;
        this.active.matrix = rotated;
        this.active.rotation = (this.active.rotation + 1) % 4;
        return true;
      }
    }
    return false;
  }

  public getSnapshot(): GameSnapshot {
    return {
      board: this.board,
      active: this.active,
      ghostY: this.computeGhostY(),
      nextKey: this.nextKey,
      score: this.score,
      level: this.level,
      tetrisCount: this.tetrisCount,
      linesCleared: this.linesCleared,
      maxBlockSize: this.maxBlockSize,
      paused: this.paused,
      gameOver: this.gameOver,
    };
  }

  private canControl(): boolean {
    return !this.paused && !this.gameOver && this.active !== null;
  }

  private applyControlFreeze(): void {
    if (!this.active) return;
    const grounded = this.collides(this.active.x, this.active.y + 1, this.active.matrix);
    if (grounded) {
      if (this.groundFreezeCount >= MAX_GROUND_FREEZES) {
        return;
      }
      this.groundFreezeCount++;
    }
    this.freezeTimerMs = CONTROL_FREEZE_MS;
  }

  private getDropIntervalMs(): number {
    return Math.max(70, Math.round(800 * Math.pow(0.84, this.level - 1)));
  }

  private addScore(points: number): void {
    this.score += points;
  }

  private getLinesForNextLevel(level: number): number {
    if (level <= 2) return 20;
    let prev = 20;
    let curr = 20;
    for (let i = 3; i <= level; i++) {
      const next = prev + curr;
      prev = curr;
      curr = next;
    }
    return curr;
  }

  private drawFromBag(): TetrominoKey {
    if (this.bag.length === 0) {
      this.bag = createBag();
    }
    return this.bag.pop()!;
  }

  private spawnNext(): void {
    const key = this.nextKey;
    this.nextKey = this.drawFromBag();
    const def = TETROMINOES[key];
    const matrix = def.matrix.map((row) => [...row]);
    const x = Math.floor((COLS - matrix[0].length) / 2);
    const y = 0;

    if (this.collides(x, y, matrix)) {
      this.active = null;
      this.gameOver = true;
      return;
    }

    this.active = {
      id: this.nextPieceId++,
      key,
      rotation: 0,
      x,
      y,
      matrix,
      color: def.color,
    };
    this.gravityTimerMs = 0;
    this.freezeTimerMs = 0;
    this.groundFreezeCount = 0;
    this.softDropHeld = false;
  }

  private tryMove(dx: number, dy: number): boolean {
    if (!this.active) return false;
    if (this.collides(this.active.x + dx, this.active.y + dy, this.active.matrix)) {
      return false;
    }
    this.active.x += dx;
    this.active.y += dy;
    return true;
  }

  private collides(px: number, py: number, matrix: number[][]): boolean {
    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (!matrix[r][c]) continue;
        const bx = px + c;
        const by = py + r;
        if (bx < 0 || bx >= COLS || by >= ROWS) return true;
        if (by >= 0 && this.board[by][bx] !== null) return true;
      }
    }
    return false;
  }

  private lockActivePiece(): void {
    if (!this.active) return;
    const { id, x, y, matrix, color } = this.active;

    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (!matrix[r][c]) continue;
        const by = y + r;
        const bx = x + c;
        if (by >= 0 && by < ROWS && bx >= 0 && bx < COLS) {
          this.board[by][bx] = { color, id };
        }
      }
    }

    const cleared = this.clearFullLines();
    if (cleared > 0) {
      this.linesCleared += cleared;
      this.linesIntoLevel += cleared;
      if (cleared === 4) {
        this.tetrisCount++;
      }
      this.addScore(LINE_SCORES[cleared] * this.level);

      let needed = this.getLinesForNextLevel(this.level);
      while (this.linesIntoLevel >= needed) {
        this.linesIntoLevel -= needed;
        this.level++;
        needed = this.getLinesForNextLevel(this.level);
      }
    }

    this.maxBlockSize = Math.max(this.maxBlockSize, this.computeLargestColorBlock());

    this.spawnNext();
    this.onPiecePlaced?.();
  }

  private computeLargestColorBlock(): number {
    const visited = Array.from({ length: ROWS }, () => Array<boolean>(COLS).fill(false));
    let best = 0;
    const dirs = [
      [-1, 0],
      [1, 0],
      [0, -1],
      [0, 1],
    ];

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const start = this.board[r][c];
        if (!start || visited[r][c]) continue;

        const targetColor = start.color;
        const queue: Array<[number, number]> = [[r, c]];
        visited[r][c] = true;
        let size = 0;

        while (queue.length > 0) {
          const [cr, cc] = queue.pop()!;
          size++;
          for (const [dr, dc] of dirs) {
            const nr = cr + dr;
            const nc = cc + dc;
            if (nr < 0 || nr >= ROWS || nc < 0 || nc >= COLS) continue;
            if (visited[nr][nc]) continue;
            const neighbor = this.board[nr][nc];
            if (neighbor && neighbor.color === targetColor) {
              visited[nr][nc] = true;
              queue.push([nr, nc]);
            }
          }
        }

        if (size > best) best = size;
      }
    }

    return best;
  }

  private clearFullLines(): number {
    let cleared = 0;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (this.board[r].every((cell) => cell !== null)) {
        this.board.splice(r, 1);
        this.board.unshift(Array<BoardCell | null>(COLS).fill(null));
        cleared++;
        r++;
      }
    }
    return cleared;
  }

  private computeGhostY(): number {
    if (!this.active) return 0;
    let gy = this.active.y;
    while (!this.collides(this.active.x, gy + 1, this.active.matrix)) {
      gy++;
    }
    return gy;
  }
}
