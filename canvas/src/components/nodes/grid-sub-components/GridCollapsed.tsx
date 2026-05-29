import React from 'react';
import { SLOT_W, SLOT_H } from './useGridNodeLogic';

interface GridCollapsedProps {
  totalSlots:      number;
  outputImage:     string;
  firstSlotImage?: string;
  onExpand:        () => void;
}

export const GridCollapsed: React.FC<GridCollapsedProps> = ({
  totalSlots,
  outputImage,
  firstSlotImage,
  onExpand,
}) => {
  const previewSrc = outputImage || firstSlotImage || '';

  return (
    // 整个折叠卡片 = 固定 180×200
    <div
      onDoubleClick={onExpand}
      style={{
        width:          SLOT_W,
        height:         SLOT_H,
        borderRadius:   '12px',
        overflow:       'hidden',
        position:       'relative',
        background:     previewSrc ? 'transparent' : 'rgba(12, 16, 26, 0.92)',
        border:         '1.5px solid rgba(34, 197, 94, 0.65)',
        cursor:         'pointer',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
      }}
      title="双击展开宫格"
    >
      {/* 缩略预览 */}
      {previewSrc ? (
        <img
          src={previewSrc}
          alt="preview"
          style={{ width: '100%', height: '100%', objectFit: 'cover', display: 'block' }}
        />
      ) : (
        <span style={{ fontSize: '28px', color: 'rgba(255,255,255,0.1)' }}>⊞</span>
      )}

      {/* 右上角：格数角标 */}
      <div
        style={{
          position:       'absolute',
          top:            '8px',
          right:          '8px',
          background:     'rgba(10, 13, 22, 0.88)',
          border:         '1px solid rgba(255,255,255,0.1)',
          backdropFilter: 'blur(8px)',
          borderRadius:   '8px',
          padding:        '2px 7px',
          display:        'flex',
          alignItems:     'center',
          gap:            '3px',
        }}
      >
        <span style={{ fontSize: '10px' }}>⊞</span>
        <span style={{ fontSize: '10px', fontWeight: 700, color: '#fff' }}>{totalSlots}</span>
      </div>

      {/* 底部提示 */}
      <div
        style={{
          position:   'absolute',
          bottom:     0,
          left:       0,
          right:      0,
          background: 'linear-gradient(to top, rgba(0,0,0,0.75), transparent)',
          padding:    '16px 8px 6px',
          fontSize:   '9px',
          color:      'rgba(255,255,255,0.5)',
          textAlign:  'center',
          letterSpacing: '0.3px',
        }}
      >
        双击展开
      </div>
    </div>
  );
};
