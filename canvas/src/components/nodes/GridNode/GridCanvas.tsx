/**
 * GridCanvas.tsx
 * 仅负责：宫格画布 UI 渲染
 *
 * === 布局说明 ===
 * 使用 CSS Grid（display:grid）而非 flexbox：
 *   - gridTemplateColumns: repeat(cols, SLOT_W px) — 明确指定每列宽度，不依赖父容器宽度计算
 *   - 不会因浮点误差导致第三列换行，彻底解决"9格只显6格"问题
 *
 * === 图片渲染说明（黑屏修复）===
 * 槽位容器用 position:relative，图片用 position:absolute + inset:0：
 *   - 彻底避免 flex 容器中 height:100% 失效导致的 0px 高度黑屏
 *   - 直接使用 <img src={...}>，支持：
 *       ① base64 — "data:image/jpeg;base64,..."（本地上传）
 *       ② MinIO URL — "http://82.197.92.233:19000/workflows/..."（云端存储）
 *   - 不使用 ResolvedMedia（异步 Blob 转换有初始空帧黑屏风险）
 *
 * 输入：slotImages[idx] = base64 或 MinIO URL
 * 输出：纯 JSX，无副作用
 */

import React from 'react';
import { SLOT_W, SLOT_H, CELL_GAP } from './GridNode.config';

// === Props 定义 ===
interface GridCanvasProps {
  cols:        number;
  rows:        number;
  totalSlots:  number;
  /** key=槽位索引，value=base64 或 MinIO URL */
  slotImages:  Record<number, string>;
  /** 仅本地上传的图片，用于判断是否显示清除按钮 */
  localImages: Record<number, string>;
  /** 画布宽（含 padding），由 calcCanvasW 计算，传给节点尺寸同步用，CSS Grid 不依赖此值布局 */
  canvasW:     number;
  canvasH:     number;
  synthesizing: boolean;
  selected:    boolean;
  onSlotClick: (idx: number) => void;
  onClearSlot: (e: React.MouseEvent, idx: number) => void;
}

