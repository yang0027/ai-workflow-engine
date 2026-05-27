import React, { useState, useEffect, useMemo } from 'react';
import { Handle, Position, useReactFlow, useStore, useNodes } from '@xyflow/react';

interface LoopNodeProps {
  id: string;
  data: {
    label?: string;
    progress?: number;
    inputs?: {
      loopSource?: 'manual' | 'upstream';
      manualCount?: number;
      runMode?: 'sequential' | 'concurrent';
      maxConcurrent?: number;
      [key: string]: any;
    };
    outputs?: {
      currentIndex?: number;
      total?: number;
      currentVariables?: any;
      errorMsg?: string;
    };
  };
  selected?: boolean;
}

export default function LoopNode({ id, data, selected }: LoopNodeProps) {
  const { setNodes, setEdges } = useReactFlow();
  const nodes = useNodes();
  const edges = useStore((state) => state.edges);

  // 多选检测：只有单选时才显示菜单
  const isMultiSelected = useStore((state) => {
    return state.nodes.filter(n => n.selected).length > 1;
  });

  // 1. 扫描上游连线，看是否有 LLM 节点或者文本节点连入
  const connectedInput = useMemo(() => {
    const edge = edges.find(e => e.target === id && e.targetHandle === 'input');
    if (!edge) return null;
    const srcNode = nodes.find(n => n.id === edge.source);
    if (!srcNode) return null;
    const outputs = srcNode.data?.outputs as any || {};
    return outputs.storyboard || outputs.outputUrl || outputs.output || (srcNode.data as any)?.inputs?.text || null;
  }, [edges, nodes, id]);

  const hasUpstreamSource = !!connectedInput;

  // 2. 状态值初始化
  const loopSource = data.inputs?.loopSource || (hasUpstreamSource ? 'upstream' : 'manual');
  const manualCount = data.inputs?.manualCount || 3;
  const runMode = data.inputs?.runMode || 'concurrent';
  const maxConcurrent = data.inputs?.maxConcurrent || 3;

  // 双击重命名逻辑与状态对齐
  const [isEditingName, setIsEditingName] = useState(false);
  const [localName, setLocalName] = useState(data.label || '批量循环迭代');

  useEffect(() => {
    setLocalName(data.label || '批量循环迭代');
  }, [data.label]);

  const handleSaveName = () => {
    setIsEditingName(false);
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === id) {
          return {
            ...n,
            data: {
              ...n.data,
              label: localName
            }
          };
        }
        return n;
      })
    );
  };

  const updateNodeInputs = (updates: any) => {
    setNodes((nds) =>
      nds.map((n) => {
        if (n.id === id) {
          return {
            ...n,
            data: {
              ...n.data,
              inputs: {
                ...((n.data as any)?.inputs || {}),
                ...updates
              }
            }
          };
        }
        return n;
      })
    );
  };

  const handleInputChange = (field: string, val: any) => {
    updateNodeInputs({ [field]: val });
  };

  // 微量步进器控制
  const decrementManual = () => {
    const newVal = Math.max(1, manualCount - 1);
    updateNodeInputs({ manualCount: newVal });
  };
  const incrementManual = () => {
    const newVal = Math.min(10, manualCount + 1);
    updateNodeInputs({ manualCount: newVal });
  };

  const decrementConcurrent = () => {
    const newVal = Math.max(1, maxConcurrent - 1);
    updateNodeInputs({ maxConcurrent: newVal });
  };
  const incrementConcurrent = () => {
    const newVal = Math.min(5, maxConcurrent + 1);
    updateNodeInputs({ maxConcurrent: newVal });
  };

  // 进度控制
  const currentIndex = data.outputs?.currentIndex || 0;
  const total = data.outputs?.total || 0;
  const progressPct = total > 0 ? Math.round((currentIndex / total) * 100) : 0;
  const isRunning = data.outputs?.currentIndex !== undefined && currentIndex < total && currentIndex > 0;

  // 根据数据源解析当前的循环项目数
  const parsedCount = useMemo(() => {
    if (loopSource === 'manual') {
      return manualCount;
    }
    if (!connectedInput) return 0;
    try {
      const parsed = JSON.parse(connectedInput.trim());
      if (Array.isArray(parsed)) return parsed.length;
    } catch (e) {
      return connectedInput.split('\n').filter((l: string) => l.trim()).length;
    }
    return 0;
  }, [loopSource, manualCount, connectedInput]);

  // 与生图/视频等节点对齐的高保真大 Handle 样式（火红控制流色系）
  const handleStyle: React.CSSProperties = {
    width: '24px',
    height: '24px',
    background: 'rgba(15, 23, 42, 0.95)',
    border: '1.5px solid rgba(244, 63, 94, 0.85)',
    borderRadius: '50%',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: 'rgba(244, 63, 94, 1)',
    cursor: 'crosshair',
    boxShadow: '0 0 10px rgba(244, 63, 94, 0.45)',
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
    <div
      className="loop-node-container"
      style={{
        width: '180px',
        height: '180px',
        background: 'linear-gradient(135deg, rgba(17, 24, 39, 0.95) 0%, rgba(11, 15, 26, 0.98) 100%)',
        borderRadius: '16px',
        padding: '12px',
        border: selected 
          ? '2px solid hsl(var(--accent-secondary))' 
          : '1px solid rgba(255,255,255,0.08)',
        boxShadow: selected
          ? '0 0 25px rgba(244, 63, 94, 0.25), 0 20px 40px rgba(0, 0, 0, 0.6)'
          : '0 10px 30px rgba(0, 0, 0, 0.5)',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'space-between',
        position: 'relative',
        transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
        overflow: 'visible'
      }}
    >
      {/* 物理删除悬浮按钮 */}
      {selected && !isMultiSelected && (
        <button
          onClick={() => {
            setNodes((nds) => nds.filter((n) => n.id !== id));
            setEdges((eds) => eds.filter((e) => e.source !== id && e.target !== id));
          }}
          style={{
            position: 'absolute',
            top: '-28px',
            right: '0px',
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
            padding: 0,
            zIndex: 10
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.3)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
        >
          ×
        </button>
      )}

      {/* 悬浮重命名 Label，完全物理对齐 100% 一致体验 */}
      {isEditingName ? (
        <input
          value={localName}
          onChange={(e) => setLocalName(e.target.value)}
          onBlur={handleSaveName}
          onKeyDown={(e) => {
            if (e.key === 'Enter') handleSaveName();
          }}
          autoFocus
          className="nodrag"
          style={{
            position: 'absolute',
            top: '-28px',
            left: '12px',
            background: 'rgba(0,0,0,0.3)',
            border: '1px solid rgba(244, 63, 94, 0.6)',
            borderRadius: '4px',
            padding: '2px 6px',
            color: '#fff',
            fontSize: '11px',
            fontWeight: 700,
            width: '120px',
            outline: 'none',
            zIndex: 15
          }}
        />
      ) : (
        <div 
          style={{
            position: 'absolute',
            top: '-24px',
            left: '12px',
            fontSize: '11px',
            fontWeight: 700,
            color: 'rgba(244, 63, 94, 0.9)',
            textTransform: 'uppercase',
            letterSpacing: '1px',
            textShadow: '0 0 6px rgba(244, 63, 94, 0.45)',
            cursor: 'text',
            display: 'flex',
            alignItems: 'center',
            gap: '4px',
            zIndex: 15
          }}
          onDoubleClick={() => setIsEditingName(true)}
          title="双击以重命名"
        >
          <span>{localName}</span>
          <span
            onClick={(e) => { e.stopPropagation(); setIsEditingName(true); }}
            style={{ cursor: 'pointer', opacity: 0.5, fontSize: '9px', userSelect: 'none' }}
            title="点击重命名"
          >
            ✏️
          </span>
        </div>
      )}

      {/* Header 行 */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: '8.5px', fontWeight: 800, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.5px' }}>
          CONTROL NODE
        </span>
        <span style={{ fontSize: '10px' }}>🔄</span>
      </div>

      {/* 原地内嵌式配置面板，无需高级悬浮面板 */}
      {isRunning ? (
        /* 运行态自适应蜕变为高拟态圆环仪表盘 */
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', flex: 1, gap: '6px' }}>
          <div style={{ position: 'relative', width: '60px', height: '60px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <svg style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
              <circle cx="30" cy="30" r="26" stroke="rgba(255,255,255,0.04)" strokeWidth="3.5" fill="transparent" />
              <circle
                cx="30"
                cy="30"
                r="26"
                stroke="hsl(340, 85%, 55%)"
                strokeWidth="3.5"
                fill="transparent"
                strokeDasharray={`${2 * Math.PI * 26}`}
                strokeDashoffset={`${2 * Math.PI * 26 * (1 - progressPct / 100)}`}
                style={{ transition: 'stroke-dashoffset 0.35s ease' }}
              />
            </svg>
            <div style={{ position: 'absolute', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
              <span style={{ fontSize: '11px', fontWeight: 800, color: '#fff' }}>{currentIndex}</span>
              <hr style={{ border: 'none', borderTop: '1px solid rgba(255,255,255,0.2)', width: '14px', margin: '1px 0' }} />
              <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.45)' }}>{total}</span>
            </div>
          </div>
          <span style={{ fontSize: '10.5px', fontWeight: 700, color: '#fff' }}>
            {localName}
          </span>
        </div>
      ) : (
        /* 空闲态原地嵌入 4 行精致控制盘 */
        <div className="nodrag" style={{ display: 'flex', flexDirection: 'column', gap: '6px', flex: 1, justifyContent: 'center', marginTop: '4px' }}>
          {/* 1. 驱动来源切换 */}
          <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.2)', padding: '2px', borderRadius: '6px' }}>
            <button
              onClick={() => handleInputChange('loopSource', 'manual')}
              style={{
                flex: 1,
                background: loopSource === 'manual' ? 'rgba(244, 63, 94, 0.25)' : 'transparent',
                border: 'none',
                borderRadius: '4px',
                color: loopSource === 'manual' ? '#fff' : 'rgba(255,255,255,0.4)',
                fontSize: '8.5px',
                padding: '3px 0',
                cursor: 'pointer',
                fontWeight: 'bold',
                outline: 'none'
              }}
            >
              手动计数
            </button>
            <button
              onClick={() => handleInputChange('loopSource', 'upstream')}
              style={{
                flex: 1,
                background: loopSource === 'upstream' ? 'rgba(244, 63, 94, 0.25)' : 'transparent',
                border: 'none',
                borderRadius: '4px',
                color: loopSource === 'upstream' ? '#fff' : 'rgba(255,255,255,0.4)',
                fontSize: '8.5px',
                padding: '3px 0',
                cursor: 'pointer',
                fontWeight: 'bold',
                outline: 'none'
              }}
            >
              连线驱动
            </button>
          </div>

          {/* 2. 循环次数步进器或连线指标 */}
          {loopSource === 'manual' ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.15)', padding: '3px 6px', borderRadius: '6px' }}>
              <span style={{ fontSize: '8.5px', color: 'rgba(255,255,255,0.4)' }}>循环次数:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <button
                  onClick={decrementManual}
                  style={{ width: '15px', height: '15px', background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '3px', color: '#fff', fontSize: '9px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', outline: 'none' }}
                >
                  -
                </button>
                <span style={{ fontSize: '9.5px', fontWeight: 'bold', color: '#f43f5e', minWidth: '12px', textAlign: 'center' }}>
                  {manualCount}
                </span>
                <button
                  onClick={incrementManual}
                  style={{ width: '15px', height: '15px', background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '3px', color: '#fff', fontSize: '9px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', outline: 'none' }}
                >
                  +
                </button>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: '8.5px', color: hasUpstreamSource ? '#10b981' : '#f59e0b', background: 'rgba(0,0,0,0.15)', padding: '3px 6px', borderRadius: '6px', textAlign: 'center', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap' }}>
              {hasUpstreamSource ? `✅ 已读分镜: ${parsedCount}个` : '⚠️ 待左侧连线注入数组'}
            </div>
          )}

          {/* 3. 执行流控制切换 */}
          <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.2)', padding: '2px', borderRadius: '6px' }}>
            <button
              onClick={() => handleInputChange('runMode', 'sequential')}
              style={{
                flex: 1,
                background: runMode === 'sequential' ? 'rgba(244, 63, 94, 0.25)' : 'transparent',
                border: 'none',
                borderRadius: '4px',
                color: runMode === 'sequential' ? '#fff' : 'rgba(255,255,255,0.4)',
                fontSize: '8.5px',
                padding: '3px 0',
                cursor: 'pointer',
                fontWeight: 'bold',
                outline: 'none'
              }}
            >
              顺序串联
            </button>
            <button
              onClick={() => handleInputChange('runMode', 'concurrent')}
              style={{
                flex: 1,
                background: runMode === 'concurrent' ? 'rgba(244, 63, 94, 0.25)' : 'transparent',
                border: 'none',
                borderRadius: '4px',
                color: runMode === 'concurrent' ? '#fff' : 'rgba(255,255,255,0.4)',
                fontSize: '8.5px',
                padding: '3px 0',
                cursor: 'pointer',
                fontWeight: 'bold',
                outline: 'none'
              }}
            >
              并发暴击
            </button>
          </div>

          {/* 4. 最大并发步进器 */}
          {runMode === 'concurrent' ? (
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'rgba(0,0,0,0.15)', padding: '3px 6px', borderRadius: '6px' }}>
              <span style={{ fontSize: '8.5px', color: 'rgba(255,255,255,0.4)' }}>并发限制:</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '5px' }}>
                <button
                  onClick={decrementConcurrent}
                  style={{ width: '15px', height: '15px', background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '3px', color: '#fff', fontSize: '9px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', outline: 'none' }}
                >
                  -
                </button>
                <span style={{ fontSize: '9.5px', fontWeight: 'bold', color: '#f43f5e', minWidth: '12px', textAlign: 'center' }}>
                  {maxConcurrent}
                </span>
                <button
                  onClick={incrementConcurrent}
                  style={{ width: '15px', height: '15px', background: 'rgba(255,255,255,0.06)', border: 'none', borderRadius: '3px', color: '#fff', fontSize: '9px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', outline: 'none' }}
                >
                  +
                </button>
              </div>
            </div>
          ) : (
            <div style={{ fontSize: '8.5px', color: 'rgba(255,255,255,0.3)', background: 'rgba(0,0,0,0.15)', padding: '3.5px 6px', borderRadius: '6px', textAlign: 'center' }}>
              ➔ 串行出图，高自愈逐项生成
            </div>
          )}
        </div>
      )}

      {/* 底部小字动态标签（空闲态下显示） */}
      {!isRunning && (
        <div style={{ textAlign: 'center', fontSize: '8px', color: 'rgba(255,255,255,0.25)', borderTop: '1px solid rgba(255,255,255,0.04)', paddingTop: '4px', marginTop: '2px' }}>
          {localName}
        </div>
      )}

      {/* 嵌入高阶 CSS：控制 Handle 磁力自动吸附与高级过渡动画 */}
      <style>{`
        .loop-node-container .react-flow__handle {
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }
        .loop-node-container .react-flow__handle:hover {
          transform: translateY(-50%) scale(1.3) !important;
          background: rgba(244, 63, 94, 1) !important;
          border-color: #fff !important;
          box-shadow: 0 0 18px rgba(244, 63, 94, 0.95) !important;
        }
        .loop-node-container .react-flow__handle::after {
          content: '';
          position: absolute;
          top: -4px;
          left: -4px;
          right: -4px;
          bottom: -4px;
          border-radius: 50%;
          background: transparent;
          cursor: crosshair;
          z-index: 10;
        }
      `}</style>

      {/* ReactFlow 连接桩 Handle */}
      {/* 输入连接口 - 24px 大手柄，样式与生图节点完全统一 */}
      <Handle
        type="target"
        position={Position.Left}
        id="input"
        style={{
          ...handleStyle,
          left: '-12px',
          opacity: selected ? 1 : 0,
          pointerEvents: selected ? 'all' : 'none',
          visibility: selected ? 'visible' : 'hidden',
          borderColor: hasUpstreamSource ? 'rgba(244, 63, 94, 1)' : 'rgba(255,255,255,0.2)',
          boxShadow: hasUpstreamSource ? '0 0 10px rgba(244, 63, 94, 0.45)' : 'none'
        }}
      >
        <span style={{ fontSize: '13px', pointerEvents: 'none', transform: 'translateY(-1.5px)', display: 'block', fontWeight: 'bold' }}>+</span>
      </Handle>

      {/* 输出连接口 - 24px 大手柄 */}
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
        <span style={{ fontSize: '13px', pointerEvents: 'none', transform: 'translateY(-1.5px)', display: 'block', fontWeight: 'bold' }}>+</span>
      </Handle>
    </div>
  );
}
