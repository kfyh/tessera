import type { TetrominoKey } from './types';

export interface TetrominoDef {
  color: number;
  matrix: number[][];
}

// Colour-blind-safe earthy wooden-block palette with clear luminance separation
// and strong contrast against both light (#eae3d6) and dark (#120f0c) themes.
export const TETROMINOES: Record<TetrominoKey, TetrominoDef> = {
  I: {
    color: 0xd4ba92, // Warm Birch (brightest, distinct from light board bg)
    matrix: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  },
  O: {
    color: 0xdfa63c, // Honey Ochre
    matrix: [
      [1, 1],
      [1, 1],
    ],
  },
  S: {
    color: 0x87a36d, // Olive Moss
    matrix: [
      [0, 1, 1],
      [1, 1, 0],
      [0, 0, 0],
    ],
  },
  L: {
    color: 0xc76438, // Terracotta Clay
    matrix: [
      [0, 0, 1],
      [1, 1, 1],
      [0, 0, 0],
    ],
  },
  T: {
    color: 0x4e798f, // Slate Teal
    matrix: [
      [0, 1, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
  },
  J: {
    color: 0x8c5636, // Chestnut Walnut
    matrix: [
      [1, 0, 0],
      [1, 1, 1],
      [0, 0, 0],
    ],
  },
  Z: {
    color: 0x6b3a2e, // Deep Mahogany (darkest, still distinct on dark board bg)
    matrix: [
      [1, 1, 0],
      [0, 1, 1],
      [0, 0, 0],
    ],
  },
};

const KEYS: TetrominoKey[] = ['I', 'O', 'T', 'S', 'Z', 'J', 'L'];

export function createBag(): TetrominoKey[] {
  const bag = [...KEYS];
  for (let i = bag.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [bag[i], bag[j]] = [bag[j], bag[i]];
  }
  return bag;
}

export function rotateMatrixCW(matrix: number[][]): number[][] {
  const size = matrix.length;
  const result: number[][] = Array.from({ length: size }, () => Array(size).fill(0));
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      result[c][size - 1 - r] = matrix[r][c];
    }
  }
  return result;
}
