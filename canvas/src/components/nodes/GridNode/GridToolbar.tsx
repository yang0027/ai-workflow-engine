/**
 * GridToolbar.tsx
 * 仅负责：宫格节点工具栏 UI（选中时悬浮在节点上方）
 *
 * 设计约束：
 *   - 工具栏必须在单行内显示（flexWrap: 'nowrap'）
 *   - 下拉菜单 z-index: 9999，确保显示在画布最上层
 *   - 所有按钮/输入加 nodrag，防止触发节点拖拽
 */

import React, { useState, useRef, useEffect } from 'react';
import { AspectRatio, GridType, ASPECT_RATIOS, GRID_TYPES } from './GridNode.config';

// === Props 定义 ===
interface GridToolbarProps {
  aspect:       AspectRatio;
  gridType:     GridType;
  customCols:   number;
  customRows:   number;
  collapsed:    boolean;
  synthesizing: boolean;
  outputImage:  string;
  onAspectChange:     (v: AspectRatio) => void;
  onGridTypeChange:   (v: GridType)    => void;
  onCustomColsChange: (v: number)      => void;
  onCustomRowsChange: (v: number)      => void;
  onCompose:          () => void;
  onClearAll:         () => void;
  onToggleCollapse:   () => void;
  onDownload:         () => void;
}

