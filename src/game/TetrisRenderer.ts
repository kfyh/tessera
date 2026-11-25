import { Application, Container, Graphics, Sprite } from 'pixi.js';
import { createGameTextures, type GameTextures } from './textures';
import { TETROMINOES } from './tetrominoes';
import { COLS, ROWS, type GameSnapshot, type TetrominoKey } from './types';

export class TetrisRenderer {
  private boardApp = new Application();
  private nextApp = new Application();
  private textures!: GameTextures;

  private cellSize = 24;
  private isLightTheme = false;
  private boardSprites: Sprite[][] = [];
  private borderGraphics = new Graphics();
  private activeSprites: Sprite[] = [];
  private ghostSprites: Sprite[] = [];
  private nextSprites: Sprite[] = [];
  private lastNextKey: TetrominoKey | null = null;

  public async init(boardContainer: HTMLElement, nextContainer: HTMLElement): Promise<void> {
    this.isLightTheme = window.matchMedia('(prefers-color-scheme: light)').matches;
    this.textures = createGameTextures(64, this.isLightTheme);
    this.cellSize = this.computeCellSize(boardContainer);

    await this.boardApp.init({
      width: COLS * this.cellSize,
      height: ROWS * this.cellSize,
      backgroundColor: this.isLightTheme ? 0xeae3d6 : 0x120f0c,
      antialias: false,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    });
    boardContainer.innerHTML = '';
    boardContainer.appendChild(this.boardApp.canvas);

    await this.nextApp.init({
      width: 44,
      height: 36,
      backgroundAlpha: 0,
      antialias: false,
      resolution: Math.min(window.devicePixelRatio || 1, 2),
      autoDensity: true,
    });
    nextContainer.innerHTML = '';
    nextContainer.appendChild(this.nextApp.canvas);

    this.buildBoardLayers();
    this.buildNextLayer();
  }

  public setLightTheme(isLight: boolean): void {
    if (this.isLightTheme === isLight) return;
    this.isLightTheme = isLight;
    this.textures = createGameTextures(64, isLight);
    this.boardApp.renderer.background.color = isLight ? 0xeae3d6 : 0x120f0c;
    this.boardApp.stage.removeChildren();
    this.boardSprites = [];
    this.ghostSprites = [];
    this.activeSprites = [];
    this.buildBoardLayers();
    this.nextApp.stage.removeChildren();
    this.buildNextLayer();
    if (this.lastNextKey) {
      this.renderNextPiece(this.lastNextKey);
    }
  }

  public resize(boardContainer: HTMLElement): void {
    const nextSize = this.computeCellSize(boardContainer);
    if (nextSize === this.cellSize) return;
    this.cellSize = nextSize;
    this.boardApp.renderer.resize(COLS * this.cellSize, ROWS * this.cellSize);

    // Reposition grid and block sprites
    this.boardApp.stage.removeChildren();
    this.boardSprites = [];
    this.ghostSprites = [];
    this.activeSprites = [];
    this.buildBoardLayers();
  }

