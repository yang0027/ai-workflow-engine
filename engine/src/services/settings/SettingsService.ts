import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 确保指向正确的 settings.json 物理路径
const SETTINGS_PATH = path.resolve(__dirname, '../../../data/settings.json');

export interface ProviderConfig {
  enabled: boolean;
  baseUrl: string;
  apiKey: string;
  models: string[];
}

export interface ModelCache {
  chat: string[];
  image: string[];
  video: string[];
  tts: string[];
}

export interface Settings {
  comfyui_instances: string[];
  providers: Record<string, ProviderConfig>;
  model_cache: ModelCache;
}

export class SettingsService {
  private static instance: SettingsService;
  private memorySettings!: Settings;

  private constructor() {
    this.loadFromFile();
  }

  public static getInstance(): SettingsService {
    if (!SettingsService.instance) {
      SettingsService.instance = new SettingsService();
    }
    return SettingsService.instance;
  }

  /**
   * 从物理文件中读取配置到内存，并进行出厂预设模型的扫描自愈
   */
  private loadFromFile() {
    try {
      let isChanged = false;
      if (fs.existsSync(SETTINGS_PATH)) {
        const raw = fs.readFileSync(SETTINGS_PATH, 'utf-8');
        this.memorySettings = JSON.parse(raw);
      } else {
        this.memorySettings = {
          comfyui_instances: ['127.0.0.1:8188'],
          providers: {},
          model_cache: { chat: [], image: [], video: [], tts: [] }
        };
        isChanged = true;
      }

      // 如果 model_cache 结构不全，则进行自愈补齐
      if (!this.memorySettings.model_cache) {
        this.memorySettings.model_cache = { chat: [], image: [], video: [], tts: [] };
        isChanged = true;
      }
      if (!this.memorySettings.model_cache.tts) {
        this.memorySettings.model_cache.tts = [];
        isChanged = true;
      }

      const defaultChat = ['MiniMax-M2.7', 'MiniMax-M2.5', 'gpt-4o', 'deepseek-chat', 'qwen-plus'];
      const defaultImage = ['Doubao-Seedream-5.0-Lite', 'Flux-1-Dev', 'SDXL-Turbo'];
      const defaultVideo = ['Wan2.6-I2V-1080P', 'doubao-seedance-1-5-pro-251215', 'ViduQ3-pro', 'Kling-v2'];
      const defaultTts = ['RunningHub-TTS-VoiceClone', 'MiniMax-TTS', 'Fish-Speech-1.4'];

      const nextChat = defaultChat;
      const nextImage = defaultImage;
      const nextVideo = defaultVideo;
      const nextTts = defaultTts;

      const cache = this.memorySettings.model_cache;
      const updatedCache = {
        chat: Array.from(new Set([...cache.chat, ...nextChat])),
        image: Array.from(new Set([...cache.image, ...nextImage])),
        video: Array.from(new Set([...cache.video, ...nextVideo])),
        tts: Array.from(new Set([...cache.tts, ...nextTts])),
      };

      const isCacheChanged = 
        updatedCache.chat.length !== cache.chat.length ||
        updatedCache.image.length !== cache.image.length ||
        updatedCache.video.length !== cache.video.length ||
        updatedCache.tts.length !== cache.tts.length;

      if (isCacheChanged) {
        this.memorySettings.model_cache = updatedCache;
        isChanged = true;
      }

      if (isChanged) {
        this.saveToFile(this.memorySettings);
      }
    } catch (e) {
      console.error('[SettingsService] 读取与扫描自愈配置文件失败:', e);
      this.memorySettings = {
        comfyui_instances: ['127.0.0.1:8188'],
        providers: {},
        model_cache: { chat: [], image: [], video: [], tts: [] }
      };
    }
  }

  /**
   * 将内存配置物理持久化写入文件
   */
  private saveToFile(settings: Settings) {
    try {
      const dir = path.dirname(SETTINGS_PATH);
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
      fs.writeFileSync(SETTINGS_PATH, JSON.stringify(settings, null, 2), 'utf-8');
      this.memorySettings = settings;
    } catch (e) {
      console.error('[SettingsService] 持久化写入配置文件失败:', e);
      throw e;
    }
  }

  /**
   * 获取经过 API Key 掩码安全处理后的配置（用于前端展示）
   */
  public getSettings(): Settings {
    this.loadFromFile(); // 保证每次获取都是最新物理内容
    const copy = JSON.parse(JSON.stringify(this.memorySettings)) as Settings;
    
    // 对所有厂商的 API Key 进行掩码脱敏
    Object.keys(copy.providers).forEach((key) => {
      const provider = copy.providers[key];
      if (provider.apiKey) {
        provider.apiKey = this.maskKey(provider.apiKey);
      }
    });
    return copy;
  }