export const GridCanvas: React.FC<GridCanvasProps> = ({
  cols,
  rows,
  totalSlots,
  slotImages,
  localImages,
  canvasW,
  canvasH,
  synthesizing,
  selected,
  onSlotClick,
  onClearSlot,
}) => {
  return (
    // === 功能分块：画布容器 ===
    // display:grid + gridTemplateColumns 显式定义列宽，不受父容器宽度影响
    // canvasW/canvasH 仅作为参考尺寸，实际由 grid 自动计算
    <div
      style={{
        display:               'grid',
        gridTemplateColumns:   `repeat(${cols}, ${SLOT_W}px)`,
        gridTemplateRows:      `repeat(${rows}, ${SLOT_H}px)`,
        gap:                   `${CELL_GAP}px`,
        padding:               `${CELL_GAP}px`,
        background:            'rgba(10, 14, 22, 0.9)',
        border:                `1.5px solid ${selected ? 'rgba(168,85,247,0.6)' : 'rgba(255,255,255,0.07)'}`,
        borderRadius:          '10px',
        boxShadow:             selected ? '0 0 18px rgba(168,85,247,0.15)' : '0 4px 16px rgba(0,0,0,0.35)',
        transition:            'border-color 0.2s, box-shadow 0.2s',
        // 溢出隐藏（防止极端情况下内容超出圆角范围）
        overflow:              'hidden',
        position:              'relative',
      }}
    >
      {/* === 功能分块：槽位列表（共 cols × rows 个） === */}
      {Array.from({ length: totalSlots }).map((_, idx) => {
        const src     = slotImages[idx];
        const isLocal = !!localImages[idx];
        const hasImg  = !!src;

        return (
          <div
            key={idx}
            // nodrag：防止点击格子时触发节点拖拽
            className="nodrag"
            onClick={() => onSlotClick(idx)}
            style={{
              // 槽位固定 SLOT_W × SLOT_H，由 CSS Grid 行列模板保证
              width:        SLOT_W,
              height:       SLOT_H,
              position:     'relative',   // 子元素 absolute 定位的锚点
              overflow:     'hidden',
              borderRadius: '6px',
              cursor:       'pointer',
              background:   hasImg ? '#000' : 'rgba(255,255,255,0.025)',
              border:       hasImg ? 'none' : '1px dashed rgba(255,255,255,0.12)',
              transition:   'border-color 0.18s',
            }}
            onMouseEnter={e => {
              if (!hasImg) e.currentTarget.style.borderColor = 'rgba(168,85,247,0.55)';
            }}
            onMouseLeave={e => {
              if (!hasImg) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
            }}
            title={hasImg ? `槽位 ${idx + 1} — 点击替换` : `槽位 ${idx + 1} — 点击上传`}
          >
            {hasImg ? (
              <>
                {/* === 图片渲染 ===
                    position:absolute + inset:0 + width/height:100% — 铺满槽位，不受 flex/grid 影响
                    输入：base64("data:image/...") 或 MinIO URL("http://82.197.92.233:19000/...")
                    浏览器直接渲染，无需异步转换 */}
                <img
                  src={src}
                  alt={`格子 ${idx + 1}`}
                  draggable={false}
                  style={{
                    position:   'absolute',
                    inset:      0,
                    width:      '100%',
                    height:     '100%',
                    objectFit:  'cover',
                    display:    'block',
                  }}
                  onError={e => {
                    // 加载失败时显示半透明遮罩，提示用户而非纯黑
                    const el = e.currentTarget;
                    el.style.display = 'none';
                    (el.parentElement as HTMLElement).style.background = 'rgba(239,68,68,0.08)';
                  }}
                />

                {/* 仅本地上传（非连线）才显示清除按钮 */}
                {isLocal && (
                  <button
                    onClick={e => onClearSlot(e, idx)}
                    style={{
                      position:       'absolute',
                      top:            '4px',
                      right:          '4px',
                      width:          '18px',
                      height:         '18px',
                      borderRadius:   '50%',
                      background:     'rgba(0,0,0,0.72)',
                      border:         'none',
                      color:          '#f87171',
                      display:        'flex',
                      alignItems:     'center',
                      justifyContent: 'center',
                      fontSize:       '11px',
                      cursor:         'pointer',
                      zIndex:         5,
                      padding:        0,
                    }}
                    title="清除此槽位"
                  >
                    ×
                  </button>
                )}
              </>
            ) : (
              /* 空槽位：居中显示序号和加号 */
              <div
                style={{
                  position:       'absolute',
                  inset:          0,
                  display:        'flex',
                  flexDirection:  'column',
                  alignItems:     'center',
                  justifyContent: 'center',
                  gap:            '4px',
                  pointerEvents:  'none',
                }}
              >
                <span style={{ fontSize: '18px', color: 'rgba(255,255,255,0.1)', lineHeight: 1 }}>+</span>
                <span style={{ fontSize: '9px',  color: 'rgba(255,255,255,0.18)' }}>{idx + 1}</span>
              </div>
            )}
          </div>
        );
      })}

      {/* === 功能分块：合成中遮罩（覆盖整个画布） === */}
      {synthesizing && (
        <div
          style={{
            position:       'absolute',
            inset:          0,
            background:     'rgba(8,12,20,0.88)',
            backdropFilter: 'blur(8px)',
            display:        'flex',
            flexDirection:  'column',
            alignItems:     'center',
            justifyContent: 'center',
            gap:            '12px',
            zIndex:         20,
            borderRadius:   '10px',
          }}
        >
          <span style={{ fontSize: '13px', color: '#a855f7', fontWeight: 600 }}>
            像素拼接合成中...
          </span>
          <div style={{
            width: '55%', height: '3px',
            background: 'rgba(255,255,255,0.08)',
            borderRadius: '2px', overflow: 'hidden',
          }}>
            <div style={{
              width: '60%', height: '100%',
              background: 'linear-gradient(90deg,#a855f7,#ec4899)',
              animation: 'pulse 1.2s infinite',
            }} />
          </div>
        </div>
      )}
    </div>
  );
};