  public render(snapshot: GameSnapshot): void {
    // Locked board cells (flat Mondrian fills; uniform borders drawn below)
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = snapshot.board[r][c];
        const sprite = this.boardSprites[r][c];
        if (cell !== null) {
          sprite.visible = true;
          sprite.texture = this.textures.landedBlock;
          sprite.tint = cell.color;
        } else {
          sprite.visible = false;
        }
      }
    }

    this.drawLandedBorders(snapshot.board);

    // Ghost & active piece (contiguous within the piece matrix)
    let ghostIdx = 0;
    let activeIdx = 0;
    if (snapshot.active) {
      const { x, y, matrix, color } = snapshot.active;
      const showGhost = snapshot.ghostY > y;
      for (let r = 0; r < matrix.length; r++) {
        for (let c = 0; c < matrix[r].length; c++) {
          if (!matrix[r][c]) continue;
          const px = (x + c) * this.cellSize;
          const mask = this.getMatrixMask(matrix, r, c);
          const tex = this.textures.blocks[mask];

          if (showGhost && ghostIdx < this.ghostSprites.length) {
            const g = this.ghostSprites[ghostIdx++];
            g.visible = true;
            g.texture = tex;
            g.tint = color;
            g.position.set(px, (snapshot.ghostY + r) * this.cellSize);
          }

          if (activeIdx < this.activeSprites.length) {
            const a = this.activeSprites[activeIdx++];
            a.visible = true;
            a.texture = tex;
            a.tint = color;
            a.position.set(px, (y + r) * this.cellSize);
          }
        }
      }
    }

    for (let i = ghostIdx; i < this.ghostSprites.length; i++) {
      this.ghostSprites[i].visible = false;
    }
    for (let i = activeIdx; i < this.activeSprites.length; i++) {
      this.activeSprites[i].visible = false;
    }

    if (this.lastNextKey !== snapshot.nextKey) {
      this.lastNextKey = snapshot.nextKey;
      this.renderNextPiece(snapshot.nextKey);
    }
  }

  private computeCellSize(boardContainer: HTMLElement): number {
    const parent = boardContainer.parentElement;
    const availW = parent ? parent.clientWidth - 8 : window.innerWidth - 28;
    const availH = parent ? parent.clientHeight - 12 : window.innerHeight - 100;
    const size = Math.floor(Math.min(availW / COLS, availH / ROWS));
    return Math.max(14, Math.min(42, size));
  }

  private buildBoardLayers(): void {
    const gridLayer = new Container();
    const lockedLayer = new Container();
    const ghostLayer = new Container();
    const activeLayer = new Container();

    for (let r = 0; r < ROWS; r++) {
      const rowSprites: Sprite[] = [];
      for (let c = 0; c < COLS; c++) {
        const bg = new Sprite(this.textures.gridCell);
        bg.width = this.cellSize;
        bg.height = this.cellSize;
        bg.position.set(c * this.cellSize, r * this.cellSize);
        gridLayer.addChild(bg);

        const cell = new Sprite(this.textures.blocks[0]);
        cell.width = this.cellSize;
        cell.height = this.cellSize;
        cell.position.set(c * this.cellSize, r * this.cellSize);
        cell.visible = false;
        lockedLayer.addChild(cell);
        rowSprites.push(cell);
      }
      this.boardSprites.push(rowSprites);
    }

    for (let i = 0; i < 4; i++) {
      const ghost = new Sprite(this.textures.blocks[0]);
      ghost.width = this.cellSize;
      ghost.height = this.cellSize;
      ghost.alpha = 0.26;
      ghost.visible = false;
      ghostLayer.addChild(ghost);
      this.ghostSprites.push(ghost);

      const active = new Sprite(this.textures.blocks[0]);
      active.width = this.cellSize;
      active.height = this.cellSize;
      active.visible = false;
      activeLayer.addChild(active);
      this.activeSprites.push(active);
    }

    this.borderGraphics = new Graphics();
    this.boardApp.stage.addChild(gridLayer, lockedLayer, this.borderGraphics, ghostLayer, activeLayer);
  }

  private buildNextLayer(): void {
    this.nextSprites = [];
    for (let i = 0; i < 4; i++) {
      const s = new Sprite(this.textures.blocks[0]);
      s.visible = false;
      this.nextApp.stage.addChild(s);
      this.nextSprites.push(s);
    }
  }

  private renderNextPiece(key: TetrominoKey): void {
    const def = TETROMINOES[key];
    const matrix = def.matrix;
    const cells: Array<{ r: number; c: number; mask: number }> = [];

    let minR = 99;
    let maxR = -1;
    let minC = 99;
    let maxC = -1;

    for (let r = 0; r < matrix.length; r++) {
      for (let c = 0; c < matrix[r].length; c++) {
        if (!matrix[r][c]) continue;
        cells.push({ r, c, mask: this.getMatrixMask(matrix, r, c) });
        minR = Math.min(minR, r);
        maxR = Math.max(maxR, r);
        minC = Math.min(minC, c);
        maxC = Math.max(maxC, c);
      }
    }

    const spanC = maxC - minC + 1;
    const spanR = maxR - minR + 1;
    const cell = 9;
    const offsetX = Math.floor((44 - spanC * cell) / 2);
    const offsetY = Math.floor((36 - spanR * cell) / 2);

    this.nextSprites.forEach((s, i) => {
      const pt = cells[i];
      if (!pt) {
        s.visible = false;
        return;
      }
      s.visible = true;
      s.texture = this.textures.blocks[pt.mask];
      s.tint = def.color;
      s.width = cell;
      s.height = cell;
      s.position.set(offsetX + (pt.c - minC) * cell, offsetY + (pt.r - minR) * cell);
    });
  }

  private drawLandedBorders(board: GameSnapshot['board']): void {
    const g = this.borderGraphics;
    g.clear();

    const s = this.cellSize;
    const t = Math.max(2, Math.round(s * 0.12));
    const half = t / 2;
    const maxW = COLS * s;
    const maxH = ROWS * s;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const cell = board[r][c];
        if (!cell) continue;

        const x0 = c * s;
        const y0 = r * s;
        const x1 = x0 + s;
        const y1 = y0 + s;

        // Top seam (drawn if top edge or neighbor above is empty / different color)
        if (r === 0 || board[r - 1][c]?.color !== cell.color) {
          const rx = Math.max(0, x0 - half);
          const ry = Math.max(0, y0 - half);
          const rw = Math.min(maxW, x1 + half) - rx;
          g.rect(rx, ry, rw, t);
        }

        // Bottom seam (only if board bottom or empty below, so shared seams draw once)
        if (r === ROWS - 1 || board[r + 1][c] === null) {
          const rx = Math.max(0, x0 - half);
          const ry = Math.min(maxH - t, y1 - half);
          const rw = Math.min(maxW, x1 + half) - rx;
          g.rect(rx, ry, rw, t);
        }

        // Left seam (drawn if left edge or neighbor left is empty / different color)
        if (c === 0 || board[r][c - 1]?.color !== cell.color) {
          const rx = Math.max(0, x0 - half);
          const ry = Math.max(0, y0 - half);
          const rh = Math.min(maxH, y1 + half) - ry;
          g.rect(rx, ry, t, rh);
        }

        // Right seam (only if board right or empty right, so shared seams draw once)
        if (c === COLS - 1 || board[r][c + 1] === null) {
          const rx = Math.min(maxW - t, x1 - half);
          const ry = Math.max(0, y0 - half);
          const rh = Math.min(maxH, y1 + half) - ry;
          g.rect(rx, ry, t, rh);
        }
      }
    }

    g.fill(0x000000);
  }

  private getMatrixMask(matrix: number[][], r: number, c: number): number {
    let mask = 0;
    if (matrix[r - 1]?.[c]) mask |= 1;
    if (matrix[r]?.[c + 1]) mask |= 2;
    if (matrix[r + 1]?.[c]) mask |= 4;
    if (matrix[r]?.[c - 1]) mask |= 8;
    return mask;
  }
}
