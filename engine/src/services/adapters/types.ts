export interface AIConfig {
  provider: string;
  baseUrl: string;
  apiKey: string;
  model?: string;
}

export interface ProviderRequest {
  url: string;
  method: string;
  headers: Record<string, string>;
  body: any;
}

/**
 * 统一的图片生成适配器契约
 */
export interface ImageAdapter {
  provider: string;
  buildGenerateRequest(config: AIConfig, prompt: string, size: string, options?: any): ProviderRequest;
  parseGenerateResponse(result: any): { isAsync: boolean; taskId?: string; imageUrl?: string };
  buildPollRequest(config: AIConfig, taskId: string): ProviderRequest;
  parsePollResponse(result: any): { status: 'pending' | 'processing' | 'completed' | 'failed'; imageUrl?: string; error?: string };
}

/**
 * 统一的视频生成适配器契约
 */
export interface VideoAdapter {
  provider: string;
  buildGenerateRequest(config: AIConfig, prompt: string, options?: any): ProviderRequest;
  parseGenerateResponse(result: any): { isAsync: boolean; taskId?: string; videoUrl?: string };
  buildPollRequest(config: AIConfig, taskId: string): ProviderRequest;
  parsePollResponse(result: any): { status: 'pending' | 'processing' | 'completed' | 'failed'; videoUrl?: string; error?: string };
}

/**
 * 统一的声音克隆 (TTS) 适配器契约
 */
export interface TTSAdapter {
  provider: string;
  buildGenerateRequest(config: AIConfig, text: string, speakerId: string, options?: any): ProviderRequest;
  parseGenerateResponse(result: any): { audioUrlOrBase64: string; format: string };
}

/**
 * 统一的 LLM 文本生成适配器契约
 */
export interface LLMAdapter {
  provider: string;
  buildChatRequest(config: AIConfig, messages: Array<{ role: string; content: string }>, options?: any): ProviderRequest;
  parseChatResponse(result: any): string;
}

// ============ 自定义 ComfyUI/RunningHub 工作流灌参映射契约 ============

export interface InputMapping {
  portId: string;        // 前端画布节点定义的端口ID (如 prompt_text)
  nodeId: string;        // 目标 ComfyUI 节点ID 或 RunningHub 节点ID (如 "6")
  fieldName: string;     // 节点里的实际输入属性 (如 "text" 或者是 "seed")
  displayName: string;   // 前端显示的中文或英文别名 (如 "剧本提示词")
}

export interface CustomWorkflowPayload {
  source: 'local_comfyui' | 'runninghub';
  workflowIdOrJson: string;          // 本地 JSON 串或者是云端 RunningHub 工作流 ID
  mappings: InputMapping[];
  inputs: Record<string, any>;       // 画布输入数据，键为 portId，值为具体连线传入的内容
}
