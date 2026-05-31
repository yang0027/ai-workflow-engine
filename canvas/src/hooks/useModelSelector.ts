/**
 * 统一模型选择钩子
 * 所有节点必须使用此钩子来获取厂商和模型列表
 */
import { useMemo, useCallback } from 'react';

// 模型能力类型。节点菜单唯一按全局模型分流缓存分类取模型，不再按内置厂商能力猜测。
export type ModelCapability = 'chat' | 'image' | 'video' | 'tts';

const CAPABILITY_CACHE_KEY: Record<ModelCapability, string> = {
  chat: 'chat',
  image: 'image',
  video: 'video',
  tts: 'tts',
};

function modelCacheIncludes(list: string[] | undefined, providerId: string, model: string): boolean {
  if (!Array.isArray(list)) return false;
  const hasScopedEntries = list.some(item => item.includes('::'));
  if (hasScopedEntries) return list.includes(`${providerId}::${model}`);
  return list.includes(model);
}

function modelCacheHasAnyEntry(settings: any): boolean {
  const cache = settings?.model_cache;
  if (!cache) return false;
  return ['chat', 'image', 'video', 'tts', 'search', 'other'].some(category =>
    Array.isArray(cache[category]) && cache[category].length > 0
  );
}

function modelVisibleForCapability(settings: any, providerId: string, model: string, capability: ModelCapability): boolean {
  const cache = settings?.model_cache;
  if (!cache) return true;

  const category = CAPABILITY_CACHE_KEY[capability];
  // 节点菜单只认全局分流缓存的当前分类白名单。
  // 例如 image 分类里只有 3 个，生图节点就只显示这 3 个。
  if (!modelCacheHasAnyEntry(settings)) return true;
  return modelCacheIncludes(cache[category], providerId, model);
}

export interface Provider {
  id: string;
  name: string;
  icon: string;
  /** 历史字段，仅用于显示兼容；节点模型过滤以 model_cache 为准。 */
  capabilities: ModelCapability[];
}

export interface UseModelSelectorProps {
  capability: ModelCapability;
  settings: any;
  currentProviderId: string;
  currentModel: string;
  onProviderChange?: (providerId: string) => void;
  onModelChange?: (model: string) => void;
}

/**
 * 获取自定义厂商名称（从 localStorage 读取）
 */
function getCustomProviderNames(): Record<string, { name: string; icon: string }> {
  try {
    const saved = localStorage.getItem('custom_providers');
    return saved ? JSON.parse(saved) : {};
  } catch {
    return {};
  }
}

// 内置厂商配置（用于名称/图标/能力映射）
const BUILT_IN_PROVIDERS: Record<string, { name: string; icon: string; capabilities: ModelCapability[] }> = {
  minimax: { name: 'MiniMax (海螺)', icon: '🐚', capabilities: ['chat', 'image', 'video', 'tts'] },
  deepseek: { name: 'DeepSeek', icon: '🐋', capabilities: ['chat'] },
  openai: { name: 'OpenAI', icon: '🧠', capabilities: ['chat', 'image', 'tts'] },
  ali: { name: '通义千问 (Ali)', icon: '☁️', capabilities: ['chat', 'image', 'video', 'tts'] },
  volcengine: { name: '火山引擎 (豆包)', icon: '🌋', capabilities: ['chat', 'video', 'tts'] },
  vidu: { name: 'Vidu (视频生成)', icon: '🎬', capabilities: ['video'] },
  suno: { name: 'Suno (AI 音乐)', icon: '🎵', capabilities: ['tts'] },
  runninghub: { name: 'RunningHub', icon: '⚡', capabilities: ['image', 'video', 'tts'] }
};

/**
 * 统一模型选择钩子
 * @param props 配置参数
 * @returns 厂商列表、模型列表、操作函数
 *
 * 核心逻辑：直接使用 settings.providers[pid].models 作为该 provider 的模型列表，
 * 不做任何额外过滤。用户选择什么就显示什么。
 */
