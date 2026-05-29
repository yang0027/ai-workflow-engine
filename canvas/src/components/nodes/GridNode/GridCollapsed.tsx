/**
 * GridCollapsed.tsx
 * 仅负责：节点折叠态 UI（180×200 紧凑预览卡片）
 *
 * 输入：
 *   - outputImage:    合成大图地址（MinIO URL 或 base64），优先显示
 *   - firstSlotImage: 第一个槽位图片（outputImage 为空时的备用预览）
 *   - totalSlots:     格子总数，显示在右上角角标
 *
 * 输出：纯 JSX，双击触发展开回调
 */

import React from 'react';
import { COLLAPSED_W, COLLAPSED_H } from './GridNode.config';

// === Props 定义 ===
interface GridCollapsedProps {
  /** 合成输出图（MinIO URL），有值则优先展示 */
  outputImage:     string;
  /** 第一槽位图（base64 或 MinIO URL），outputImage 为空时展示 */
  firstSlotImage?: string;
  /** 总格子数，显示在角标 */
  totalSlots:      number;
  /** 双击后展开节点 */
  onExpand:        () => void;
}

export const GridCollapsed: React.FC<GridCollapsedProps> = ({
  outputImage,
  firstSlotImage,
  totalSlots,
  onExpand,
}) => {
  // 优先显示合成大图，其次第一格预览，都没有则显示图标
  const previewSrc = outputImage || firstSlotImage || '';

  return (
    // === 功能分块：折叠卡片容器（固定 COLLAPSED_W × COLLAPSED_H = 180×200）===
    <div
      onDoubleClick={onExpand}
      style={{
        width:          COLLAPSED_W,
        height:         COLLAPSED_H,
        borderRadius:   '14px',
        overflow:       'hidden',
        position:       'relative',
        background:     previewSrc ? '#000' : 'rgba(12, 16, 26, 0.92)',
        border:         '1.5px solid rgba(168, 85, 247, 0.65)',
        boxShadow:      '0 0 14px rgba(168,85,247,0.15)',
        cursor:         'grab',
        display:        'flex',
        alignItems:     'center',
        justifyContent: 'center',
      }}
      title="双击展开宫格"
    >
      {/* === 功能分块：预览图 ===
          输入：previewSrc — base64("data:image/...") 或 MinIO URL("http://...19000/...")
          直接使用 <img>，无异步转换，避免黑屏 */}
      {previewSrc ? (
        <img
          src={previewSrc}
          alt="宫格预览"
          draggable={false}
          style={{
            width:     '100%',
            height:    '100%',
            objectFit: 'cover',
            display:   'block',
          }}
          onError={e => {
            (e.currentTarget as HTMLImageElement).style.display = 'none';
          }}
        />
      ) : (
        /* 空白态：显示 ⊞ 图标 */
        <span style={{ fontSize: '32px', color: 'rgba(168,85,247,0.25)' }}>⊞</span>
      )}

      {/* === 功能分块：右上角格数角标 === */}
      <div
        style={{
          position:       'absolute',
          top:            '7px',
          right:          '7px',
          background:     'rgba(10, 13, 22, 0.88)',
          border:         '1px solid rgba(168,85,247,0.25)',
          backdropFilter: 'blur(8px)',
          borderRadius:   '8px',
          padding:        '2px 6px',
          display:        'flex',
          alignItems:     'center',
          gap:            '3px',
        }}
      >
        <span style={{ fontSize: '9px', color: 'rgba(168,85,247,0.9)' }}>⊞</span>
        <span style={{ fontSize: '10px', fontWeight: 700, color: '#fff' }}>{totalSlots}</span>
      </div>

      {/* === 功能分块：底部展开提示条 === */}
      <div
        style={{
          position:      'absolute',
          bottom:        0,
          left:          0,
          right:         0,
          background:    'linear-gradient(to top, rgba(0,0,0,0.72), transparent)',
          padding:       '18px 8px 6px',
          fontSize:      '9px',
          color:         'rgba(255,255,255,0.45)',
          textAlign:     'center',
          letterSpacing: '0.3px',
          userSelect:    'none',
        }}
      >
        双击展开
      </div>
    </div>
  );
};
