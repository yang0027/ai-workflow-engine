import React, { useState, useEffect, useRef } from 'react';
import { Handle, Position, NodeResizer, useStore } from '@xyflow/react';
import { ResolvedMedia } from '../../ResolvedMedia';
import { useModelSelector, getModelsForProvider, Provider } from '../../../hooks/useModelSelector';
import {
  PromptSourceNodeProps,
  HANDLE_STYLE,
  NODE_STYLE,
  LYRIC_MODELS,
  WORK_MODES,
} from './PromptSourceNode.config';
import { usePromptSourceNodeLogic } from './PromptSourceNode.logic';

export default function PromptSourceNode({ id, data, selected, style }: PromptSourceNodeProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  // 多选检测
  const isMultiSelected = useStore((state) => {
    return state.nodes.filter(n => n.selected).length > 1;
  });

  // 使用业务逻辑舱 Hook
  const logic = usePromptSourceNodeLogic({ id, data, selected });

  // 模型选择状态
  const [activeVendor, setActiveVendor] = useState<string>('openai');
  const [activePopover, setActivePopover] = useState<'model' | 'mode' | 'reference' | null>(null);

  // 使用统一模型选择器
  const { providers: chatProviders, setProviderId: handleVendorChange, setModel: onModelChange } = useModelSelector({
    capability: 'chat',
    settings: logic.settings,
    currentProviderId: activeVendor,
    currentModel: logic.selectedModel,
  });

  // 点击空白关闭 popover
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) {
        setActivePopover(null);
      }
    };
    if (activePopover) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [activePopover]);

  // 获取指定厂商的模型列表
  const getModelsForVendor = (vendorId: string) => {
    return getModelsForProvider(vendorId, 'chat', logic.settings);
  };

  // 工作模式切换（由 logic 层实现）

  const nodeStyle = {
    ...NODE_STYLE,
    ...(selected
      ? {
          border: '1.5px solid rgba(168, 85, 247, 0.85)',
          boxShadow: '0 0 25px rgba(168, 85, 247, 0.35)',
        }
      : {
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)',
        }),
    ...style,
  };

  return (
    <div ref={containerRef} className="glass-panel text-left custom-drag-handle" style={nodeStyle}>
      {selected && (
        <NodeResizer
          color="#a855f7"
          minWidth={320}
          minHeight={280}
          lineStyle={{ border: '1.5px solid rgba(168, 85, 247, 0.85)' }}
          handleStyle={{ width: 8, height: 8, borderRadius: '50%', background: '#a855f7' }}
        />
      )}

      {/* 头部与物理删除 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px', flex: 1 }}>
          <span style={{ fontSize: '16px' }}>📝</span>
          {logic.isEditingName ? (
            <input
              value={logic.localName}
              onChange={(e) => logic.setLocalName(e.target.value)}
              onBlur={logic.handleSaveName}
              onKeyDown={(e) => { if (e.key === 'Enter') logic.handleSaveName(); }}
              autoFocus
              className="nodrag"
              style={{
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(168, 85, 247, 0.6)',
                borderRadius: '4px',
                padding: '2px 6px',
                color: '#fff',
                fontSize: '13px',
                fontWeight: 600,
                width: '180px',
                outline: 'none'
              }}
            />
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
              <span
                onDoubleClick={() => logic.setIsEditingName(true)}
                style={{ fontWeight: 600, fontSize: '13px', letterSpacing: '0.5px', cursor: 'text' }}
                title="双击以重命名"
              >
                {logic.localName}
              </span>
              <span
                onClick={() => logic.setIsEditingName(true)}
                style={{ cursor: 'pointer', opacity: 0.5, fontSize: '11px', userSelect: 'none' }}
                title="点击重命名"
              >
                ✏️
              </span>
            </div>
          )}
        </div>
        <button
          onClick={logic.handleDelete}
          style={{
            width: '20px',
            height: '20px',
            borderRadius: '50%',
            background: 'rgba(239, 68, 68, 0.1)',
            border: '1px solid rgba(239, 68, 68, 0.2)',
            color: '#ef4444',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            fontSize: '11px',
            cursor: 'pointer',
            padding: 0
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.3)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
        >
          ×
        </button>
      </div>

      {/* 双态条件渲染 */}
      {!logic.isEditing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, justifyContent: 'center' }}>
          <div style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)', textAlign: 'center', marginBottom: '4px' }}>
            {logic.textVal.trim() ? '📖 已配置剧本 (点击下方修改)' : '💡 剧本为空，选择操作以开始：'}
          </div>
          <button
            onClick={(e) => { e.stopPropagation(); logic.setIsEditing(true); }}
            style={{
              width: '100%',
              padding: '10px 12px',
              borderRadius: '8px',
              background: 'rgba(255, 255, 255, 0.05)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#fff',
              fontSize: '12px',
              fontWeight: 'bold',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.1)'}
            onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)'}
          >
            {logic.textVal.trim() ? '✍️ 点击修改剧本内容' : '✍️ 点击自己编写剧本'}
          </button>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px', width: '100%' }}>
            <button
              onClick={(e) => { e.stopPropagation(); logic.handleSpawnUploadNode(); }}
              style={{
                padding: '10px 8px',
                borderRadius: '8px',
                background: 'rgba(168, 85, 247, 0.12)',
                border: '1px solid rgba(168, 85, 247, 0.25)',
                color: '#e9d5ff',
                fontSize: '11px',
                fontWeight: 'bold',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                gap: '4px'
              }}
              onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(168, 85, 247, 0.25)'}
              onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(168, 85, 247, 0.12)'}
            >
              📷 图像反推提示词
            </button>
          </div>
        </div>
      ) : (
        <>
          {/* 顶部格式工具栏 */}
          <div style={{ display: 'flex', gap: '8px', marginBottom: '8px', background: 'rgba(255,255,255,0.03)', padding: '6px 8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)', alignItems: 'center' }}>
            <button onClick={() => {
              const textarea = document.getElementById(`textarea-${id}`) as HTMLTextAreaElement;
              if (!textarea) return;
              const start = textarea.selectionStart;
              const end = textarea.selectionEnd;
              const selectedText = textarea.value.substring(start, end);
              const replacement = `**${selectedText || '加粗文本'}**`;
              const newVal = textarea.value.substring(0, start) + replacement + textarea.value.substring(end);
              logic.handleTextChange(newVal);
            }} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '11px', fontWeight: 'bold', cursor: 'pointer', padding: '2px 6px' }} title="加粗">B</button>

            <button onClick={() => {
              const textarea = document.getElementById(`textarea-${id}`) as HTMLTextAreaElement;
              if (!textarea) return;
              const start = textarea.selectionStart;
              const end = textarea.selectionEnd;
              const selectedText = textarea.value.substring(start, end);
              const replacement = `*${selectedText || '斜体文本'}*`;
              const newVal = textarea.value.substring(0, start) + replacement + textarea.value.substring(end);
              logic.handleTextChange(newVal);
            }} style={{ background: 'none', border: 'none', color: '#fff', fontSize: '11px', fontStyle: 'italic', cursor: 'pointer', padding: '2px 6px' }} title="斜体">I</button>

            <select onChange={(e) => {
              const textarea = document.getElementById(`textarea-${id}`) as HTMLTextAreaElement;
              if (!textarea) return;
              textarea.style.fontSize = e.target.value;
            }} style={{ background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.1)', color: '#fff', fontSize: '10px', padding: '2px 4px', borderRadius: '4px', outline: 'none', cursor: 'pointer' }} title="文字大小">
              <option value="12px">小 (12px)</option>
              <option value="14px">中 (14px)</option>
              <option value="18px">大 (18px)</option>
              <option value="24px">超大 (24px)</option>
            </select>

            <div style={{ width: '1px', height: '14px', background: 'rgba(255,255,255,0.1)' }} />

            <button onClick={() => logic.setShowTableEditor(!logic.showTableEditor)} style={{ background: logic.showTableEditor ? 'rgba(168,85,247,0.2)' : 'none', border: 'none', color: logic.showTableEditor ? '#c084fc' : '#fff', fontSize: '11px', cursor: 'pointer', padding: '2px 6px', display: 'flex', alignItems: 'center', gap: '3px' }} title="可视化表格分镜编辑器">
              📊 表格编辑
            </button>
          </div>

          {/* 可视化表格编辑器 */}
          {logic.showTableEditor ? (
            <div className="nodrag" style={{ display: 'flex', flexDirection: 'column', gap: '8px', flex: 1, maxHeight: '180px', overflowY: 'auto', background: 'rgba(0,0,0,0.25)', padding: '10px', borderRadius: '8px', border: '1px solid rgba(255,255,255,0.06)' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', fontWeight: 'bold', color: 'rgba(255,255,255,0.5)' }}>🎬 镜头分镜可视化编辑器</span>
                <button onClick={logic.handleAddTableRow} style={{ padding: '2px 8px', background: 'rgba(168,85,247,0.2)', border: '1px solid rgba(168,85,247,0.4)', borderRadius: '4px', color: '#fff', fontSize: '9px', cursor: 'pointer' }}>+ 新增分镜</button>
              </div>

              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '10px' }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
                    <th style={{ textAlign: 'left', padding: '4px', color: 'rgba(255,255,255,0.4)' }}>分镜</th>
                    <th style={{ textAlign: 'left', padding: '4px', color: 'rgba(255,255,255,0.4)' }}>画面描述</th>
                    <th style={{ textAlign: 'left', padding: '4px', color: 'rgba(255,255,255,0.4)' }}>旁白台词</th>
                    <th style={{ textAlign: 'center', padding: '4px', color: 'rgba(255,255,255,0.4)' }}>操作</th>
                  </tr>
                </thead>
                <tbody>
                  {logic.tableRows.map((row, idx) => (
                    <tr key={idx} style={{ borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                      <td style={{ padding: '2px' }}>
                        <input value={row.scene} onChange={(e) => logic.handleUpdateTableCell(idx, 'scene', e.target.value)} style={{ width: '30px', background: 'none', border: 'none', color: '#fff', outline: 'none' }} />
                      </td>
                      <td style={{ padding: '2px' }}>
                        <input value={row.prompt} onChange={(e) => logic.handleUpdateTableCell(idx, 'prompt', e.target.value)} placeholder="微风拂过湖面..." style={{ width: '90px', background: 'none', border: 'none', color: '#fff', outline: 'none' }} />
                      </td>
                      <td style={{ padding: '2px' }}>
                        <input value={row.tts} onChange={(e) => logic.handleUpdateTableCell(idx, 'tts', e.target.value)} placeholder="台词旁白..." style={{ width: '90px', background: 'none', border: 'none', color: '#fff', outline: 'none' }} />
                      </td>
                      <td style={{ padding: '2px', textAlign: 'center' }}>
                        <button onClick={() => logic.handleRemoveTableRow(idx)} style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', fontSize: '11px' }}>×</button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            /* 大型文本编辑器 */
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, minHeight: '100px' }}>
              <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.5)' }}>编辑剧本/小说原文 (支持复制粘贴):</span>
              <textarea
                id={`textarea-${id}`}
                value={logic.textVal}
                className="nodrag custom-scrollbar"
                onMouseDown={(e) => e.stopPropagation()}
                onChange={(e) => logic.handleTextChange(e.target.value)}
                placeholder="在此编写剧本描述，或者通过下方按钮优化与反推提示词..."
                style={{
                  width: '100%',
                  height: '200px',
                  minHeight: '120px',
                  background: 'rgba(0,0,0,0.3)',
                  border: '1px solid rgba(255,255,255,0.08)',
                  borderRadius: '8px',
                  outline: 'none',
                  resize: 'none',
                  color: '#fff',
                  fontSize: '12px',
                  lineHeight: '1.5',
                  padding: '8px 12px',
                  fontFamily: 'var(--font-sans)',
                  overflowY: 'auto'
                }}
              />
            </div>
          )}
        </>
      )}

      {/* ReactFlow 连接桩 Handle */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        style={{
          ...HANDLE_STYLE,
          left: '-12px',
          opacity: selected ? 1 : 0,
          pointerEvents: selected ? 'all' : 'none',
          visibility: selected ? 'visible' : 'hidden',
          borderColor: logic.connectedImage ? 'rgba(168, 85, 247, 1)' : 'rgba(255,255,255,0.2)',
          boxShadow: logic.connectedImage ? '0 0 10px rgba(168, 85, 247, 0.45)' : 'none'
        }}
      >
        <span style={{ fontSize: '13px', pointerEvents: 'none', transform: 'translateY(-1.5px)', display: 'block', fontWeight: 'bold' }}>+</span>
      </Handle>

      <Handle
        type="source"
        position={Position.Right}
        id="output"
        style={{
          ...HANDLE_STYLE,
          right: '-12px',
          opacity: selected ? 1 : 0,
          pointerEvents: selected ? 'all' : 'none',
          visibility: selected ? 'visible' : 'hidden'
        }}
      >
        <span style={{ fontSize: '13px', pointerEvents: 'none', transform: 'translateY(-1.5px)', display: 'block', fontWeight: 'bold' }}>+</span>
      </Handle>

      {/* 选中态底部悬浮配置面板 */}
      {selected && !isMultiSelected && (
        <div
          className="nodrag"
          style={{
            position: 'absolute',
            top: 'calc(100% + 12px)',
            left: '50%',
            transform: 'translateX(-50%)',
            width: '580px',
            background: 'rgba(11, 15, 26, 0.95)',
            backdropFilter: 'blur(24px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 20px 50px rgba(0, 0, 0, 0.65), 0 0 30px rgba(168, 85, 247, 0.1)',
            borderRadius: '16px',
            padding: '12px 14px',
            display: 'flex',
            flexDirection: 'column',
            gap: '8px',
            zIndex: 2000,
            animation: 'slideUpTextNode 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
          }}
        >
          <style>{`
            @keyframes slideUpTextNode {
              from { transform: translate(-50%, 15px); opacity: 0; }
              to { transform: translate(-50%, 0); opacity: 1; }
            }
            .pill-capsule-button {
              background: rgba(255, 255, 255, 0.04);
              border: 1px solid rgba(255, 255, 255, 0.06);
              border-radius: 20px;
              color: rgba(255, 255, 255, 0.7);
              padding: 4px 10px;
              font-size: 10.5px;
              font-weight: 600;
              cursor: pointer;
              display: flex;
              align-items: center;
              justify-content: center;
              gap: 4px;
              transition: all 0.2s;
              outline: none;
            }
            .pill-capsule-button:hover, .pill-capsule-button.active {
              background: rgba(168, 85, 247, 0.15);
              border-color: rgba(168, 85, 247, 0.45);
              color: #fff;
            }
            .popover-floating-card {
              position: absolute;
              bottom: calc(100% + 8px);
              left: 50%;
              transform: translateX(-50%);
              width: 300px;
              background: rgba(11, 15, 26, 0.98);
              backdrop-filter: blur(24px);
              border: 1px solid rgba(255, 255, 255, 0.1);
              border-radius: 12px;
              box-shadow: 0 15px 35px rgba(0,0,0,0.5), 0 0 20px rgba(168, 85, 247, 0.15);
              padding: 12px;
              display: flex;
              flex-direction: column;
              gap: 10px;
              z-index: 2005;
              animation: popoverFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
            }
            @keyframes popoverFadeIn {
              from { transform: translate(-50%, 8px); opacity: 0; }
              to { transform: translate(-50%, 0); opacity: 1; }
            }
            .popover-floating-card::after {
              content: '';
              position: absolute;
              top: 100%;
              left: 50%;
              transform: translateX(-50%);
              border-width: 6px;
              border-style: solid;
              border-color: rgba(11, 15, 26, 0.98) transparent transparent transparent;
            }
            .hover-vendor-item {
              display: flex;
              justify-content: space-between;
              align-items: center;
              padding: 6px 8px;
              border-radius: 6px;
              cursor: pointer;
              font-size: 11px;
              color: rgba(255,255,255,0.7);
              transition: all 0.2s;
              position: relative;
            }
            .hover-vendor-item:hover, .hover-vendor-item.active {
              background: rgba(168, 85, 247, 0.15);
              color: #fff;
            }
            .sub-model-list-hover {
              position: absolute;
              left: calc(100% + 4px);
              top: 0;
              width: 170px;
              background: rgba(11, 15, 26, 0.98);
              border: 1px solid rgba(255, 255, 255, 0.1);
              border-radius: 8px;
              padding: 6px;
              flex-direction: column;
              gap: 4px;
              box-shadow: 0 10px 25px rgba(0,0,0,0.4);
              z-index: 2010;
              visibility: hidden;
              opacity: 0;
              transition: visibility 0.2s ease 0.15s, opacity 0.2s ease 0.15s;
            }
            .hover-vendor-item:hover > .sub-model-list-hover {
              visibility: visible;
              opacity: 1;
              transition: visibility 0s, opacity 0.1s ease 0s;
            }
            .sub-model-list-hover:hover {
              visibility: visible;
              opacity: 1;
              transition: visibility 0s, opacity 0.1s ease 0s;
            }
            .sub-model-list-hover button:hover {
              background: rgba(168, 85, 247, 0.15) !important;
            }
          `}</style>

          {/* Row 1: 极简极窄生图控制行 */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center', position: 'relative' }}>
            <button
              onClick={() => setActivePopover(activePopover === 'reference' ? null : 'reference')}
              title={logic.connectedImage ? "查看已连接参考图" : "关联左侧参考图"}
              style={{
                width: '30px',
                height: '30px',
                borderRadius: '8px',
                background: logic.connectedImage ? 'rgba(168, 85, 247, 0.1)' : 'rgba(255,255,255,0.03)',
                border: logic.connectedImage ? '1.5px solid rgba(168, 85, 247, 0.7)' : '1px dashed rgba(255,255,255,0.15)',
                color: logic.connectedImage ? '#c084fc' : 'rgba(255,255,255,0.4)',
                fontSize: '13px',
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                outline: 'none',
                flexShrink: 0,
                transition: 'all 0.2s'
              }}
            >
              {logic.connectedImage ? '🖼️' : '＋'}
            </button>

            <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
              <textarea
                value={logic.textVal}
                onChange={(e) => logic.handleTextChange(e.target.value)}
                className="nodrag custom-scrollbar"
                onMouseDown={(e) => e.stopPropagation()}
                placeholder="在此编写剧本描述，或者通过下方按钮优化与反推提示词..."
                style={{
                  width: '100%',
                  height: '30px',
                  background: 'rgba(255, 255, 255, 0.03)',
                  border: '1px solid rgba(255, 255, 255, 0.08)',
                  borderRadius: '8px',
                  outline: 'none',
                  resize: 'none',
                  color: '#fff',
                  fontSize: '11px',
                  lineHeight: '1.4',
                  padding: '5px 10px',
                  fontFamily: 'var(--font-sans)',
                  overflowY: 'auto',
                  transition: 'all 0.2s'
                }}
                onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.4)'}
                onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'}
              />
            </div>

            <button
              onClick={logic.handleGenerate}
              disabled={logic.generating}
              style={{
                background: 'linear-gradient(135deg, hsl(262, 83%, 58%) 0%, hsl(316, 73%, 52%) 100%)',
                border: 'none',
                borderRadius: '20px',
                color: '#fff',
                padding: '5px 14px',
                fontSize: '11px',
                fontWeight: 700,
                cursor: 'pointer',
                boxShadow: '0 4px 12px rgba(168, 85, 247, 0.3)',
                whiteSpace: 'nowrap',
                display: 'flex',
                alignItems: 'center',
                gap: '4px',
                outline: 'none',
                flexShrink: 0
              }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 6px 16px rgba(168, 85, 247, 0.45)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(168, 85, 247, 0.3)'; }}
            >
              {logic.generating ? '正在优化...' : (logic.connectedImage ? '开始反推' : '开始优化')}
            </button>
          </div>

          <hr style={{ border: 'none', borderTop: '1px solid rgba(255, 255, 255, 0.05)', margin: '2px 0' }} />

          {/* Row 2: 极简胶囊 Pill 按钮组 */}
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button
              className={`pill-capsule-button ${activePopover === 'model' ? 'active' : ''}`}
              onClick={() => setActivePopover(activePopover === 'model' ? null : 'model')}
            >
              🌐 模型: {logic.selectedModel} ▼
            </button>

            <button
              className={`pill-capsule-button ${activePopover === 'mode' ? 'active' : ''}`}
              onClick={() => setActivePopover(activePopover === 'mode' ? null : 'mode')}
            >
              ⚙️ 模式: {logic.currentMode === 'text' ? '智能剧本' : '音乐歌词'} ▼
            </button>

            <button
              className={`pill-capsule-button ${activePopover === 'reference' ? 'active' : ''}`}
              onClick={() => setActivePopover(activePopover === 'reference' ? null : 'reference')}
            >
              📷 参考图: {logic.connectedImage ? '已连接' : '未连接'} ▼
            </button>

            <div style={{ flex: 1 }} />

            <button
              onClick={logic.handleSpawnImageService}
              style={{
                background: 'rgba(255,255,255,0.02)',
                border: '1px solid rgba(255,255,255,0.06)',
                borderRadius: '12px',
                padding: '2px 8px',
                fontSize: '9.5px',
                color: 'rgba(255,255,255,0.6)',
                cursor: 'pointer',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.color = '#fff'; e.currentTarget.style.background = 'rgba(255,255,255,0.06)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.color = 'rgba(255,255,255,0.6)'; e.currentTarget.style.background = 'rgba(255,255,255,0.02)'; }}
            >
              🎨 文生图助手
            </button>
          </div>

          {/* Popovers 浮窗 */}
          {activePopover === 'model' && (
            <div className="popover-floating-card" style={{ width: '220px', left: '15%' }}>
              {logic.currentMode === 'text' ? (
                <>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', fontWeight: 'bold', paddingBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    🤖 通用语言大模型服务商
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                    {chatProviders.map(v => (
                      <div
                        key={v.id}
                        className={`hover-vendor-item ${activeVendor === v.id ? 'active' : ''}`}
                        onClick={() => {
                          setActiveVendor(v.id);
                          onModelChange(getModelsForVendor(v.id)[0] || '');
                        }}
                      >
                        <span>{v.name}</span>
                        <span style={{ fontSize: '8px', opacity: 0.5 }}>▶</span>

                        <div className="sub-model-list-hover">
                          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.45)', padding: '2px 4px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: '4px' }}>
                            选择具体模型：
                          </div>
                          {getModelsForVendor(v.id).map((m: string) => (
                            <button
                              key={m}
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveVendor(v.id);
                                handleVendorChange(v.id);
                                onModelChange(m);
                                logic.doModelChange(m);
                                setActivePopover(null);
                              }}
                              style={{
                                background: logic.selectedModel === m ? 'rgba(168, 85, 247, 0.25)' : 'transparent',
                                border: 'none',
                                borderRadius: '4px',
                                color: logic.selectedModel === m ? '#fff' : 'rgba(255,255,255,0.7)',
                                fontSize: '9.5px',
                                padding: '4px 6px',
                                textAlign: 'left',
                                cursor: 'pointer',
                                width: '100%'
                              }}
                            >
                              {m}
                            </button>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <>
                  <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', fontWeight: 'bold', paddingBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                    🎵 歌词音乐生成模型
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                    {LYRIC_MODELS.map(m => (
                      <button
                        key={m}
                        onClick={() => {
                          logic.doModelChange(m);
                          setActivePopover(null);
                        }}
                        style={{
                          background: logic.selectedModel === m ? 'rgba(168, 85, 247, 0.25)' : 'rgba(255,255,255,0.02)',
                          border: 'none',
                          borderRadius: '4px',
                          color: logic.selectedModel === m ? '#fff' : 'rgba(255,255,255,0.7)',
                          fontSize: '9.5px',
                          padding: '6px 8px',
                          textAlign: 'center',
                          cursor: 'pointer',
                          width: '100%',
                          transition: 'all 0.15s'
                        }}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </div>
          )}

          {activePopover === 'mode' && (
            <div className="popover-floating-card" style={{ width: '200px', left: '42%' }}>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', fontWeight: 'bold', paddingBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                ⚙️ 切换工作模式
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                {WORK_MODES.map(m => {
                  const isSel = logic.currentMode === m.id;
                  return (
                    <button
                      key={m.id}
                      onClick={() => logic.handleModeChange(m.id)}
                      style={{
                        background: isSel ? 'rgba(168, 85, 247, 0.25)' : 'rgba(255,255,255,0.02)',
                        border: 'none',
                        borderRadius: '6px',
                        color: isSel ? '#fff' : 'rgba(255,255,255,0.7)',
                        fontSize: '10px',
                        padding: '6px 8px',
                        cursor: 'pointer',
                        textAlign: 'left',
                        transition: 'all 0.15s'
                      }}
                    >
                      {m.label}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {activePopover === 'reference' && (
            <div className="popover-floating-card" style={{ width: '220px', left: '68%' }}>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', fontWeight: 'bold', paddingBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                📷 图像反推提示词参考源
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px', alignItems: 'center' }}>
                {logic.connectedImage ? (
                  <div style={{ position: 'relative', width: '100%', height: '100%', minHeight: '100px', borderRadius: '6px', overflow: 'hidden', border: '1px solid rgba(255,255,255,0.1)' }}>
                    <ResolvedMedia url={logic.connectedImage} type="image" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(168, 85, 247, 0.9)', color: '#fff', fontSize: '8.5px', textAlign: 'center', padding: '2px 0', fontWeight: 'bold' }}>
                      已成功关联参考图
                    </div>
                  </div>
                ) : (
                  <div
                    onClick={() => {
                      logic.handleSpawnUploadNode();
                      setActivePopover(null);
                    }}
                    style={{
                      width: '100%',
                      height: '80px',
                      borderRadius: '8px',
                      border: '1.5px dashed rgba(255,255,255,0.15)',
                      background: 'rgba(255,255,255,0.02)',
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      cursor: 'pointer',
                      gap: '4px',
                      transition: 'all 0.2s'
                    }}
                    onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.5)'; }}
                    onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)'; }}
                  >
                    <span style={{ fontSize: '18px' }}>＋</span>
                    <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)' }}>连线并关联左侧参考图</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* 左右翼智能管线导流舱 */}
      <DeriveWings id={id} downstreamTypes={logic.downstreamTypes} />
    </div>
  );
}

// 左右翼组件（拆分出来减少主文件行数）
function DeriveWings({ id, downstreamTypes }: { id: string; downstreamTypes: any[] }) {
  const [showRightDerive, setShowRightDerive] = useState(false);

  return (
    <>
      <style>{`
        .derive-wing-btn {
          pointer-events: all;
          width: 20px;
          height: 48px;
          border-radius: 6px;
          background: rgba(15, 23, 42, 0.9);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(168, 85, 247, 0.4);
          color: rgba(168, 85, 247, 1);
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 11px;
          cursor: pointer;
          box-shadow: 0 0 10px rgba(168, 85, 247, 0.25);
          transition: all 0.2s cubic-bezier(0.4, 0, 0.2, 1);
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          opacity: 0;
          padding: 0;
        }
        .glass-panel:hover .derive-wing-btn,
        .glass-panel:focus-within .derive-wing-btn {
          opacity: 1;
        }
        .derive-wing-btn:hover {
          background: rgba(168, 85, 247, 0.95);
          color: #fff;
          border-color: #fff;
          box-shadow: 0 0 18px rgba(168, 85, 247, 0.75);
        }
        .derive-menu-list {
          position: absolute;
          top: 50%;
          transform: translateY(-50%);
          background: rgba(11, 15, 25, 0.98);
          backdrop-filter: blur(20px);
          border: 1px solid rgba(168, 85, 247, 0.5);
          border-radius: 8px;
          padding: 4px;
          display: flex;
          flex-direction: column;
          gap: 4px;
          box-shadow: 0 10px 30px rgba(0, 0, 0, 0.75), 0 0 20px rgba(168, 85, 247, 0.3);
          z-index: 100;
          pointer-events: all;
          animation: fadeIn 0.15s ease-out;
          width: 130px;
        }
        .derive-menu-item {
          width: 100%;
          padding: 6px 10px;
          border: none;
          background: transparent;
          color: rgba(255, 255, 255, 0.85);
          font-size: 11px;
          font-weight: 500;
          text-align: left;
          cursor: pointer;
          border-radius: 6px;
          transition: all 0.15s;
        }
        .derive-menu-item:hover {
          background: rgba(168, 85, 247, 0.2);
          color: #fff;
          transform: translateX(3px);
        }
      `}</style>

      <div className="derive-wings-overlay" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 40, display: 'none' }}>
        {/* 右翼：派生 */}
        {downstreamTypes.length > 0 && (
          <div style={{ position: 'absolute', right: '-22px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <button
              className="derive-wing-btn"
              onClick={() => { setShowRightDerive(!showRightDerive); }}
              title="一键派生下游输出"
            >
              ▶
            </button>
            {showRightDerive && (
              <div className="derive-menu-list" style={{ left: '28px' }}>
                <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold', padding: '4px 8px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>⚡ 派生下游成果:</div>
                {downstreamTypes.map(down => (
                  <button
                    key={down.type}
                    className="derive-menu-item"
                    onClick={() => {
                      if (typeof (window as any).handleDeriveNode === 'function') {
                        (window as any).handleDeriveNode(id, down.type, 'downstream');
                      }
                      setShowRightDerive(false);
                    }}
                  >
                    {down.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>
    </>
  );
}
