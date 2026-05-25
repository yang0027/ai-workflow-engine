import { ImageAdapter, VideoAdapter, TTSAdapter, LLMAdapter } from './types.js';
import { ComfyUIAdapter } from './impl/ComfyUIAdapter.js';
import { RunningHubAdapter } from './impl/RunningHubAdapter.js';
import { OpenAIImageAdapter, OpenAIVideoAdapter, OpenAITTSAdapter, OpenAILLMAdapter } from './impl/OpenAIAdapter.js';

export class AdapterRegistry {
  private static imageAdapters: Record<string, ImageAdapter> = {};
  private static videoAdapters: Record<string, VideoAdapter> = {};
  private static ttsAdapters: Record<string, TTSAdapter> = {};
  private static llmAdapters: Record<string, LLMAdapter> = {};

  private static initialized = false;

  private static init() {
    if (this.initialized) return;

    // 实例化各类适配器并注册
    const comfy = new ComfyUIAdapter() as any;
    const runninghub = new RunningHubAdapter() as any;
    
    const openAIImage = new OpenAIImageAdapter();
    const openAIVideo = new OpenAIVideoAdapter();
    const openAITTS = new OpenAITTSAdapter();
    const openAILLM = new OpenAILLMAdapter();

    // 1. 注册图片生成适配器
    this.imageAdapters['local_comfyui'] = comfy;
    this.imageAdapters['runninghub'] = runninghub;
    this.imageAdapters['openai'] = openAIImage;
    this.imageAdapters['minimax'] = openAIImage; // 暂用 OpenAI 兼容层
    this.imageAdapters['volcengine'] = openAIImage;
    this.imageAdapters['ali'] = openAIImage;

    // 2. 注册视频生成适配器
    this.videoAdapters['local_comfyui'] = comfy;
    this.videoAdapters['runninghub'] = runninghub;
    this.videoAdapters['minimax'] = openAIVideo;
    this.videoAdapters['vidu'] = openAIVideo;
    this.videoAdapters['ali'] = openAIVideo;

    // 3. 注册语音克隆 (TTS) 适配器
    this.ttsAdapters['local_comfyui'] = comfy;
    this.ttsAdapters['runninghub'] = runninghub;
    this.ttsAdapters['minimax'] = openAITTS;

    // 4. 注册对话 (LLM) 适配器
    this.llmAdapters['openai'] = openAILLM;
    this.llmAdapters['deepseek'] = openAILLM;
    this.llmAdapters['volcengine'] = openAILLM;
    this.llmAdapters['ali'] = openAILLM;

    this.initialized = true;
  }

  public static getImageAdapter(provider: string): ImageAdapter {
    this.init();
    const id = provider.toLowerCase();
    return this.imageAdapters[id] || this.imageAdapters['openai'];
  }

  public static getVideoAdapter(provider: string): VideoAdapter {
    this.init();
    const id = provider.toLowerCase();
    return this.videoAdapters[id] || this.videoAdapters['openai'];
  }

  public static getTTSAdapter(provider: string): TTSAdapter {
    this.init();
    const id = provider.toLowerCase();
    return this.ttsAdapters[id] || this.ttsAdapters['runninghub'];
  }

  public static getLLMAdapter(provider: string): LLMAdapter {
    this.init();
    const id = provider.toLowerCase();
    return this.llmAdapters[id] || this.llmAdapters['openai'];
  }
}
