/**
 * 统一模型选择钩子
 * 所有节点必须使用此钩子来获取厂商和模型列表
 */
import { useMemo, useCallback } from 'react';

// 模型能力类型
export type ModelCapability = 'chat' | 'image' | 'video' | 'tts';

// 内置厂商配置（按能力分类）
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

// 模型关键词配置（精确匹配，避免跨类型）
const MODEL_KEYWORDS: Record<ModelCapability, string[]> = {
  chat: ['gpt', 'claude', 'qwen', 'minimax', 'doubao', 'glm', 'chat', 'llm', 'moe', 'mixtral', 'kimi', 'chatglm', 'baichuan', 'yi', 'qwen3', 'qwen2', 'qwen1', 'deepseek', 'ernie', 'moe'],
  image: ['wanx2.1-t2i', 'wanx2-t2i', 'wanx-t2i', 'seedream', 'dall-e', 'flux', 'sdxl', 'stable-diffusion', 'midjourney', 'illustrate', 'kling', 'grok-image', 'wan2.7-image'],
  video: ['vidu', 'seedance', 'wanx-video', 'wan2-video', 'wan-video', 'sora', 'svd', 'cogvideo', 'luma', 'kling', 'hailuo', 'doubao-video', 'minimax-video', 'grok-video', 'wan2.1-video', 'qvq'],
  tts: ['tts', 'speech', 'voice', 'clone', 'fish', 'sound', 'talk', 'suno', 'music', 'audio', 'volc', 'cosyvoice', 'sambert', 'minimax-speech', 'openai-speech']
};

// 默认模型
const DEFAULT_MODELS: Record<ModelCapability, Record<string, string[]>> = {
  chat: {
    minimax: ['MiniMax-M2.1'],
    deepseek: ['deepseek-chat', 'deepseek-coder'],
    openai: ['gpt-4o', 'gpt-4o-mini'],
    ali: ['qwen-max', 'qwen-plus'],
    volcengine: ['doubao-pro', 'doubao-lite']
  },
  image: {
    minimax: ['image-01'],
    ali: ['wanx2.1-t2i-turbo', 'wanx2.1-t2i-plus'],
    volcengine: ['Doubao-Seedream-5.0-Lite'],
    openai: ['dall-e-3', 'dall-e-2']
  },
  video: {
    vidu: ['vidu-high-speed', 'viduq3'],
    volcengine: ['seedance-v1', 'seedance-v2'],
    minimax: ['minimax-video-v1'],
    ali: ['wanx-video-v1', 'wanx-video-v2']
  },
  tts: {
    minimax: ['speech-01-turbo', 'speech-01'],
    openai: ['tts-1', 'tts-1-hd'],
    volcengine: ['volc-tts-premium', 'volc-tts-standard'],
    suno: ['suno-v3', 'suno-v4'],
    ali: ['cosyvoice-v1', 'cosyvoice-2']
  }
};

