import Fastify from 'fastify';
import cors from '@fastify/cors';
import { RunningHubClient } from './lib/RunningHubClient.js';
import { TTSService } from './services/tts/TTSService.js';
import { VideoService } from './services/video/VideoService.js';
import { SettingsService } from './services/settings/SettingsService.js';
import { SkillsService } from './services/settings/SkillsService.js';
import { CustomWorkflowParser } from './services/adapters/CustomWorkflowParser.js';
import { ComfyUIAdapter } from './services/adapters/impl/ComfyUIAdapter.js';
import { RunningHubAdapter } from './services/adapters/impl/RunningHubAdapter.js';
import { WorkflowTemplateService } from './services/workflow-templates/WorkflowTemplateService.js';
import { ComfyUIWorkflowService } from './services/comfyui/ComfyUIWorkflowService.js';
import { CanvasService } from './services/canvas/CanvasService.js';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fastify = Fastify({ 
  logger: true,
  bodyLimit: 52428800 // 50MB 物理大载荷支持
});

// 注册 CORS，允许前端 5173 端口访问
await fastify.register(cors, {
  origin: ['http://localhost:5173', 'http://localhost:5174'],
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
});

// 从环境变量中读取 RunningHub API Key，或者使用备用开发 Key (此处死锁为 ToonFlow 项目的集成规范)
const RUNNINGHUB_API_KEY = process.env.RUNNINGHUB_API_KEY || 'dev_runninghub_api_key_toonflow';
const runningHubClient = new RunningHubClient({ apiKey: RUNNINGHUB_API_KEY });

const ttsService = new TTSService(runningHubClient);
const videoService = new VideoService(runningHubClient);
const settingsService = SettingsService.getInstance();
const skillsService = SkillsService.getInstance();
const workflowTemplateService = WorkflowTemplateService.getInstance();
const comfyUIAdapter = new ComfyUIAdapter();
const runningHubAdapter = new RunningHubAdapter();
const comfyUIWorkflowService = ComfyUIWorkflowService.getInstance();
const canvasService = CanvasService.getInstance();

// 1. 健康状态接口
fastify.get('/api/v1/engine/health', async () => {
  return {
    status: 'ok',
    service: 'engine-core',
    runningHubConnected: !!RUNNINGHUB_API_KEY,
  };
});

// 2. 声音克隆接口 (TTS Node)
fastify.post('/api/v1/engine/tts/clone', async (request, reply) => {
  try {
    const body = request.body as any;
    if (!body.audioBase64 || !body.characterName) {
      return reply.status(400).send({ error: 'Missing audioBase64 or characterName' });
    }

    const result = await ttsService.cloneVoice(body);
    return { success: true, ...result };
  } catch (err: any) {
    fastify.log.error(err);
    return reply.status(500).send({ error: err.message });
  }
});

// 3. 声音克隆状态与输出获取
fastify.get('/api/v1/engine/tts/status/:taskId', async (request, reply) => {
  try {
    const { taskId } = request.params as { taskId: string };
    const result = await ttsService.getClonedAudioResult(taskId);
    return { success: true, ...result };
  } catch (err: any) {
    fastify.log.error(err);
    return reply.status(500).send({ error: err.message });
  }
});

// 4. 视频融合接口 (Video Node)
fastify.post('/api/v1/engine/video/fusion', async (request, reply) => {
  try {
    const body = request.body as any;

    if (!body.imageBase64 || !body.audioBase64) {
      return reply.status(400).send({ error: 'Missing imageBase64 or audioBase64' });
    }

    const result = await videoService.fuseVideo(body);
    return { success: true, ...result };
  } catch (err: any) {
    fastify.log.error(err);
    return reply.status(500).send({ error: err.message });
  }
});

// 5. 视频融合状态与输出获取
fastify.get('/api/v1/engine/video/status/:taskId', async (request, reply) => {
  try {
    const { taskId } = request.params as { taskId: string };
    const result = await videoService.getVideoResult(taskId);
    return { success: true, ...result };
  } catch (err: any) {
    fastify.log.error(err);
    return reply.status(500).send({ error: err.message });
  }
});

