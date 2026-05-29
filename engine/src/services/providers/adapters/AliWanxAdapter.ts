/**
 * 阿里云百炼（WanX）生图适配器
 *
 * 同步模式（推荐）：POST /multimodal-generation/generation
 *   直接返回图片 URL，无异步轮询
 *
 * 异步模式：POST /image-generation/generation + GET /tasks/{id}
 *   返回 task_id，需轮询
 */

import axios from 'axios';
import { ImageGenerateResult } from '../imageRegistry.js';

export interface AliWanxOptions {
  model: string;
  prompt: string;
  size?: string;   // 1K | 2K | 4K（wan2.7-image-pro）
  n?: number;
  baseUrl?: string;
  apiKey: string;
}

const ALI_BASE_URL = 'https://dashscope.aliyuncs.com';

/**
 * 生图入口，按 model 选择同步/异步
 */
export async function generateImage(opts: AliWanxOptions): Promise<ImageGenerateResult> {
  const { model, prompt, size = '2K', n = 1, baseUrl = ALI_BASE_URL, apiKey } = opts;

  // wan2.7-image-pro / wan2.7-image 使用同步端点
  if (model === 'wan2.7-image-pro' || model === 'wan2.7-image') {
    return generateSync(model, prompt, size, n, baseUrl, apiKey);
  }

  // 其他走异步
  return generateAsync(model, prompt, size, n, baseUrl, apiKey);
}

/**
 * 同步模式（适合 wan2.7-image-pro）
 * 端点: /api/v1/services/aigc/multimodal-generation/generation
 * 直接返回图片 URL
 */
async function generateSync(
  model: string,
  prompt: string,
  size: string,
  n: number,
  baseUrl: string,
  apiKey: string
): Promise<ImageGenerateResult> {
  const url = `${baseUrl}/api/v1/services/aigc/multimodal-generation/generation`;

  const body = {
    model,
    input: {
      messages: [
        {
          role: 'user',
          content: [{ text: prompt }],
        },
      ],
    },
    parameters: {
      size,
      n,
      watermark: false,
    },
  };

  console.log(`[AliWanxAdapter] 同步调用 ${url}, model=${model}`);

  const response = await axios.post(url, body, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
    },
    timeout: 60000,
  });

  // 同步响应: output.choices[0].message.content[0].image_url
  const choices = response.data?.output?.choices ?? [];
  const urls: string[] = [];

  for (const choice of choices) {
    const content: any[] = choice?.message?.content ?? [];
    for (const item of content) {
      if (item?.image_url) {
        urls.push(item.image_url);
      }
    }
  }

  if (urls.length === 0) {
    throw new Error(`AliWanx 同步返回无图片 URL: ${JSON.stringify(response.data).substring(0, 500)}`);
  }

  console.log(`[AliWanxAdapter] 同步返回 ${urls.length} 张图片`);
  return { data: urls.map((url) => ({ url })) };
}

/**
 * 异步模式（适合 qwen-image-2.0-pro 等）
 * 端点: POST /image-generation/generation + GET /tasks/{id}
 */
async function generateAsync(
  model: string,
  prompt: string,
  size: string,
  n: number,
  baseUrl: string,
  apiKey: string
): Promise<ImageGenerateResult> {
  const url = `${baseUrl}/api/v1/services/aigc/image-generation/generation`;

  const body = {
    model,
    input: {
      messages: [
        {
          role: 'user',
          content: [{ text: prompt }],
        },
      ],
    },
    parameters: {
      size,
      n,
    },
  };

  console.log(`[AliWanxAdapter] 异步提交 ${url}, model=${model}`);

  const submitResp = await axios.post(url, body, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'X-DashScope-Async': 'enable',
    },
    timeout: 10000,
  });

  const taskId: string =
    submitResp.data?.output?.task_id ?? submitResp.data?.task_id ?? '';

  if (!taskId) {
    throw new Error(`AliWanx 异步提交无 task_id: ${JSON.stringify(submitResp.data).substring(0, 500)}`);
  }

  console.log(`[AliWanxAdapter] 任务已提交: ${taskId}`);

  // 轮询
  const imageUrl = await pollTask(taskId, baseUrl, apiKey);
  return { data: [{ url: imageUrl }] };
}

async function pollTask(taskId: string, baseUrl: string, apiKey: string): Promise<string> {
  const url = `${baseUrl}/api/v1/tasks/${taskId}`;
  const maxAttempts = 200;
  const intervalMs = 3000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));

    const resp = await axios.get(url, {
      headers: { Authorization: `Bearer ${apiKey}` },
      timeout: 10000,
    });

    const taskStatus: string = resp.data?.output?.task_status ?? '';
    console.log(`[AliWanxAdapter] 轮询 ${taskId} attempt ${attempt + 1}: status=${taskStatus}`);

    if (taskStatus === 'SUCCEEDED') {
      const results: any[] = resp.data?.output?.results ?? [];
      for (const r of results) {
        if (r?.image_url) return r.image_url;
      }
      throw new Error(`AliWanx 任务 ${taskId} SUCCEEDED 但无 image_url`);
    }

    if (taskStatus === 'FAILED') {
      const errMsg: string =
        resp.data?.output?.code ?? resp.data?.output?.message ?? JSON.stringify(resp.data?.output);
      throw new Error(`AliWanx 任务 ${taskId} FAILED: ${errMsg}`);
    }
  }

  throw new Error(`AliWanx 任务 ${taskId} 轮询超时`);
}
