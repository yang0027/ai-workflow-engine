import React, { useMemo, useState } from 'react';
import { getModelsForProvider, ModelCapability, Provider } from '../hooks/useModelSelector';

interface ModelSelectPanelProps {
  capability: ModelCapability;
  providers: Provider[];
  settings: any;
  selectedProviderId?: string;
  selectedModel?: string;
  onSelect: (providerId: string, model: string) => void;
}

interface ModelOption {
  id: string;
  label: string;
  providerId: string;
  providerName: string;
  family: string;
  disabled?: boolean;
}

function inferFamily(model: string) {
  const lower = model.toLowerCase();
  if (lower.includes('gpt') || lower.startsWith('o1') || lower.startsWith('o3')) return 'GPT 系列';
  if (lower.includes('claude')) return 'Claude 系列';
  if (lower.includes('gemini')) return 'Gemini 系列';
  if (lower.includes('deepseek')) return 'DeepSeek 系列';
  if (lower.includes('qwen') || lower.includes('通义')) return '通义千问系列';
  if (lower.includes('flux')) return 'Flux 系列';
  if (lower.includes('dall') || lower.includes('image')) return '图像模型';
  if (lower.includes('tts') || lower.includes('speech') || lower.includes('voice')) return 'TTS 模型';
  if (lower.includes('video') || lower.includes('kling') || lower.includes('luma') || lower.includes('vidu')) return '视频模型';
  return '其他模型';
}

export function ModelSelectPanel({
  capability,
  providers,
  settings,
  selectedProviderId,
  selectedModel,
  onSelect,
}: ModelSelectPanelProps) {
  const [keyword, setKeyword] = useState('');
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});

  const models = useMemo<ModelOption[]>(() => {
    return providers.flatMap((provider) => {
      const providerModels = getModelsForProvider(provider.id, capability, settings);
      return providerModels.map((model) => ({
        id: model,
        label: model,
        providerId: provider.id,
        providerName: provider.name,
        family: inferFamily(model),
      }));
    });
  }, [capability, providers, settings]);

  const filteredModels = useMemo(() => {
    const q = keyword.trim().toLowerCase();
    if (!q) return models;
    return models.filter((model) =>
      model.id.toLowerCase().includes(q) ||
      model.label.toLowerCase().includes(q) ||
      model.providerName.toLowerCase().includes(q) ||
      model.family.toLowerCase().includes(q)
    );
  }, [keyword, models]);

  const groupedModels = useMemo(() => {
    const groups: Record<string, ModelOption[]> = {};
    filteredModels.forEach((model) => {
      if (!groups[model.providerName]) groups[model.providerName] = [];
      groups[model.providerName].push(model);
    });
    return Object.entries(groups);
  }, [filteredModels]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '8px', width: '100%' }}>
      <input
        value={keyword}
        onChange={(event) => setKeyword(event.target.value)}
        placeholder="搜索模型..."
        autoFocus
        style={{
          width: '100%',
          background: 'rgba(0,0,0,0.28)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: '8px',
          color: '#fff',
          fontSize: '11px',
          padding: '7px 9px',
          outline: 'none',
        }}
      />

      <div className="model-list" style={{ maxHeight: '360px', overflowY: 'auto', overscrollBehavior: 'contain', paddingRight: '2px' }}>
        {groupedModels.length === 0 ? (
          <div style={{ fontSize: '10px', color: 'rgba(255,255,255,0.38)', textAlign: 'center', padding: '16px 8px' }}>
            没有匹配的模型
          </div>
        ) : groupedModels.map(([group, items]) => {
          const collapsed = !!collapsedGroups[group];
          return (
            <div key={group} style={{ borderBottom: '1px solid rgba(255,255,255,0.05)', paddingBottom: '5px', marginBottom: '5px' }}>
              <button
                onClick={() => setCollapsedGroups((prev) => ({ ...prev, [group]: !prev[group] }))}
                style={{
                  width: '100%',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  color: 'rgba(255,255,255,0.55)',
                  fontSize: '10px',
                  fontWeight: 700,
                  padding: '4px 2px',
                  cursor: 'pointer',
                }}
              >
                <span>{collapsed ? '▶' : '▼'} {group}</span>
                <span style={{ opacity: 0.5 }}>{items.length}</span>
              </button>

              {!collapsed && items.map((item) => {
                const selected = selectedModel === item.id && (!selectedProviderId || selectedProviderId === item.providerId);
                return (
                  <button
                    key={`${item.providerId}:${item.id}`}
                    disabled={item.disabled}
                    title={`${item.label} (${item.providerName})`}
                    onClick={() => !item.disabled && onSelect(item.providerId, item.id)}
                    style={{
                      width: '100%',
                      display: 'grid',
                      gridTemplateColumns: '18px minmax(0, 1fr) auto',
                      alignItems: 'center',
                      gap: '6px',
                      padding: '6px 7px',
                      borderRadius: '7px',
                      background: selected ? 'rgba(168,85,247,0.22)' : 'transparent',
                      color: item.disabled ? 'rgba(255,255,255,0.28)' : selected ? '#fff' : 'rgba(255,255,255,0.76)',
                      cursor: item.disabled ? 'not-allowed' : 'pointer',
                      textAlign: 'left',
                    }}
                  >
                    <span style={{ color: selected ? '#c084fc' : 'rgba(255,255,255,0.45)', fontSize: '12px' }}>{selected ? '●' : '○'}</span>
                    <span className="model-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', minWidth: 0, fontSize: '10.5px' }}>
                      {item.label}
                    </span>
                    <span style={{ fontSize: '9px', color: 'rgba(255,255,255,0.35)', maxWidth: '82px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {item.family}
                    </span>
                  </button>
                );
              })}
            </div>
          );
        })}
      </div>
    </div>
  );
}
