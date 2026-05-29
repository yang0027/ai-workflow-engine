import React, { useState, useRef, useEffect } from 'react';
import { AspectRatio, GridType, ASPECT_RATIOS, GRID_TYPES } from './useGridNodeLogic';

interface GridToolbarProps {
  aspect: AspectRatio;
  gridType: GridType;
  customCols: number;
  customRows: number;
  collapsed: boolean;
  synthesizing: boolean;
  outputImage: string;
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
  aspect, gridType, customCols, customRows, collapsed, synthesizing, outputImage,
  onAspectChange, onGridTypeChange, onCustomColsChange, onCustomRowsChange,
  onCompose, onClearAll, onToggleCollapse, onDownload,
}) => {
  const [showAspect, setShowAspect] = useState(false);
  const [showGrid,   setShowGrid]   = useState(false);
  const aspectRef = useRef<HTMLDivElement>(null);
  const gridRef   = useRef<HTMLDivElement>(null);

  // 点击外部关闭下拉
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (aspectRef.current && !aspectRef.current.contains(e.target as Node)) setShowAspect(false);
      if (gridRef.current   && !gridRef.current.contains(e.target as Node))   setShowGrid(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  const gridLabel = gridType === 'custom'
    ? `${customCols}×${customRows}`
    : gridType.replace('x', '×');

  return (
    <>
      <style>{`
        .grid-tb-btn {
          background: transparent; border: none;
          color: rgba(255,255,255,0.78);
          font-size: 10.5px; font-weight: 600;
          padding: 5px 10px; border-radius: 16px;
          cursor: pointer; display: flex; align-items: center; gap: 4px;
          transition: background 0.15s, color 0.15s;
          white-space: nowrap; outline: none;
          font-family: inherit;
        }
        .grid-tb-btn:hover { background: rgba(255,255,255,0.07); color: #fff; }
        .grid-tb-btn:disabled { opacity: 0.35; cursor: not-allowed; }
        .grid-dd-item {
          display: block; width: 100%;
          padding: 7px 14px; border: none; border-radius: 8px;
          font-size: 11px; font-weight: 600; cursor: pointer;
          text-align: left; transition: background 0.15s; outline: none;
          font-family: inherit;
        }
      `}</style>

      <div
        className="nodrag"
        onMouseDown={e => e.stopPropagation()}
        style={{
          display: 'flex', alignItems: 'center', gap: '1px',
          background: 'rgba(10, 13, 22, 0.96)',
          border: '1px solid rgba(255,255,255,0.09)',
          borderRadius: '24px',
          padding: '3px 7px',
          backdropFilter: 'blur(16px)',
          boxShadow: '0 4px 18px rgba(0,0,0,0.55)',
          userSelect: 'none',
          flexWrap: 'wrap',
        }}
      >
        {/* ── 比例下拉 ─────────────────────────────── */}
        <div ref={aspectRef} style={{ position: 'relative' }}>
          <button
            className="grid-tb-btn"
            onClick={e => { e.stopPropagation(); setShowAspect(v => !v); setShowGrid(false); }}
          >
            比例 {aspect}
            <span style={{ fontSize: '7px', opacity: 0.55 }}>{showAspect ? '▲' : '▼'}</span>
          </button>

          {showAspect && (
            <div
              onMouseDown={e => e.stopPropagation()}
              style={{
                position: 'absolute', top: 'calc(100% + 6px)', left: 0,
                background: 'rgba(10, 13, 22, 0.99)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px', padding: '4px',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 10px 35px rgba(0,0,0,0.75)',
                zIndex: 300, minWidth: '90px',
              }}
            >
              {ASPECT_RATIOS.map(a => (
                <button
                  key={a.id}
                  className="grid-dd-item"
                  onClick={() => { onAspectChange(a.id); setShowAspect(false); }}
                  style={{
                    background: aspect === a.id ? 'rgba(168,85,247,0.18)' : 'transparent',
                    color:      aspect === a.id ? '#c084fc' : 'rgba(255,255,255,0.75)',
                  }}
                >{a.id}</button>
              ))}
            </div>
          )}
        </div>

        {/* ── 网格下拉 ─────────────────────────────── */}
        <div ref={gridRef} style={{ position: 'relative' }}>
          <button
            className="grid-tb-btn"
            onClick={e => { e.stopPropagation(); setShowGrid(v => !v); setShowAspect(false); }}
          >
            网格 {gridLabel}
            <span style={{ fontSize: '7px', opacity: 0.55 }}>{showGrid ? '▲' : '▼'}</span>
          </button>

          {showGrid && (
            <div
              onMouseDown={e => e.stopPropagation()}
              style={{
                position: 'absolute', top: 'calc(100% + 6px)', left: 0,
                background: 'rgba(10, 13, 22, 0.99)',
                border: '1px solid rgba(255,255,255,0.1)',
                borderRadius: '12px', padding: '4px',
                backdropFilter: 'blur(20px)',
                boxShadow: '0 10px 35px rgba(0,0,0,0.75)',
                zIndex: 300, minWidth: '100px',
              }}
            >
              {GRID_TYPES.map(g => (
                <button
                  key={g.id}
                  className="grid-dd-item"
                  onClick={() => {
                    onGridTypeChange(g.id);
                    if (g.id !== 'custom') setShowGrid(false);
                  }}
                  style={{
                    background: gridType === g.id ? 'rgba(168,85,247,0.18)' : 'transparent',
                    color:      gridType === g.id ? '#c084fc' : 'rgba(255,255,255,0.75)',
                  }}
                >{g.label}</button>
              ))}

              {/* 自定义行列输入 */}
              {gridType === 'custom' && (
                <div style={{ padding: '6px 10px 4px', display: 'flex', gap: '6px', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.06)', marginTop: '4px' }}>
                  <input
                    type="number" min={1} max={8} value={customCols}
                    onChange={e => onCustomColsChange(parseInt(e.target.value) || 2)}
                    onClick={e => e.stopPropagation()}
                    style={customInputStyle}
                    placeholder="列"
                  />
                  <span style={{ color: 'rgba(255,255,255,0.35)', fontSize: '10px' }}>×</span>
                  <input
                    type="number" min={1} max={8} value={customRows}
                    onChange={e => onCustomRowsChange(parseInt(e.target.value) || 2)}
                    onClick={e => e.stopPropagation()}
                    style={customInputStyle}
                    placeholder="行"
                  />
                </div>
              )}
            </div>
          )}
        </div>

        {/* 分隔线 */}
        <div style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.09)', margin: '0 2px', flexShrink: 0 }} />

        {/* ✏ 编辑 */}
        <button className="grid-tb-btn" title="编辑各格内容">
          <span style={{ fontSize: '11px' }}>✏</span> 编辑
        </button>

        {/* ⚡ 合成 */}
        <button
          className="grid-tb-btn"
          onClick={e => { e.stopPropagation(); onCompose(); }}
          disabled={synthesizing}
          style={{ color: synthesizing ? 'rgba(255,255,255,0.3)' : 'rgba(255,255,255,0.78)' }}
          title="一键像素级拼接合成大图"
        >
          <span style={{ fontSize: '11px' }}>⚡</span>
          {synthesizing ? '合成中' : '合成'}
        </button>

        {/* 清空 */}
        <button
          className="grid-tb-btn"
          onClick={e => { e.stopPropagation(); onClearAll(); }}
          style={{ color: 'rgba(248, 113, 113, 0.85)' }}
          title="清空所有槽位图片"
        >
          <span style={{ fontSize: '11px' }}>🗑</span> 清空
        </button>

        {/* 折叠 / 展开 */}
        <button
          className="grid-tb-btn"
          onClick={e => { e.stopPropagation(); onToggleCollapse(); }}
          title={collapsed ? '展开宫格' : '折叠宫格'}
        >
          {collapsed ? '展开' : '折叠'}
        </button>
      </div>
    </>
  );
};

const customInputStyle: React.CSSProperties = {
  width: '38px',
  padding: '4px 6px',
  background: 'rgba(0,0,0,0.45)',
  border: '1px solid rgba(255,255,255,0.14)',
  borderRadius: '6px',
  color: '#fff',
  fontSize: '11px',
  outline: 'none',
  textAlign: 'center',
  fontFamily: 'inherit',
};