export interface Provider {
  id: string;
  name: string;
  icon: string;
  /** 该厂商支持的能力列表，用于判断是否应该在当前节点显示 */
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

/**
 * 统一模型选择钩子
 * @param props 配置参数
 * @returns 厂商列表、模型列表、操作函数
 */
export function useModelSelector({
  capability,
  settings,
  currentProviderId,
  currentModel,
  onProviderChange,
  onModelChange
}: UseModelSelectorProps) {
  // 从 localStorage 读取自定义厂商名称
  const customProviderNames = useMemo(() => getCustomProviderNames(), [settings]);

  // 获取所有可用的厂商列表（按能力过滤）
  const providers = useMemo((): Provider[] => {
    const builtInIds = Object.keys(BUILT_IN_PROVIDERS);

    if (!settings?.providers) {
      // 没有 settings 时，返回内置厂商列表（按能力过滤）
      return builtInIds
        .filter(id => {
          if (id === 'runninghub') return false;
          const p = BUILT_IN_PROVIDERS[id];
          return p.capabilities.includes(capability);
        })
        .map(id => ({
          id,
          name: BUILT_IN_PROVIDERS[id].name,
          icon: BUILT_IN_PROVIDERS[id].icon,
          capabilities: BUILT_IN_PROVIDERS[id].capabilities
        }));
    }

    // 合并内置厂商和自定义厂商
    const allIds = [...new Set([...builtInIds, ...Object.keys(settings.providers)])];

    return allIds
      .filter(pid => {
        if (pid === 'runninghub') return false;
        // 内置厂商：检查能力是否匹配
        if (builtInIds.includes(pid)) {
          const p = BUILT_IN_PROVIDERS[pid];
          return p.capabilities.includes(capability);
        }
        // 自定义厂商：需要 enabled
        return settings.providers[pid]?.enabled;
      })
      .map(pid => {
        const builtIn = BUILT_IN_PROVIDERS[pid];
        const customName = customProviderNames[pid];
        const provider = settings.providers[pid];

        // 优先顺序：自定义名称 > 内置名称 > 厂商ID
        const name = customName?.name || builtIn?.name || provider?.name || pid;
        const icon = customName?.icon || builtIn?.icon || provider?.icon || '🔌';

        // 自定义厂商默认支持所有能力
        const capabilities = builtIn?.capabilities || ['chat', 'image', 'video', 'tts'];

        return { id: pid, name, icon, capabilities };
      });
  }, [settings, capability, customProviderNames]);

  // 根据厂商 ID 获取过滤后的模型列表
  const getModelsForProvider = useCallback((providerId: string): string[] => {
    const keywords = MODEL_KEYWORDS[capability];

    // 如果有 model_cache，优先使用用户勾选的模型
    if (settings?.model_cache?.[capability]?.length > 0) {
      const cachedModels = settings.model_cache[capability];
      if (settings?.providers?.[providerId]?.models) {
        const filtered = settings.providers[providerId].models.filter((m: string) =>
          cachedModels.includes(m)
        );
        if (filtered.length > 0) return filtered;
      }
    }

    // 直接从 settings.providers 获取模型列表
    if (!settings?.providers?.[providerId]) {
      return DEFAULT_MODELS[capability]?.[providerId] || [];
    }
    const provider = settings.providers[providerId];
    if (!provider.models || !Array.isArray(provider.models) || provider.models.length === 0) {
      return DEFAULT_MODELS[capability]?.[providerId] || [];
    }

    // 用前缀匹配过滤，只返回对应类型的模型（前缀更精确，避免 q/qwen 等通用字符误匹配）
    const filtered = provider.models.filter((m: string) =>
      keywords.some(kw => m.toLowerCase().startsWith(kw.toLowerCase()))
    );
    return filtered;
  }, [settings, capability]);

  // 当前厂商的模型列表
  const models = useMemo(() => {
    return getModelsForProvider(currentProviderId);
  }, [currentProviderId, getModelsForProvider]);

  // 切换厂商
  const setProviderId = useCallback((providerId: string) => {
    const newModels = getModelsForProvider(providerId);
    onProviderChange?.(providerId);
    // 如果当前模型不在新列表中，自动切换到第一个模型
    if (newModels.length > 0 && !newModels.includes(currentModel)) {
      onModelChange?.(newModels[0]);
    }
  }, [getModelsForProvider, currentModel, onProviderChange, onModelChange]);

  // 切换模型
  const setModel = useCallback((model: string) => {
    onModelChange?.(model);
  }, [onModelChange]);

  // 验证当前模型是否有效
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

// 导出关键词常量，供 ConfigPanel 使用
export { MODEL_KEYWORDS };

/**
 * 根据厂商 ID 和配置获取过滤后的模型列表（纯函数，可独立使用）
 * @param providerId - 厂商 ID
 * @param capability - 模型能力类型
 * @param settings - 设置对象（包含 providers 和 model_cache）
 * @returns 过滤后的模型数组
 */
export function getModelsForProvider(providerId: string, capability: ModelCapability, settings: any): string[] {
  const keywords = MODEL_KEYWORDS[capability];

  // 如果有 model_cache，优先使用用户勾选的模型
  if (settings?.model_cache?.[capability]?.length > 0) {
    const cachedModels = settings.model_cache[capability];
    if (settings?.providers?.[providerId]?.models) {
      const filtered = settings.providers[providerId].models.filter((m: string) =>
        cachedModels.includes(m)
      );
      if (filtered.length > 0) return filtered;
    }
  }

  // 直接从 settings.providers 获取模型列表
  if (!settings?.providers?.[providerId]) {
    return DEFAULT_MODELS[capability]?.[providerId] || [];
  }
  const provider = settings.providers[providerId];
  if (!provider.models || !Array.isArray(provider.models) || provider.models.length === 0) {
    return DEFAULT_MODELS[capability]?.[providerId] || [];
  }

  // 用前缀匹配过滤，只返回对应类型的模型
  const filtered = provider.models.filter((m: string) =>
    keywords.some(kw => m.toLowerCase().startsWith(kw.toLowerCase()))
  );
  return filtered;
}