export const GridToolbar: React.FC<GridToolbarProps> = ({
  aspect, gridType, customCols, customRows,
  collapsed, synthesizing, outputImage,
  onAspectChange, onGridTypeChange,
  onCustomColsChange, onCustomRowsChange,
  onCompose, onClearAll, onToggleCollapse, onDownload,
}) => {

  // === 功能分块：下拉菜单开关状态 ===
  const [showAspect, setShowAspect] = useState(false);
  const [showGrid,   setShowGrid]   = useState(false);
  const aspectRef = useRef<HTMLDivElement>(null);
  const gridRef   = useRef<HTMLDivElement>(null);

  // 点击外部区域时关闭下拉
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (aspectRef.current && !aspectRef.current.contains(e.target as Node)) setShowAspect(false);
      if (gridRef.current   && !gridRef.current.contains(e.target as Node))   setShowGrid(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // 当前网格类型的显示标签，如 "3×3"、"2×4" 等
  const gridLabel = gridType === 'custom'
    ? `${customCols}×${customRows}`
    : gridType.replace('x', '×');

  // === 功能分块：公共按钮样式 ===
  const btnBase: React.CSSProperties = {
    background:  'transparent',
    border:      'none',
    color:       'rgba(255,255,255,0.78)',
    fontSize:    '11px',
    fontWeight:  600,
    padding:     '4px 9px',
    borderRadius:'14px',
    cursor:      'pointer',
    display:     'flex',
    alignItems:  'center',
    gap:         '3px',
    whiteSpace:  'nowrap',
    outline:     'none',
    fontFamily:  'inherit',
    transition:  'background 0.15s, color 0.15s',
    flexShrink:  0,   // 禁止在单行内被压缩
  };

  const ddItemStyle: React.CSSProperties = {
    display:      'block',
    width:        '100%',
    padding:      '6px 12px',
    border:       'none',
    borderRadius: '7px',
    fontSize:     '11px',
    fontWeight:   600,
    cursor:       'pointer',
    textAlign:    'left',
    transition:   'background 0.15s',
    outline:      'none',
    fontFamily:   'inherit',
    whiteSpace:   'nowrap',
  };

  // 下拉面板通用样式（z-index: 9999 确保浮在画布所有节点上方）
  const ddPanelStyle: React.CSSProperties = {
    position:       'absolute',
    top:            'calc(100% + 6px)',
    left:           0,
    background:     'rgba(10, 13, 22, 0.99)',
    border:         '1px solid rgba(255,255,255,0.1)',
    borderRadius:   '12px',
    padding:        '4px',
    backdropFilter: 'blur(20px)',
    boxShadow:      '0 10px 35px rgba(0,0,0,0.75)',
    zIndex:         9999,   // 确保下拉框永远显示在最上层
    minWidth:       '90px',
  };

  return (
    // === 功能分块：工具栏容器 ===
    // flexWrap: 'nowrap' 强制单行显示，不允许换行
    <div
      className="nodrag"
      onMouseDown={e => e.stopPropagation()}
      style={{
        display:        'flex',
        alignItems:     'center',
        gap:            '2px',
        flexWrap:       'nowrap',   // ← 强制单行
        background:     'rgba(10, 13, 22, 0.97)',
        border:         '1px solid rgba(255,255,255,0.1)',
        borderRadius:   '24px',
        padding:        '3px 8px',
        backdropFilter: 'blur(16px)',
        boxShadow:      '0 4px 18px rgba(0,0,0,0.6)',
        userSelect:     'none',
      }}
    >
      {/* === 功能分块：比例下拉（输出比例影响合成大图的宽高） === */}
      <div ref={aspectRef} style={{ position: 'relative' }}>
        <button
          style={btnBase}
          onClick={e => { e.stopPropagation(); setShowAspect(v => !v); setShowGrid(false); }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          title="输出图像比例"
        >
          {/* 仅显示当前值，节省宽度 */}
          ⬜ {aspect}
          <span style={{ fontSize: '7px', opacity: 0.5 }}>{showAspect ? '▲' : '▼'}</span>
        </button>

        {showAspect && (
          <div style={ddPanelStyle} onMouseDown={e => e.stopPropagation()}>
            {ASPECT_RATIOS.map(a => (
              <button
                key={a.id}
                style={{
                  ...ddItemStyle,
                  background: aspect === a.id ? 'rgba(168,85,247,0.18)' : 'transparent',
                  color:      aspect === a.id ? '#c084fc' : 'rgba(255,255,255,0.75)',
                }}
                onClick={() => { onAspectChange(a.id); setShowAspect(false); }}
              >
                {a.id}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* === 功能分块：网格类型下拉（决定 cols × rows，影响槽位数量） === */}
      <div ref={gridRef} style={{ position: 'relative' }}>
        <button
          style={btnBase}
          onClick={e => { e.stopPropagation(); setShowGrid(v => !v); setShowAspect(false); }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          title="宫格规格"
        >
          ⊞ {gridLabel}
          <span style={{ fontSize: '7px', opacity: 0.5 }}>{showGrid ? '▲' : '▼'}</span>
        </button>

        {showGrid && (
          <div style={ddPanelStyle} onMouseDown={e => e.stopPropagation()}>
            {GRID_TYPES.map(g => (
              <button
                key={g.id}
                style={{
                  ...ddItemStyle,
                  background: gridType === g.id ? 'rgba(168,85,247,0.18)' : 'transparent',
                  color:      gridType === g.id ? '#c084fc' : 'rgba(255,255,255,0.75)',
                }}
                onClick={() => {
                  onGridTypeChange(g.id);
                  if (g.id !== 'custom') setShowGrid(false);
                }}
              >
                {g.label}
              </button>
            ))}

            {/* 自定义行列数输入（仅 custom 模式显示） */}
            {gridType === 'custom' && (
              <div style={{
                padding:      '6px 10px 4px',
                display:      'flex',
                gap:          '6px',
                alignItems:   'center',
                borderTop:    '1px solid rgba(255,255,255,0.06)',
                marginTop:    '4px',
              }}>
                <input
                  type="number" min={1} max={8} value={customCols}
                  onChange={e => onCustomColsChange(parseInt(e.target.value) || 2)}
                  onClick={e => e.stopPropagation()}
                  style={numInputStyle}
                  placeholder="列"
                />
                <span style={{ color: 'rgba(255,255,255,0.3)', fontSize: '10px' }}>×</span>
                <input
                  type="number" min={1} max={8} value={customRows}
                  onChange={e => onCustomRowsChange(parseInt(e.target.value) || 2)}
                  onClick={e => e.stopPropagation()}
                  style={numInputStyle}
                  placeholder="行"
                />
              </div>
            )}
          </div>
        )}
      </div>

      {/* 分隔线 */}
      <div style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.1)', margin: '0 2px', flexShrink: 0 }} />

      {/* === 功能分块：合成按钮 ===
          触发 Canvas 离屏合成，输出 base64 → 上传 MinIO (port 19000) → 写入 data.outputs.output */}
      <button
        style={{
          ...btnBase,
          color: synthesizing ? 'rgba(168,85,247,0.5)' : '#a855f7',
          fontWeight: 700,
        }}
        onClick={e => { e.stopPropagation(); onCompose(); }}
        disabled={synthesizing}
        onMouseEnter={e => { if (!synthesizing) e.currentTarget.style.background = 'rgba(168,85,247,0.1)'; }}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        title="一键像素级拼接合成大图，上传 MinIO"
      >
        ⚡ {synthesizing ? '合成中' : '合成'}
      </button>

      {/* 下载（仅有合成图时显示） */}
      {outputImage && (
        <button
          style={btnBase}
          onClick={e => { e.stopPropagation(); onDownload(); }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
          title="下载合成大图"
        >
          ⬇
        </button>
      )}

      {/* 清空所有槽位 */}
      <button
        style={{ ...btnBase, color: 'rgba(248,113,113,0.85)' }}
        onClick={e => { e.stopPropagation(); onClearAll(); }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.1)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        title="清空所有槽位"
      >
        🗑
      </button>

      {/* 折叠/展开 */}
      <button
        style={{ ...btnBase, color: 'rgba(255,255,255,0.45)', fontSize: '15px' }}
        onClick={e => { e.stopPropagation(); onToggleCollapse(); }}
        onMouseEnter={e => (e.currentTarget.style.background = 'rgba(255,255,255,0.07)')}
        onMouseLeave={e => (e.currentTarget.style.background = 'transparent')}
        title={collapsed ? '展开宫格' : '折叠宫格'}
      >
        {collapsed ? '⊕' : '⊟'}
      </button>
    </div>
  );
};

// === 功能分块：自定义行列数 input 样式 ===
const numInputStyle: React.CSSProperties = {
  width:      '36px',
  padding:    '3px 6px',
  background: 'rgba(0,0,0,0.45)',
  border:     '1px solid rgba(255,255,255,0.14)',
  borderRadius: '6px',
  color:      '#fff',
  fontSize:   '11px',
  outline:    'none',
  textAlign:  'center',
  fontFamily: 'inherit',
};
