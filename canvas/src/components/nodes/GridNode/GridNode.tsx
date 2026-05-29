/**
 * GridNode.tsx
 * 仅负责：UI 渲染（JSX 结构、样式、Handle 挂载）
 *
 * 拖拽策略（与 UploadNode 保持一致）：
 *   - 根 div 加 className="custom-drag-handle"，整个节点范围均可拖动
 *   - 内部所有交互元素（格子、按钮、输入框）加 className="nodrag"，
 *     防止这些元素的鼠标事件冒泡触发节点拖拽
 *
 * Handle 规范：
 *   - 左侧：Target Handle（id="input"），接收上游图像输入
 *   - 右侧：Source Handle（id="output"），输出合成大图
 *   - 选中时显示，未选中时隐藏（opacity/pointerEvents 控制）
 *
 * 工具栏规范：
 *   - 仅在 selected && !isMultiSelected && !collapsed 时渲染
 *   - 绝对定位在节点上方，z-index: 9999
 */

import React from 'react';
import { Handle, Position } from '@xyflow/react';
import { useGridNodeLogic }  from './GridNode.logic';
import { GridToolbar }       from './GridToolbar';
import { GridCanvas }        from './GridCanvas';
import { GridCollapsed }     from './GridCollapsed';
import { HANDLE_BASE }       from './GridNode.config';

// === Props 定义 ===
interface GridNodeProps {
  id: string;
  data: {
    label?:    string;
    inputs?:   Record<string, any>;
    outputs?:  Record<string, any>;
  };
  selected?: boolean;
}

