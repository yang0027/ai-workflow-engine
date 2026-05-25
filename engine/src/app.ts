import Fastify from 'fastify';
import { RunningHubClient } from './lib/RunningHubClient.js';
import { TTSService } from './services/tts/TTSService.js';
import { VideoService } from './services/video/VideoService.js';
import { SettingsService } from './services/settings/SettingsService.js';
import { SkillsService } from './services/settings/SkillsService.js';
import { CustomWorkflowParser } from './services/adapters/CustomWorkflowParser.js';
import { ComfyUIAdapter } from './services/adapters/impl/ComfyUIAdapter.js';
import { RunningHubAdapter } from './services/adapters/impl/RunningHubAdapter.js';
import { WorkflowTemplateService } from './services/workflow-templates/WorkflowTemplateService.js';
import fs from 'fs';
import path from 'path';
import axios from 'axios';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const fastify = Fastify({ logger: true });

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
    const mime = ext === '.mp4' ? 'video/mp4' : ext === '.mp3' ? 'audio/mpeg' : 'image/png';
    return reply.type(mime).send(stream);
  }
  return reply.status(404).send({ error: 'File not found' });
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
    if (providerId === 'minimax' && !cleanUrl.endsWith('/v1')) {
      cleanUrl = `${cleanUrl}/v1`;
    }
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
    const { providerId, model, prompt, size = '1024x1024', response_format = 'b64_json' } = request.body as {
      providerId: string;
      model: string;
      prompt: string;
      size?: string;
      response_format?: string;
    };

    if (!providerId || !model || !prompt) {
      return reply.status(400).send({ error: 'Missing providerId, model or prompt' });
    }

    const config = settingsService.getRawProviderConfig(providerId);
    if (!config || !config.enabled) {
      return reply.status(400).send({ error: `Provider ${providerId} is not enabled` });
    }

    let cleanUrl = config.baseUrl.endsWith('/') ? config.baseUrl.slice(0, -1) : config.baseUrl;
    if (providerId === 'minimax' && !cleanUrl.endsWith('/v1')) {
      cleanUrl = `${cleanUrl}/v1`;
    }

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