// ============ 静态生成资源服务 ============
fastify.get('/outputs/:filename', async (request, reply) => {
  const { filename } = request.params as { filename: string };
  const filePath = path.resolve(__dirname, '../data/outputs', filename);
  if (fs.existsSync(filePath)) {
    const stream = fs.createReadStream(filePath);
    const ext = path.extname(filename).toLowerCase();
    let mime = 'image/png';
    if (ext === '.mp4') mime = 'video/mp4';
    else if (ext === '.mp3') mime = 'audio/mpeg';
    else if (ext === '.mpeg' || ext === '.mpg') mime = 'video/mpeg';
    else if (ext === '.wav') mime = 'audio/wav';
    else if (ext === '.gif') mime = 'image/gif';
    else if (ext === '.webp') mime = 'image/webp';
    else if (ext === '.jpg' || ext === '.jpeg') mime = 'image/jpeg';
    return reply
      .type(mime)
      .header('Cache-Control', 'public, max-age=31536000, immutable')
      .send(stream);
  }
  return reply.status(404).send({ error: 'File not found' });
});

// ============ 通用多媒体文件上传 MinIO (带本地灾备与 MimeType 识别) ============
fastify.post('/api/v1/engine/upload', async (request, reply) => {
  try {
    const body = request.body as any || {};
    const file = body.file || body.fileBase64;
    const filename = body.filename || body.fileName;

    if (!file || !filename) {
      return reply.status(400).send({ error: 'Missing file base64 or filename' });
    }

    // 1. 提取纯 Base64 并物理落地到本地 outputs 作为灾备降级
    const cleanBase64 = file.replace(/^data:[a-zA-Z0-9/+-]+;base64,/, '');
    const buffer = Buffer.from(cleanBase64, 'base64');
    
    // 生成带时间戳的唯一文件名，防止重名覆盖
    const ext = path.extname(filename) || '.png';
    const uniqueFilename = `upload-${Date.now()}-${Math.random().toString(36).substr(2, 8)}${ext}`;
    
    const outputDir = path.resolve(__dirname, '../data/outputs');
    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }
    const filePath = path.join(outputDir, uniqueFilename);
    fs.writeFileSync(filePath, buffer);
    console.log(`[Engine Upload] 📁 文件本地物理灾备落地成功: ${filePath}`);

    // 2. 识别 MIME 类型以便 MinIO 能正确返回 Content-Type
    let mimeType = 'image/png';
    const lowerExt = ext.toLowerCase();
    
    // 物理防黑屏：增加主流视频及音频格式的深度匹配（包含大小写）
    if (lowerExt === '.jpg' || lowerExt === '.jpeg') mimeType = 'image/jpeg';
    else if (lowerExt === '.gif') mimeType = 'image/gif';
    else if (lowerExt === '.webp') mimeType = 'image/webp';
    else if (lowerExt === '.mp4' || lowerExt === '.webm' || lowerExt === '.mov' || lowerExt === '.avi' || lowerExt === '.mkv') mimeType = 'video/mp4';
    else if (lowerExt === '.mp3') mimeType = 'audio/mpeg';
    else if (lowerExt === '.wav') mimeType = 'audio/wav';
    else if (lowerExt === '.flac') mimeType = 'audio/flac';
    else if (lowerExt === '.ogg') mimeType = 'audio/ogg';

    // 3. 上传到本地 MinIO 的 workflows 桶中
    let uploadUrl = '';
    try {
      console.log(`[Engine Upload] 📦 正在同步上传到 MinIO: ${uniqueFilename}...`);
      // 超时时间由 8 秒大幅提升至 60 秒，确保大文件（如 25.5MB 视频）不超时断开
      await axios.put(`http://localhost:19000/workflows/${uniqueFilename}`, buffer, {
        headers: { 'Content-Type': mimeType },
        timeout: 60000
      });
      uploadUrl = `http://localhost:19000/workflows/${uniqueFilename}`;
      console.log(`[Engine Upload] 🎉 MinIO 上传成功: ${uploadUrl}`);
    } catch (minioErr: any) {
      console.warn(`[Engine Upload] ⚠️ MinIO 物理同步失败 (已自动启用降级防灾本地链路): ${minioErr.message}`);
      // 灾备降级，使用本地核心服务端口 4000 接管
      uploadUrl = `http://localhost:4000/outputs/${uniqueFilename}`;
    }

    return { success: true, url: uploadUrl, filename: uniqueFilename };
  } catch (err: any) {
    fastify.log.error(err);
    return reply.status(500).send({ error: `Upload engine error: ${err.message}` });
  }
});