export function useModelSelector({
  capability,
  settings,
  currentProviderId,
  currentModel,
  onProviderChange,
  onModelChange
}: UseModelSelectorProps) {
  const customProviderNames = useMemo(() => getCustomProviderNames(), [settings]);

  // 获取所有有可显示模型的厂商。是否显示由 model_cache 当前分类决定，不再按内置厂商能力表过滤。
  const providers = useMemo((): Provider[] => {
    const builtInIds = Object.keys(BUILT_IN_PROVIDERS);

    if (!settings?.providers) {
      return [];
    }

    const allIds = [...new Set([...builtInIds, ...Object.keys(settings.providers)])];

    return allIds
      .filter(pid => {
        const providerInSettings = settings.providers?.[pid];
        if (!providerInSettings || !providerInSettings.enabled || !Array.isArray(providerInSettings.models)) return false;
        return providerInSettings.models.some((model: string) => modelVisibleForCapability(settings, pid, model, capability));
      })
      .map(pid => {
        const builtIn = BUILT_IN_PROVIDERS[pid];
        const customName = customProviderNames[pid];
        const provider = settings.providers[pid];
        const name = customName?.name || builtIn?.name || provider?.name || pid;
        const icon = customName?.icon || builtIn?.icon || provider?.icon || '🔌';
        const capabilities = builtIn?.capabilities || ['chat', 'image', 'video', 'tts'];
        return { id: pid, name, icon, capabilities };
      });
  }, [settings, capability, customProviderNames]);

  // 严格按全局模型分流缓存过滤；只有空缓存时才回退到 provider 原始模型，防止新用户空菜单。
  const getModelsForProvider = useCallback((providerId: string): string[] => {
    if (settings?.providers?.[providerId] && !settings.providers[providerId].enabled) {
      return [];
    }
    const provider = settings?.providers?.[providerId];
    if (provider?.models && Array.isArray(provider.models) && provider.models.length > 0) {
      return provider.models.filter((model: string) => modelVisibleForCapability(settings, providerId, model, capability));
    }
    return [];
  }, [settings, capability]);

  const models = useMemo(() => {
    return getModelsForProvider(currentProviderId);
  }, [currentProviderId, getModelsForProvider]);

  const setProviderId = useCallback((providerId: string) => {
    const newModels = getModelsForProvider(providerId);
    onProviderChange?.(providerId);
    if (newModels.length > 0 && !newModels.includes(currentModel)) {
      onModelChange?.(newModels[0]);
    }
  }, [getModelsForProvider, currentModel, onProviderChange, onModelChange]);

  const setModel = useCallback((model: string) => {
    const currentModels = getModelsForProvider(currentProviderId);
    if (currentModels.includes(model)) {
      onModelChange?.(model);
      return;
    }
    if (settings?.providers) {
      for (const [pid, p] of Object.entries(settings.providers)) {
        if ((p as any).enabled && getModelsForProvider(pid).includes(model)) {
          onProviderChange?.(pid);
          onModelChange?.(model);
          return;
        }
      }
    }
    onModelChange?.(model);
  }, [getModelsForProvider, currentProviderId, settings, onModelChange, onProviderChange]);

  const validModel = useMemo(() => {
    if (models.includes(currentModel)) return currentModel;
    return models[0] || '';
  }, [models, currentModel]);

  return {
    providers,
    models,
    currentModel: validModel,
    setProviderId,
    setModel
  };
}

/**
 * 根据厂商 ID 和配置获取模型列表（纯函数，独立使用）
 * 严格按全局模型分流缓存过滤；只有空缓存时才回退到 provider 原始模型。
 */
export function getModelsForProvider(providerId: string, capability: ModelCapability, settings: any): string[] {
  if (settings?.providers?.[providerId] && !settings.providers[providerId].enabled) {
    return [];
  }
  const provider = settings?.providers?.[providerId];
  if (provider?.models && Array.isArray(provider.models) && provider.models.length > 0) {
    return provider.models.filter((model: string) => modelVisibleForCapability(settings, providerId, model, capability));
  }
  return [];
}
