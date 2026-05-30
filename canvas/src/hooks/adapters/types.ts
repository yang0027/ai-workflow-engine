// ============ 节点分类（executeNode 分发依据） ============
// mediaType: 节点产出的媒体类型
export type MediaType = 'text' | 'image' | 'video' | 'audio' | 'workflow';
// actionType: 节点执行的动作类型
export type ActionType = 'chat' | 'generate' | 'fusion' | 'tts' | 'upsample' | 'inpaint' | 'control' | 'upload' | 'loop';

// ============ 统一节点结果 ============
export interface NodeResult {
  success: boolean;
  data?: any;
  error?: NodeError;
  mediaType?: 'text' | 'image' | 'video' | 'audio';
  durationMs?: number;
}

export interface NodeError {
  code: 'NODE_EXEC_ERROR' | 'API_ERROR' | 'TIMEOUT' | 'INVALID_INPUT' | 'NETWORK_ERROR';
  message: string;
  nodeId?: string;
  nodeType?: string;
  detail?: any;
}

// ============ 上游数据 ============
export interface UpstreamData {
  text: string;
  image: string;
  video: string;
  audio: string;
  all: UpstreamItem[];
  texts: string[];
  images: string[];
  videos: string[];
  audios: string[];
}

export interface UpstreamItem {
  nodeId: string;
  nodeType?: string;
  nodeName: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  type: 'text' | 'image' | 'video' | 'audio' | 'unknown';
  value: string;
}

// ============ 模型配置 ============
export interface ModelConfig {
  providerId: string;
  modelId: string;
  apiKey?: string;
  baseUrl?: string;
}

// ============ Chat 请求/响应 ============
export interface ChatMessage {
  role: 'system' | 'user' | 'assistant';
  content: string | ChatContentPart[];
}

export type ChatContentPart =
  | { type: 'text'; text: string }
  | { type: 'image_url'; image_url: { url: string } };

export interface ChatRequest {
  providerId: string;
  model: string;
  messages: ChatMessage[];
  systemPrompt?: string;
  temperature?: number;
  stream?: boolean;
  abortSignal?: AbortSignal;
}

export interface ChatResponse {
  id: string;
  model: string;
  content: string;
  usage?: {
    prompt_tokens?: number;
    completion_tokens?: number;
    total_tokens?: number;
  };
}

// ============ Adapter 接口 ============
export interface ChatAdapter {
  chat(req: ChatRequest): Promise<ChatResponse>;
  /** 检测模型是否支持 vision（有多图输入时） */
  supportsVision?(model: string): boolean;
  /** 多图时自动找同 provider 下的 VL 模型 */
  resolveVisionModel?(providerId: string, model: string, settings: any): string | null;
}

export interface ImageAdapter {
  generate(req: {
    providerId: string;
    model: string;
    prompt: string;
    size?: string;
    n?: number;
    abortSignal?: AbortSignal;
  }): Promise<{ url: string; metadata?: any }>;
}

export interface VideoAdapter {
  generate(req: {
    providerId: string;
    model: string;
    prompt: string;
    duration?: number;
    abortSignal?: AbortSignal;
  }): Promise<{ url: string; duration?: number; metadata?: any }>;
}

export interface AudioAdapter {
  generate(req: {
    providerId: string;
    model: string;
    text: string;
    voice?: string;
    abortSignal?: AbortSignal;
  }): Promise<{ url: string; duration?: number; metadata?: any }>;
}

// ============ executeNode 参数 ============
export interface ExecuteNodeParams {
  nodeId: string;
  nodeType: string;
  mediaType: MediaType;
  actionType: ActionType;
  upstreamData: UpstreamData;
  modelConfig: ModelConfig;
  nodeInputs: Record<string, any>;
  abortSignal?: AbortSignal;
}

// ============ 节点注册表条目 ============
export interface NodeRegistration {
  type: string;           // 节点唯一标识，如 'prompt-source'
  label: string;          // 显示名
  category: string;       // 分类：剧本 | 生成 | 工具 | 媒体
  mediaType: MediaType;   // 输出媒体类型
  actionType: ActionType; // 执行动作类型
  inputs?: NodePort[];
  outputs?: NodePort[];
  defaultModel?: string;  // 可选默认模型
  component?: any;        // React 渲染组件
}

export interface NodePort {
  name: string;
  label: string;
  multiple?: boolean;
  required?: boolean;
}

// ============ 节点执行器注册表 ============
export const NODE_REGISTRY: Record<string, NodeRegistration> = {
  'prompt-source': {
    type: 'prompt-source',
    label: '📖 故事剧本源',
    category: '剧本',
    mediaType: 'text',
    actionType: 'chat',
  },
  'llm-storyboard': {
    type: 'llm-storyboard',
    label: '🎬 分镜规划',
    category: '剧本',
    mediaType: 'text',
    actionType: 'chat',
  },
  'image-service': {
    type: 'image-service',
    label: '🖼️ 图像生成',
    category: '生成',
    mediaType: 'image',
    actionType: 'generate',
  },
  'video-fusion': {
    type: 'video-fusion',
    label: '🎥 视频融合',
    category: '生成',
    mediaType: 'video',
    actionType: 'fusion',
  },
  'tts-service': {
    type: 'tts-service',
    label: '🔊 语音合成',
    category: '生成',
    mediaType: 'audio',
    actionType: 'tts',
  },
  'upload-node': {
    type: 'upload-node',
    label: '📁 上传节点',
    category: '媒体',
    mediaType: 'text',
    actionType: 'upload',
  },
  'loop-node': {
    type: 'loop-node',
    label: '🔄 循环节点',
    category: '工具',
    mediaType: 'text',
    actionType: 'loop',
  },
  'custom-workflow': {
    type: 'custom-workflow',
    label: '⚙️ 自定义工作流',
    category: '工具',
    mediaType: 'workflow',
    actionType: 'control',
  },
};