// ============ 全局配置持久化与脱敏获取 ============
fastify.get('/api/v1/engine/settings', async () => {
  return settingsService.getSettings();
});

fastify.put('/api/v1/engine/settings', async (request, reply) => {
  try {
    const body = request.body as any;
    settingsService.saveSettings(body);
    return { success: true, message: '配置热更新已保存。' };
  } catch (err: any) {
    return reply.status(500).send({ error: err.message });
  }
});

// ============ 本地 ComfyUI 握手测试 ============
fastify.post('/api/v1/engine/settings/comfy/test', async (request, reply) => {
  try {
    const { address } = request.body as { address: string };
    if (!address) return reply.status(400).send({ error: 'Address is required' });
    const result = await settingsService.testComfyConnection(address);
    return result;
  } catch (err: any) {
    return reply.status(500).send({ error: err.message });
  }
});

// ============ 第三方 API Key 握手测试并拉取模型 ============
fastify.post('/api/v1/engine/settings/provider/test', async (request, reply) => {
  try {
    const { providerId, baseUrl, apiKey } = request.body as { providerId: string; baseUrl: string; apiKey: string };
    if (!providerId || !baseUrl) {
      return reply.status(400).send({ error: 'Missing providerId or baseUrl' });
    }
    const result = await settingsService.testProviderConnection(providerId, baseUrl, apiKey);
    return result;
  } catch (err: any) {
    return reply.status(500).send({ error: err.message });
  }
});

// ============ 技能中心 Skills API ============
fastify.get('/api/v1/engine/skills', async () => {
  return skillsService.getSkills();
});

fastify.get('/api/v1/engine/skills/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const skill = skillsService.getSkillById(id);
  if (!skill) return reply.status(404).send({ error: 'Skill not found' });
  return skill;
});

fastify.post('/api/v1/engine/skills', async (request, reply) => {
  try {
    const body = request.body as any;
    if (!body.id || !body.name || !body.systemPrompt) {
      return reply.status(400).send({ error: 'Missing id, name or systemPrompt' });
    }
    skillsService.saveSkill(body);
    return { success: true, message: '技能已成功保存。' };
  } catch (err: any) {
    return reply.status(500).send({ error: err.message });
  }
});

fastify.delete('/api/v1/engine/skills/:id', async (request, reply) => {
  try {
    const { id } = request.params as { id: string };
    skillsService.deleteSkill(id);
    return { success: true, message: '技能已成功删除。' };
  } catch (err: any) {
    return reply.status(500).send({ error: err.message });
  }
});

// ============ 工作流模板库：本地 ComfyUI + RunningHub 统一模板 ============
fastify.get('/api/v1/engine/workflow-templates', async () => {
  return {
    success: true,
    templates: workflowTemplateService.listTemplates()
  };
});

fastify.get('/api/v1/engine/workflow-templates/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const template = workflowTemplateService.getTemplate(id);
  if (!template) {
    return reply.status(404).send({ error: 'Workflow template not found' });
  }
  return { success: true, template };
});

fastify.post('/api/v1/engine/workflow-templates/parse', async (request, reply) => {
  try {
    const result = workflowTemplateService.parseTemplate(request.body as any);
    return { success: true, ...result };
  } catch (err: any) {
    fastify.log.error(err);
    return reply.status(400).send({ error: err.message });
  }
});

fastify.post('/api/v1/engine/workflow-templates', async (request, reply) => {
  try {
    const template = workflowTemplateService.saveTemplate(request.body as any);
    return { success: true, template };
  } catch (err: any) {
    fastify.log.error(err);
    return reply.status(400).send({ error: err.message });
  }
});

fastify.put('/api/v1/engine/workflow-templates/:id', async (request, reply) => {
  try {
    const { id } = request.params as { id: string };
    const template = workflowTemplateService.saveTemplate({ ...(request.body as any), id });
    return { success: true, template };
  } catch (err: any) {
    fastify.log.error(err);
    return reply.status(400).send({ error: err.message });
  }
});

fastify.delete('/api/v1/engine/workflow-templates/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const deleted = workflowTemplateService.deleteTemplate(id);
  if (!deleted) {
    return reply.status(404).send({ error: 'Workflow template not found' });
  }
  return { success: true, message: '工作流模板已删除。' };
});

