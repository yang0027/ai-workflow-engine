/**
 * ChatAdapter - 统一 LLM 对话调用层
 *
 * 职责边界：
 * - 接收原始 upstreamData 和 nodeInputs，自己构造 messages
 * - 有图输入时检测模型是否支持 vision，不支持则报错
 * - 统一错误处理 + 3 次重试（递增间隔）
 * - 通过 canvas proxy (/api/v1/llm/chat) 走 engine
 *
 * executeNode 只做 (actionType → adapter) 的路由分发，
 * vision 兼容性判断由本文件负责
 */

import { withRetry } from './retry';

const API_BASE = '/api/v1/llm/chat';

/** 检测模型名是否暗示支持 vision */
function isVisionModel(model: string): boolean {
  const m = model.toLowerCase();
  return (
    m.includes('vl') ||
    m.includes('vision') ||
    m.includes('image') ||
    m.includes('gpt-4o') ||
    m.includes('gpt-4-turbo') ||
    m.includes('gpt-5') ||
    m.includes('claude') ||
    m.includes('gemini')
  );
}

/** 收集所有图片 URL */
function collectImages(texts: string[], images: string[]): string[] {
  const allImages: string[] = [...images];
  // text 中可能含 data:image/... 或 http URL
  for (const t of texts) {
    const matches = t.matchAll(/(?:data:image\/[^;]+;base64,|https?:\/\/)[^\s'"]+/g);
    for (const m of matches) allImages.push(m[0]);
  }
  return allImages;
}

// ─── 对外接口 ────────────────────────────────────────────────────────────────

export interface ChatExecuteInput {
  providerId: string;
  modelId: string;
  upstreamData: {
    text: string;
    texts: string[];
    image: string;
    images: string[];
    video: string;
    videos: string[];
    audio: string;
    audios: string[];
  };
  nodeInputs: Record<string, any>;
  abortSignal?: AbortSignal;
}

export async function executeChat(input: ChatExecuteInput): Promise<{
  type: 'text';
  content: string;
  model: string;
}> {
  const { providerId, modelId, upstreamData, nodeInputs, abortSignal } = input;
  const { texts, images } = upstreamData;

  const imageUrls = collectImages(texts, images);
  const hasImages = imageUrls.length > 0;
  const textContent = texts.join('\n') || nodeInputs?.text || nodeInputs?.prompt || '';

  // ── 前置检查：有图输入但模型不支持 vision → 报错 ────────────────────────
  if (hasImages && !isVisionModel(modelId)) {
    throw Object.assign(
      new Error(`当前模型 "${modelId}" 不支持 vision。请在节点配置中选择一个支持图像理解的模型（如 qwen-vl、gpt-4o、claude 等）`),
      { code: 'INVALID_INPUT' }
    );
  }

  // ── 构造 messages ─────────────────────────────────────────────────────────
  const systemPrompt = nodeInputs?.systemPrompt || nodeInputs?.instructions || '';
  const finalMessages: any[] = [];

  if (hasImages) {
    const imageParts = imageUrls.map((url: string) => ({
      type: 'image_url' as const,
      image_url: { url },
    }));
    finalMessages.push({
      role: 'user',
      content: [
        ...imageParts,
        { type: 'text' as const, text: textContent || '请描述这张图片' },
      ],
    });
  } else {
    finalMessages.push({ role: 'user', content: textContent });
  }

  // ── 请求 + 重试 ──────────────────────────────────────────────────────────
  const body = JSON.stringify({
    providerId,
    model: modelId,
    messages: finalMessages,
    systemPrompt,
    temperature: nodeInputs?.temperature ?? 0.7,
  });

  const data = await withRetry(
    async () => {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 60000);
      const merged = makeMergedSignal([abortSignal, controller.signal]);

      try {
        const res = await fetch(API_BASE, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body,
          signal: merged,
        });
        if (!res.ok) {
          const text = await res.text();
          let msg = `HTTP ${res.status}`;
          let detailStr = '';
          try {
            const parsed = JSON.parse(text);
            msg = parsed.error || msg;
            if (parsed.detail) {
              detailStr = typeof parsed.detail === 'object' ? JSON.stringify(parsed.detail) : String(parsed.detail);
            }
          } catch {}
          const fullErr = detailStr ? `${msg} (详情: ${detailStr})` : msg;
          throw Object.assign(new Error(fullErr), { status: res.status });
        }
        const json = await res.json();
        if (json.error) {
          const detailStr = json.detail ? (typeof json.detail === 'object' ? JSON.stringify(json.detail) : String(json.detail)) : '';
          const errMsg = detailStr ? `${json.error} (详情: ${detailStr})` : json.error;
          throw Object.assign(new Error(errMsg), { status: res.status });
        }
        if (json.choices?.[0]?.message?.content === undefined) {
          throw new Error(`API 返回格式异常: ${JSON.stringify(json).substring(0, 100)}`);
        }
        return json;
      } finally {
        clearTimeout(timer);
      }
    },
    {
      retries: 3,
      delays: [1000, 3000, 8000],
      abortSignal,
      onRetry: (attempt, err) =>
        console.warn(`[ChatAdapter] 请求失败（第 ${attempt} 次重试）: status=${(err as any).status} ${err.message}`),
    }
  );

  return {
    type: 'text',
    content: data.choices[0].message.content,
    model: modelId,
  };
}

// ─── 内部工具 ────────────────────────────────────────────────────────────────

function makeMergedSignal(signals: (AbortSignal | undefined)[]): AbortSignal | undefined {
  const valid = signals.filter((s): s is AbortSignal => !!s);
  if (valid.length === 0) return undefined;
  if (valid.length === 1) return valid[0];
  let _reason: any = new Error('Aborted');
  let _onabort: ((ev: Event) => void) | null = null;
  valid.forEach((s) => {
    if (s.aborted) _reason = s.reason;
    s.addEventListener('abort', () => { _reason = s.reason; _onabort?.(new Event('abort')); });
  });
  return {
    get aborted() { return valid.some((s) => s.aborted); },
    get reason() { return _reason; },
    get onabort() { return _onabort; },
    set onabort(v) { _onabort = v; },
    addEventListener(type: string, listener: EventListener) { valid.forEach((s) => s.addEventListener(type, listener)); },
    removeEventListener(type: string, listener: EventListener) { valid.forEach((s) => s.removeEventListener(type, listener)); },
    dispatchEvent(event: Event): boolean { return valid[0].dispatchEvent(event); },
    throwIfAborted() { if (this.aborted) throw _reason; },
  };
}