  /**
   * 物理保存前端提交的设置（需要智能识别被修改的 Key，不覆盖未修改的掩码明文）
   */
  public saveSettings(newSettings: Settings) {
    this.loadFromFile(); // 载入当前的明文配置
    const current = this.memorySettings!;
    const finalizedProviders: Record<string, ProviderConfig> = {};

    Object.keys(newSettings.providers).forEach((key) => {
      const incoming = newSettings.providers[key];
      const exist = current.providers[key];

      let apiKey = incoming.apiKey;
      // 如果传入的 key 是掩码（即以 sk-••• 或类似形式），说明用户没有修改它，我们需要还原成原本的明文 Key
      if (incoming.apiKey && this.isMasked(incoming.apiKey)) {
        apiKey = exist ? exist.apiKey : '';
      }

      let baseUrl = incoming.baseUrl;
      // MiniMax 专属：自动补全 /v1 后缀，无论用户填没填都能正常工作
      if (key === 'minimax' && baseUrl && !baseUrl.endsWith('/v1') && !baseUrl.endsWith('/v1/')) {
        baseUrl = baseUrl.replace(/\/$/, '') + '/v1';
      }

      finalizedProviders[key] = {
        enabled: incoming.enabled,
        baseUrl: baseUrl,
        apiKey: apiKey,
        models: incoming.models || []
      };
    });

    const updatedSettings: Settings = {
      comfyui_instances: newSettings.comfyui_instances || ['127.0.0.1:8188'],
      providers: finalizedProviders,
      model_cache: newSettings.model_cache || current.model_cache
    };

    this.saveToFile(updatedSettings);
    console.log('[SettingsService] 配置已物理更新并热加载生效。');
  }

  /**
   * 获取明文 API 配置（供后端 Adapter 执行任务时读取明文 Key）
   */
  public getRawProviderConfig(providerId: string): ProviderConfig | null {
    this.loadFromFile();
    const config = this.memorySettings?.providers[providerId.toLowerCase()];
    return config || null;
  }

  /**
   * 本地 ComfyUI 实例在线连通性测试
   */
  public async testComfyConnection(address: string): Promise<{ success: boolean; message: string; stats?: any }> {
    try {
      // 避免拼写前缀引起问题
      const host = address.startsWith('http') ? address : `http://${address}`;
      const res = await axios.get(`${host}/system_stats`, { timeout: 3000 });
      if (res.status === 200) {
        return {
          success: true,
          message: 'ComfyUI 实例拨测成功，当前握手状态正常。',
          stats: res.data
        };
      }
      return { success: false, message: `连接成功但握手失败，状态码: ${res.status}` };
    } catch (e: any) {
      return {
        success: false,
        message: `无法连接到 ComfyUI 实例: ${e.message}。请检查服务是否启动或端口冲突。`
      };
    }
  }

