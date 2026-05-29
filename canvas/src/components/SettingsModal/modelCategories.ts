/**
 * 模型分类配置 - 集中管理所有模型分类相关的正则模式和常量
 * 支持: chat | image | video | tts | search(检索) | other
 */

export type ModelCategory = 'chat' | 'image' | 'video' | 'tts' | 'search' | 'other';

// 模型分类标签配置
export const MODEL_CATEGORY_CONFIG: Record<ModelCategory, { label: string; emoji: string; color: string }> = {
  chat: { label: '聊天/文本', emoji: '🧠', color: 'hsl(var(--accent-primary))' },
  image: { label: '生图', emoji: '🎨', color: 'hsl(var(--accent-secondary))' },
  video: { label: '视频', emoji: '📹', color: '#eab308' },
  tts: { label: '音频', emoji: '🎙️', color: '#38bdf8' },
  search: { label: '检索', emoji: '🔍', color: '#f472b6' },
  other: { label: '其他', emoji: '❓', color: '#a78bfa' }
};

// 视频模型匹配正则
const VIDEO_PATTERNS = /sora|kling|seedance|viduq|wan.*video|cogvideo|hunyuan.*video|minimax.*hailuo|hailuo|video/;

// 图片模型匹配正则
const IMAGE_PATTERNS = /gemini.*image|grok.*imagine|ideogram|flux|recraft|dall|flux|sd-|stable.*diffusion|wan.*image|midjourney|seedream|qwen.*image|imagen|image-|imagine|generate.*image|image.*preview|image.*generation/;

// TTS/音频模型匹配正则
const TTS_PATTERNS = /tts|speech|voice|clone|fish|audio|sound|bark|openvoice/;

// 检索模型匹配正则
const SEARCH_PATTERNS = /embed|embedding|rerank|retrieval|search|vector|similarity|knowledge/;

// Chat 模型匹配正则（更严格的识别，避免误匹配）
const CHAT_PATTERNS = /^(gpt|claude|gemini$|deepseek|llama|qwen|mistral|command|yi|abab|grok-3|grok-2|chat|llm|text|completion)/;

/**
 * 根据模型名称判断所属分类
 */
export function getModelCategory(modelName: string): ModelCategory {
  const lower = modelName.toLowerCase();
  
  if (VIDEO_PATTERNS.test(lower)) return 'video';
  if (IMAGE_PATTERNS.test(lower)) return 'image';
  if (TTS_PATTERNS.test(lower)) return 'tts';
  if (SEARCH_PATTERNS.test(lower)) return 'search';
  if (CHAT_PATTERNS.test(lower)) return 'chat';
  
  return 'other';
}

/**
 * 按分类统计模型数量
 */
export function countModelsByCategory(models: Array<{ modelName: string }>): Record<ModelCategory, number> {
  const counts: Record<ModelCategory, number> = {
    chat: 0, image: 0, video: 0, tts: 0, search: 0, other: 0
  };
  
  models.forEach(item => {
    const category = getModelCategory(item.modelName);
    counts[category]++;
  });
  
  return counts;
}

/**
 * 按分类过滤模型列表
 */
export function filterModelsByCategory(
  models: Array<{ modelName: string }>,
  category: ModelCategory | 'all'
): Array<{ modelName: string }> {
  if (category === 'all') return models;
  return models.filter(item => getModelCategory(item.modelName) === category);
}
