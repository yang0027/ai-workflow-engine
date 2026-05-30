import React, { useState, useMemo } from 'react';
import { Provider } from '../../../hooks/useModelSelector';

interface ModelPopoverProps {
  activeVendor: string;
  selectedModel: string;
  chatProviders: Provider[];
  getModelsForVendor: (vendorId: string) => string[];
  doProviderChange: (providerId: string, modelName: string) => void;
  onClose: () => void;
}

export default function ModelPopover({
  activeVendor,
  selectedModel,
  chatProviders,
  getModelsForVendor,
  doProviderChange,
  onClose
}: ModelPopoverProps) {
  const [searchQuery, setSearchQuery] = useState('');

  // 模糊检索逻辑：支持按模型名称、服务商名称进行模糊匹配
  const filteredItems = useMemo(() => {
    if (!searchQuery.trim()) return null;

    const query = searchQuery.toLowerCase().trim();
    const results: Array<{ provider: Provider; model: string }> = [];

    chatProviders.forEach(prov => {
      const models = getModelsForVendor(prov.id);
      models.forEach(m => {
        if (m.toLowerCase().includes(query) || prov.name.toLowerCase().includes(query)) {
          results.push({ provider: prov, model: m });
        }
      });
    });

    return results;
  }, [searchQuery, chatProviders, getModelsForVendor]);

  return (
    <div
      className="popover-floating-card nodrag"
      style={{
        position: 'absolute',
        bottom: 'calc(100% + 8px)',
        left: '15%',
        width: '260px',
        background: 'rgba(11, 15, 26, 0.98)',
        backdropFilter: 'blur(24px)',
        border: '1px solid rgba(255, 255, 255, 0.1)',
        borderRadius: '12px',
        boxShadow: '0 15px 35px rgba(0,0,0,0.5), 0 0 20px rgba(168, 85, 247, 0.15)',
        padding: '12px',
        display: 'flex',
        flexDirection: 'column',
        gap: '10px',
        zIndex: 2005,
        animation: 'popoverFadeIn 0.2s cubic-bezier(0.16, 1, 0.3, 1)'
      }}
    >
      {/* 头部标题 */}
      <div style={{ fontSize: '10.5px', color: 'rgba(255,255,255,0.45)', fontWeight: 'bold', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span>🤖 选择对话模型</span>
        <span style={{ fontSize: '9px', opacity: 0.5 }}>支持视频/反推/聊天</span>
      </div>

      {/* 🔍 模糊搜索输入框 */}
      <div style={{ position: 'relative', width: '100%' }}>
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="🔍 搜索模型名称或服务商..."
          style={{
            width: '100%',
            background: 'rgba(0, 0, 0, 0.3)',
            border: '1px solid rgba(255, 255, 255, 0.08)',
            borderRadius: '6px',
            padding: '5px 8px 5px 24px',
            color: '#fff',
            fontSize: '11px',
            outline: 'none',
            transition: 'border-color 0.2s'
          }}
          onFocus={(e) => e.target.style.borderColor = 'rgba(168, 85, 247, 0.6)'}
          onBlur={(e) => e.target.style.borderColor = 'rgba(255, 255, 255, 0.08)'}
        />
        <span style={{ position: 'absolute', left: '8px', top: '50%', transform: 'translateY(-50%)', fontSize: '10px', opacity: 0.4, pointerEvents: 'none' }}>
          🔍
        </span>
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            style={{
              position: 'absolute',
              right: '8px',
              top: '50%',
              transform: 'translateY(-50%)',
              background: 'none',
              border: 'none',
              color: 'rgba(255, 255, 255, 0.5)',
              fontSize: '11px',
              cursor: 'pointer',
              padding: 0
            }}
          >
            ×
          </button>
        )}
      </div>

      {/* 模型列表容器 - 统一最大高度与内部滚动条 */}
      <div
        className="model-list-scroll-container"
        style={{
          maxHeight: '280px',
          overflowY: 'auto',
          display: 'flex',
          flexDirection: 'column',
          gap: '2px',
          paddingRight: '2px'
        }}
      >
        <style>{`
          .model-list-scroll-container::-webkit-scrollbar {
            width: 4px;
          }
          .model-list-scroll-container::-webkit-scrollbar-track {
            background: rgba(0, 0, 0, 0.1);
          }
          .model-list-scroll-container::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.15);
            border-radius: 2px;
          }
          .model-list-scroll-container::-webkit-scrollbar-thumb:hover {
            background: rgba(168, 85, 247, 0.5);
          }
          
          /* 二级子菜单专属漂亮滚动条 */
          .sub-model-list-hover-scroll::-webkit-scrollbar {
            width: 4px;
          }
          .sub-model-list-hover-scroll::-webkit-scrollbar-track {
            background: rgba(0, 0, 0, 0.1);
          }
          .sub-model-list-hover-scroll::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.15);
            border-radius: 2px;
          }
          .sub-model-list-hover-scroll::-webkit-scrollbar-thumb:hover {
            background: rgba(168, 85, 247, 0.5);
          }
        `}</style>

        {/* 情况 1：搜索模式 */}
        {filteredItems !== null ? (
          filteredItems.length > 0 ? (
            filteredItems.map(({ provider, model }) => (
              <button
                key={`${provider.id}-${model}`}
                onClick={() => {
                  doProviderChange(provider.id, model);
                  onClose();
                }}
                style={{
                  background: selectedModel === model ? 'rgba(168, 85, 247, 0.25)' : 'rgba(255, 255, 255, 0.02)',
                  border: 'none',
                  borderRadius: '6px',
                  color: selectedModel === model ? '#fff' : 'rgba(255,255,255,0.7)',
                  fontSize: '10.5px',
                  padding: '6px 8px',
                  textAlign: 'left',
                  cursor: 'pointer',
                  width: '100%',
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  gap: '8px',
                  transition: 'all 0.15s'
                }}
                onMouseEnter={(e) => {
                  if (selectedModel !== model) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.06)';
                }}
                onMouseLeave={(e) => {
                  if (selectedModel !== model) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.02)';
                }}
              >
                {/* 模型名称超长 ellipsis 截断 */}
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    flex: 1
                  }}
                  title={model}
                >
                  {model}
                </span>
                {/* 厂家标签 */}
                <span style={{ fontSize: '8px', background: 'rgba(168, 85, 247, 0.15)', color: '#c084fc', padding: '1px 4px', borderRadius: '4px', flexShrink: 0 }}>
                  {provider.name}
                </span>
              </button>
            ))
          ) : (
            <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.3)', textAlign: 'center', padding: '16px 0' }}>
              🔍 未找到匹配的模型
            </div>
          )
        ) : (
          /* 情况 2：标准二级悬浮列表模式 */
          chatProviders.map(v => {
            const providerModels = getModelsForVendor(v.id);
            return (
              <div
                key={v.id}
                className={`hover-vendor-item ${activeVendor === v.id ? 'active' : ''}`}
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'center',
                  padding: '7px 8px',
                  borderRadius: '6px',
                  cursor: 'pointer',
                  fontSize: '11px',
                  color: activeVendor === v.id ? '#fff' : 'rgba(255,255,255,0.7)',
                  transition: 'all 0.2s',
                  position: 'relative'
                }}
              >
                <span
                  style={{
                    overflow: 'hidden',
                    textOverflow: 'ellipsis',
                    whiteSpace: 'nowrap',
                    maxWidth: '160px'
                  }}
                  title={v.name}
                >
                  {v.name}
                </span>
                <span style={{ fontSize: '8px', opacity: 0.5 }}>▶</span>

                {/* 二级悬浮菜单 */}
                <div className="sub-model-list-hover">
                  <div style={{ fontSize: '9px', color: 'rgba(255,255,255,0.45)', padding: '2px 4px', borderBottom: '1px solid rgba(255,255,255,0.06)', marginBottom: '4px' }}>
                    选择 {v.name} 旗下模型：
                  </div>
                  {/* 限制子菜单最大高度，避免模型过多撑爆屏幕 */}
                  <div
                    className="sub-model-list-hover-scroll"
                    style={{
                      maxHeight: '240px',
                      overflowY: 'auto',
                      display: 'flex',
                      flexDirection: 'column',
                      gap: '3px'
                    }}
                  >
                    {providerModels.map((m: string) => (
                      <button
                        key={m}
                        onClick={(e) => {
                          e.stopPropagation();
                          doProviderChange(v.id, m);
                          onClose();
                        }}
                        style={{
                          background: selectedModel === m ? 'rgba(168, 85, 247, 0.25)' : 'transparent',
                          border: 'none',
                          borderRadius: '4px',
                          color: selectedModel === m ? '#fff' : 'rgba(255,255,255,0.7)',
                          fontSize: '9.5px',
                          padding: '5px 6px',
                          textAlign: 'left',
                          cursor: 'pointer',
                          width: '100%',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                          transition: 'background 0.15s'
                        }}
                        onMouseEnter={(e) => {
                          if (selectedModel !== m) e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                        }}
                        onMouseLeave={(e) => {
                          if (selectedModel !== m) e.currentTarget.style.background = 'transparent';
                        }}
                        title={m}
                      >
                        {m}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
