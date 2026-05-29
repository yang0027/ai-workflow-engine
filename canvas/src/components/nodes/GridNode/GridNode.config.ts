/**
 * GridNode.config.ts
 * 仅负责：静态常量、尺寸公式、类型定义、Handle 样式
 */
import type { CSSProperties } from 'react';

// ─── 尺寸常量 ─────────────────────────────────────────────────────────────────
export const SLOT_W      = 180;   // 每格宽
export const SLOT_H      = 200;   // 每格高
export const CELL_GAP    = 4;     // 格间距（同时也是 canvas padding）
export const DRAG_BAR_H  = 32;    // 顶部拖拽条高
export const PAD_X       = 10;    // 卡片左右内边距（单侧）
export const PAD_B       = 10;    // 卡片底部内边距

// 折叠态固定尺寸
export const COLLAPSED_W = SLOT_W;
export const COLLAPSED_H = SLOT_H;

// ─── 画布尺寸计算 ─────────────────────────────────────────────────────────────
// GridCanvas 使用 padding: CELL_GAP（上下左右），boxSizing: border-box
// 内部可用宽 = canvasW - 2*CELL_GAP，需放下 cols 个格子 + (cols-1) 个间距
// ∴ canvasW = cols*SLOT_W + (cols+1)*CELL_GAP
export function calcCanvasW(cols: number): number {
  return cols * SLOT_W + (cols + 1) * CELL_GAP;
}
export function calcCanvasH(rows: number): number {
  return rows * SLOT_H + (rows + 1) * CELL_GAP;
}
export function calcNodeW(cols: number): number {
  return calcCanvasW(cols) + PAD_X * 2;
}
export function calcNodeH(rows: number): number {
  return DRAG_BAR_H + calcCanvasH(rows) + PAD_B;
}

// ─── Handle 样式（紫色，与其他节点保持一致） ─────────────────────────────────
export const HANDLE_BASE: CSSProperties = {
  width:          '24px',
  height:         '24px',
  background:     'rgba(15, 23, 42, 0.95)',
  border:         '1.5px solid rgba(168, 85, 247, 0.85)',
  borderRadius:   '50%',
  display:        'flex',
  alignItems:     'center',
  justifyContent: 'center',
  color:          'rgba(168, 85, 247, 1)',
  cursor:         'crosshair',
  boxShadow:      '0 0 10px rgba(168, 85, 247, 0.45)',
  fontWeight:     'bold',
  fontSize:       '14px',
  userSelect:     'none',
  lineHeight:     '24px',
  position:       'absolute',
  top:            '50%',
  transform:      'translateY(-50%)',
  transition:     'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
};

// ─── 类型 ────────────────────────────────────────────────────────────────────
export type GridType    = '2x2' | '3x3' | '4x4' | '5x5' | 'custom';
export type AspectRatio = '16:9' | '9:16' | '3:4' | '4:3' | '1:1';

export interface GridOption   { id: GridType;    label: string; cols: number; rows: number; }
export interface AspectOption { id: AspectRatio; w: number;    h: number; }

export const GRID_TYPES: GridOption[] = [
  { id: '2x2',    label: '2×2',    cols: 2, rows: 2 },
  { id: '3x3',    label: '3×3',    cols: 3, rows: 3 },
  { id: '4x4',    label: '4×4',    cols: 4, rows: 4 },
  { id: '5x5',    label: '5×5',    cols: 5, rows: 5 },
  { id: 'custom', label: '自定义', cols: 0, rows: 0 },
];

export const ASPECT_RATIOS: AspectOption[] = [
  { id: '16:9', w: 16, h: 9  },
  { id: '9:16', w: 9,  h: 16 },
  { id: '3:4',  w: 3,  h: 4  },
  { id: '4:3',  w: 4,  h: 3  },
  { id: '1:1',  w: 1,  h: 1  },
];

// ─── 辅助 ─────────────────────────────────────────────────────────────────────
export function getGridDims(
  gridType: GridType,
  customCols: number,
  customRows: number,
): { cols: number; rows: number } {
  if (gridType === 'custom') {
    return {
      cols: Math.max(1, Math.min(8, customCols)),
      rows: Math.max(1, Math.min(8, customRows)),
    };
  }
  const found = GRID_TYPES.find(g => g.id === gridType);
  return { cols: found?.cols ?? 3, rows: found?.rows ?? 3 };
}
