import React from 'react';
import { DEFAULT_PROVIDER_IMAGE_MODELS } from './useImageNodeLogic';
import { ResolvedMedia } from '../../ResolvedMedia';

// 性能特优且酷炫的 inline badge 解析器：文本 -> 富文本 HTML (绿色高亮带微缩图)
const convertPromptToHTML = (text: string, connectedImages: any[]) => {
  if (!text) return '';
  let html = text;
  
  // 安全转义 HTML
  html = html
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

  connectedImages.forEach((img, idx) => {
    const target = `@[图${idx + 1}]`;
    const badgeHTML = `<span contenteditable="false" class="mention-inline-badge" style="display: inline-flex; align-items: center; gap: 3.5px; color: #10b981; font-weight: bold; background: rgba(16, 185, 129, 0.08); border: 1.5px solid rgba(16, 185, 129, 0.25); padding: 2px 6px; border-radius: 4px; vertical-align: middle; margin: 0 3px; font-size: 10px; user-select: none;">` +
      `<img src="${img.url}" style="width: 13px; height: 13px; border-radius: 2px; object-fit: cover;" />` +
      `@图片${idx + 1}` +
      `</span>&nbsp;`;
    
    html = html.split(target).join(badgeHTML);
  });
  
  return html;
};

// 反向解析器：富文本 HTML -> 标准 @[图X] 文本
const convertHTMLToPrompt = (html: string) => {
  const tempDiv = document.createElement('div');
  tempDiv.innerHTML = html;
  
  const badges = tempDiv.querySelectorAll('.mention-inline-badge');
  badges.forEach(badge => {
    const textContent = badge.textContent || '';
    const match = textContent.match(/@图片(\d+)/);
    if (match) {
      const idx = match[1];
      const textNode = document.createTextNode(`@[图${idx}]`);
      badge.parentNode?.replaceChild(textNode, badge);
    }
  });
  
  return tempDiv.innerText;
};

export interface ConfigPanelProps {
  id: string;
  data: any;
  providerId: string;
  size: string;
  cfg: number;
  steps: number;
  refImages: any[];
  promptInput: string;
  showMentionList: boolean;
  mentionSearch: string;
  connectedImages: any[];
  activeTab: 'standard' | 'aix';
  currentTemplate: any;
  currentProviderModels: string[];
  model: string;
  currentPrompt: string;
  isPromptConnected: boolean;
  isFaceRefConnected: boolean;
  generating: boolean;
  activePopover: 'model' | 'specs' | 'gallery' | 'runninghub' | 'batchSize' | null;
  fileInputRef: React.RefObject<HTMLInputElement | null>;

  handleTabChange: (tab: 'standard' | 'aix') => void;
  handleInputChange: (field: string, val: any) => void;
  handleFileChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleRemoveRefImage: (index: number) => void;
  handleOpenAssetsModal: () => void;
  handleSelectMention: (index: number, name: string) => void;
  handlePromptChange: (val: string) => void;
  handleGenerateImage: () => void;
  handleDownloadImage: () => void;
  setActivePopover: (popover: 'model' | 'specs' | 'gallery' | 'runninghub' | 'batchSize' | null) => void;
  handleAddRefImagePhysicalNode: () => void;
}