// ============ 通用大语言模型调度路由 ============
fastify.post('/api/v1/engine/llm/chat', async (request, reply) => {
  try {
    const { providerId, model, messages, systemPrompt } = request.body as {
      providerId: string;
      model: string;
      messages: any[];
      systemPrompt?: string;
    };

    if (!providerId || !model || !messages) {
      return reply.status(400).send({ error: 'Missing providerId, model or messages' });
    }

    const config = settingsService.getRawProviderConfig(providerId);
    if (!config || !config.enabled) {
      return reply.status(400).send({ error: `Provider ${providerId} is not enabled` });
    }

    const finalMessages = systemPrompt 
      ? [{ role: 'system', content: systemPrompt }, ...messages]
      : messages;

    let cleanUrl = config.baseUrl.endsWith('/') ? config.baseUrl.slice(0, -1) : config.baseUrl;
    const response = await axios.post(`${cleanUrl}/chat/completions`, {
      model: model,
      messages: finalMessages,
      temperature: 0.7
    }, {
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 20000
    });

    return response.data;
  } catch (err: any) {
    fastify.log.error(err);
    return reply.status(500).send({ error: err.message });
  }
});

// ============ 通用生图服务调度路由 ============
fastify.post('/api/v1/engine/image/generate', async (request, reply) => {
  try {
    const { providerId, model, prompt, size = '1024x1024', response_format = 'url' } = request.body as {
      providerId: string;
      model: string;
      prompt: string;
      size?: string;
      response_format?: 'url' | 'b64_json';
    };

    if (!providerId || !model || !prompt) {
      return reply.status(400).send({ error: 'Missing providerId, model or prompt' });
    }

    const config = settingsService.getRawProviderConfig(providerId);
    if (!config || !config.enabled) {
      return reply.status(400).send({ error: `Provider ${providerId} is not enabled` });
    }

    let cleanUrl = config.baseUrl.endsWith('/') ? config.baseUrl.slice(0, -1) : config.baseUrl;

    // ===== MiniMax 专属图片接口 (返回格式与 OpenAI 不同) =====
    if (providerId === 'minimax') {
      const endpoint = `${cleanUrl}/image_generation`;
      console.log(`[Engine] MiniMax image generation at ${endpoint}, model=${model}`);
      const response = await axios.post(endpoint, {
        model: model,
        prompt: prompt
      }, {
        headers: {
          'Authorization': `Bearer ${config.apiKey}`,
          'Content-Type': 'application/json'
        },
        timeout: 60000
      });
      // MiniMax 返回 { id, data: { image_urls: ["..."] } }
      // 统一转成 OpenAI 兼容格式: { data: [{ url: "..." }] }
      const imageUrls: string[] = response.data?.data?.image_urls || [];
      if (imageUrls.length === 0) {
        throw new Error('MiniMax 未返回图片 URL');
      }
      return {
        data: imageUrls.map((url: string) => ({ url }))
      };
    }

    // ===== 通用 OpenAI 兼容接口 =====
    // 检查是否是豆包/Seedream 等特殊调用
    let endpoint = `${cleanUrl}/images/generations`;
    if (providerId === 'grsai' && model.startsWith('nano-banana')) {
      endpoint = `${cleanUrl}/v1/draw/nano-banana`;
    }

    console.log(`[Engine] Generating image via ${providerId} model ${model} at ${endpoint}`);

    // 如果是 b64_json 格式，需要将 base64 转为本地文件 URL
    const saveBase64ToFile = async (base64Data: string): Promise<string> => {
      const buffer = Buffer.from(base64Data, 'base64');
      const filename = `std-img-${Date.now()}-${Math.random().toString(36).substr(2, 8)}.png`;
      const outputDir = path.join(__dirname, '..', 'data', 'outputs');
      
      // 确保输出目录存在
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      
      const filePath = path.join(outputDir, filename);
      fs.writeFileSync(filePath, buffer);

      // 返回走网关代理的 URL，彻底解决跨域与公网访问不回显问题
      const gatewayUrl = process.env.GATEWAY_URL || 'http://localhost:3000';
      return `${gatewayUrl}/api/v1/download/proxy?url=http://localhost:4000/outputs/${filename}`;
    };

    const response = await axios.post(endpoint, {
      model: model,
      prompt: prompt,
      size: size,
      n: 1,
      response_format: response_format
    }, {
      headers: {
        'Authorization': `Bearer ${config.apiKey}`,
        'Content-Type': 'application/json'
      },
      timeout: 25000
    });

    // 处理响应：将 b64_json 转为文件 URL
    if (response.data?.data && Array.isArray(response.data.data)) {
      const processedData = await Promise.all(response.data.data.map(async (item: any) => {
        if (item.b64_json) {
          const fileUrl = await saveBase64ToFile(item.b64_json);
          console.log(`[Engine] Converted b64_json to URL: ${fileUrl}`);
          return { url: fileUrl };
        }
        return item;
      }));
      return { data: processedData };
    }

    return response.data;
  } catch (err: any) {
    fastify.log.error(err);
    return reply.status(500).send({ error: err.message });
  }
});

