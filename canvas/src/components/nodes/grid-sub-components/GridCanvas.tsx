import React from 'react';
import { ResolvedMedia } from '../../ResolvedMedia';
import { SLOT_W, SLOT_H, CELL_GAP } from './useGridNodeLogic';

interface GridCanvasProps {
  cols:         number;
  rows:         number;
  totalSlots:   number;
  slotImages:   Record<number, string>;
  localImages:  Record<number, string>;
  canvasW:      number;
  canvasH:      number;
  synthesizing: boolean;
  selected:     boolean;
  onSlotClick:  (idx: number) => void;
  onClearSlot:  (e: React.MouseEvent, idx: number) => void;
}

export const GridCanvas: React.FC<GridCanvasProps> = ({
  cols, rows, totalSlots,
  slotImages, localImages,
  canvasW, canvasH,
  synthesizing, selected,
  onSlotClick, onClearSlot,
}) => {
  return (
    <div
      style={{
        width:        canvasW,
        height:       canvasH,
        border:       '1.5px solid rgba(34, 197, 94, 0.65)',
        borderRadius: '10px',
        overflow:     'hidden',
        position:     'relative',
        background:   'rgba(10, 14, 22, 0.9)',
        boxShadow:    selected
          ? '0 0 18px rgba(34, 197, 94, 0.18)'
          : '0 4px 16px rgba(0,0,0,0.35)',
        display:      'flex',
        flexWrap:     'wrap',
        gap:          `${CELL_GAP}px`,
        padding:      `${CELL_GAP}px`,
        boxSizing:    'border-box',
        alignContent: 'flex-start',
      }}
    >
      {Array.from({ length: totalSlots }).map((_, idx) => {
        const src = slotImages[idx];
        return (
          <div
            key={idx}
            onClick={() => onSlotClick(idx)}
            style={{
              width:        SLOT_W,
              height:       SLOT_H,
              borderRadius: '6px',
              overflow:     'hidden',
              position:     'relative',
              cursor:       'pointer',
              background:   src ? 'transparent' : 'rgba(255,255,255,0.025)',
              border:       src ? 'none' : '1px dashed rgba(255,255,255,0.12)',
              display:      'flex',
              alignItems:   'center',
              justifyContent: 'center',
              flexShrink:   0,
              transition:   'border-color 0.18s',
            }}
            onMouseEnter={e => { if (!src) e.currentTarget.style.borderColor = 'rgba(34,197,94,0.6)'; }}
            onMouseLeave={e => { if (!src) e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)'; }}
            title={`槽位 ${idx + 1} — 点击上传图片`}
          >
            {src ? (
              <>
                <ResolvedMedia
                  url={src}
                  type="image"
                  style={{
                    width:     '100%',
                    height:    '100%',
                    objectFit: 'cover',
                    display:   'block',
                  }}
                />
                {/* 本地手动上传才显示清除 × */}
                {localImages[idx] && (
                  <button
                    onClick={e => onClearSlot(e, idx)}
                    style={{
                      position:     'absolute',
                      top:          '4px',
                      right:        '4px',
                      width:        '18px',
                      height:       '18px',
                      borderRadius: '50%',
                      background:   'rgba(0,0,0,0.75)',
                      border:       'none',
                      color:        '#ef4444',
                      display:      'flex',
                      alignItems:   'center',
                      justifyContent: 'center',
                      fontSize:     '11px',
                      cursor:       'pointer',
                      zIndex:       5,
                      padding:      0,
                    }}
                    title="清除此槽位"
                  >×</button>
                )}
              </>
            ) : (
              <span style={{ fontSize: '22px', color: 'rgba(255,255,255,0.15)', lineHeight: 1 }}>+</span>
            )}
          </div>
        );
      })}

      {/* 合成中遮罩 */}
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
          }}
        >
          <span style={{ fontSize: '13px', color: '#a855f7', fontWeight: 600 }}>
            像素拼接合成中...
          </span>
          <div style={{ width: '55%', height: '3px', background: 'rgba(255,255,255,0.08)', borderRadius: '2px', overflow: 'hidden' }}>
            <div style={{ width: '55%', height: '100%', background: 'linear-gradient(90deg,#a855f7,#ec4899)', animation: 'pulse 1.2s infinite' }} />
          </div>
        </div>
      )}
    </div>
  );
};
