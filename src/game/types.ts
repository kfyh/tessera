export const COLS = 10;
export const ROWS = 20;

export type TetrominoKey = 'I' | 'O' | 'T' | 'S' | 'Z' | 'J' | 'L';

export interface BoardCell {
  color: number;
  id: number;
}

export interface ActivePiece {
  id: number;
  key: TetrominoKey;
  rotation: number;
  x: number;
  y: number;
  matrix: number[][];
  color: number;
}

export interface GameSnapshot {
  board: (BoardCell | null)[][];
  active: ActivePiece | null;
  ghostY: number;
  nextKey: TetrominoKey;
  score: number;
  level: number;
  tetrisCount: number;
  linesCleared: number;
  maxBlockSize: number;
  paused: boolean;
  gameOver: boolean;
}
