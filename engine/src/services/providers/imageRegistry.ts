/**
 * 生图 Provider 能力注册表
 * 职责：根据 model 名称找到对应的适配器 + 接口类型
 *
 * 每个条目格式：
 * {
 *   adapter:  string   - 适配器 ID（对应 adapters/ 下文件名）
 *   mode:     'sync' | 'async'  - 接口模式
 *   endpoint: string   - 相对路径，拼接 baseUrl 使用
 *   authStyle: 'bearer' | 'apikey'  - 认证方式
 * }
 *
 * 如何扩展新 provider：
 * 1. 在 docs/ 下新建 xxx-image.md，写清接口文档
 * 2. 在 adapters/ 下新建 XxxAdapter.ts，实现 IImageAdapter 接口
 * 3. 在本文件注册表添加 entry
 * 4. 在 engine/src/app.ts 中替换生图路由逻辑
 */

export type ImageAdapterMode = 'sync' | 'async';
export type ImageAuthStyle = 'bearer' | 'apikey';

export interface ImageProviderEntry {
  adapter: string;
  mode: ImageAdapterMode;
  endpoint: string;
  authStyle: ImageAuthStyle;
  note?: string;
}

export const imageProviderRegistry: Record<string, ImageProviderEntry> = {

  // ===== NewAPI / ZhangVIP =====
  // 提交走 NewAPI（计费），轮询走 APIMart GET /v1/tasks/{id}（免费）
  // 轮询需要有效的 APIMart key
  'gpt-image-2': {
    adapter: 'NewAPIAdapter',
    mode: 'async',
    endpoint: '/v1/images/generations',
    authStyle: 'bearer',
    note: '提交用 new-api，轮询用 apimart GET /v1/tasks/{id}',
  },
  'dall-e-2': {
    adapter: 'NewAPIAdapter',
    mode: 'async',
    endpoint: '/v1/images/generations',
    authStyle: 'bearer',
  },
  'dall-e-3': {
    adapter: 'NewAPIAdapter',
    mode: 'async',
    endpoint: '/v1/images/generations',
    authStyle: 'bearer',
  },

  // ===== 阿里云百炼 =====
  // 同步端点：/multimodal-generation/generation
  // 异步端点：/image-generation/generation + /tasks/{id}
  'wan2.7-image-pro': {
    adapter: 'AliWanxAdapter',
    mode: 'sync',
    endpoint: '/api/v1/services/aigc/multimodal-generation/generation',
    authStyle: 'bearer',
  },
  'wan2.7-image': {
    adapter: 'AliWanxAdapter',
    mode: 'sync',
    endpoint: '/api/v1/services/aigc/multimodal-generation/generation',
    authStyle: 'bearer',
  },

  // ===== MiniMax =====（Engine 已实现）
  // 走 minimax 自定义端点: /image_generation
  // Engine 直接硬编码处理，暂保留
};

export interface ImageGenerateOptions {
  model: string;
  prompt: string;
  size?: string;
  n?: number;
  baseUrl: string;
  apiKey: string;
}

export interface ImageGenerateResult {
  data: Array<{ url: string }>;
}

/**
 * 根据 model 查找注册表条目，找不到返回 null
 */
export function resolveImageProvider(model: string): ImageProviderEntry | null {
  return imageProviderRegistry[model] ?? null;
}