export const ConfigPanel: React.FC<ConfigPanelProps> = ({
  id,
  data,
  providerId,
  size,
  cfg,
  steps,
  refImages,
  promptInput,
  showMentionList,
  mentionSearch,
  connectedImages,
  activeTab,
  currentTemplate,
  currentProviderModels,
  model,
  currentPrompt,
  isPromptConnected,
  isFaceRefConnected,
  generating,
  activePopover,
  fileInputRef,
  handleTabChange,
  handleInputChange,
  handleFileChange,
  handleRemoveRefImage,
  handleOpenAssetsModal,
  handleSelectMention,
  handlePromptChange,
  handleGenerateImage,
  handleDownloadImage,
  setActivePopover,
}) => {


  // 极精细富文本控制
  const editorRef = React.useRef<HTMLDivElement>(null);

  const containerRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);

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
  }, [activePopover, setActivePopover]);

  // 提示词文本框高度根据字数自适应变大 (最小 42px，最大 160px，写满 6 行后超出滚动)
  React.useEffect(() => {
    const textarea = textareaRef.current;
    if (textarea) {
      textarea.style.height = 'auto';
      const scrollHeight = textarea.scrollHeight;
      textarea.style.height = `${Math.min(Math.max(scrollHeight, 42), 160)}px`;
    }
  }, [currentPrompt]);

  // 辅助：一键打开 ComfyUI 云端工作流大屏中心
  const handleOpenWorkflowsModal = () => {
    window.dispatchEvent(
      new CustomEvent('open-large-modal', {
        detail: { tab: 'workflows', nodeTarget: id, type: 'image' }
      })
    );
  };

  const ASPECT_RATIOS = [
    { value: '1:1', label: '1:1' },
    { value: '2:3', label: '2:3' },
    { value: '3:2', label: '3:2' },
    { value: '4:5', label: '4:5' },
    { value: '5:4', label: '5:4' },
    { value: '16:9', label: '16:9' },
    { value: '9:16', label: '9:16' },
    { value: '21:9', label: '21:9' },
    { value: '3:4', label: '3:4' },
    { value: '4:3', label: '4:3' },
    { value: '公众号封面', label: '微信公众号封面' },
    { value: '小红书封面', label: '小红书封面' },
    { value: '公众号配图', label: '微信公众号配图' },
    { value: '抖音封面', label: '抖音短视频封面' },
    { value: '快手封面', label: '快手短视频封面' },
    { value: 'bilibili封面', label: 'B站视频封面' },
    { value: 'YouTube封面', label: 'YouTube封面' }
  ];

  const currentRatio = data.inputs?.aspectRatio || '1:1';
  const currentQuality = data.inputs?.quality || '中';
  const currentResolution = data.inputs?.resolution || '1k';

  const updateSpecs = (ratio: string, qual: string, res: string) => {
    let stepsVal = 20;
    if (qual === '低') stepsVal = 15;
    else if (qual === '高') stepsVal = 35;

    let w = 1024;
    let h = 1024;

    if (ratio === '16:9') { w = 1280; h = 720; }
    else if (ratio === '9:16') { w = 720; h = 1280; }
    else if (ratio === '2:3') { w = 832; h = 1248; }
    else if (ratio === '3:2') { w = 1248; h = 832; }
    else if (ratio === '4:5') { w = 896; h = 1120; }
    else if (ratio === '5:4') { w = 1120; h = 896; }
    else if (ratio === '3:4') { w = 896; h = 1192; }
    else if (ratio === '4:3') { w = 1192; h = 896; }
    else if (ratio === '21:9') { w = 1280; h = 544; }
    else if (ratio === '公众号封面') { w = 900; h = 383; }
    else if (ratio === '小红书封面') { w = 1242; h = 1660; }
    else if (ratio === '公众号配图') { w = 1000; h = 1000; }
    else if (ratio === '抖音封面' || ratio === '快手封面') { w = 1080; h = 1920; }
    else if (ratio === 'bilibili封面') { w = 1146; h = 717; }
    else if (ratio === 'YouTube封面') { w = 1280; h = 720; }

    let multiplier = 1.0;
    if (res === '2k') multiplier = 1.5;
    else if (res === '4K') multiplier = 2.0;

    const finalW = Math.round(w * multiplier);
    const finalH = Math.round(h * multiplier);

    handleInputChange('aspectRatio', ratio);
    handleInputChange('quality', qual);
    handleInputChange('resolution', res);
    handleInputChange('steps', stepsVal);
    handleInputChange('size', `${finalW}x${finalH}`);
  };

  const currentProviderLabel = React.useMemo(() => {
    const labels: Record<string, string> = {
      minimax: 'MiniMax (海螺)',
      ali: '通义万相',
      volcengine: '火山引擎 (豆包)',
      openai: 'OpenAI Dall-E'
    };
    return labels[providerId] || providerId;
  }, [providerId]);

  return (
    <React.Fragment>
      
      {/* 10000px 物理遮罩已彻底剔除，升级为超轻量 containerRef 全局 document 监听，完美根治拖拽粘连 Bug */}

      {/* 580px 玻璃拟态极窄面板 - 定位调整为物理绝对粘性的 top: '190px'，彻底焊接，绝不分离 */}
      <div
        ref={containerRef}
        className="nodrag"
        style={{
          position: 'absolute',
          top: '190px', // 紧贴 180px 卡片底部，10px 边距无缝组合
          left: '50%',
          transform: 'translateX(-50%)',
          width: '580px',
          background: 'rgba(11, 15, 26, 0.95)',
          backdropFilter: 'blur(16px)',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.65), 0 0 30px rgba(168, 85, 247, 0.1)',
          borderRadius: '16px',
          padding: '10px 14px',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          zIndex: 2000,
          animation: 'slideUpBar 0.25s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        <style>{`
          @keyframes slideUpBar {
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
            white-space: normal;
            word-break: break-all;
            max-width: 145px;
            line-height: 1.25;
            text-align: center;
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
            width: 320px;
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
            width: 180px;
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
          .grid-ratio-button {
            background: rgba(255,255,255,0.02);
            border: 1px solid rgba(255,255,255,0.08);
            border-radius: 6px;
            color: rgba(255,255,255,0.6);
            font-size: 9.5px;
            padding: 5px 0;
            cursor: pointer;
            transition: all 0.15s;
            text-align: center;
            font-weight: bold;
          }
          .grid-ratio-button:hover, .grid-ratio-button.active {
            background: rgba(168, 85, 247, 0.2);
            border-color: rgba(168, 85, 247, 0.6);
            color: #fff;
          }
          
          /* 富文本 div 占位符 placeholder CSS 完美拟态 */
          .rich-prompt-editor:empty:before {
            content: attr(placeholder);
            color: rgba(255, 255, 255, 0.35);
            font-style: normal;
            pointer-events: none;
            display: block;
          }
          
          /* 炫酷的 inline badge 微型缩略图悬浮气泡 */
          .mention-inline-badge {
            animation: badgeBounceIn 0.25s cubic-bezier(0.175, 0.885, 0.32, 1.275);
            box-shadow: 0 2px 6px rgba(16, 185, 129, 0.15);
          }
          @keyframes badgeBounceIn {
            from { transform: scale(0.85); opacity: 0; }
            to { transform: scale(1); opacity: 1; }
          }
        `}</style>

        {/* 隐藏本地上传 input */}
        <input type="file" ref={fileInputRef as any} onChange={handleFileChange} accept="image/*,video/*,audio/*" multiple style={{ display: 'none' }} />

        {/* 极窄常驻生图控制行 */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', position: 'relative' }}>
          {/* 画廊常驻方纽 */}
          <button
            onClick={() => setActivePopover(activePopover === 'gallery' ? null : 'gallery')}
            title="管理画廊/添加参考图"
            style={{
              width: '30px',
              height: '30px',
              borderRadius: '8px',
              background: refImages.length > 0 ? 'rgba(168, 85, 247, 0.1)' : 'rgba(255,255,255,0.03)',
              border: refImages.length > 0 ? '1.5px solid rgba(168, 85, 247, 0.7)' : '1px dashed rgba(255,255,255,0.15)',
              color: refImages.length > 0 ? '#c084fc' : 'rgba(255,255,255,0.4)',
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
            {refImages.length > 0 ? `🖼️` : `＋`}
          </button>

          {/* Prompt 提示词框 & 微型缩略图引用 Tag 渲染 */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '2px' }}>
            {/* 极简经典极窄输入框 - 完美还原原生输入稳定性与顺畅打字体验 */}
            <textarea
              ref={textareaRef}
              value={currentPrompt}
              disabled={isPromptConnected}
              className="nodrag custom-scrollbar"
              onMouseDown={(e) => e.stopPropagation()}
              onChange={(e) => handlePromptChange(e.target.value)}
              placeholder={isPromptConnected ? "" : "描述你想生成的内容，使用 @ 引用上游已连线的图像..."}
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
                fontSize: '11.5px',
                lineHeight: '1.4',
                padding: '10px 10px',
                fontFamily: 'var(--font-sans)',
                overflowY: 'auto',
                whiteSpace: 'pre-wrap',
                wordBreak: 'break-word',
                transition: 'border-color 0.2s'
              }}
              onFocus={(e) => e.currentTarget.style.borderColor = 'rgba(168, 85, 247, 0.4)'}
              onBlur={(e) => e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.08)'}
            />

            {/* @ 选中的图像在文本框正下方渲染极其惊艳的“微型缩略图 Tag”组 (第 5 点) */}
            <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '1px' }}>
              {connectedImages.map((img, idx) => {
                const label = img.type === 'image' ? '图' : img.type === 'video' ? '视频' : '音频';
                const isMentioned = promptInput.includes(`@[${label}${idx + 1}]`) || promptInput.includes(`[${img.nodeName}]`);
                if (isMentioned) {
                  return (
                    <div 
                      key={img.nodeId} 
                      style={{ 
                        display: 'flex', 
                        alignItems: 'center', 
                        gap: '4px', 
                        background: 'rgba(168, 85, 247, 0.12)', 
                        border: '1px solid rgba(168, 85, 247, 0.3)', 
                        borderRadius: '4px', 
                        padding: '1px 5px', 
                        fontSize: '8.5px', 
                        color: '#e9d5ff',
                        boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
                        transition: 'all 0.15s'
                      }}
                    >
                      <ResolvedMedia url={img.url} type={img.type} style={{ width: '12px', height: '12px', borderRadius: '2px', objectFit: 'cover' }} />
                      <span>@{label}{idx + 1}</span>
                    </div>
                  );
                }
                return null;
              })}
            </div>

            {/* @ Mention 弹出下拉单 */}
            {showMentionList && connectedImages.length > 0 && (
              <div
                style={{
                  position: 'absolute',
                  bottom: '100%',
                  left: 0,
                  background: 'rgba(11, 15, 26, 0.98)',
                  border: '1px solid rgba(255, 255, 255, 0.1)',
                  borderRadius: '8px',
                  boxShadow: '0 10px 20px rgba(0,0,0,0.5)',
                  width: '200px',
                  padding: '4px',
                  zIndex: 3000,
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '2px'
                }}
              >
                <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.4)', padding: '4px 6px', fontWeight: 'bold' }}>
                  🔗 引用上游已连线图像：
                </div>
                {connectedImages.map((img, idx) => {
                  const label = img.type === 'image' ? '图' : img.type === 'video' ? '视频' : '音频';
                  return (
                    <div
                      key={img.nodeId}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        e.stopPropagation();
                        handleSelectMention(idx, img.nodeName);
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
                      <ResolvedMedia url={img.url} type={img.type} style={{ width: '16px', height: '16px', borderRadius: '2px', objectFit: 'cover' }} />
                      <span>{img.nodeName} ({label}{idx + 1})</span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* 生成按钮 */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '3px', flexShrink: 0 }}>
            <button
              onClick={handleGenerateImage}
              disabled={generating}
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
                outline: 'none'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.boxShadow = '0 6px 16px rgba(168, 85, 247, 0.45)'; }}
              onMouseLeave={(e) => { e.currentTarget.style.boxShadow = '0 4px 12px rgba(168, 85, 247, 0.3)'; }}
            >
              {generating ? '🎨 渲染中...' : '开始生成'}
            </button>
            {data.inputs?.customTemplate && (
              <span style={{ fontSize: '8px', color: 'rgba(255,255,255,0.4)', fontWeight: 'bold', letterSpacing: '0.5px' }}>
                {data.inputs.customTemplate.source === 'runninghub' ? '⚡ RH工作流' : '💻 CF工作流'}
              </span>
            )}
          </div>
        </div>

        <hr style={{ border: 'none', borderTop: '1px solid rgba(255, 255, 255, 0.05)', margin: '2px 0' }} />

        {/* 底部胶囊 Pill 横排 - 完美删掉多余的画廊重复胶囊按钮 (第 1 点) */}
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          {/* 大模型 - 自适应本地ComfyUI/RunningHub参数微调 */}
          {data.inputs?.customTemplate ? (
            <React.Fragment>
              <button 
                className={`pill-capsule-button ${activePopover === 'runninghub' ? 'active' : ''}`}
                onClick={() => setActivePopover(activePopover === 'runninghub' ? null : 'runninghub')}
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
            </React.Fragment>
          ) : (
            <button 
              className={`pill-capsule-button ${activePopover === 'model' ? 'active' : ''}`}
              onClick={() => setActivePopover(activePopover === 'model' ? null : 'model')}
            >
              🌐 选择模型 ▼
            </button>
          )}

          {/* 参数控制面板 */}
          <button 
            className={`pill-capsule-button ${activePopover === 'specs' ? 'active' : ''}`}
            onClick={() => setActivePopover(activePopover === 'specs' ? null : 'specs')}
          >
            ⚙️ 参数控制面板 ▼
          </button>

          {/* ComfyUI 工作流 - 点击直接打开大模态框工作流中心选择，去除繁琐二级菜单，实现无感直连 */}
          {!data.inputs?.customTemplate && (
            <button 
              className="pill-capsule-button"
              onClick={handleOpenWorkflowsModal}
            >
              ⚡ {data.inputs?.runningHubWorkflowName ? `ComfyUI: ${data.inputs.runningHubWorkflowName}` : 'ComfyUI 工作流'} ▼
            </button>
          )}


        </div>

        {/* ---------------- Popover 浮窗 ---------------- */}

        {/* Popover 1: 模型厂商及 Hover 级联 */}
        {activePopover === 'model' && (
          <div className="popover-floating-card" style={{ width: '220px', left: '15%' }}>
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.45)', fontWeight: 'bold', paddingBottom: '4px', borderBottom: '1px solid rgba(255,255,255,0.06)' }}>
              🌐 大模型生图驱动商
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
              {[
                { id: 'minimax', label: 'MiniMax (海螺)' },
                { id: 'ali', label: '通义万相 (Ali)' },
                { id: 'volcengine', label: '火山引擎 (豆包)' },
                { id: 'openai', label: 'OpenAI (DallE)' }
              ].map(v => (
                <div 
                  key={v.id} 
                  className={`hover-vendor-item ${providerId === v.id ? 'active' : ''}`}
                  onClick={() => {
                    handleInputChange('providerId', v.id);
                    const providerModels = DEFAULT_PROVIDER_IMAGE_MODELS[v.id] || [];
                    handleInputChange('model', providerModels[0]);
                  }}
                >
                  <span>{v.label}</span>
                  <span style={{ fontSize: '8px', opacity: 0.5 }}>▶</span>

                  {/* 二级级联 */}
                  <div className="sub-model-list-hover">
                    <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.45)', padding: '2px 4px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: '4px' }}>
                      选择具体模型：
                    </div>
                    {(DEFAULT_PROVIDER_IMAGE_MODELS[v.id] || []).map((m: string) => (
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
                          width: '100%',
                          transition: 'all 0.15s'
                        }}
                        onMouseEnter={(e) => e.currentTarget.style.background = 'rgba(168, 85, 247, 0.15)'}
                        onMouseLeave={(e) => {
                          if (model !== m) e.currentTarget.style.background = 'transparent';
                        }}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Popover 2: 参数控制面板 */}
        {activePopover === 'specs' && (
          <div className="popover-floating-card" style={{ width: '380px', left: '50%', transform: 'translateX(-50%)' }}>
            <div style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.5)', fontWeight: 'bold', display: 'flex', alignItems: 'center', gap: '4px', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '4px' }}>
              <span>📐 参数控制面板</span>
            </div>

            {/* 17 种长宽比胶囊 Grid 网格 */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', color: 'rgba(255,255,255,0.45)' }}>
                <span>画面自适应长宽比 (17类)</span>
                <span style={{ color: '#c084fc', fontWeight: 'bold' }}>{currentRatio}</span>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: '4px', maxHeight: '110px', overflowY: 'auto', background: 'rgba(0,0,0,0.2)', padding: '6px', borderRadius: '8px' }}>
                {ASPECT_RATIOS.map(item => (
                  <button
                    key={item.value}
                    onClick={() => updateSpecs(item.value, currentQuality, currentResolution)}
                    className={`grid-ratio-button ${currentRatio === item.value ? 'active' : ''}`}
                    title={item.label}
                  >
                    {item.value}
                  </button>
                ))}
              </div>
            </div>

            {/* 图像质量 (低、中、高) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '2px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', color: 'rgba(255,255,255,0.45)' }}>
                <span>图像质量</span>
                <span style={{ color: '#c084fc', fontWeight: 'bold' }}>{currentQuality}档 ({steps}步)</span>
              </div>
              <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.2)', padding: '2px', borderRadius: '6px' }}>
                {['低', '中', '高'].map(q => (
                  <button
                    key={q}
                    onClick={() => updateSpecs(currentRatio, q, currentResolution)}
                    style={{
                      flex: 1,
                      background: currentQuality === q ? 'rgba(168, 85, 247, 0.25)' : 'transparent',
                      border: 'none',
                      borderRadius: '4px',
                      color: currentQuality === q ? '#fff' : 'rgba(255,255,255,0.5)',
                      fontSize: '9.5px',
                      padding: '4px 0',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      transition: 'all 0.15s'
                    }}
                  >
                    {q}
                  </button>
                ))}
              </div>
            </div>

            {/* 分辨率 (1k, 2k, 4K) */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '4px', marginTop: '2px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '9.5px', color: 'rgba(255,255,255,0.45)' }}>
                <span>物理输出分辨率</span>
                <span style={{ color: '#c084fc', fontWeight: 'bold' }}>{currentResolution} ({size})</span>
              </div>
              <div style={{ display: 'flex', gap: '4px', background: 'rgba(0,0,0,0.2)', padding: '2px', borderRadius: '6px' }}>
                {['1k', '2k', '4K'].map(r => (
                  <button
                    key={r}
                    onClick={() => updateSpecs(currentRatio, currentQuality, r)}
                    style={{
                      flex: 1,
                      background: currentResolution === r ? 'rgba(168, 85, 247, 0.25)' : 'transparent',
                      border: 'none',
                      borderRadius: '4px',
                      color: currentResolution === r ? '#fff' : 'rgba(255,255,255,0.5)',
                      fontSize: '9.5px',
                      padding: '4px 0',
                      cursor: 'pointer',
                      fontWeight: 'bold',
                      transition: 'all 0.15s'
                    }}
                  >
                    {r}
                  </button>
                ))}
              </div>
            </div>
          </div>
        )}



        {/* Popover 4: 画廊弹窗 */}
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
              <span>🖼️ 角色参考图画廊 ({refImages.length}/6)</span>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: '6px', maxHeight: '160px', overflowY: 'auto' }}>
              {refImages.map((img, idx) => (
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
                  {img.type === 'audio' ? (
                    <div style={{ width: '100%', height: '100%', background: 'linear-gradient(135deg, #1e1b4b 0%, #311042 100%)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '4px' }}>
                      <span style={{ fontSize: '20px', display: 'block' }}>🎵</span>
                      <span style={{ fontSize: '8px', color: '#c084fc', textOverflow: 'ellipsis', overflow: 'hidden', whiteSpace: 'nowrap', maxWidth: '80%', display: 'block' }}>音频</span>
                    </div>
                  ) : img.type === 'video' ? (
                    <div style={{ width: '100%', height: '100%', position: 'relative' }}>
                      <ResolvedMedia url={img.url} type="video" autoPlay loop muted playsInline style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      <span style={{ position: 'absolute', bottom: '4px', left: '4px', fontSize: '10px', background: 'rgba(0,0,0,0.6)', padding: '1px 3px', borderRadius: '3px', zIndex: 10 }}>🎥</span>
                    </div>
                  ) : (
                    <ResolvedMedia url={img.url} type="image" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                  )}
                  
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveRefImage(idx);
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
                    {img.type === 'image' ? '图' : img.type === 'video' ? '视频' : '音频'}{idx + 1}
                  </div>
                </div>
              ))}

              {refImages.length < 6 && (
                <div
                  onClick={handleOpenAssetsModal}
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
                  <span style={{ fontSize: '14px', color: 'rgba(255,255,255,0.4)' }}>📂</span>
                  <span style={{ fontSize: '8.5px', color: 'rgba(255,255,255,0.3)' }}>资产库选入</span>
                </div>
              )}
              
              {refImages.length < 6 && (
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

        {/* Popover 5: Custom ComfyUI Params */}
        {activePopover === 'runninghub' && (() => {
          const tpl = data.inputs?.customTemplate;
          if (!tpl) return null;
          
          const paramsList = tpl.paramsSchema || [];
          // 过滤掉已经在高级菜单对齐的 Prompt、Images 与 CFG/Steps
          const filteredParams = paramsList.filter((p: any) => {
            if (!p.exposed) return false;
            const fieldLower = (p.fieldName || '').toLowerCase();
            const displayLower = (p.label || '').toLowerCase();

            const isText = fieldLower === 'text' || fieldLower === 'prompt' || fieldLower === 'instruction' || fieldLower === 'description' || displayLower.includes('提示词') || displayLower.includes('文本') || displayLower.includes('指令');
            const isImage = p.type === 'image' || fieldLower === 'image' || fieldLower === 'faceref' || fieldLower === 'img' || fieldLower === 'refimage' || fieldLower === 'ref_image' || displayLower.includes('图片') || displayLower.includes('图像');
            const isSpecs = fieldLower === 'cfg' || fieldLower === 'steps' || fieldLower === 'denoise' || fieldLower === 'width' || fieldLower === 'height' || fieldLower === 'w' || fieldLower === 'h';

            return !isText && !isImage && !isSpecs;
          });

          return (
            <div className="popover-floating-card" style={{ width: '280px', left: '15%' }}>
              <div style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.5)', fontWeight: 'bold', borderBottom: '1px solid rgba(255,255,255,0.06)', paddingBottom: '4px' }}>
                ⚙️ 自定义参数设置
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', marginTop: '8px', maxHeight: '180px', overflowY: 'auto' }}>
                {filteredParams.length === 0 ? (
                  <div style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.4)', textAlign: 'center', padding: '10px 0' }}>
                    本工作流无额外特有参数，已在主菜单完美对齐
                  </div>
                ) : (
                  filteredParams.map((p: any) => {
                    const inputKey = `${p.nodeId}_${p.fieldName}`;
                    const val = data.inputs?.[inputKey] !== undefined ? data.inputs[inputKey] : p.defaultValue;
                    return (
                      <div key={inputKey} style={{ display: 'flex', flexDirection: 'column', gap: '4px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ fontSize: '9.5px', color: 'rgba(255,255,255,0.7)' }}>{p.label || p.fieldName}</span>
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
                  })
                )}
              </div>
            </div>
          );
        })()}


      </div>
    </React.Fragment>
  );
};