// ============ 自定义工作流智能字段解析 ============
fastify.post('/api/v1/engine/custom-workflow/parse', async (request, reply) => {
  try {
    const { source, workflowIdOrJson } = request.body as { source: 'local_comfyui' | 'runninghub'; workflowIdOrJson: string };
    if (!workflowIdOrJson) {
      return reply.status(400).send({ error: 'Missing workflowIdOrJson' });
    }

    // 判断是否为合法 JSON
    let isJson = false;
    try {
      JSON.parse(workflowIdOrJson);
      isJson = true;
    } catch (e) {}

    if (isJson) {
      const params = CustomWorkflowParser.parseComfyUIJson(workflowIdOrJson);
      return { success: true, parameters: params };
    } else if (source === 'runninghub' || !source) {
      const params = CustomWorkflowParser.parseRunningHubWorkflow(workflowIdOrJson);
      return { success: true, parameters: params };
    } else {
      // 降级使用 ComfyUI 解析
      const params = CustomWorkflowParser.parseComfyUIJson(workflowIdOrJson);
      return { success: true, parameters: params };
    }
  } catch (err: any) {
    return reply.status(500).send({ error: err.message });
  }
});

// ============ 自定义工作流通用节点化执行 ============
fastify.post('/api/v1/engine/custom-workflow/execute', async (request, reply) => {
  try {
    const payload = request.body as any; // 满足 CustomWorkflowPayload 类型
    if (!payload.source || !payload.workflowIdOrJson) {
      return reply.status(400).send({ error: 'Missing source or workflowIdOrJson in payload' });
    }

    let outputUrl = '';
    if (payload.source === 'local_comfyui') {
      outputUrl = await comfyUIAdapter.executeCustomWorkflow(payload);
    } else {
      outputUrl = await runningHubAdapter.executeCustomWorkflow(payload);
    }

    return { success: true, outputUrl };
  } catch (err: any) {
    fastify.log.error(err);
    return reply.status(500).send({ error: err.message });
  }
});

// ============ ComfyUI 工作流管理 API ============

// 列出所有可用工作流
fastify.get('/api/v1/engine/comfyui/workflows', async () => {
  return {
    success: true,
    workflows: comfyUIWorkflowService.listWorkflows()
  };
});

// 获取单个工作流配置
fastify.get('/api/v1/engine/comfyui/workflows/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const workflow = comfyUIWorkflowService.getWorkflow(id);
  if (!workflow) {
    return reply.status(404).send({ error: 'Workflow not found' });
  }
  return { success: true, workflow };
});

// 获取工作流原始 JSON
fastify.get('/api/v1/engine/comfyui/workflows/:id/json', async (request, reply) => {
  const { id } = request.params as { id: string };
  const workflow = comfyUIWorkflowService.getWorkflow(id);
  if (!workflow) {
    return reply.status(404).send({ error: 'Workflow not found' });
  }
  const json = comfyUIWorkflowService.getWorkflowJson(workflow.filename);
  if (!json) {
    return reply.status(404).send({ error: 'Workflow JSON file not found' });
  }
  return { success: true, json };
});

// 解析任意 ComfyUI 工作流 JSON 的字段
fastify.post('/api/v1/engine/comfyui/workflows/parse', async (request, reply) => {
  try {
    const { json } = request.body as { json: any };
    if (!json) {
      return reply.status(400).send({ error: 'Missing workflow JSON' });
    }
    const fields = comfyUIWorkflowService.parseWorkflowFields(json);
    return { success: true, fields };
  } catch (err: any) {
    return reply.status(500).send({ error: err.message });
  }
});

