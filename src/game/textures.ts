import { Texture } from 'pixi.js';

export interface GameTextures {
  /** 16 autotile textures for falling/preview wooden blocks (N=1, E=2, S=4, W=8) */
  blocks: Texture[];
  /** Flat matte texture for landed Mondrian blocks (borders drawn uniformly in borderLayer) */
  landedBlock: Texture;
  gridCell: Texture;
}

/**
 * Generates a 16-tile set of contiguous edge-routered wooden block textures
 * plus a background grid cell texture matching the active light/dark theme.
 */
export function createGameTextures(size = 64, isLight = false): GameTextures {
  const blocks: Texture[] = [];
  const chamfer = Math.max(4, Math.round(size * 0.12));
  const cornerCut = Math.max(3, Math.round(size * 0.08));

  for (let mask = 0; mask < 16; mask++) {
    const hasN = (mask & 1) !== 0;
    const hasE = (mask & 2) !== 0;
    const hasS = (mask & 4) !== 0;
    const hasW = (mask & 8) !== 0;

    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    const ctx = canvas.getContext('2d');
    if (ctx) {
      // Chamfered outer silhouette path (only cut corners where both adjacent edges are exposed)
      const tl = !hasN && !hasW ? cornerCut : 0;
      const tr = !hasN && !hasE ? cornerCut : 0;
      const br = !hasS && !hasE ? cornerCut : 0;
      const bl = !hasS && !hasW ? cornerCut : 0;

      ctx.beginPath();
      ctx.moveTo(tl, 0);
      ctx.lineTo(size - tr, 0);
      if (tr > 0) ctx.lineTo(size, tr);
      ctx.lineTo(size, size - br);
      if (br > 0) ctx.lineTo(size - br, size);
      ctx.lineTo(bl, size);
      if (bl > 0) ctx.lineTo(0, size - bl);
      ctx.lineTo(0, tl);
      if (tl > 0) ctx.lineTo(tl, 0);
      ctx.closePath();
      ctx.clip();

      // Smooth warm wood base (grayscale/neutral so tinting preserves color accuracy)
      ctx.fillStyle = '#e7e2da';
      ctx.fillRect(0, 0, size, size);

      // Subtle horizontal wood-grain streaks
      ctx.fillStyle = 'rgba(0, 0, 0, 0.035)';
      for (let y = 6; y < size; y += 11) {
        ctx.fillRect(0, y, size, 2);
      }

      // Routered / chamfered edge shading only on exposed outer edges
      if (!hasN) {
        const g = ctx.createLinearGradient(0, 0, 0, chamfer);
        g.addColorStop(0, 'rgba(255, 255, 255, 0.55)');
        g.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, size, chamfer);
      }

      if (!hasW) {
        const g = ctx.createLinearGradient(0, 0, chamfer, 0);
        g.addColorStop(0, 'rgba(255, 255, 255, 0.35)');
        g.addColorStop(1, 'rgba(255, 255, 255, 0)');
        ctx.fillStyle = g;
        ctx.fillRect(0, 0, chamfer, size);
      }

      if (!hasS) {
        const g = ctx.createLinearGradient(0, size - chamfer, 0, size);
        g.addColorStop(0, 'rgba(0, 0, 0, 0)');
        g.addColorStop(1, 'rgba(0, 0, 0, 0.32)');
        ctx.fillStyle = g;
        ctx.fillRect(0, size - chamfer, size, chamfer);
      }

      if (!hasE) {
        const g = ctx.createLinearGradient(size - chamfer, 0, size, 0);
        g.addColorStop(0, 'rgba(0, 0, 0, 0)');
        g.addColorStop(1, 'rgba(0, 0, 0, 0.22)');
        ctx.fillStyle = g;
        ctx.fillRect(size - chamfer, 0, chamfer, size);
      }

      // Crisp outer routered edge line only on exposed sides
      ctx.strokeStyle = isLight ? 'rgba(43, 36, 29, 0.48)' : 'rgba(18, 15, 12, 0.55)';
      ctx.lineWidth = Math.max(1.5, size * 0.03);
      ctx.beginPath();
      if (!hasN) {
        ctx.moveTo(tl, 0.75);
        ctx.lineTo(size - tr, 0.75);
      }
      if (!hasE) {
        ctx.moveTo(size - 0.75, tr);
        ctx.lineTo(size - 0.75, size - br);
      }
      if (!hasS) {
        ctx.moveTo(size - br, size - 0.75);
        ctx.lineTo(bl, size - 0.75);
      }
      if (!hasW) {
        ctx.moveTo(0.75, size - bl);
        ctx.lineTo(0.75, tl);
      }
      if (tl > 0) {
        ctx.moveTo(0.75, tl);
        ctx.lineTo(tl, 0.75);
      }
      if (tr > 0) {
        ctx.moveTo(size - tr, 0.75);
        ctx.lineTo(size - 0.75, tr);
      }
      if (br > 0) {
        ctx.moveTo(size - 0.75, size - br);
        ctx.lineTo(size - br, size - 0.75);
      }
      if (bl > 0) {
        ctx.moveTo(bl, size - 0.75);
        ctx.lineTo(0.75, size - bl);
      }
      ctx.stroke();
    }

    blocks.push(Texture.from(canvas));
  }

  const landedCanvas = document.createElement('canvas');
  landedCanvas.width = size;
  landedCanvas.height = size;
  const lctx = landedCanvas.getContext('2d');
  if (lctx) {
    lctx.fillStyle = '#ece7df';
    lctx.fillRect(0, 0, size, size);
  }
  const landedBlock = Texture.from(landedCanvas);

  const gridCanvas = document.createElement('canvas');
  gridCanvas.width = size;
  gridCanvas.height = size;
  const gctx = gridCanvas.getContext('2d');
  if (gctx) {
    gctx.fillStyle = isLight ? '#e8dfd1' : '#120f0c';
    gctx.fillRect(0, 0, size, size);
    gctx.strokeStyle = isLight ? 'rgba(43, 36, 29, 0.08)' : 'rgba(239, 232, 220, 0.05)';
    gctx.lineWidth = 1;
    gctx.strokeRect(0.5, 0.5, size - 1, size - 1);
  }

  return {
    blocks,
    landedBlock,
    gridCell: Texture.from(gridCanvas),
  };
}