// === 主组件 ===
export default function GridNode({ id, data, selected }: GridNodeProps) {

  // === 功能分块：业务逻辑（全部委托给 useGridNodeLogic）===
  const logic = useGridNodeLogic(id, data);
  const {
    gridType, aspect, customCols, customRows, collapsed,
    cols, rows, totalSlots, canvasW, canvasH, nodeW,
    synthesizing, outputImage, isMultiSelected, slotImages, localImages,
    fileInputRef,
    handleInputChange,
    handleSlotClick, handleFileChange,
    handleClearSlot, handleClearAll,
    handleDelete, handleToggleCollapse,
    handleDownloadOutput, handleCompose,
  } = logic;

  // === 功能分块：Handle 样式（紫色，selected 时显示） ===
  // 与 UploadNode 使用相同颜色 rgba(168,85,247)
  const handleVisible: React.CSSProperties = {
    ...HANDLE_BASE,
    opacity:       selected ? 1 : 0,
    pointerEvents: selected ? 'all' : 'none',
    visibility:    selected ? 'visible' : 'hidden',
  };

  return (
    // === 功能分块：根容器 ===
    // custom-drag-handle：整个节点范围均可拖动（参考 UploadNode 实现）
    // z-index: 在节点选中时提升，确保下拉菜单不被其他节点遮挡
    <div
      className="custom-drag-handle"
      style={{
        position:   'relative',
        width:      nodeW,
        fontFamily: 'var(--font-sans, system-ui)',
        userSelect: 'none',
        zIndex:     selected ? 10 : 1,
      }}
    >
      {/* 隐藏的文件输入，由 handleSlotClick 触发 */}
      <input
        type="file"
        ref={fileInputRef}
        onChange={handleFileChange}
        accept="image/*"
        style={{ display: 'none' }}
      />

      {/* === 功能分块：悬浮工具栏（选中展开态时显示在节点正上方）===
          - 选中 && 非多选 && 非折叠 → 显示
          - 绝对定位，top:-52px，居中对齐
          - z-index:9999 确保工具栏下拉框显示在最顶层 */}
      {selected && !isMultiSelected && !collapsed && (
        <div
          className="nodrag"
          style={{
            position:  'absolute',
            top:       '-52px',
            left:      '50%',
            transform: 'translateX(-50%)',
            zIndex:    9999,
            animation: 'gridTbIn 0.18s cubic-bezier(0.16,1,0.3,1)',
          }}
        >
          <style>{`
            @keyframes gridTbIn {
              from { opacity:0; transform: translateX(-50%) translateY(8px); }
              to   { opacity:1; transform: translateX(-50%) translateY(0);   }
            }
          `}</style>
          <GridToolbar
            aspect={aspect}
            gridType={gridType}
            customCols={customCols}
            customRows={customRows}
            collapsed={collapsed}
            synthesizing={synthesizing}
            outputImage={outputImage}
            onAspectChange={v     => handleInputChange('aspect',     v)}
            onGridTypeChange={v   => handleInputChange('gridType',   v)}
            onCustomColsChange={v => handleInputChange('customCols', v)}
            onCustomRowsChange={v => handleInputChange('customRows', v)}
            onCompose={handleCompose}
            onClearAll={handleClearAll}
            onToggleCollapse={handleToggleCollapse}
            onDownload={handleDownloadOutput}
          />
        </div>
      )}

      {/* === 功能分块：删除按钮（选中时右上角浮现）=== */}
      {selected && !isMultiSelected && (
        <button
          className="nodrag"
          onClick={handleDelete}
          style={{
            position:       'absolute',
            top:            '-26px',
            right:          '0',
            width:          '20px',
            height:         '20px',
            borderRadius:   '50%',
            background:     'rgba(239,68,68,0.1)',
            border:         '1px solid rgba(239,68,68,0.2)',
            color:          '#ef4444',
            display:        'flex',
            alignItems:     'center',
            justifyContent: 'center',
            fontSize:       '11px',
            cursor:         'pointer',
            padding:        0,
            zIndex:         20,
          }}
          onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.3)')}
          onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.1)')}
          title="删除节点"
        >
          ×
        </button>
      )}

      {/* === 功能分块：折叠态 / 展开态条件渲染 === */}
      {collapsed ? (
        // ── 折叠态：180×200 紧凑预览卡 ─────────────────────────────────
        <GridCollapsed
          totalSlots={totalSlots}
          outputImage={outputImage}
          firstSlotImage={slotImages[0]}
          onExpand={handleToggleCollapse}
        />
      ) : (
        // ── 展开态：完整宫格卡片 ────────────────────────────────────────
        <div
          style={{
            width:         nodeW,
            background:    'linear-gradient(145deg, rgba(14,20,32,0.96) 0%, rgba(8,11,20,0.99) 100%)',
            border:        selected
              ? '1.5px solid rgba(168, 85, 247, 0.55)'
              : '1px solid rgba(255,255,255,0.07)',
            boxShadow:     selected
              ? '0 0 28px rgba(168, 85, 247, 0.15)'
              : '0 8px 32px rgba(0,0,0,0.42)',
            borderRadius:  '18px',
            overflow:      'hidden',
            display:       'flex',
            flexDirection: 'column',
            transition:    'all 0.25s cubic-bezier(0.4, 0, 0.2, 1)',
          }}
        >
          {/* 节点标题条（也是可视化的拖拽区域）
              注意：nodrag 不加在这里，整个节点都可拖动 */}
          <div
            style={{
              display:        'flex',
              alignItems:     'center',
              justifyContent: 'space-between',
              padding:        '7px 12px 6px',
              background:     'rgba(168,85,247,0.06)',
              borderBottom:   '1px solid rgba(255,255,255,0.05)',
              flexShrink:     0,
              cursor:         'grab',
            }}
          >
            <span style={{
              fontSize:      '10.5px',
              fontWeight:    700,
              color:         'rgba(168, 85, 247, 0.9)',
              letterSpacing: '0.6px',
              userSelect:    'none',
              display:       'flex',
              alignItems:    'center',
              gap:           '5px',
            }}>
              ⊞ <span>宫格合成</span>
              <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', fontWeight: 400 }}>
                {cols}×{rows}
              </span>
            </span>

            {/* 折叠按钮（nodrag，不触发拖拽） */}
            <button
              className="nodrag"
              onClick={e => { e.stopPropagation(); handleToggleCollapse(); }}
              style={{
                background:  'transparent',
                border:      'none',
                color:       'rgba(255,255,255,0.3)',
                fontSize:    '14px',
                cursor:      'pointer',
                padding:     '0 2px',
                lineHeight:  1,
                userSelect:  'none',
              }}
              title="折叠"
            >
              ⊟
            </button>
          </div>

          {/* === 功能分块：宫格画布区域 ===
              nodrag + onMouseDown.stopPropagation 防止格子点击触发节点拖拽
              padding: 10px 让画布与卡片边缘保持间距 */}
          <div
            className="nodrag"
            onMouseDown={e => e.stopPropagation()}
            style={{ padding: '10px', boxSizing: 'border-box' }}
          >
            <GridCanvas
              cols={cols}
              rows={rows}
              totalSlots={totalSlots}
              slotImages={slotImages}
              localImages={localImages}
              canvasW={canvasW}
              canvasH={canvasH}
              synthesizing={synthesizing}
              selected={!!selected}
              onSlotClick={handleSlotClick}
              onClearSlot={handleClearSlot}
            />
          </div>
        </div>
      )}

      {/* === 功能分块：左侧 Target Handle（图像输入）===
          - id="input"，接收上游节点的 data.outputs.output
          - 选中时显示，未选中隐藏 */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        style={{ ...handleVisible, left: '-12px' }}
        title="图像输入"
      >
        ＋
      </Handle>

      {/* === 功能分块：右侧 Source Handle（合成大图输出）===
          - id="output"，下游节点通过 data.outputs.output 读取合成大图
          - 输出格式：MinIO URL（http://82.197.92.233:19000/workflows/...） */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        style={{ ...handleVisible, right: '-12px' }}
        title="合成大图输出（MinIO URL）"
      >
        ＋
      </Handle>
    </div>
  );
}
