import React from 'react';
import { Handle, Position, useStore } from '@xyflow/react';
import { CustomWorkflowNodeProps } from './CustomWorkflowNode.config';
import { useCustomWorkflowNodeLogic } from './CustomWorkflowNode.logic';
import { ImageUploadArea } from '../../ImageUploadArea';
import { ConnectedImagePreview } from '../../ConnectedImagePreview';
import { ResolvedMedia } from '../../ResolvedMedia';
import { WorkflowTextarea } from '../../WorkflowTextarea';

export default function CustomWorkflowNode({ id, data, selected = false }: CustomWorkflowNodeProps) {
  const source = data.source || 'local_comfyui';
  const mappings = data.mappings || [];
  const outputUrl = data.outputs?.output || data.outputUrl || '';
  const isRunning = data.isRunning || false;

  // 多选检测：只有单选时才显示菜单（框选多个时隐藏菜单）
  const isMultiSelected = useStore((state) => {
    return state.nodes.filter(n => n.selected).length > 1;
  });

  // 使用物理剥离出的业务逻辑舱 Hook
  const logic = useCustomWorkflowNodeLogic({
    id,
    data,
    source,
    mappings,
    outputUrl,
    isRunning
  });

  return (
    <div
      className="relative text-left custom-workflow-node-container"
      style={{
        position: 'relative',
        width: '180px',
        height: '180px',
        userSelect: 'none'
      }}
    >
      {/* 物理删除悬浮按钮 */}
      {selected && !isMultiSelected && (
        <button
          onClick={logic.handleDelete}
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
            zIndex: 25
          }}
          onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.3)'}
          onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(239,68,68,0.1)'}
        >
          ×
        </button>
      )}

      {/* 悬浮标题 Label */}
      <div 
        style={{
          position: 'absolute',
          top: '-24px',
          left: '12px',
          fontSize: '11px',
          fontWeight: 700,
          color: 'rgba(168, 85, 247, 0.9)',
          textTransform: 'uppercase',
          letterSpacing: '1px',
          textShadow: '0 0 6px rgba(168, 85, 247, 0.45)',
          zIndex: 15,
          textOverflow: 'ellipsis',
          overflow: 'hidden',
          whiteSpace: 'nowrap',
          maxWidth: '150px'
        }}
      >
        {data.label || '自定义工作流'}
      </div>

      {/* 180x180 视觉主卡片体 */}
      <div
        className="glass-card"
        style={{
          width: '100%',
          height: '100%',
          background: outputUrl 
            ? '#000' 
            : 'linear-gradient(135deg, rgba(20, 24, 33, 0.75) 0%, rgba(10, 12, 16, 0.95) 100%)',
          border: selected 
            ? '1.5px solid rgba(168, 85, 247, 0.85)' 
            : '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: selected 
            ? '0 0 25px rgba(168, 85, 247, 0.35)' 
            : '0 8px 32px rgba(0, 0, 0, 0.4)',
          borderRadius: '16px',
          position: 'relative',
          overflow: 'hidden',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transition: 'all 0.3s cubic-bezier(0.4, 0, 0.2, 1)'
        }}
      >
        {/* 全屏大光箱预览 */}
        {outputUrl && selected && logic.isImage && (
          <div style={{ position: 'absolute', top: '8px', right: '8px', display: 'flex', gap: '6px', zIndex: 20 }}>
            <button 
              onClick={(e) => { 
                e.stopPropagation(); 
                if (typeof (window as any).setFullScreenMedia === 'function') {
                  (window as any).setFullScreenMedia({ url: outputUrl, type: 'image' });
                }
              }}
              style={{ width: '24px', height: '24px', borderRadius: '50%', background: 'rgba(15,23,42,0.85)', border: '1px solid rgba(255,255,255,0.15)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: '#fff', fontSize: '11px', cursor: 'pointer', outline: 'none' }}
              title="全屏预览"
            >
              ⛶
            </button>
          </div>
        )}

        {data.outputs?.errorMsg ? (
          <div 
            style={{ 
              display: 'flex', 
              flexDirection: 'column', 
              alignItems: 'center', 
              justifyContent: 'center',
              gap: '6px', 
              padding: '12px',
              textAlign: 'center',
              background: 'linear-gradient(135deg, rgba(239, 68, 68, 0.15) 0%, rgba(20, 10, 10, 0.8) 100%)',
              width: '100%',
              height: '100%',
              borderRadius: '15px'
            }}
          >
            <span style={{ fontSize: '24px', animation: 'pulse 1.5s infinite' }}>⚠️</span>
            <span style={{ fontSize: '11px', fontWeight: 'bold', color: '#ef4444' }}>生成失败</span>
            <span 
              style={{ 
                fontSize: '8px', 
                color: 'rgba(255,255,255,0.4)', 
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                display: '-webkit-box',
                WebkitLineClamp: 3,
                WebkitBoxOrient: 'vertical',
                lineHeight: '1.3',
                maxHeight: '32px'
              }}
              title={data.outputs.errorMsg}
            >
              {data.outputs.errorMsg}
            </span>
          </div>
        ) : outputUrl ? (
          <>
            {logic.isImage && (
              <ResolvedMedia 
                url={outputUrl} 
                type="image" 
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '15px' }} 
              />
            )}
            {logic.isVideo && (
              <ResolvedMedia 
                url={outputUrl} 
                type="video" 
                autoPlay loop muted playsInline
                style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '15px' }} 
              />
            )}
            {logic.isAudio && (
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', width: '100%', height: '100%', background: 'rgba(0,0,0,0.3)', borderRadius: '15px', padding: '12px' }}>
                <span style={{ fontSize: '28px', animation: 'floatPill 3s infinite ease-in-out', marginBottom: '8px' }}>🎵</span>
                <ResolvedMedia 
                  url={outputUrl} 
                  type="audio" 
                  controls 
                  style={{ width: '100%', height: '32px' }} 
                />
              </div>
            )}
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '8px', padding: '8px', width: '100%', height: '100%', justifyContent: 'center' }}>
            <span style={{ fontSize: '26px' }}>🔮</span>
            <span style={{ fontSize: '10px', color: '#a3a3a3', fontWeight: 500 }}>自定义工作流</span>
          </div>
        )}

        {/* 统一高保真进度条 */}
        {isRunning && (
          <div 
            style={{
              position: 'absolute',
              top: 0, left: 0, right: 0, bottom: 0,
              background: 'rgba(9, 13, 22, 0.85)',
              backdropFilter: 'blur(8px)',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              borderRadius: '15px',
              zIndex: 10,
              padding: '0 16px'
            }}
          >
            <span style={{ fontSize: '20px', animation: 'spin 1.5s linear infinite', display: 'block' }}>🔄</span>
            <span 
              style={{ 
                fontSize: '10px', 
                color: 'rgba(168, 85, 247, 1)', 
                fontWeight: 600, 
                marginTop: '8px',
                textAlign: 'center'
              }}
            >
              执行中并轮询中...
            </span>
          </div>
        )}
      </div>

      {/* 绝对定位浮动 ConfigPanel */}
      {selected && !isMultiSelected && (
        <div
          className="nodrag glass-panel"
          onMouseDown={(e) => e.stopPropagation()}
          style={{
            position: 'absolute',
            left: '196px',
            top: '0px',
            width: '320px',
            zIndex: 50,
            borderRadius: '16px',
            background: 'rgba(11, 15, 25, 0.95)',
            backdropFilter: 'blur(20px)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5), 0 0 15px rgba(168, 85, 247, 0.15)',
            padding: '16px',
            display: 'flex',
            flexDirection: 'column',
            gap: '14px',
            maxHeight: '440px',
            overflowY: 'auto',
            animation: 'slideInPopup 0.2s ease'
          }}
        >
          {/* Header */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '8px' }}>
            <h4 style={{ fontSize: '12px', fontWeight: 700, color: '#fff', margin: 0 }}>
              🔮 工作流高级配置菜单
            </h4>
            <span style={{ fontSize: '9px', background: 'rgba(255,255,255,0.06)', padding: '2px 6px', borderRadius: '4px', color: 'rgba(255,255,255,0.5)' }}>
              {source === 'local_comfyui' ? 'ComfyUI API' : 'RunningHub'}
            </span>
          </div>

          {/* Body */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            
            {/* 1. 文本输入区 (Prompt) */}
            {logic.textParams.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {logic.textParams.map(map => {
                  const connected = logic.isPortConnected(map.portId);
                  const displayVal = connected ? logic.getConnectedValSync(map.portId) : (data.inputs?.[map.portId] || '');
                  return (
                    <div key={map.portId} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                        <span>{map.displayName || map.portId}</span>
                        {connected && <span style={{ color: '#8b5cf6' }}>🔗 连线驱动中</span>}
                      </label>
                      <WorkflowTextarea
                        disabled={connected}
                        value={displayVal}
                        onChange={(val) => logic.handleParamChange(map.portId, val)}
                        mentionItems={connected ? [{ id: `${map.portId}-upstream`, name: '上游连线输入', type: 'text', token: '@[文本1] ' }] : []}
                        placeholder={connected ? '🔗 连线驱动中...' : '请输入提示词或文本...'}
                        style={{
                          padding: '6px 10px',
                          color: connected ? '#a3a3a3' : '#fff',
                          fontFamily: 'inherit'
                        }}
                      />
                    </div>
                  );
                })}
              </div>
            )}

            {/* 2. 图像参考区 (Reference Images) */}
            {logic.imageParams.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {logic.imageParams.map(map => {
                  const connected = logic.isPortConnected(map.portId);
                  const connectedVal = connected ? logic.getConnectedValSync(map.portId) : '';
                  const displayVal = connected ? connectedVal : (data.inputs?.[map.portId] || '');
                  return (
                    <div key={map.portId} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                        <span>{map.displayName || map.portId}</span>
                        {connected && <span style={{ color: '#8b5cf6' }}>🔗 连线驱动中</span>}
                      </label>
                      
                      {connected ? (
                        <ConnectedImagePreview imageValue={connectedVal} />
                      ) : (
                        <ImageUploadArea
                           displayVal={displayVal}
                           portId={map.portId}
                           onImageUploaded={(url) => logic.handleParamChange(map.portId, url)}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* 2.5 视频与音频参考区 */}
            {logic.videoParams.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '8px' }}>
                {logic.videoParams.map(map => {
                  const connected = logic.isPortConnected(map.portId);
                  const connectedVal = connected ? logic.getConnectedValSync(map.portId) : '';
                  const displayVal = connected ? connectedVal : (data.inputs?.[map.portId] || '');
                  return (
                    <div key={map.portId} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                        <span>📹 {map.displayName || map.portId}</span>
                        {connected && <span style={{ color: '#8b5cf6' }}>🔗 连线驱动中</span>}
                      </label>
                      {connected ? (
                        <div style={{ height: '70px', borderRadius: '8px', overflow: 'hidden', border: '1px solid rgba(139,92,246,0.5)' }}>
                          <ResolvedMedia url={connectedVal} type="video" autoPlay loop muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={displayVal}
                          className="nodrag"
                          onMouseDown={(e) => e.stopPropagation()}
                          onChange={(e) => logic.handleParamChange(map.portId, e.target.value)}
                          placeholder="输入视频链接或连线输入..."
                          style={{
                            width: '100%',
                            background: 'rgba(0,0,0,0.25)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '4px',
                            padding: '6px 10px',
                            color: '#fff',
                            fontSize: '11px',
                            outline: 'none'
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {logic.audioParams.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '8px' }}>
                {logic.audioParams.map(map => {
                  const connected = logic.isPortConnected(map.portId);
                  const connectedVal = connected ? logic.getConnectedValSync(map.portId) : '';
                  const displayVal = connected ? connectedVal : (data.inputs?.[map.portId] || '');
                  return (
                    <div key={map.portId} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <label style={{ fontSize: '10px', color: 'rgba(255,255,255,0.5)', fontWeight: 600, display: 'flex', justifyContent: 'space-between' }}>
                        <span>🎵 {map.displayName || map.portId}</span>
                        {connected && <span style={{ color: '#8b5cf6' }}>🔗 连线驱动中</span>}
                      </label>
                      {connected ? (
                        <div style={{ padding: '6px', background: 'rgba(0,0,0,0.2)', borderRadius: '8px', border: '1px solid rgba(139,92,246,0.5)' }}>
                          <ResolvedMedia url={connectedVal} type="audio" controls style={{ width: '100%', height: '24px' }} />
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={displayVal}
                          className="nodrag"
                          onMouseDown={(e) => e.stopPropagation()}
                          onChange={(e) => logic.handleParamChange(map.portId, e.target.value)}
                          placeholder="输入音频链接或连线输入..."
                          style={{
                            width: '100%',
                            background: 'rgba(0,0,0,0.25)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '4px',
                            padding: '6px 10px',
                            color: '#fff',
                            fontSize: '11px',
                            outline: 'none'
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            {/* 3. 微调数值与自定义参数区 */}
            {logic.customParams.length > 0 && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '10px' }}>
                <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', fontWeight: 600 }}>🎛️ 自定义微调参数</span>
                {logic.customParams.map(map => {
                  const connected = logic.isPortConnected(map.portId);
                  const displayVal = connected ? logic.getConnectedValSync(map.portId) : (data.inputs?.[map.portId] || '');
                  const key = map.fieldName.toLowerCase();

                  const isSlider = key.includes('cfg') || key.includes('denoise') || key.includes('steps');
                  const minVal = key.includes('denoise') ? 0 : 1;
                  const maxVal = key.includes('denoise') ? 1 : (key.includes('cfg') ? 20 : 100);
                  const stepVal = key.includes('denoise') ? 0.01 : (key.includes('cfg') ? 0.1 : 1);

                  return (
                    <div key={map.portId} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                        <span style={{ fontSize: '10px', color: '#e9d5ff' }}>{map.displayName || map.portId}</span>
                        <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>{displayVal}</span>
                      </div>

                      {connected ? (
                        <div style={{ padding: '6px', background: 'rgba(255,255,255,0.01)', border: '1px dashed rgba(139,92,246,0.2)', borderRadius: '4px', fontSize: '9px', color: '#a3a3a3', textAlign: 'center' }}>
                          🔗 连线驱动中
                        </div>
                      ) : isSlider ? (
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <input
                            type="range"
                            min={minVal}
                            max={maxVal}
                            step={stepVal}
                            value={parseFloat(displayVal) || minVal}
                            className="nodrag"
                            onMouseDown={(e) => e.stopPropagation()}
                            onChange={(e) => logic.handleParamChange(map.portId, e.target.value)}
                            style={{ flex: 1, height: '4px', borderRadius: '2px', background: 'rgba(255,255,255,0.1)', outline: 'none' }}
                          />
                        </div>
                      ) : (
                        <input
                          type="text"
                          value={displayVal}
                          className="nodrag"
                          onMouseDown={(e) => e.stopPropagation()}
                          onChange={(e) => logic.handleParamChange(map.portId, e.target.value)}
                          placeholder="手动输入参数..."
                          style={{
                            width: '100%',
                            background: 'rgba(0,0,0,0.25)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            color: '#fff',
                            fontSize: '10px',
                            outline: 'none',
                            fontFamily: 'monospace'
                          }}
                        />
                      )}
                    </div>
                  );
                })}
              </div>
            )}

          </div>

          {/* ⚡ 开始运行单节点物理按钮 */}
          <button
            onClick={logic.handleExecuteSingleNode}
            disabled={isRunning}
            style={{
              width: '100%',
              padding: '8px 12px',
              background: isRunning 
                ? 'rgba(255,255,255,0.06)' 
                : 'linear-gradient(135deg, hsl(var(--accent-primary)), hsl(var(--accent-secondary)))',
              border: 'none',
              borderRadius: '8px',
              color: isRunning ? 'rgba(255,255,255,0.3)' : '#fff',
              fontSize: '11px',
              fontWeight: 700,
              cursor: isRunning ? 'not-allowed' : 'pointer',
              boxShadow: isRunning ? 'none' : '0 4px 12px hsl(var(--accent-primary) / 0.25)',
              transition: 'all 0.2s ease',
              marginTop: '10px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: '6px'
            }}
            onMouseEnter={(e) => {
              if (!isRunning) {
                e.currentTarget.style.transform = 'scale(1.01)';
                e.currentTarget.style.boxShadow = '0 6px 16px hsl(var(--accent-primary) / 0.35)';
              }
            }}
            onMouseLeave={(e) => {
              if (!isRunning) {
                e.currentTarget.style.transform = 'scale(1)';
                e.currentTarget.style.boxShadow = '0 4px 12px hsl(var(--accent-primary) / 0.25)';
              }
            }}
          >
            {isRunning ? '🔄 物理计算中...' : '⚡ 开始运行工作流'}
          </button>
        </div>
      )}

      {/* 嵌入高阶 CSS */}
      <style>{`
        .custom-workflow-node-container .react-flow__handle {
          transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1) !important;
        }
        .custom-workflow-node-container .react-flow__handle:hover {
          transform: translateY(-50%) scale(1.3) !important;
          background: rgba(168, 85, 247, 1) !important;
          border-color: #fff !important;
          box-shadow: 0 0 18px rgba(168, 85, 247, 0.95) !important;
        }
        .custom-workflow-node-container .react-flow__handle::after {
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
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
      `}</style>

      {/* ReactFlow 连接桩 Handle */}
      {/* 输入连接口 - 支持多个端口，根据 mappings 垂直等分分布在左边缘 */}
      {mappings.map((map, idx) => (
        <Handle
          key={map.portId}
          type="target"
          position={Position.Left}
          id={map.portId}
          style={{
            width: '10px',
            height: '10px',
            background: 'rgba(15, 23, 42, 0.95)',
            border: logic.isPortConnected(map.portId) ? '2px solid rgba(168, 85, 247, 1)' : '2.5px solid rgba(255, 255, 255, 0.45)',
            borderRadius: '50%',
            left: '-6px',
            top: `${((idx + 1) * 100) / (mappings.length + 1)}%`,
            transform: 'translateY(-50%)',
            boxShadow: logic.isPortConnected(map.portId) ? '0 0 8px rgba(168, 85, 247, 0.65)' : 'none',
            zIndex: 10,
            opacity: selected ? 1 : 0,
            pointerEvents: selected ? 'all' : 'none',
            visibility: selected ? 'visible' : 'hidden'
          }}
          title={map.displayName || map.portId}
        />
      ))}

      {/* 输出连接口 - 居右边缘中心 */}
      <Handle
        type="source"
        position={Position.Right}
        id="output"
        style={{
          width: '10px',
          height: '10px',
          background: 'rgba(15, 23, 42, 0.95)',
          border: outputUrl ? '2px solid rgba(168, 85, 247, 1)' : '2.5px solid rgba(255, 255, 255, 0.45)',
          borderRadius: '50%',
          right: '-6px',
          top: '50%',
          transform: 'translateY(-50%)',
          boxShadow: outputUrl ? '0 0 8px rgba(168, 85, 247, 0.65)' : 'none',
          zIndex: 10,
          opacity: selected ? 1 : 0,
          pointerEvents: selected ? 'all' : 'none',
          visibility: selected ? 'visible' : 'hidden'
        }}
      />
    </div>
  );
}
