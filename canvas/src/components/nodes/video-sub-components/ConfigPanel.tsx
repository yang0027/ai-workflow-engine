import React from 'react';
import { ResolvedMedia } from '../../ResolvedMedia';
import { useVideoNodeLogic, DEFAULT_PROVIDER_VIDEO_MODELS } from './useVideoNodeLogic';

interface ConfigPanelProps {
  id: string;
  data: any;
  logic: ReturnType<typeof useVideoNodeLogic>;
}

export default function ConfigPanel({ id, data, logic }: ConfigPanelProps) {
  const {
    fileInputRef,
    textareaRef,
    allConnectedAssets,
    connectedPrompt,
    isPromptConnected,
    providerId,
    activeTab,
    videoModeTab,
    fusing,
    fusedVideo,
    showMentionList,
    setShowMentionList,
    activePopover,
    setActivePopover,
    activeVendor,
    setActiveVendor,
    currentTemplate,
    unifiedParams,
    model,
    currentProviderModels,
    handleInputChange,
    handleRemoveRefAsset,
    handleFileChange,
    handleOpenAssetsModal,
    handleSelectMention,
    updateSizeFromSpecs,
    handleVideoFusion,
    handleDownloadVideo
  } = logic;

  const currentPrompt = isPromptConnected ? connectedPrompt : (data.inputs?.prompt || '');

  // 提示词文本框高度根据字数自适应变大 (最小 42px，最大 160px，写满 6 行后超出滚动)
  React.useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      textarea.style.height = `${Math.min(Math.max(scrollHeight, 42), 160)}px`;
    }
  }, [currentPrompt, textareaRef]);

  return (
    <div
      className="nodrag"
      style={{
        position: 'absolute',
        top: 'calc(100% + 12px)', // 完美贴合节点正下方，绝无任何物理重合遮挡
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
        animation: 'slideUpVideoNode 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      <style>{`
        @keyframes slideUpVideoNode {
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
        .gallery-popover-right::after {
          top: 50% !important;
          left: -12px !important;
          transform: translateY(-50%) !important;
          border-color: transparent rgba(11, 15, 26, 0.98) transparent transparent !important;
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
          display: none;
          flex-direction: column;
          gap: 4px;
          box-shadow: 0 10px 25px rgba(0,0,0,0.4);
          z-index: 2010;
        }
        .hover-vendor-item:hover .sub-model-list-hover {
          display: flex;
        }
      `}</style>

      {/* Row 1: 极简极窄生图控制行 (输入框 + 开始优化按钮) */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', position: 'relative' }}>
        {/* 隐藏的本地上传文件 input */}
        <input 
          type="file" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          accept="image/*,video/*,audio/*" 
          multiple 
          style={{ display: 'none' }} 
        />

        {/* 虚线快捷添加/查看参考源按钮 */}
        <button
          onClick={() => {
            setActivePopover(activePopover === 'gallery' ? null : 'gallery');
          }}
          title={
            allConnectedAssets.length > 0
              ? '查看已装载的参考素材'
              : '添加首尾帧或音视频参考素材'
          }
          style={{
            width: '30px',
            height: '30px',
            borderRadius: '8px',
            background:
              allConnectedAssets.length > 0
                ? 'rgba(168, 85, 247, 0.1)'
                : 'rgba(255,255,255,0.03)',
            border:
              allConnectedAssets.length > 0
                ? '1.5px solid rgba(168, 85, 247, 0.7)'
                : '1px dashed rgba(255,255,255,0.15)',
            color:
              allConnectedAssets.length > 0
                ? '#c084fc'
                : 'rgba(255,255,255,0.4)',
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
          {allConnectedAssets.length > 0 ? '🖼️' : '＋'}
        </button>

        {/* 极窄输入提示词文本框 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', position: 'relative' }}>
          <textarea
            ref={textareaRef}
            id={`textarea-${id}`}
            value={currentPrompt}
            disabled={isPromptConnected}
            className="nodrag custom-scrollbar"
            onMouseDown={(e) => e.stopPropagation()}
            onChange={(e) => {
              const val = e.target.value;
              handleInputChange('prompt', val);
              const cursor = e.target.selectionStart;
              const textBefore = val.substring(0, cursor);
              const lastAt = textBefore.lastIndexOf('@');
              if (lastAt !== -1 && lastAt >= textBefore.length - 2) {
                setShowMentionList(true);
              } else {
                setShowMentionList(false);
              }
            }}
            placeholder={
              isPromptConnected
                ? '🔗 已通过连线装载并接收上游动作提示词描述...'
                : '在此编写动作提示词 Prompt (支持输入 @ 快捷绑定参考图，如 @图1)...'
            }
            style={{
              width: '100%',
              height: 'auto',
              minHeight: '42px',
              maxHeight: '160px',
              background: 'rgba(255, 255, 255, 0.03)',
              border: '1px solid rgba(255, 255, 255, 0.08)',
              borderRadius: '8px',
              outline: 'none',
              resize: 'none',
              color: isPromptConnected ? 'rgba(255, 255, 255, 0.45)' : '#fff',
              fontSize: '11px',
              lineHeight: '1.4',
              padding: '10px 10px',
              fontFamily: 'var(--font-sans)',
              overflowY: 'auto',
              transition: 'border-color 0.2s'
            }}
            onFocus={(e) => {
              if (!isPromptConnected) e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.4)';
            }}
            onBlur={(e) => {
              if (!isPromptConnected) e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)';
            }}
          />

          {/* @ Mention 弹出下拉单 */}
          {showMentionList && allConnectedAssets.length > 0 && (
            <div
              className="nodrag"
              style={{
                position: 'absolute',
                bottom: '100%',
                left: 0,
                background: 'rgba(11, 15, 26, 0.98)',
                border: '1px solid rgba(255, 255, 255, 0.1)',
                borderRadius: '8px',
                boxShadow: '0 10px 20px rgba(0,0,0,0.5)',
                width: '220px',
                padding: '4px',
                zIndex: 3000,
                display: 'flex',
                flexDirection: 'column',
                gap: '2px',
                marginBottom: '4px'
              }}
            >
              <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', padding: '4px 6px', fontWeight: 'bold' }}>
                🔗 引用上游已装载多媒体：
              </div>
              {allConnectedAssets.map((asset, idx) => {
                const typeLabel = asset.type === 'image' ? '图' : asset.type === 'video' ? '视频' : '音频';
                return (
                  <div
                    key={asset.nodeId}
                    onMouseDown={(e) => {
                      e.preventDefault();
                      e.stopPropagation();
                      handleSelectMention(idx, asset.name, asset.type);
                    }}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 8px',
                      borderRadius: '4px',
                      cursor: 'pointer',
                      fontSize: '10px',
                      color: '#fff',
                      background: 'transparent',
                      transition: 'all 0.15s'
                    }}
                    onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(168, 85, 247, 0.25)'}
                    onMouseLeave={(e) => e.currentTarget.style.background = 'transparent'}
                  >
                    {asset.type === 'audio' ? (
                      <span style={{ fontSize: '11px' }}>🎵</span>
                    ) : (
                      <ResolvedMedia url={asset.url} type={asset.type === 'video' ? 'video' : 'image'} style={{ width: '16px', height: '16px', borderRadius: '2px', objectFit: 'cover' }} />
                    )}
                    <span style={{ textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', flex: 1 }}>
                      {asset.name} ({typeLabel}{idx + 1})
                    </span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* 开始处理生成按钮 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
          <button
            onClick={handleVideoFusion}
            disabled={fusing}
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
            {fusing ? '正在生成...' : '开始生成'}
          </button>
          {data.inputs?.customTemplate && (
            <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold', letterSpacing: '0.5px' }}>
              {data.inputs.customTemplate.source === 'runninghub' ? '⚡ RH工作流' : '💻 CF工作流'}
            </span>
          )}
        </div>
      </div>

      {/* 快捷提及 Pills 栏 */}
      {allConnectedAssets.length > 0 && (
        <div style={{ display: 'flex', alignItems: 'center', gap: '6px', background: 'rgba(255,255,255,0.01)', padding: '2px 4px', borderRadius: '4px', fontSize: '9px', marginTop: '-4px' }}>
          <span style={{ color: 'rgba(255,255,255,0.45)' }}>📎 快捷绑定参考图:</span>
          {allConnectedAssets.map((asset, idx) => {
            const typeLabel = asset.type === 'image' ? '图' : asset.type === 'video' ? '视频' : '音频';
            const icon = asset.type === 'image' ? '🖼️' : asset.type === 'video' ? '🎥' : '🎵';
            return (
              <button
                key={idx}
                onClick={() => {
                  const textarea = textareaRef.current;
                  const cursor = textarea ? textarea.selectionStart : currentPrompt.length;
                  const textBefore = currentPrompt.substring(0, cursor);
                  const textAfter = currentPrompt.substring(cursor);
                  const mentionText = `@[${typeLabel}${idx + 1}] `;
                  const nextPrompt = textBefore + mentionText + textAfter;
                  handleInputChange('prompt', nextPrompt);
                  if (textarea) {
                    setTimeout(() => {
                      textarea.focus();
                      const newCursorPos = cursor + mentionText.length;
                      textarea.setSelectionRange(newCursorPos, newCursorPos);
                    }, 50);
                  }
                }}
                style={{
                  background: 'rgba(168, 85, 247, 0.15)',
                  border: '1px solid rgba(168, 85, 247, 0.3)',
                  borderRadius: '4px',
                  color: '#e9d5ff',
                  padding: '1px 5px',
                  fontSize: '9px',
                  cursor: 'pointer',
                  fontWeight: 'bold',
                  transition: 'all 0.15s',
                  outline: 'none',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '2px'
                }}
                onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(168, 85, 247, 0.3)'}
                onMouseLeave={(e) => e.currentTarget.style.background = 'rgba(168, 85, 247, 0.15)'}
              >
                <span>{icon} {typeLabel}{idx + 1}</span>
              </button>
            );
          })}
        </div>
      )}

      <hr style={{ border: 'none', borderTop: '1px solid rgba(255, 255, 255, 0.05)', margin: '2px 0' }} />

      {/* Row 2: 极简胶囊 Pill 按钮组 */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
        {/* 1. 模型选择/自定义参数 */}
        {data.inputs?.customTemplate ? (
          <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
            <button 
              className={`pill-capsule-button ${activePopover === 'workflow' ? 'active' : ''}`}
              onClick={() => setActivePopover(activePopover === 'workflow' ? null : 'workflow')}
            >
              ⚙️ 自定义参数设置 ▼
            </button>
            {currentTemplate?.source === 'runninghub' && currentTemplate?.webLink && (
              <button 
                className="pill-capsule-button"
                onClick={() => window.open(currentTemplate.webLink, '_blank')}
                style={{
                  background: 'rgba(16, 185, 129, 0.1)',
                  borderColor: 'rgba(16, 185, 129, 0.3)',
                  color: '#34d399'
                }}
              >
                🌐 工作流链接
              </button>
            )}
          </div>
        ) : (
          <button 
            className={`pill-capsule-button ${activePopover === 'model' ? 'active' : ''}`}
            onClick={() => setActivePopover(activePopover === 'model' ? null : 'model')}
          >
            🌐 模型: {model} ▼
          </button>
        )}

        {/* 2. 规格尺寸参数胶囊 */}
        <button 
          className={`pill-capsule-button ${activePopover === 'specs' ? 'active' : ''}`}
          onClick={() => setActivePopover(activePopover === 'specs' ? null : 'specs')}
        >
          📐 规格尺寸 ▼
        </button>

        {/* 3. ComfyUI 工作流 */}
        {!data.inputs?.customTemplate && (
          <button 
            className="pill-capsule-button"
            onClick={() => {
              window.dispatchEvent(
                new CustomEvent('open-large-modal', {
                  detail: { tab: 'workflows', nodeTarget: id, type: 'video' }
                })
              );
            }}
          >
            ⚡ {data.inputs?.runningHubWorkflowName ? `ComfyUI: ${data.inputs.runningHubWorkflowName}` : 'comfyui工作流'} ▼
          </button>
        )}

        <div style={{ flex: 1 }} />
        
        <span style={{ fontSize: '9px', color: 'rgba(255, 255, 255, 0.35)', whiteSpace: 'nowrap' }}>
          输出: video (outputs.video)
        </span>
      </div>

      {/* ---------------- Popovers 浮窗 ---------------- */}

      {/* Popover 1: 模型选择 (级联) */}
      {activePopover === 'model' && (
        <div className="popover-floating-card" style={{ width: '220px', left: '15%' }}>
          {activeTab === 'aix' ? (
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '6px' }}>
              💡 云端工作流已由模版配置托管，无需在节点端设置物理视频大模型。
            </div>
          ) : (
            <>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', fontWeight: 'bold', paddingBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                🤖 视频生成大模型服务商
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
                {[
                  { id: 'volcengine', label: '火山引擎 (Seedance)' },
                  { id: 'vidu', label: 'Vidu 视频' },
                  { id: 'minimax', label: '海螺视频' },
                  { id: 'ali', label: '通义万相' }
                ].map(v => (
                  <div 
                    key={v.id}
                    className={`hover-vendor-item ${activeVendor === v.id ? 'active' : ''}`}
                    onClick={() => {
                      setActiveVendor(v.id as any);
                      handleInputChange('providerId', v.id);
                      const providerModels = DEFAULT_PROVIDER_VIDEO_MODELS[v.id] || [];
                      handleInputChange('model', providerModels[0]);
                    }}
                  >
                    <span>{v.label.replace(' (Seedance)', '')}</span>
                    <span style={{ fontSize: '8px', opacity: 0.5 }}>▶</span>

                    {/* 二级级联模型列表 */}
                    <div className="sub-model-list-hover">
                      <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.45)', padding: '2px 4px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: '4px' }}>
                        选择具体视频模型：
                      </div>
                      {(DEFAULT_PROVIDER_VIDEO_MODELS[v.id] || []).map(m => (
                        <button
                          key={m}
                          onClick={(e) => {
                            e.stopPropagation();
                            setActiveVendor(v.id as any);
                            handleInputChange('providerId', v.id);
                            handleInputChange('model', m);
                            setActivePopover(null);
                          }}
                          style={{
                            background: model === m ? 'rgba(168, 85, 247, 0.25)' : 'transparent',
                            border: 'none',
                            borderRadius: '4px',
                            color: model === m ? '#fff' : 'rgba(255,255,255,0.7)',
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
          )}
        </div>
      )}

      {/* Popover 2: 工作模式 */}
      {activePopover === 'mode' && (
        <div className="popover-floating-card" style={{ width: '200px', left: '25%' }}>
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', fontWeight: 'bold', paddingBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            ⚙️ 切换视频创作模式
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
            {[
              { id: 'all', label: '🔮 全能参考参考源' },
              { id: 'edit', label: '✂️ 视频编辑 (图/声/视)' },
              { id: 'ref', label: '🎬 视频画面角色参考' },
              { id: 'extend', label: '🔄 视频首尾帧续写' },
              { id: 'aix', label: '⚡ ComfyUI 云端工作流' }
            ].map(m => {
              const isSel = m.id === 'aix' ? activeTab === 'aix' : activeTab === 'standard' && videoModeTab === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => {
                    if (m.id === 'aix') {
                      handleInputChange('activeTab', 'aix');
                    } else {
                      handleInputChange('activeTab', 'standard');
                      handleInputChange('videoModeTab', m.id);
                    }
                    setActivePopover(null);
                  }}
                  style={{
                    background: isSel ? 'rgba(168, 85, 247, 0.25)' : 'rgba(255, 255, 255, 0.02)',
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

      {/* Popover 3: 规格尺寸与生成参数 */}
      {activePopover === 'specs' && (
        <div className="popover-floating-card" style={{ width: '310px', left: '40%' }}>
          <div style={{ fontSize: '10.5px', fontWeight: 'bold', color: 'rgba(255,255,255,0.5)', paddingBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            📐 规格尺寸与生成参数
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
            {/* 1. 分辨率组 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.4)', width: '60px', flexShrink: 0 }}>画面分辨率:</span>
              <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', padding: '2px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)', flex: 1, justifyContent: 'space-between' }}>
                {['480p', '720p', '1080p', '2K', '4K'].map(c => {
                  const isSel = (data.inputs?.clarity || '720p') === c;
                  return (
                    <button
                      key={c}
                      onClick={() => {
                        const curRatio = data.inputs?.aspectRatio || '16:9';
                        updateSizeFromSpecs(curRatio, c);
                      }}
                      style={{
                        padding: '3px 8px',
                        border: 'none',
                        borderRadius: '4px',
                        background: isSel ? 'rgba(168, 85, 247, 0.25)' : 'transparent',
                        color: isSel ? '#fff' : 'rgba(255,255,255,0.4)',
                        fontSize: '9px',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                    >
                      {c}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 2. 画面比例组 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.4)', width: '60px', flexShrink: 0 }}>画面比例:</span>
              <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', padding: '2px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)', flexWrap: 'wrap', gap: '2px', flex: 1 }}>
                {['自适应', '16:9', '9:16', '4:3', '1:1', '3:4', '21:9'].map(r => {
                  const isSel = (data.inputs?.aspectRatio || '16:9') === r;
                  return (
                    <button
                      key={r}
                      onClick={() => {
                        const curClarity = data.inputs?.clarity || '720p';
                        updateSizeFromSpecs(r, curClarity);
                      }}
                      style={{
                        padding: '3px 6px',
                        border: 'none',
                        borderRadius: '4px',
                        background: isSel ? 'rgba(168, 85, 247, 0.25)' : 'transparent',
                        color: isSel ? '#fff' : 'rgba(255,255,255,0.4)',
                        fontSize: '9px',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                    >
                      {r}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 3. 是否生成音频 */}
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <span style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.4)', width: '60px', flexShrink: 0 }}>生成音频:</span>
              <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', padding: '2px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.06)' }}>
                {['是', '否'].map(opt => {
                  const isSel = (data.inputs?.generateAudio || '否') === opt;
                  return (
                    <button
                      key={opt}
                      onClick={() => handleInputChange('generateAudio', opt)}
                      style={{
                        padding: '3px 12px',
                        border: 'none',
                        borderRadius: '4px',
                        background: isSel ? 'rgba(168, 85, 247, 0.25)' : 'transparent',
                        color: isSel ? '#fff' : 'rgba(255,255,255,0.4)',
                        fontSize: '9px',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                    >
                      {opt}
                    </button>
                  );
                })}
              </div>
            </div>

            {/* 4. 时长选择及滑块 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <span style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.4)', width: '60px', flexShrink: 0 }}>生成时长:</span>
                <div style={{ display: 'flex', background: 'rgba(0,0,0,0.3)', padding: '2px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.06)', flex: 1, justifyContent: 'space-between' }}>
                  {[4, 8, 12, 15].map(d => {
                    const isSel = (data.inputs?.durationMode || 'preset') === 'preset' && (data.inputs?.duration || 4) === d;
                    return (
                      <button
                        key={d}
                        onClick={() => {
                          handleInputChange('durationMode', 'preset');
                          handleInputChange('duration', d);
                        }}
                        style={{
                          padding: '3px 8px',
                          border: 'none',
                          borderRadius: '4px',
                          background: isSel ? 'rgba(168, 85, 247, 0.25)' : 'transparent',
                          color: isSel ? '#fff' : 'rgba(255,255,255,0.4)',
                          fontSize: '9px',
                          fontWeight: 'bold',
                          cursor: 'pointer'
                        }}
                      >
                        {d}s
                      </button>
                    );
                  })}
                  <button
                    onClick={() => {
                      handleInputChange('durationMode', 'custom');
                      const curD = data.inputs?.duration || 4;
                      if (curD < 4 || curD > 60) {
                        handleInputChange('duration', 20);
                      }
                    }}
                    style={{
                      padding: '3px 8px',
                      border: 'none',
                      borderRadius: '4px',
                      background: (data.inputs?.durationMode === 'custom') ? 'rgba(168, 85, 247, 0.25)' : 'transparent',
                      color: (data.inputs?.durationMode === 'custom') ? '#fff' : 'rgba(255,255,255,0.4)',
                      fontSize: '9px',
                      fontWeight: 'bold',
                      cursor: 'pointer'
                    }}
                  >
                    自定义
                  </button>
                </div>
              </div>

              {data.inputs?.durationMode === 'custom' && (
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(0,0,0,0.2)', padding: '6px 10px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.03)', marginTop: '2px' }}>
                  <span style={{ fontSize: '8.5px', color: 'rgba(255,255,255,0.45)', flexShrink: 0 }}>微调时长:</span>
                  <input 
                    type="range"
                    className="nodrag"
                    onMouseDown={(e) => e.stopPropagation()}
                    min="4"
                    max="60"
                    value={data.inputs?.duration || 20}
                    onChange={(e) => handleInputChange('duration', parseInt(e.target.value))}
                    style={{ flex: 1, accentColor: '#a855f7', height: '3px', background: 'rgba(255,255,255,0.1)', borderRadius: '2px', cursor: 'pointer' }}
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '2px', flexShrink: 0 }}>
                    <input 
                      type="number"
                      className="nodrag"
                      onMouseDown={(e) => e.stopPropagation()}
                      min="4"
                      max="60"
                      value={data.inputs?.duration || 20}
                      onChange={(e) => {
                        let val = parseInt(e.target.value) || 4;
                        if (val < 4) val = 4;
                        if (val > 60) val = 60;
                        handleInputChange('duration', val);
                      }}
                      style={{ width: '32px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', padding: '1px 3px', color: '#fff', fontSize: '9.5px', textAlign: 'center', outline: 'none' }}
                    />
                    <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.5)', fontWeight: 'bold' }}>秒</span>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Popover 4: 模式共享的参考素材画廊 (重定位到右侧，绝不遮挡节点本体) */}
      {activePopover === 'gallery' && (
        <div 
          className="popover-floating-card gallery-popover-right" 
          style={{ 
            width: '310px', 
            left: 'calc(50% + 102px)', 
            top: '-220px',
            bottom: 'auto',
            transform: 'none' 
          }}
        >
          <div style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.5)', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '4px' }}>
            <span>🖼️ 参考素材画廊 ({allConnectedAssets.length}/6)</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', maxHeight: '160px', overflowY: 'auto', marginTop: '6px' }}>
            {allConnectedAssets.map((asset, idx) => (
              <div 
                key={idx} 
                style={{ 
                  position: 'relative', 
                  width: '100%', 
                  height: '75px', 
                  borderRadius: '6px', 
                  overflow: 'hidden', 
                  border: '1.5px solid rgba(255,255,255,0.05)',
                  boxShadow: '0 2px 8px rgba(0,0,0,0.3)'
                }}
              >
                {asset.type === 'audio' ? (
                  <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #1e1b4b 0%, #311042 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                    <span style={{ fontSize: '20px', display: 'block' }}>🎵</span>
                    <span style={{ fontSize: '8px', color: '#c084fc', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '80%', display: 'block' }}>音频已连入</span>
                  </div>
                ) : asset.type === 'video' ? (
                  <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                    <ResolvedMedia url={asset.url} type="video" autoPlay loop muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                    <span style={{ position: 'absolute', bottom: '4px', left: '4px', fontSize: '10px', background: 'rgba(0,0,0,0.6)', padding: '1px 3px', borderRadius: '3px', zIndex: 10 }}>🎥</span>
                  </div>
                ) : (
                  <ResolvedMedia url={asset.url} type="image" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                )}
                
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    handleRemoveRefAsset(asset.nodeId);
                  }}
                  style={{
                    position: 'absolute', top: '2px', right: '2px', width: '14px', height: '14px', borderRadius: '50%',
                    background: 'rgba(239, 68, 68, 0.85)', border: 'none', color: '#fff', display: 'flex',
                    alignItems: 'center', justifyContent: 'center', fontSize: '9px', cursor: 'pointer', outline: 'none', fontWeight: 'bold'
                  }}
                >
                  ×
                </button>
                <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: 'rgba(0,0,0,0.6)', color: 'rgba(255,255,255,0.7)', fontSize: '8px', textAlign: 'center', padding: '1px 0' }}>
                  {asset.type === 'image' ? '图' : asset.type === 'video' ? '视频' : '音频'}{idx + 1}
                </div>
              </div>
            ))}

            {allConnectedAssets.length < 6 && (
              <div
                onClick={() => handleOpenAssetsModal('image')}
                style={{
                  width: '100%', height: '75px', borderRadius: '6px', border: '1.5px dashed rgba(255, 255, 255, 0.15)',
                  background: 'rgba(255,255,255,0.01)', display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', gap: '4px', cursor: 'pointer', transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.6)';
                  e.currentTarget.style.background = 'rgba(168, 85, 247, 0.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.01)';
                }}
              >
                <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>🖼️</span>
                <span style={{ fontSize: '8.5px', color: 'rgba(255,255,255,0.3)' }}>图像选入</span>
              </div>
            )}

            {allConnectedAssets.length < 6 && (
              <div
                onClick={() => handleOpenAssetsModal('video')}
                style={{
                  width: '100%', height: '75px', borderRadius: '6px', border: '1.5px dashed rgba(255, 255, 255, 0.15)',
                  background: 'rgba(255,255,255,0.01)', display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', gap: '4px', cursor: 'pointer', transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.6)';
                  e.currentTarget.style.background = 'rgba(168, 85, 247, 0.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.01)';
                }}
              >
                <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>🎥</span>
                <span style={{ fontSize: '8.5px', color: 'rgba(255,255,255,0.3)' }}>视频选入</span>
              </div>
            )}

            {allConnectedAssets.length < 6 && (
              <div
                onClick={() => handleOpenAssetsModal('audio')}
                style={{
                  width: '100%', height: '75px', borderRadius: '6px', border: '1.5px dashed rgba(255, 255, 255, 0.15)',
                  background: 'rgba(255,255,255,0.01)', display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', gap: '4px', cursor: 'pointer', transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.6)';
                  e.currentTarget.style.background = 'rgba(168, 85, 247, 0.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.01)';
                }}
              >
                <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>🎵</span>
                <span style={{ fontSize: '8.5px', color: 'rgba(255,255,255,0.3)' }}>音频选入</span>
              </div>
            )}

            {allConnectedAssets.length < 6 && (
              <div
                onClick={() => fileInputRef.current?.click()}
                style={{
                  width: '100%', height: '75px', borderRadius: '6px', border: '1.5px dashed rgba(255, 255, 255, 0.15)',
                  background: 'rgba(255,255,255,0.01)', display: 'flex', flexDirection: 'column', alignItems: 'center',
                  justifyContent: 'center', gap: '4px', cursor: 'pointer', transition: 'all 0.2s'
                }}
                onMouseEnter={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.6)';
                  e.currentTarget.style.background = 'rgba(168, 85, 247, 0.05)';
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.15)';
                  e.currentTarget.style.background = 'rgba(255,255,255,0.01)';
                }}
              >
                <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>📤</span>
                <span style={{ fontSize: '8.5px', color: 'rgba(255,255,255,0.3)' }}>本地上传</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Popover 5: aix 模式下的云端工作流配置 */}
      {activePopover === 'workflow' && (
        <div className="popover-floating-card" style={{ width: '280px', left: '15%', maxHeight: '280px', overflowY: 'auto' }}>
          {data.inputs?.customTemplate ? (
            <>
              <div style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.5)', fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '4px' }}>
                ⚙️ 自定义参数设置
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px' }}>
                {(() => {
                  const filteredParams = unifiedParams.filter((p: any) => {
                    if (!p.exposed) return false;
                    const fieldLower = (p.fieldName || '').toLowerCase();
                    const displayLower = (p.description || '').toLowerCase();

                    const isText = fieldLower === 'text' || fieldLower === 'prompt' || fieldLower === 'instruction' || fieldLower === 'description' || displayLower.includes('提示词') || displayLower.includes('文本') || displayLower.includes('指令');
                    const isImage = p.type === 'image' || fieldLower === 'image' || fieldLower === 'faceref' || fieldLower === 'img' || fieldLower === 'refimage' || fieldLower === 'ref_image' || displayLower.includes('图片') || displayLower.includes('图像');
                    const isVideo = p.type === 'video' || fieldLower === 'video' || fieldLower === 'refvideo' || fieldLower === 'ref_video' || displayLower.includes('视频');
                    const isAudio = p.type === 'audio' || fieldLower === 'audio' || fieldLower === 'refaudio' || fieldLower === 'ref_audio' || displayLower.includes('音频') || displayLower.includes('声音') || displayLower.includes('配音');
                    const isSpecs = fieldLower === 'cfg' || fieldLower === 'steps' || fieldLower === 'denoise' || fieldLower === 'width' || fieldLower === 'height' || fieldLower === 'w' || fieldLower === 'h' || fieldLower === 'clarity' || fieldLower === 'duration';

                    return !isText && !isImage && !isVideo && !isAudio && !isSpecs;
                  });

                  if (filteredParams.length === 0) {
                    return (
                      <div style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '10px 0' }}>
                        本工作流无额外特有参数，已在主菜单完美对齐
                      </div>
                    );
                  }

                  return filteredParams.map((p: any) => {
                    const inputKey = p.portId;
                    const val = data.inputs?.[inputKey] !== undefined ? data.inputs[inputKey] : p.fieldValue;
                    return (
                      <div key={inputKey} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.7)' }}>{p.description || p.fieldName}</span>
                          <span style={{ fontSize: '8.5px', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }}>{val}</span>
                        </div>
                        <input
                          type="text"
                          className="nodrag"
                          onMouseDown={(e) => e.stopPropagation()}
                          value={val || ''}
                          onChange={(e) => handleInputChange(inputKey, e.target.value)}
                          placeholder="配置特有参数..."
                          style={{
                            width: '100%',
                            background: 'rgba(0,0,0,0.25)',
                            border: '1px solid rgba(255,255,255,0.08)',
                            borderRadius: '4px',
                            padding: '4px 8px',
                            color: '#fff',
                            fontSize: '9.5px',
                            outline: 'none',
                            fontFamily: 'monospace'
                          }}
                        />
                      </div>
                    );
                  });
                })()}
              </div>
            </>
          ) : (
            <>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', fontWeight: 'bold', paddingBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                🎯 云端工作流模板与参数配制
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '6px' }}>
                <button
                  onClick={() => {
                    window.dispatchEvent(
                      new CustomEvent('open-large-modal', {
                        detail: { tab: 'templates', nodeTarget: id, type: 'video' }
                      })
                    );
                    setActivePopover(null);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    background: 'rgba(168, 85, 247, 0.1)',
                    border: '1px dashed rgba(168, 85, 247, 0.4)',
                    borderRadius: '6px',
                    color: '#e9d5ff',
                    fontSize: '10.5px',
                    fontWeight: 'bold',
                    cursor: 'pointer',
                    textAlign: 'center'
                  }}
                >
                  🎯 选择云端工作流模版
                </button>

                {data.inputs?.runningHubWorkflowName && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', background: 'rgba(255,255,255,0.02)', padding: '6px 8px', borderRadius: '4px', border: '1px solid rgba(255,255,255,0.04)' }}>
                    <span style={{ fontSize: '10px', color: '#c084fc', fontWeight: 'bold' }}>
                      模版: {data.inputs.runningHubWorkflowName}
                    </span>
                    {currentTemplate && (
                      <span style={{ fontSize: '8.5px', color: 'rgba(255,255,255,0.4)', lineHeight: '1.3' }}>
                        💡 说明: {currentTemplate.description}
                      </span>
                    )}
                  </div>
                )}

                {/* 动态渲染动态表单字段 */}
                {currentTemplate && currentTemplate.nodeInfoList && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '6px' }}>
                    {currentTemplate.nodeInfoList.map((info: any) => {
                      const lowerName = info.fieldName.toLowerCase();
                      const isText = lowerName === 'text' || lowerName === 'prompt';
                      const isImg = lowerName === 'image' || lowerName === 'faceref' || lowerName === 'img' || lowerName === 'refimage';
                      const isAudio = lowerName === 'audio' || lowerName === 'refaudio';
                      const isVideo = lowerName === 'video' || lowerName === 'refvideo';
                      const inputKey = `${info.nodeId}_${info.fieldName}`;
                      const currentVal = data.inputs?.[inputKey] !== undefined ? data.inputs[inputKey] : info.fieldValue;

                      return (
                        <div key={inputKey} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.55)' }}>
                              {info.description || info.fieldName} (节点: {info.nodeId})
                            </span>
                            {isText && isPromptConnected && <span style={{ color: '#a855f7', fontSize: '8px' }}>🔗 连线驱动</span>}
                            {isImg && logic.isRefImageConnected && <span style={{ color: '#a855f7', fontSize: '8px' }}>🔗 连线驱动</span>}
                            {isAudio && logic.isRefAudioConnected && <span style={{ color: '#a855f7', fontSize: '8px' }}>🔗 连线驱动</span>}
                            {isVideo && logic.isRefVideoConnected && <span style={{ color: '#a855f7', fontSize: '8px' }}>🔗 连线驱动</span>}
                          </div>

                          {isText ? (
                            <textarea
                              disabled={isPromptConnected}
                              value={isPromptConnected ? connectedPrompt : currentVal}
                              className="nodrag"
                              onMouseDown={(e) => e.stopPropagation()}
                              onChange={(e) => handleInputChange(inputKey, e.target.value)}
                              style={{
                                width: '100%',
                                height: '38px',
                                background: 'rgba(0,0,0,0.3)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: '4px',
                                padding: '4px 6px',
                                color: isPromptConnected ? 'rgba(255, 255, 255, 0.45)' : '#fff',
                                fontSize: '9.5px',
                                resize: 'none',
                                outline: 'none',
                                lineHeight: '1.3'
                              }}
                            />
                          ) : isImg ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.15)', padding: '4px', borderRadius: '4px' }}>
                              <span style={{ fontSize: '11px' }}>🖼️</span>
                              <span style={{ fontSize: '8.5px', color: 'rgba(255,255,255,0.4)' }}>
                                {logic.isRefImageConnected ? '参考图画面已就绪' : '等待连线或添加参考图'}
                              </span>
                            </div>
                          ) : isVideo ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.15)', padding: '4px', borderRadius: '4px' }}>
                              <span style={{ fontSize: '11px' }}>🎥</span>
                              <span style={{ fontSize: '8.5px', color: 'rgba(255,255,255,0.4)' }}>
                                {logic.isRefVideoConnected ? '参考视频已就绪' : '等待连线或添加视频'}
                              </span>
                            </div>
                          ) : isAudio ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.15)', padding: '4px', borderRadius: '4px' }}>
                              <span style={{ fontSize: '11px' }}>🎵</span>
                              <span style={{ fontSize: '8.5px', color: 'rgba(255,255,255,0.4)' }}>
                                {logic.isRefAudioConnected ? '参考音频已就绪' : '等待连线或添加声音'}
                              </span>
                            </div>
                          ) : (
                            <input
                              type="text"
                              value={currentVal}
                              className="nodrag"
                              onMouseDown={(e) => e.stopPropagation()}
                              onChange={(e) => handleInputChange(inputKey, e.target.value)}
                              style={{
                                width: '100%',
                                background: 'rgba(0,0,0,0.3)',
                                border: '1px solid rgba(255,255,255,0.08)',
                                borderRadius: '4px',
                                padding: '4px 6px',
                                color: '#fff',
                                fontSize: '9.5px',
                                outline: 'none'
                              }}
                            />
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
