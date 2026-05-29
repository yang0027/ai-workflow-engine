/**
 * NewAPI / ZhangVIP 生图适配器
 *
 * 架构：
 *   Engine (submit) → NewAPI（计费）→ 原始厂商
 *   Engine (poll)   → APIMart（免费）→ 原始厂商
 *
 * 关键差异：
 *   提交 Key：不带 sk- 前缀（如 Wgxda0oQv9JC8jr9k5F9mxul...）
 *   轮询 Key：APIMart 的 key（需确认格式，通常带 sk-）
 *   轮询端点：GET https://api.apimart.ai/v1/tasks/{task_id}
 */

import axios from 'axios';
import { ImageGenerateResult } from '../imageRegistry.js';

// 配置从 settings.json 读取，本文件硬编码用于快速验证
// 实际使用时应从 provider config 动态读取
const NEW_API_URL = 'https://api.zhangvip.top';
const NEW_API_KEY = 'Wgxda0oQv9JC8jr9k5F9mxulEULAnlBOyjOUnahJpvnX4HTF';
const APIMART_URL = 'https://api.apimart.ai';
const APIMART_KEY = process.env.APIMART_IMAGE_KEY ?? 'sk-XKmOcWpKi9bDk4fzb5WFkajbUHZeXrxBxLj9F9WtcjNtjoJJ';

export interface NewAPIImageOptions {
  model: string;
  prompt: string;
  size?: string;
  n?: number;
  apimartKey?: string;   // 运行时传入，覆盖默认
}

export async function generateImage(
  opts: NewAPIImageOptions
): Promise<ImageGenerateResult> {
  const { model, prompt, size = '1024x1024', n = 1, apimartKey = APIMART_KEY } = opts;

  // Step 1: 提交到 NewAPI（计费）
  const taskId = await submitTask(model, prompt, size, n);

  // Step 2: 轮询 APIMart（免费）
  const imageUrl = await pollTask(taskId, apimartKey);

  return { data: [{ url: imageUrl }] };
}

async function submitTask(
  model: string,
  prompt: string,
  size: string,
  n: number
): Promise<string> {
  const url = `${NEW_API_URL}/v1/images/generations`;
  const body = { model, prompt, size, n };

  const response = await axios.post(url, body, {
    headers: {
      Authorization: `Bearer ${NEW_API_KEY}`,
      'Content-Type': 'application/json',
    },
    timeout: 30000,
  });

  const data = response.data;

  // 兼容 data[0].task_id 或 data.task_id
  const taskId =
    data?.data?.[0]?.task_id ??
    data?.task_id ??
    (typeof data?.data === 'object' && !Array.isArray(data.data)
      ? (data.data as Record<string, unknown>).task_id
      : null);

  if (!taskId) {
    throw new Error(
      `NewAPI 提交成功但未找到 task_id: ${JSON.stringify(data)}`
    );
  }

  console.log(`[NewAPIAdapter] 任务已提交: ${taskId}`);
  return taskId as string;
}

async function pollTask(taskId: string, apimartKey: string): Promise<string> {
  if (!apimartKey) {
    throw new Error(
      'APIMART_KEY 未设置，请在 settings.json 中配置 apimartKey 或设置环境变量 APIMART_IMAGE_KEY'
    );
  }

  const url = `${APIMART_URL}/v1/tasks/${taskId}`;
  const maxAttempts = 120;
  const intervalMs = 5000;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    await new Promise((resolve) => setTimeout(resolve, intervalMs));

    let statusCode: number;
    let responseBody: string;
    try {
      const response = await axios.get(url, {
        headers: { Authorization: `Bearer ${apimartKey}` },
        timeout: 10000,
      });
      statusCode = response.status;
      responseBody = JSON.stringify(response.data);
    } catch (err: unknown) {
      const axiosErr = err as { response?: { status: number; data: unknown }; message: string };
      if (axiosErr.response) {
        statusCode = axiosErr.response.status;
        responseBody = JSON.stringify(axiosErr.response.data);
      } else {
        throw new Error(`APIMart 轮询网络错误: ${axiosErr.message}`);
      }
    }

    // APIMart 响应格式: {"code": 200, "data": {"status": "...", "result": {...}}}
    const parsed = JSON.parse(responseBody);
    const inner: Record<string, unknown> = parsed?.data ?? parsed;
    const status: string = (inner?.status as string) ?? 'unknown';

    console.log(
      `[NewAPIAdapter] 轮询 ${taskId} attempt ${attempt + 1}: status=${status}`
    );

    if (status === 'completed') {
      const result: Record<string, unknown> = (inner?.result as Record<string, unknown>) ?? {};
      const imageUrl = extractUrl(result);
      if (!imageUrl) {
        throw new Error(
          `NewAPI 任务 ${taskId} completed 但无 URL: ${responseBody}`
        );
      }
      return imageUrl;
    }

    if (status === 'failed' || status === 'error') {
      const reason = (inner?.reason ?? inner?.message ?? parsed?.message) as string;
      throw new Error(`NewAPI 任务 ${taskId} failed: ${reason}`);
    }
  }

  throw new Error(
    `NewAPI 任务 ${taskId} 轮询超时（${maxAttempts} 次，约 ${Math.round(
      (maxAttempts * intervalMs) / 1000
    )}s）`
  );
}

/** 从 result 对象中提取 URL，支持图片/视频/音频 */
function extractUrl(result: Record<string, unknown>): string | null {
  for (const key of ['images', 'videos', 'files', 'data']) {
    const items = result[key];
    if (Array.isArray(items) && items.length > 0) {
      const first = items[0] as Record<string, unknown>;
      const urlVal = first?.url;
      if (Array.isArray(urlVal)) return urlVal[0] as string;
      if (typeof urlVal === 'string') return urlVal;
      for (const k of ['video_url', 'audio_url', 'url', 'link']) {
        if (k in first) return first[k] as string;
      }
    }
  }
  for (const k of ['url', 'video_url', 'audio_url', 'link']) {
    if (k in result) return result[k] as string;
  }
  return null;
}