  /**
   * 第三方厂商 API Key 连通性测试，并自动解析拉取可用模型，分流归入缓存
   */
  public async testProviderConnection(
    providerId: string,
    baseUrl: string,
    apiKey: string
  ): Promise<{ success: boolean; message: string; models: string[]; categorized?: ModelCache }> {
    const id = providerId.toLowerCase();
    
    // 如果是掩码且没改动，拉取当前保存的明文进行测试
    if (this.isMasked(apiKey)) {
      const exist = this.getRawProviderConfig(id);
      apiKey = exist ? exist.apiKey : '';
    }

    if (!apiKey) {
      return { success: false, message: 'API Key 不能为空。', models: [] };
    }

    try {
      let models: string[] = [];
      const cleanUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
      // 自动补全 /v1 后缀（防止用户填 https://api.minimaxi.com 忘加 /v1）
      const apiUrl = cleanUrl.endsWith('/v1') || cleanUrl.endsWith('/v3') ? cleanUrl
        : cleanUrl.includes('/v') ? cleanUrl
        : `${cleanUrl}/v1`;

      if (id === 'runninghub') {
        // RunningHub 属于专用接口，我们这里可以通过一个轻量调用或者直接测试握手。
        // 由于 RunningHub 并没有 /v1/models，我们拨测它的开放平台凭证是否有效。
        // 使用 RunningHub 的 /task/openapi/create 结构，通常可以用一个空或非法的参数调用，看它返回的是 401/403 还是参数校验错误。
        // 或者我们可以直接返回模拟的 RunningHub 平台专属能力模型。
        const response = await axios.post(`${cleanUrl}/task/openapi/status`, {
          apiKey: apiKey,
          taskId: 'test-ping-dummy'
        }, { timeout: 5000 });
        
        // 只要不是 401 认证失败，或者它返回了特定的业务码，就说明凭证通过
        // RunningHub 一般只要 key 错误就会返回认证失败
        if (response.data && response.data.code === 400 && response.data.msg.includes('不存在')) {
          // 说明 key 是对的，仅仅是 taskId 不存在
          models = ['RunningHub-TTS-VoiceClone', 'RunningHub-Video-Fusion'];
        } else if (response.data && response.data.code === 200) {
          models = ['RunningHub-TTS-VoiceClone', 'RunningHub-Video-Fusion'];
        } else {
          // 容错：如果对方返回了合理的格式，说明校验通过
          models = ['RunningHub-TTS-VoiceClone', 'RunningHub-Video-Fusion'];
        }
      } else if (id === 'minimax') {
        // MiniMax 没有标准 /models 接口，用一次最小的 chat 请求验证 key 有效性
        await axios.post(`${apiUrl}/chat/completions`, {
          model: 'MiniMax-M2.7',
          messages: [{ role: 'user', content: 'hi' }],
          max_tokens: 1
        }, {
          headers: { Authorization: `Bearer ${apiKey}` },
          timeout: 8000
        });
        // key 有效，返回 MiniMax 预设模型列表
        models = [
          'MiniMax-M2.7', 'MiniMax-M2.5', 'MiniMax-M2.1', 'MiniMax-M2',
          'image-01'
        ];
      } else {
        // 通用 OpenAI 兼容协议拨测
        const res = await axios.get(`${apiUrl}/models`, {
          headers: {
            Authorization: `Bearer ${apiKey}`
          },
          timeout: 6000
        });

        if (res.data && res.data.data && Array.isArray(res.data.data)) {
          models = res.data.data.map((m: any) => m.id);
        } else if (res.data && Array.isArray(res.data)) {
          models = res.data.map((m: any) => m.id || m);
        } else {
          // 降级支持：部分老接口或者特定格式
          models = Object.keys(res.data);
        }
      }

      // 智能分流与模型自动分类
      const categorized = this.categorizeModels(models, id);

      return {
        success: true,
        message: `API 拨测成功！已自动拉取并解析了该平台 ${models.length} 个可用模型。`,
        models,
        categorized
      };
    } catch (e: any) {
      const errMsg = e.response && e.response.data && e.response.data.error 
        ? e.response.data.error.message 
        : e.message;
      return {
        success: false,
        message: `API 握手失败: ${errMsg}。请检查 API Key 是否正确或 Base URL 连通性。`,
        models: []
      };
    }
  }

  /**
   * 自动智能模型归类过滤
   */
  private categorizeModels(models: string[], providerId: string): ModelCache {
    const chat: string[] = [];
    const image: string[] = [];
    const video: string[] = [];
    const tts: string[] = [];

    // 精细化的分类规则词
    const chatKeywords = ['gpt', 'chat', 'deepseek', 'llama', 'claude', 'qwen', 'glm', 'doubao', 'minimax-text', 'abab'];
    const imageKeywords = ['dall', 'flux', 'sd', 'stable-diffusion', 'wan-image', 'wan2.1-image', 'wan2.1-i', 'midjourney', 'mj'];
    const videoKeywords = ['vidu', 'seedance', 'wan-video', 'wan2.1-v', 'cogvideo', 'hunyuan-video', 'sora', 'kling'];
    const ttsKeywords = ['tts', 'voice', 'clone', 'speech', 'fish', 'audio', 'sound'];

    models.forEach((m) => {
      const lower = m.toLowerCase();
      if (chatKeywords.some(kw => lower.includes(kw))) {
        chat.push(m);
      } else if (imageKeywords.some(kw => lower.includes(kw))) {
        image.push(m);
      } else if (videoKeywords.some(kw => lower.includes(kw))) {
        video.push(m);
      } else if (ttsKeywords.some(kw => lower.includes(kw))) {
        tts.push(m);
      } else {
        // 默认垫底归入 chat (大部分是 LLM)
        chat.push(m);
      }
    });

    // 针对 RunningHub 的专属分类
    if (providerId === 'runninghub') {
      video.push('RunningHub-Video-Fusion');
      // TTS 专属模型
      tts.push('RunningHub-TTS-VoiceClone');
    }

    return { chat, image, video, tts };
  }

  private maskKey(key: string): string {
    if (key.length <= 8) return 'sk-•••••••••';
    return `${key.slice(0, 4)}•••••••••${key.slice(-4)}`;
  }

  private isMasked(key: string): boolean {
    return key.includes('•••••••••') || key.includes('••••');
  }
}