// 保存自定义工作流配置
fastify.post('/api/v1/engine/comfyui/workflows', async (request, reply) => {
  try {
    const config = request.body as any;
    if (!config.id || !config.title) {
      return reply.status(400).send({ error: 'Missing id or title' });
    }
    comfyUIWorkflowService.saveCustomWorkflow(config);
    return { success: true, workflow: config };
  } catch (err: any) {
    return reply.status(500).send({ error: err.message });
  }
});

// 删除自定义工作流
fastify.delete('/api/v1/engine/comfyui/workflows/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const deleted = comfyUIWorkflowService.deleteCustomWorkflow(id);
  if (!deleted) {
    return reply.status(404).send({ error: 'Workflow not found or cannot be deleted' });
  }
  return { success: true, message: 'Workflow deleted' };
});

// ============ 画布 CRUD 路由 ============

// 获取画布列表
fastify.get('/api/v1/canvases', async () => {
  return { success: true, canvases: canvasService.list() };
});

// 获取回收站画布列表
fastify.get('/api/v1/canvases/deleted', async () => {
  return { success: true, canvases: canvasService.listDeleted() };
});

// 获取单个画布
fastify.get('/api/v1/canvases/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const canvas = canvasService.get(id);
  if (!canvas) {
    return reply.status(404).send({ error: 'Canvas not found' });
  }
  return { success: true, canvas };
});

// 创建画布
fastify.post('/api/v1/canvases', async (request, reply) => {
  try {
    const { name } = request.body as { name?: string };
    const canvas = canvasService.create(name || '未命名画布');
    return { success: true, canvas };
  } catch (err: any) {
    return reply.status(500).send({ error: err.message });
  }
});

// 更新画布
fastify.put('/api/v1/canvases/:id', async (request, reply) => {
  try {
    const { id } = request.params as { id: string };
    const data = request.body as { name?: string; nodes?: any[]; edges?: any[] };
    const canvas = canvasService.update(id, data);
    if (!canvas) {
      return reply.status(404).send({ error: 'Canvas not found' });
    }
    return { success: true, canvas };
  } catch (err: any) {
    return reply.status(500).send({ error: err.message });
  }
});

// 软删除画布（移入回收站）
fastify.delete('/api/v1/canvases/:id', async (request, reply) => {
  const { id } = request.params as { id: string };
  const deleted = canvasService.delete(id);
  if (!deleted) {
    return reply.status(404).send({ error: 'Canvas not found' });
  }
  return { success: true, message: 'Canvas moved to trash' };
});

// 恢复画布
fastify.post('/api/v1/canvases/:id/restore', async (request, reply) => {
  const { id } = request.params as { id: string };
  const restored = canvasService.restore(id);
  if (!restored) {
    return reply.status(404).send({ error: 'Canvas not found in trash' });
  }
  return { success: true, message: 'Canvas restored' };
});

// 永久删除画布
fastify.delete('/api/v1/canvases/:id/permanent', async (request, reply) => {
  const { id } = request.params as { id: string };
  canvasService.permanentDelete(id);
  return { success: true, message: 'Canvas permanently deleted' };
});

// ============ 画布快照路由 ============

// 获取画布快照列表
fastify.get('/api/v1/canvases/:id/snapshots', async (request, reply) => {
  const { id } = request.params as { id: string };
  const snapshots = canvasService.listSnapshots(id);
  return { success: true, snapshots };
});

// 获取单个快照详情
fastify.get('/api/v1/canvases/:canvasId/snapshots/:snapshotId', async (request, reply) => {
  const { canvasId, snapshotId } = request.params as { canvasId: string; snapshotId: string };
  const snapshot = canvasService.getSnapshot(canvasId, snapshotId);
  if (!snapshot) {
    return reply.status(404).send({ error: 'Snapshot not found' });
  }
  return { success: true, snapshot };
});

// 回滚到指定快照
fastify.post('/api/v1/canvases/:id/rollback/:snapshotId', async (request, reply) => {
  const { id, snapshotId } = request.params as { id: string; snapshotId: string };
  const canvas = canvasService.rollback(id, snapshotId);
  if (!canvas) {
    return reply.status(404).send({ error: 'Canvas or snapshot not found' });
  }
  return { success: true, canvas, message: 'Rolled back to snapshot' };
});

// 启动服务 (监听在解耦端口 4000)
const start = async () => {
  try {
    await fastify.listen({ port: 4000, host: '0.0.0.0' });
    console.log('🚀 Engine Core Service successfully listening on port 4000');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
