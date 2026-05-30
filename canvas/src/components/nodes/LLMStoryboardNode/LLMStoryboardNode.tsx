// LLMStoryboardNode.tsx
// 剧本分镜专家节点 UI 组件

import { useState } from 'react';
import { Handle, Position, useReactFlow, useStore, useNodes } from '@xyflow/react';
import { useLLMStoryboardLogic } from './LLMStoryboardNode.logic';
import { LLMStoryboardNodeProps } from './LLMStoryboardNode.config';
import { WorkflowTextarea } from '../../WorkflowTextarea';

export default function LLMStoryboardNode({ id, data, selected }: LLMStoryboardNodeProps) {
  const { setNodes, deleteElements } = useReactFlow();
  const edges = useStore((state) => state.edges);
  const nodes = useNodes();

  // 1. 多选检测：只有单选时才显示菜单
  const isMultiSelected = useStore((state) => {
    return state.nodes.filter(n => n.selected).length > 1;
  });

  // 2. 引入高度解耦逻辑 Hooks
  const logic = useLLMStoryboardLogic({
    id,
    data,
    setNodes,
    deleteElements,
    edges,
    nodes
  });

  const {
    connectedPrompt,
    isPromptConnected,
    skills,
    parsing,
    parseResult,
    providerId,
    model,
    activeProviders,
    currentProviderModels,
    handleInputChange,
    handleDelete,
    handleManualParse,
    currentPrompt,
    skillId,
    temp,
    isLoopMode,
    loopPromptsText,
    currentIndex,
    autoStep,
    lines,
    activeLoopPrompt
  } = logic;

  // 3. 智能管线导流舱菜单状态
  const [showLeftDerive, setShowLeftDerive] = useState(false);
  const [showRightDerive, setShowRightDerive] = useState(false);

  const upstreamTypes = [
    { type: 'prompt-source', label: '📝 文本' }
  ];
  const downstreamTypes = [
    { type: 'image-service', label: '🎨 智能生图 Agent' },
    { type: 'tts-service', label: '🗣️ 声音克隆 Agent' }
  ];

  // 4. Handles 风格配置
  const handleStyle: React.CSSProperties = {
    width: '24px',
    height: '24px',
    background: 'rgba(15, 23, 42, 0.95)',
    border: '1.5px solid rgba(168, 85, 247, 0.85)',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'rgba(168, 85, 247, 1)',
    cursor: 'crosshair',
    boxShadow: '0 0 10px rgba(168, 85, 247, 0.45)',
    fontWeight: 'bold',
    fontSize: '14px',
    userSelect: 'none',
    lineHeight: '24px',
    top: '50%',
    transform: 'translateY(-50%)',
    position: 'absolute',
    transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
    zIndex: 10
  };

  return (
    <div className="glass-panel text-left custom-drag-handle" style={{
      width: '360px',
      background: 'rgba(15, 23, 42, 0.85)',
      border: selected 
        ? '1.5px solid rgba(168, 85, 247, 0.85)' 
        : '1px solid rgba(255, 255, 255, 0.08)',
      boxShadow: selected 
        ? '0 0 25px rgba(168, 85, 247, 0.35)' 
        : '0 8px 32px rgba(0, 0, 0, 0.4)',
      borderRadius: '12px',
      padding: '16px',
      color: '#fff',
      position: 'relative'
    }}>
      {/* 极简智能连接手柄 Left Input (+) */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        style={{
          ...handleStyle,
          left: '-12px',
          opacity: selected ? 1 : 0,
          pointerEvents: selected ? 'all' : 'none',
          visibility: selected ? 'visible' : 'hidden'
        }}
      >
        ＋
      </Handle>

      {/* 头部与物理删除 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '12px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
          <span style={{ fontSize: '16px' }}>🧠</span>
          <span style={{ fontWeight: 600, fontSize: '13px', letterSpacing: '0.5px' }}>剧本专家 (LLM Storyboard)</span>
        </div>
        <button
          onClick={handleDelete}
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

      {/* 双驱输入表单 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '10px', marginBottom: '12px' }}>
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '4px' }}>
            <span style={{ fontSize: '11px', color: 'hsl(var(--text-secondary))' }}>小说剧本小说输入源:</span>
            {isPromptConnected && (
              <span style={{ fontSize: '10px', color: '#a855f7', display: 'flex', alignItems: 'center', gap: '3px' }}>
                🔗 连线驱动中
              </span>
            )}
          </div>
          <WorkflowTextarea
            value={currentPrompt}
            disabled={isPromptConnected}
            onChange={(val) => handleInputChange('prompt', val)}
            mentionItems={connectedPrompt ? [{ id: `${id}-upstream-prompt`, name: '上游文本输入', type: 'text', token: '@[文本1] ' }] : []}
            placeholder="请输入剧本故事文本，或者将上游'文本'节点连接至左侧接口..."
            style={{
              height: '80px',
              background: isPromptConnected ? 'rgba(255,255,255,0.02)' : 'rgba(0,0,0,0.3)',
              border: isPromptConnected ? '1px dashed rgba(168, 85, 247, 0.3)' : '1px solid rgba(255, 255, 255, 0.08)',
              padding: '6px 10px',
              color: isPromptConnected ? '#a3a3a3' : '#fff'
            }}
          />
        </div>

        {/* 属性配置 */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px' }}>
          <div>
            <span style={{ fontSize: '10px', color: 'hsl(var(--text-muted))', display: 'block', marginBottom: '4px' }}>大模型服务商:</span>
            <select
              value={providerId}
              onChange={(e) => handleInputChange('providerId', e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '4px',
                padding: '4px 6px',
                color: '#fff',
                fontSize: '11px',
                outline: 'none'
              }}
            >
              {activeProviders.map(p => (
                <option key={p.id} value={p.id}>{p.icon} {p.name}</option>
              ))}
            </select>
          </div>
          <div>
            <span style={{ fontSize: '10px', color: 'hsl(var(--text-muted))', display: 'block', marginBottom: '4px' }}>对话模型:</span>
            <select
              value={model}
              onChange={(e) => handleInputChange('model', e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '4px',
                padding: '4px 6px',
                color: '#fff',
                fontSize: '11px',
                outline: 'none'
              }}
            >
              {currentProviderModels.map((m: string, i: number) => (
                <option key={i} value={m}>{m}</option>
              ))}
            </select>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 0.8fr', gap: '8px' }}>
          <div>
            <span style={{ fontSize: '10px', color: 'hsl(var(--text-muted))', display: 'block', marginBottom: '4px' }}>🧩 挂载技能提示词库 (Skill):</span>
            <select
              value={skillId}
              onChange={(e) => handleInputChange('skillId', e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(0,0,0,0.3)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: '4px',
                padding: '4px 6px',
                color: '#fff',
                fontSize: '11px',
                outline: 'none'
              }}
            >
              <option value="storyboard-expert">📖 剧本分镜解析专家 (默认)</option>
              {skills.map((s) => (
                <option key={s.id} value={s.id}>🧩 {s.name}</option>
              ))}
            </select>
          </div>
          <div>
            <span style={{ fontSize: '10px', color: 'hsl(var(--text-muted))', display: 'block', marginBottom: '4px' }}>温度 (0-1): {temp}</span>
            <input 
              type="range" 
              min="0" 
              max="1.2" 
              step="0.1" 
              value={temp}
              className="nodrag"
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => handleInputChange('temperature', parseFloat(e.target.value))}
              style={{
                width: '100%',
                accentColor: 'hsl(var(--accent-primary))',
                height: '4px',
                marginTop: '10px'
              }}
            />
          </div>
        </div>

        {/* 🔄 循环分镜输出工坊 (Loop & Sequence) */}
        <div style={{
          marginTop: '10px',
          padding: '10px',
          background: 'rgba(168, 85, 247, 0.05)',
          border: '1px solid rgba(168, 85, 247, 0.15)',
          borderRadius: '8px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px'
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: '11px', fontWeight: 700, color: '#e9d5ff', display: 'flex', alignItems: 'center', gap: '4px' }}>
              🔄 循环分镜提取流 (Sequence Mode)
            </span>
            <input
              type="checkbox"
              className="nodrag"
              onMouseDown={(e) => e.stopPropagation()}
              checked={isLoopMode}
              onChange={(e) => handleInputChange('isLoopMode', e.target.checked)}
              style={{ width: '13px', height: '13px', accentColor: 'rgba(168, 85, 247, 1)', cursor: 'pointer' }}
            />
          </div>

          {isLoopMode && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', animation: 'fadeIn 0.2s' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)' }}>多行分镜提示词:</span>
                <button
                  onClick={() => {
                    const text = data.outputs?.storyboard || parseResult || '';
                    if (text) {
                      const cleaned = text.split('\n')
                        .map(l => l.replace(/^\d+[\.\、\s]*/, '').trim())
                        .filter(Boolean)
                        .join('\n');
                      handleInputChange('loopPromptsText', cleaned || text);
                    } else {
                      alert('大模型暂无解析成果，请输入或执行解析后导入！');
                    }
                  }}
                  className="nodrag"
                  onMouseDown={(e) => e.stopPropagation()}
                  style={{
                    background: 'rgba(168, 85, 247, 0.2)',
                    border: '1px solid rgba(168, 85, 247, 0.4)',
                    color: '#fff',
                    fontSize: '9px',
                    padding: '2px 6px',
                    borderRadius: '4px',
                    cursor: 'pointer'
                  }}
                >
                  ⚡ 一键导入大模型成果
                </button>
              </div>

              <WorkflowTextarea
                value={loopPromptsText}
                onChange={(val) => handleInputChange('loopPromptsText', val)}
                placeholder="请输入分镜列表，每行一个分镜提示词..."
                style={{
                  height: '80px',
                  padding: '4px 8px',
                  border: '1px solid rgba(255,255,255,0.06)'
                }}
              />

              {/* 游标步进调节器 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.2)', padding: '4px 8px', borderRadius: '4px' }}>
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)' }}>
                  游标: <strong style={{ color: 'rgba(168, 85, 247, 1)' }}>{lines.length > 0 ? currentIndex + 1 : 0}</strong> / {lines.length}
                </span>

                <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                  <button
                    disabled={lines.length === 0}
                    onClick={() => handleInputChange('currentIndex', Math.max(0, currentIndex - 1))}
                    className="nodrag"
                    onMouseDown={(e) => e.stopPropagation()}
                    style={{
                      width: '20px', height: '20px',
                      borderRadius: '4px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: '11px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                  >
                    -
                  </button>
                  <button
                    disabled={lines.length === 0}
                    onClick={() => handleInputChange('currentIndex', Math.min(lines.length - 1, currentIndex + 1))}
                    className="nodrag"
                    onMouseDown={(e) => e.stopPropagation()}
                    style={{
                      width: '20px', height: '20px',
                      borderRadius: '4px',
                      background: 'rgba(255,255,255,0.05)',
                      border: '1px solid rgba(255,255,255,0.1)',
                      color: '#fff',
                      cursor: 'pointer',
                      fontSize: '11px',
                      display: 'flex', alignItems: 'center', justifyContent: 'center'
                    }}
                  >
                    +
                  </button>
                </div>
              </div>

              {/* 自动顺推循环 */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)' }}>⏳ 每次流转完成后自动顺推</span>
                <input
                  type="checkbox"
                  className="nodrag"
                  onMouseDown={(e) => e.stopPropagation()}
                  checked={autoStep}
                  onChange={(e) => handleInputChange('autoStep', e.target.checked)}
                  style={{ width: '12px', height: '12px', accentColor: 'rgba(168, 85, 247, 1)', cursor: 'pointer' }}
                />
              </div>

              {/* 预览当前发送项 */}
              {activeLoopPrompt && (
                <div style={{
                  padding: '6px',
                  background: 'rgba(168, 85, 247, 0.08)',
                  border: '1px dashed rgba(168, 85, 247, 0.2)',
                  borderRadius: '4px',
                  fontSize: '9.5px',
                  color: '#d4d4d8',
                  maxHeight: '40px',
                  overflowY: 'auto',
                  lineHeight: '1.3'
                }}>
                  📢 <strong>当前发送:</strong> {activeLoopPrompt}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* 智能微调运行按钮 */}
      <div style={{ marginBottom: '12px' }}>
        <button
          onClick={handleManualParse}
          disabled={parsing}
          style={{
            width: '100%',
            background: 'linear-gradient(135deg, hsl(var(--accent-primary)), hsl(var(--accent-secondary)))',
            border: 'none',
            borderRadius: '6px',
            color: '#fff',
            padding: '8px 0',
            fontSize: '12px',
            fontWeight: 600,
            cursor: 'pointer',
            boxShadow: '0 0 10px hsl(var(--accent-primary) / 0.2)'
          }}
        >
          {parsing ? '🧠 正在拆解分镜头...' : '🧠 一键执行分镜解析 Agent'}
        </button>
      </div>

      {/* 分镜输出与预览滚动区域 */}
      {(parseResult || data.outputs?.storyboard) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', animation: 'fadeIn 0.2s ease' }}>
          <span style={{ fontSize: '10px', color: 'hsl(var(--text-secondary))' }}>🎬 解析分镜预览成果:</span>
          <div style={{
            width: '100%',
            maxHeight: '120px',
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(255,255,255,0.06)',
            borderRadius: '6px',
            padding: '8px 10px',
            fontSize: '10px',
            color: '#d4d4d8',
            overflowY: 'auto',
            fontFamily: 'monospace',
            whiteSpace: 'pre-wrap',
            lineHeight: '1.4'
          }}>
            {parseResult || data.outputs?.storyboard}
          </div>
        </div>
      )}

      {/* 极简智能连接手柄 Right Output (+) */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        style={{
          ...handleStyle,
          right: '-12px',
          opacity: selected ? 1 : 0,
          pointerEvents: selected ? 'all' : 'none',
          visibility: selected ? 'visible' : 'hidden'
        }}
      >
        ＋
      </Handle>

      {/* 🧬 左右翼智能管线导流舱 (Derive Wings) */}
      <div 
        className="derive-wings-overlay"
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 40,
          display: 'none'
        }}
      >
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

        {/* 左翼：溯源 */}
        {upstreamTypes.length > 0 && (
          <div style={{ position: 'absolute', left: '-22px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <button 
              className="derive-wing-btn"
              onClick={() => { setShowLeftDerive(!showLeftDerive); setShowRightDerive(false); }}
              title="一键溯源上游输入"
            >
              ◀
            </button>
            {showLeftDerive && (
              <div className="derive-menu-list" style={{ right: '28px' }}>
                <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold', padding: '4px 8px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>🔌 接入上游输入:</div>
                {upstreamTypes.map(up => (
                  <button 
                    key={up.type} 
                    className="derive-menu-item"
                    onClick={() => {
                      if (typeof (window as any).handleDeriveNode === 'function') {
                        (window as any).handleDeriveNode(id, up.type, 'upstream');
                      }
                      setShowLeftDerive(false);
                    }}
                  >
                    {up.label}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}

        {/* 右翼：派生 */}
        {downstreamTypes.length > 0 && (
          <div style={{ position: 'absolute', right: '-22px', top: '50%', transform: 'translateY(-50%)', pointerEvents: 'none' }}>
            <button 
              className="derive-wing-btn"
              onClick={() => { setShowRightDerive(!showRightDerive); setShowLeftDerive(false); }}
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
    </div>
  );
}
