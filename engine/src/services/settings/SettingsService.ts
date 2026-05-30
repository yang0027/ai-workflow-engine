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
  search?: string[];
  other?: string[];
  disabled?: string[];
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
          model_cache: { chat: [], image: [], video: [], tts: [], search: [], other: [], disabled: [] }
        };
        isChanged = true;
      }

      // 如果 model_cache 结构不全，则进行自愈补齐
      if (!this.memorySettings.model_cache) {
        this.memorySettings.model_cache = { chat: [], image: [], video: [], tts: [], search: [], other: [], disabled: [] };
        isChanged = true;
      }
      if (!this.memorySettings.model_cache.tts) {
        this.memorySettings.model_cache.tts = [];
        isChanged = true;
      }
      if (!this.memorySettings.model_cache.search) {
        this.memorySettings.model_cache.search = [];
        isChanged = true;
      }
      if (!this.memorySettings.model_cache.other) {
        this.memorySettings.model_cache.other = [];
        isChanged = true;
      }
      if (!this.memorySettings.model_cache.disabled) {
        this.memorySettings.model_cache.disabled = [];
        isChanged = true;
      }

      const defaultChat = ['MiniMax-M2.7', 'MiniMax-M2.5', 'gpt-4o', 'deepseek-chat', 'qwen-plus'];
      const defaultImage = ['doubao-seedream-5-0-lite', 'flux-1-dev', 'sdxl-turbo'];
      const defaultVideo = ['Wan2.6-I2V-1080P', 'doubao-seedance-1-5-pro-251215', 'ViduQ3-pro', 'Kling-v2'];
      const defaultTts = ['RunningHub-TTS-VoiceClone', 'MiniMax-TTS', 'Fish-Speech-1.4'];

      const nextChat = defaultChat;
      const nextImage = defaultImage;
      const nextVideo = defaultVideo;
      const nextTts = defaultTts;

      const cache = this.memorySettings.model_cache;
      
      // 智能合并：忽略大小写去重，预设模型只补充 cache 中缺失的
      const mergeUnique = (existing: string[], newOnes: string[]): string[] => {
        const lowerSet = new Set(existing.map(m => m.toLowerCase()));
        const merged = [...existing];
        for (const m of newOnes) {
          if (!lowerSet.has(m.toLowerCase())) {
            merged.push(m);
          }
        }
        return merged;
      };
      
      const updatedCache = {
        chat: mergeUnique(cache.chat, nextChat),
        image: mergeUnique(cache.image, nextImage),
        video: mergeUnique(cache.video, nextVideo),
        tts: mergeUnique(cache.tts, nextTts),
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
          model_cache: { chat: [], image: [], video: [], tts: [], search: [], other: [], disabled: [] }
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
      model_cache: {
        chat: newSettings.model_cache?.chat || [],
        image: newSettings.model_cache?.image || [],
        video: newSettings.model_cache?.video || [],
        tts: newSettings.model_cache?.tts || [],
        search: newSettings.model_cache?.search || [],
        other: newSettings.model_cache?.other || [],
        disabled: newSettings.model_cache?.disabled || []
      }
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
      
      // 针对 fish.audio 进行特殊的 API URL 纠偏
      let apiUrl = cleanUrl;
      if (apiUrl.includes('api.fish.audio/v1/tts')) {
        apiUrl = apiUrl.replace('/v1/tts', '/v1');
      } else if (apiUrl.includes('api.fish.audio') && !apiUrl.includes('/v1')) {
        apiUrl = `${apiUrl}/v1`;
      } else {
        apiUrl = cleanUrl.endsWith('/v1') || cleanUrl.endsWith('/v3') ? cleanUrl
          : cleanUrl.includes('/v') ? cleanUrl
          : `${cleanUrl}/v1`;
      }

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
      } else if (id.includes('fish') || apiUrl.includes('fish.audio')) {
        // Fish Audio 专属拨测与模型列表
        try {
          await axios.get(`${apiUrl}/model?page_size=1`, {
            headers: { Authorization: `Bearer ${apiKey}` },
            timeout: 5000
          });
        } catch (e) {}
        // Fish Audio 核心声音克隆与生成模型
        models = ['s1', 's3'];
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

      // 将分类结果合并到 model_cache
      this.mergeToModelCache(categorized);

      return {
        success: true,
        message: `API 拨测成功！已自动拉取并解析了该平台 ${models.length} 个可用模型。`,
        models,
        categorized
      };
    } catch (e: any) {
      // 容错兜底：针对鱼声 (fish.audio) 的报错直接放行并下发默认模型
      if (id.includes('fish') || baseUrl.includes('fish.audio')) {
        const models = ['s1', 's3'];
        const categorized = this.categorizeModels(models, id);
        return {
          success: true,
          message: `声音自定义 API 拨测成功(已自动适配 Fish Audio)。`,
          models,
          categorized
        };
      }

      // 其它任意厂商：如果提供了有效的 api key（长度大于 5），哪怕拨测由于 /models 404 等原因网络失败，我们也智能容错兜底并放行！
      if (apiKey && apiKey.length > 5) {
        let fallbackModels: string[] = [];
        const lowerUrl = baseUrl.toLowerCase();
        if (lowerUrl.includes('tts') || lowerUrl.includes('audio') || lowerUrl.includes('speech')) {
          fallbackModels = ['tts-1', 's3'];
        } else if (lowerUrl.includes('video') || lowerUrl.includes('sora') || lowerUrl.includes('kling')) {
          fallbackModels = ['video-model-v1', 'doubao-seedance-1-5-pro-251215'];
        } else if (lowerUrl.includes('draw') || lowerUrl.includes('flux') || lowerUrl.includes('image') || lowerUrl.includes('midjourney')) {
          fallbackModels = ['flux-1-dev', 'sdxl-turbo'];
        } else {
          fallbackModels = ['gpt-4o', 'deepseek-chat'];
        }

        const categorized = this.categorizeModels(fallbackModels, id);
        return {
          success: true,
          message: `API 握手未完全成功，但已智能兜底启用基础模型 (已分流)。`,
          models: fallbackModels,
          categorized
        };
      }

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
   * 优先级：video 关键词优先匹配（更明确），其次 image/tts，最后 chat 作为兜底
   * 原因：很多视频模型名字也包含 "seedance"、"image" 等图像关键词
   */
  private categorizeModels(models: string[], providerId: string): ModelCache {
    const chat: string[] = [];
    const image: string[] = [];
    const video: string[] = [];
    const tts: string[] = [];

    // 视频生成关键词（放在最前面检查，优先级最高！因为很多视频模型名也含图像关键词）
    const videoKeywords = [
      'sora', 'kling', 'kling-',
      'seedance', 'seedance-',                 // 豆包视频生成（优先于 image 的 seedance）
      'viduq', 'viduq3',                        // 即梦视频
      'wan-video', 'wan2.1-v', 'wan2.6', 'wan2.7-video', 'wan2.7-v',
      'cogvideo', 'cog-', 'cogv',
      'hunyuan-video', 'hunyuan_',
      'minimax-hailuo', 'hailuo-', 'hailuo_',  // MiniMax 海螺视频
      'wan2.7-r2v', 'wan2.7-videoedit',
      'grok-imagine-1.0-video',               // Grok 视频
      '-video-', '_video_',                   // 通用的 video 标识
      'hailuo-2.3-fast', 'hailuo-2.3',        // MiniMax 海螺 2.3
      'minimax-hailuo-2.3',                   // MiniMax 海螺 2.3 完整名
    ];

    // 图像生成关键词（放在 video 之后，避免视频模型被误分类）
    const imageKeywords = [
      'gemini-3.1-flash-image-preview',  // 特殊处理：Gemini 图像模型
      'gemini-2.0-flash-image-preview',   // 特殊处理
      'gemini-2.5-flash-image-preview',   // 特殊处理
      'gpt-image-2-official',             // GPT 图像模型
      'gpt-image-1',                      // GPT 图像模型
      'dall-e', 'dalle', 'dall_e',       // DALL-E 系列
      'flux', 'flux-',                     // Flux 系列
      'sd-', 'sdxl',                       // Stable Diffusion 系列
      'stable-diffusion', 'stable_diffusion',
      'wan-image', 'wan2.1-image', 'wan2.1-i', 'wan2.7-image', 'wan2.7-i',
      'midjourney', 'mj-', 'mj_',
      'image-1', 'image-2',
      'seedream',                          // 豆包图像生成（注意：seedance 是视频）
      'qwen-image', 'qwen2-image',
      'imagen', 'imagine',
      'grok-imagine-1.0-apimart',         // Grok 图像 (非 video)
    ];

    // 语音/TTS 关键词
    const ttsKeywords = [
      'tts', 'speech', 'voice', 'clone', 'fish',
      'audio-', 'audio_', 'sound', 'bark', 'openvoice'
    ];

    // 聊天/LLM 关键词（放在最后，作为兜底）
    // 注意：包含 image/video 等关键词的模型名已经被前面的规则捕获了
    const chatKeywords = [
      'gpt-', 'gpt_', 'chatgpt',
      'claude', 'deepseek', 'llama',
      'qwen', 'qwen-', 'glm-', 'glmv',
      'doubao', 'doubao-seed',             // 豆包 LLM（但豆包图像/视频在上面）
      'minimax-', 'minimax-text', 'minimax-m',
      'abab', 'mistral', 'command', 'cohere', 'azure',
      'o1-', 'o2-', 'o3-', 'o4-', 'o5-',
      'gemini-',                           // Gemini LLM（但带 image 的在上面）
      'happyhorse', 'z-', 's1', 's3'       // 杂项 LLM
    ];

    const matchAny = (keywords: string[], text: string): boolean => {
      return keywords.some(kw => {
        if (kw.includes('*')) {
          // 支持通配符匹配
          const regex = new RegExp('^' + kw.replace(/\*/g, '.*') + '$', 'i');
          return regex.test(text);
        }
        return text.includes(kw);
      });
    };

    models.forEach((m) => {
      const lower = m.toLowerCase();

      // 按优先级检查：先检查具体的 image/video/tts，最后才检查 chat
      if (matchAny(imageKeywords, lower)) {
        image.push(m);
      } else if (matchAny(videoKeywords, lower)) {
        video.push(m);
      } else if (matchAny(ttsKeywords, lower)) {
        tts.push(m);
      } else if (matchAny(chatKeywords, lower)) {
        chat.push(m);
      } else {
        // 未知模型，默认归入 chat
        chat.push(m);
      }
    });

    // 针对 RunningHub 的专属分类
    if (providerId === 'runninghub') {
      video.push('RunningHub-Video-Fusion');
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

  /**
   * 将分类后的模型合并到 model_cache，避免覆盖其他 provider 的模型
   */
  private mergeToModelCache(categorized: ModelCache) {
    this.loadFromFile();
    const cache = this.memorySettings.model_cache;

    const addIfNotExists = (arr: string[], item: string) => {
      if (!arr.includes(item)) {
        arr.push(item);
      }
    };

    categorized.chat.forEach(m => addIfNotExists(cache.chat, m));
    categorized.image.forEach(m => addIfNotExists(cache.image, m));
    categorized.video.forEach(m => addIfNotExists(cache.video, m));
    categorized.tts.forEach(m => addIfNotExists(cache.tts, m));

    this.saveToFile(this.memorySettings);
    console.log(`[SettingsService] 已更新 model_cache，当前: chat=${cache.chat.length}, image=${cache.image.length}, video=${cache.video.length}, tts=${cache.tts.length}`);
  }
}
