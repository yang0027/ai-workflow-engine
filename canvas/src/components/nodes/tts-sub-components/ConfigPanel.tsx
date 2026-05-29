import React, { useState } from 'react';
import { ResolvedMedia } from '../../ResolvedMedia';
import { WorkflowTextarea } from '../../WorkflowTextarea';
import { getModelsForProvider } from '../../../hooks/useModelSelector';

export interface ConfigPanelProps {
  id: string;
  data: any;
  activeTab: 'standard' | 'aix';
  providerId: string;
  activeProviders?: Array<{ id: string; name: string; icon?: string }>;
  settings?: any;
  currentRefAudio: string;
  isRefAudioConnected: boolean;
  currentText: string;
  isTextConnected: boolean;
  currentProviderModels: string[];
  model: string;
  characterName: string;
  mode: string;
  cloning: boolean;
  currentTemplate: any;
  unifiedParams: any[];
  fileInputRef: React.RefObject<HTMLInputElement | null>;

  handleTabChange: (tab: 'standard' | 'aix') => void;
  handleOpenAssetsModal: (type: 'image' | 'video' | 'audio') => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleInputChange: (field: string, val: any) => void;
  handleVoiceClone: () => void;
}

export const ConfigPanel: React.FC<ConfigPanelProps> = ({
  id,
  data,
  activeTab,
  providerId,
  activeProviders = [],
  settings = null,
  currentRefAudio,
  isRefAudioConnected,
  currentText,
  isTextConnected,
  currentProviderModels,
  model,
  characterName,
  mode,
  cloning,
  currentTemplate,
  unifiedParams,
  fileInputRef,
  handleTabChange,
  handleOpenAssetsModal,
  handleFileChange,
  handleInputChange,
  handleVoiceClone
}) => {
  // Popover 浮层状态管理
  const [activePopover, setActivePopover] = useState<'model' | 'mode' | 'voice' | 'workflow' | null>(null);
  const [activeVendor, setActiveVendor] = useState<'minimax' | 'openai' | 'volcengine'>(
    (providerId as any) || 'openai'
  );

  const containerRef = React.useRef<HTMLDivElement>(null);

  React.useEffect(() => {
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

  const audioMode = data.inputs?.audioMode || 'tts';

  // 厂商模型级联列表
  const ttsVendors = [
    { id: 'minimax', label: 'MiniMax' },
    { id: 'openai', label: 'OpenAI TTS' },
    { id: 'volcengine', label: '火山引擎' }
  ];

  const vendorModels: Record<string, string[]> = {
    openai: ['tts-1', 'tts-1-hd'],
    minimax: ['speech-01-turbo'],
    volcengine: ['volc-tts-premium', 'volc-tts-standard']
  };

  const musicModels = ['Suno-v3', 'Suno-v4', 'Chirp-v3.5'];
  const cloneModels = ['Minimax-TTS-Clone', 'Qwen-Voice-Clone', 'OpenVoice-v2', 'GPT-SoVITS-premium'];

  // 获取当前模式的显示名称
  const getModeLabel = () => {
    if (activeTab === 'aix') return '云端工作流';
    if (audioMode === 'tts') return '文本转语音';
    if (audioMode === 'music') return '音乐创作';
    if (audioMode === 'clone') return '语音克隆';
    return '未定义';
  };

  return (
    <div
      ref={containerRef}
      className="nodrag"
      onMouseDown={(e) => e.stopPropagation()}
      onTouchStart={(e) => e.stopPropagation()}
      style={{
        position: 'absolute',
        top: '200px', // 对齐上游 bottom 定位调优，使面板自然向顶/底延伸
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
        animation: 'slideUpAudioNode 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      <style>{`
        @keyframes slideUpAudioNode {
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
          /* 默认隐藏但保留布局空间，使用 visibility + opacity 替代 display */
          visibility: hidden;
          opacity: 0;
          /* 缓慢淡出，增加手感 */
          transition: visibility 0.2s ease 0.1s, opacity 0.2s ease 0.1s;
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
      `}</style>

      {/* 10000px 物理遮罩已彻底剔除，升级为超轻量 containerRef 全局 document 监听，完美根治拖拽粘连 Bug */}

      {/* Row 1: 极窄输入合成控制行 */}
      <div style={{ display: 'flex', gap: '8px', alignItems: 'center', position: 'relative' }}>
        {/* 隐藏的本地文件 input */}
        <input
          type="file"
          ref={fileInputRef as any}
          onChange={handleFileChange}
          accept="audio/*"
          style={{ display: 'none' }}
        />

        {/* 虚线快捷添加/连线参考音色按钮 */}
        <button
          onClick={() => {
            if (activeTab === 'aix') {
              setActivePopover(activePopover === 'workflow' ? null : 'workflow');
            } else if (audioMode === 'clone') {
              setActivePopover(activePopover === 'voice' ? null : 'voice');
            } else {
              // 其它模式友好提示
              alert('当前模式无需配置克隆音色，可直接输入配音台词/描述并点击生成！');
            }
          }}
          disabled={activeTab !== 'aix' && audioMode !== 'clone'}
          title={
            activeTab === 'aix'
              ? '配置云端工作流参数'
              : audioMode === 'clone'
              ? currentRefAudio
                ? '管理克隆角色音色'
                : '添加角色克隆音色'
              : '当前模式无需克隆音色'
          }
          style={{
            width: '30px',
            height: '30px',
            borderRadius: '8px',
            background:
              activeTab === 'aix' || (audioMode === 'clone' && currentRefAudio)
                ? 'rgba(168, 85, 247, 0.1)'
                : 'rgba(255, 255, 255, 0.03)',
            border:
              activeTab === 'aix' || (audioMode === 'clone' && currentRefAudio)
                ? '1.5px solid rgba(168, 85, 247, 0.7)'
                : '1px dashed rgba(255, 255, 255, 0.15)',
            color:
              activeTab === 'aix' || (audioMode === 'clone' && currentRefAudio)
                ? '#c084fc'
                : 'rgba(255, 255, 255, 0.4)',
            fontSize: '13px',
            cursor:
              activeTab === 'aix' || audioMode === 'clone' ? 'pointer' : 'not-allowed',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            outline: 'none',
            flexShrink: 0,
            transition: 'all 0.2s',
            opacity: activeTab === 'aix' || audioMode === 'clone' ? 1 : 0.5
          }}
        >
          {activeTab === 'aix' ? '🎯' : audioMode === 'clone' && currentRefAudio ? '🎙️' : '＋'}
        </button>

        {/* 极窄输入文本域 */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <WorkflowTextarea
            value={currentText}
            disabled={isTextConnected}
            onChange={(val) => handleInputChange('text', val)}
            mentionItems={isTextConnected ? [{ id: `${id}-upstream-text`, name: '上游台词文本', type: 'text', token: '@[文本1] ' }] : []}
            placeholder={
              isTextConnected
                ? '🔗 已通过连线驱动装载配音台词描述...'
                : audioMode === 'music'
                ? '请输入音乐歌词或风格描述，或者连线文本节点...'
                : '在此编写配音旁白台词，或者连线文本节点...'
            }
            style={{
              minHeight: '80px',
              color: isTextConnected ? 'rgba(255, 255, 255, 0.45)' : '#fff',
              padding: '5px 10px',
              transition: 'all 0.2s'
            }}
          />
        </div>

        {/* 开始合成生成大按钮 */}
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
          <button
            onClick={handleVoiceClone}
            disabled={cloning}
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
            onMouseEnter={(e) => {
              e.currentTarget.style.boxShadow = '0 6px 16px rgba(168, 85, 247, 0.45)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.boxShadow = '0 4px 12px rgba(168, 85, 247, 0.3)';
            }}
          >
            {cloning ? '正在声色合成...' : '开始生成'}
          </button>
          {data.inputs?.customTemplate && (
            <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold', letterSpacing: '0.5px' }}>
              {data.inputs.customTemplate.source === 'runninghub' ? '⚡ RH工作流' : '💻 CF工作流'}
            </span>
          )}
        </div>
      </div>

      <hr style={{ border: 'none', borderTop: '1px solid rgba(255, 255, 255, 0.05)', margin: '2px 0' }} />

      {/* Row 2: 极简圆角胶囊 Pill 按钮组 */}
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
          <>
            <button
              className={`pill-capsule-button ${activePopover === 'model' ? 'active' : ''}`}
              onClick={() => setActivePopover(activePopover === 'model' ? null : 'model')}
            >
              🌐 模型: {activeTab === 'aix' ? 'RunningHub 云端' : model} ▼
            </button>

            {/* 2. 工作模式胶囊 */}
            <button
              className={`pill-capsule-button ${activePopover === 'mode' ? 'active' : ''}`}
              onClick={() => setActivePopover(activePopover === 'mode' ? null : 'mode')}
            >
              ⚙️ 模式: {getModeLabel()} ▼
            </button>

            {/* 3. 动态配置胶囊 (根据 standard/aix 对应分流为音色库或云表单) */}
            {activeTab === 'aix' ? (
              <button
                className={`pill-capsule-button ${activePopover === 'workflow' ? 'active' : ''}`}
                onClick={() => setActivePopover(activePopover === 'workflow' ? null : 'workflow')}
              >
                🎯 参数配置: {data.inputs?.runningHubWorkflowName ? '已装载' : '未选择'} ▼
              </button>
            ) : (
              <button
                className={`pill-capsule-button ${activePopover === 'voice' ? 'active' : ''}`}
                onClick={() => setActivePopover(activePopover === 'voice' ? null : 'voice')}
                disabled={audioMode === 'music'} // 只有 AI 音乐模式下不需要配置音色，语音克隆与文本转语音均能配置音色 ID
                style={{ opacity: audioMode === 'music' ? 0.5 : 1 }}
              >
                🎙️ 音色/参数: {currentRefAudio || data.inputs?.referenceId ? '已就绪' : '未配置'} ▼
              </button>
            )}
          </>
        )}

        <div style={{ flex: 1 }} />

        {/* 端口输出标注 */}
        <span style={{ fontSize: '9px', color: 'rgba(255, 255, 255, 0.35)', whiteSpace: 'nowrap' }}>
          输出: audio (outputs.audio)
        </span>
      </div>

      {/* ---------------- Popovers 浮窗卡片列表 ---------------- */}

      {/* Popover 1: 模型选择 (带二级联动) */}
      {activePopover === 'model' && (
        <div 
          className="popover-floating-card nodrag" 
          onMouseDown={(e) => e.stopPropagation()} 
          onTouchStart={(e) => e.stopPropagation()} 
          style={{ width: '220px', left: '15%' }}
        >
          {activeTab === 'aix' ? (
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '6px' }}>
              💡 云端工作流已由模版配置托管，无需在节点端设置物理大模型。
            </div>
          ) : audioMode === 'tts' ? (
            <>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', fontWeight: 'bold', paddingBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                🎙️ 配音大模型服务商
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px', marginTop: '4px' }}>
                {activeProviders.map((v) => {
                  // 使用统一的模型获取函数
                  const finalModels = getModelsForProvider(v.id, 'tts', settings);

                  // 如果没有匹配的模型，显示禁用状态
                  if (finalModels.length === 0) {
                    return (
                      <div 
                        key={v.id} 
                        className="hover-vendor-item"
                        style={{ opacity: 0.5, cursor: 'default' }}
                      >
                        <span>{v.name}</span>
                        <span style={{ fontSize: '8px', opacity: 0.3 }}>—</span>
                      </div>
                    );
                  }

                  return (
                    <div
                      key={v.id}
                      className={`hover-vendor-item ${providerId === v.id ? 'active' : ''}`}
                      onClick={() => {
                        handleInputChange('providerId', v.id);
                        handleInputChange('model', finalModels[0] || '');
                      }}
                    >
                      <span>{v.name}</span>
                      <span style={{ fontSize: '8px', opacity: 0.5 }}>▶</span>

                      {/* 二级联动下拉 */}
                      <div className="sub-model-list-hover">
                        <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.45)', padding: '2px 4px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: '4px' }}>
                          选择具体模型：
                        </div>
                        {finalModels.map((m: string) => (
                          <button
                            key={m}
                            onClick={(e) => {
                              e.stopPropagation();
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
                        {finalModels.length === 0 && (
                          <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.3)', padding: '8px', textAlign: 'center' }}>
                            暂无可用模型
                          </div>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </>
          ) : audioMode === 'music' ? (
            <>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', fontWeight: 'bold', paddingBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                🎵 Suno 音乐创作模型
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                {musicModels.map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      handleInputChange('model', m);
                      setActivePopover(null);
                    }}
                    style={{
                      background: model === m ? 'rgba(168, 85, 247, 0.25)' : 'rgba(255, 255, 255, 0.02)',
                      border: 'none',
                      borderRadius: '4px',
                      color: model === m ? '#fff' : 'rgba(255,255,255,0.7)',
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
          ) : (
            <>
              <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', fontWeight: 'bold', paddingBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
                🧬 极速声线克隆大模型
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
                {cloneModels.map((m) => (
                  <button
                    key={m}
                    onClick={() => {
                      handleInputChange('model', m);
                      setActivePopover(null);
                    }}
                    style={{
                      background: model === m ? 'rgba(168, 85, 247, 0.25)' : 'rgba(255, 255, 255, 0.02)',
                      border: 'none',
                      borderRadius: '4px',
                      color: model === m ? '#fff' : 'rgba(255,255,255,0.7)',
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

      {/* Popover 2: 工作模式 */}
      {activePopover === 'mode' && (
        <div 
          className="popover-floating-card nodrag" 
          onMouseDown={(e) => e.stopPropagation()} 
          onTouchStart={(e) => e.stopPropagation()} 
          style={{ width: '200px', left: '42%' }}
        >
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', fontWeight: 'bold', paddingBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            ⚙️ 切换音频创作模式
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '4px' }}>
            {[
              { id: 'tts', label: '🎙️ 文本转语音 (TTS)' },
              { id: 'music', label: '🎵 音乐创作 (Suno)' },
              { id: 'clone', label: '🧬 语音克隆 (Clone)' },
              { id: 'aix', label: '⚡ ComfyUI 工作流 (aix)' }
            ].map((item) => {
              const isSel = item.id === 'aix' ? activeTab === 'aix' : activeTab === 'standard' && audioMode === item.id;
              return (
                <button
                  key={item.id}
                  onClick={() => {
                    if (item.id === 'aix') {
                      handleTabChange('aix');
                    } else {
                      handleTabChange('standard');
                      handleInputChange('audioMode', item.id);
                      if (item.id === 'tts') {
                        handleInputChange('providerId', 'openai');
                        handleInputChange('model', 'tts-1');
                      } else if (item.id === 'music') {
                        handleInputChange('providerId', 'suno');
                        handleInputChange('model', 'Suno-v4');
                      } else if (item.id === 'clone') {
                        handleInputChange('providerId', 'minimax');
                        handleInputChange('model', 'Minimax-TTS-Clone');
                      }
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
                  {item.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Popover 3: 声音参数设置 (文本转语音与语音克隆共用配置) */}
      {activePopover === 'voice' && audioMode !== 'music' && (
        <div 
          className="popover-floating-card nodrag" 
          onMouseDown={(e) => e.stopPropagation()} 
          onTouchStart={(e) => e.stopPropagation()} 
          style={{ width: '280px', left: '50%' }}
        >
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', fontWeight: 'bold', paddingBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
            🧬 语音克隆参考源与配参
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '4px' }}>
            {/* 克隆素材插槽 */}
            <div style={{ background: 'rgba(0,0,0,0.2)', padding: '8px', borderRadius: '6px', border: '1px solid rgba(255,255,255,0.05)' }}>
              {currentRefAudio ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '9.5px', color: '#0ea5e9', fontWeight: 'bold' }}>
                      {isRefAudioConnected ? '🔗 连线音色素材已装载' : '克隆角色音频已就绪'}
                    </span>
                    {!isRefAudioConnected && (
                      <button
                        onClick={() => handleInputChange('refAudio', '')}
                        style={{
                          background: 'rgba(239, 68, 68, 0.85)',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '50%',
                          width: '14px',
                          height: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: '8.5px',
                          cursor: 'pointer'
                        }}
                      >
                        ×
                      </button>
                    )}
                  </div>
                  <ResolvedMedia url={currentRefAudio} type="audio" controls style={{ width: '100%', height: '24px', outline: 'none' }} />
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', alignItems: 'center', justifyContent: 'center', padding: '12px 0' }}>
                  <span style={{ fontSize: '11px', color: 'rgba(255,255,255,0.4)' }}>⏳ 未装载音色，请先添加</span>
                  <div style={{ display: 'flex', gap: '6px' }}>
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      style={{ padding: '4px 8px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)', borderRadius: '4px', color: '#fff', fontSize: '9px', cursor: 'pointer' }}
                    >
                      本地上传
                    </button>
                    <button
                      onClick={() => {
                        handleOpenAssetsModal('audio');
                        setActivePopover(null);
                      }}
                      style={{ padding: '4px 8px', background: 'rgba(14, 165, 233, 0.15)', border: '1px solid rgba(14, 165, 233, 0.3)', borderRadius: '4px', color: '#bae6fd', fontSize: '9px', cursor: 'pointer' }}
                    >
                      📂 素材库
                    </button>
                  </div>
                </div>
              )}
            </div>

            {/* 参数表单 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
              {/* 仅当 direct 模式提供声音 ID / reference_id 输入框 */}
              {mode === 'direct' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.45)' }}>声音 ID (reference_id):</span>
                    <span style={{ fontSize: '7.5px', color: 'rgba(168, 85, 247, 0.85)' }}>鱼声 API 专享</span>
                  </div>
                  <input
                    type="text"
                    value={data.inputs?.referenceId || ''}
                    placeholder="输入 UUID (如 70cfa7460c804b37875f...)"
                    className="nodrag"
                    onMouseDown={(e) => e.stopPropagation()}
                    onChange={(e) => handleInputChange('referenceId', e.target.value)}
                    style={{
                      width: '100%',
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255, 255, 255, 0.08)',
                      borderRadius: '6px',
                      padding: '5px 8px',
                      color: '#fff',
                      fontSize: '10px',
                      outline: 'none'
                    }}
                  />
                </div>
              )}

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.45)' }}>克隆角色名称:</span>
                <input
                  type="text"
                  value={characterName || ''}
                  placeholder="例如：周杰伦、可爱萝莉"
                  className="nodrag"
                  onMouseDown={(e) => e.stopPropagation()}
                  onChange={(e) => handleInputChange('characterName', e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '6px',
                    padding: '5px 8px',
                    color: '#fff',
                    fontSize: '10px',
                    outline: 'none'
                  }}
                />
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.45)' }}>克隆技术路径:</span>
                <select
                  value={mode || 'direct'}
                  onChange={(e) => handleInputChange('mode', e.target.value)}
                  style={{
                    width: '100%',
                    background: 'rgba(0,0,0,0.3)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    borderRadius: '6px',
                    padding: '5px 8px',
                    color: '#fff',
                    fontSize: '10px',
                    outline: 'none',
                    cursor: 'pointer'
                  }}
                >
                  <option value="direct">🎙️ Direct API 极速音色克隆</option>
                  <option value="comfyui">⚡ ComfyUI 工作流合成</option>
                </select>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Popover 4: aix RunningHub 工作流参数表单 */}
      {activePopover === 'workflow' && (
        <div 
          className="popover-floating-card nodrag" 
          onMouseDown={(e) => e.stopPropagation()} 
          onTouchStart={(e) => e.stopPropagation()} 
          style={{ width: '280px', left: '15%', maxHeight: '280px', overflowY: 'auto' }}
        >
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
                    const isAudio = p.type === 'audio' || fieldLower === 'audio' || fieldLower === 'refaudio' || fieldLower === 'ref_audio' || displayLower.includes('音频') || displayLower.includes('声音') || displayLower.includes('配音');

                    return !isText && !isAudio;
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
                        detail: { tab: 'templates', nodeTarget: id, type: 'audio' }
                      })
                    );
                    setActivePopover(null);
                  }}
                  style={{
                    width: '100%',
                    padding: '8px 10px',
                    background: 'rgba(14, 165, 233, 0.1)',
                    border: '1px dashed rgba(14, 165, 233, 0.4)',
                    borderRadius: '6px',
                    color: '#bae6fd',
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
                    <span style={{ fontSize: '10px', color: '#38bdf8', fontWeight: 'bold' }}>
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
                {currentTemplate && (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '6px', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: '6px' }}>
                    {currentTemplate.nodeInfoList.map((info: any) => {
                      const lowerName = info.fieldName.toLowerCase();
                      const isText = lowerName === 'text' || lowerName === 'prompt';
                      const isAudio = lowerName === 'audio' || lowerName === 'refaudio';
                      const inputKey = `${info.nodeId}_${info.fieldName}`;
                      const currentVal = data.inputs?.[inputKey] !== undefined ? data.inputs[inputKey] : info.fieldValue;

                      return (
                        <div key={inputKey} style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                            <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.55)' }}>
                              {info.description || info.fieldName} (节点: {info.nodeId})
                            </span>
                            {isText && isTextConnected && <span style={{ color: '#a855f7', fontSize: '8px' }}>🔗 连线驱动</span>}
                            {isAudio && isRefAudioConnected && <span style={{ color: '#a855f7', fontSize: '8px' }}>🔗 连线驱动</span>}
                          </div>

                          {isText ? (
                            <WorkflowTextarea
                              disabled={isTextConnected}
                              value={isTextConnected ? currentText : currentVal}
                              onChange={(val) => handleInputChange(inputKey, val)}
                              mentionItems={isTextConnected ? [{ id: `${inputKey}-upstream-text`, name: '上游台词文本', type: 'text', token: '@[文本1] ' }] : []}
                              style={{
                                minHeight: '80px',
                                padding: '4px 6px',
                                color: isTextConnected ? 'rgba(255,255,255,0.45)' : '#fff',
                                borderRadius: '8px'
                              }}
                            />
                          ) : isAudio ? (
                            <div style={{ display: 'flex', alignItems: 'center', gap: '4px', background: 'rgba(0,0,0,0.15)', padding: '4px', borderRadius: '4px' }}>
                              <span style={{ fontSize: '11px' }}>🎙️</span>
                              <span style={{ fontSize: '8.5px', color: 'rgba(255,255,255,0.4)' }}>
                                {currentRefAudio ? '克隆配音已装载' : '等待连线或添加音色'}
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
};
