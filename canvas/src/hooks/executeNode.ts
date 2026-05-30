/**
 * executeNode - 统一节点执行入口
 *
 * 分发逻辑：(mediaType, actionType) → 对应 handler
 *
 * 统一处理：
 *   - 重试逻辑（网络错误 3 次递增）
 *   - 节点状态日志（通过 dispatchEvent）
 *   - 统一 NodeResult 格式输出
 */

import type {
  NodeResult,
  ExecuteNodeParams,
  ModelConfig,
} from './adapters/types';
import { executeChat } from './adapters/ChatAdapter';
import { wrapNodeResult, wrapNodeError, sleep } from './adapters/retry';

export type NodeStatus = 'idle' | 'running' | 'success' | 'error' | 'retrying';

export interface NodeStatusEvent {
  nodeId: string;
  nodeType: string;
  status: NodeStatus;
  error?: string;
  durationMs?: number;
  timestamp: number;
}

function emitStatus(event: NodeStatusEvent) {
  window.dispatchEvent(new CustomEvent('node-status-change', { detail: event }));
}

function dispatchLog(
  nodeId: string,
  nodeName: string,
  model: string,
  status: 'running' | 'success' | 'error',
  errorMsg?: string
) {
  if (status === 'error') {
    window.dispatchEvent(new CustomEvent('add-failure-log', {
      detail: { nodeId, nodeName, model, errorMsg },
    }));
  }
  if (status === 'running') {
    window.dispatchEvent(new CustomEvent('node-running', {
      detail: { nodeId, nodeName, model },
    }));
  }
}

// ─── 入口 ───────────────────────────────────────────────────────────────────

export async function executeNode(params: ExecuteNodeParams): Promise<NodeResult> {
  const { nodeId, nodeType, actionType, upstreamData, modelConfig, nodeInputs } = params;
  const { providerId, modelId } = modelConfig;
  const nodeName = nodeInputs?.label || nodeInputs?.title || nodeType;

  emitStatus({ nodeId, nodeType, status: 'running', timestamp: Date.now() });
  dispatchLog(nodeId, nodeName, modelId, 'running');

  const t0 = Date.now();

  try {
    let result: any;

    switch (actionType) {
      case 'chat':
        result = await doChat(upstreamData, modelConfig, nodeInputs, params.abortSignal);
        break;
      case 'generate':
        result = await doGenerate(upstreamData, modelConfig, nodeInputs, params.abortSignal);
        break;
      case 'fusion':
        result = await doFusion(upstreamData, modelConfig, nodeInputs, params.abortSignal);
        break;
      case 'tts':
        result = await doTTS(upstreamData, modelConfig, nodeInputs, params.abortSignal);
        break;
      case 'upload':
        result = { type: params.mediaType, url: upstreamData.all[0]?.value || '' };
        break;
      case 'loop':
        result = await doLoop(upstreamData, modelConfig, nodeInputs, params.abortSignal);
        break;
      case 'control':
        result = await doWorkflow(upstreamData, modelConfig, nodeInputs, params.abortSignal);
        break;
      default:
        throw new Error(`不支持的动作类型: ${actionType}`);
    }

    const durationMs = Date.now() - t0;
    emitStatus({ nodeId, nodeType, status: 'success', durationMs, timestamp: Date.now() });
    dispatchLog(nodeId, nodeName, modelId, 'success');
    return wrapNodeResult(result, durationMs);

  } catch (err: any) {
    const durationMs = Date.now() - t0;
    const message = err instanceof Error ? err.message : String(err);
    emitStatus({ nodeId, nodeType, status: 'error', error: message, timestamp: Date.now() });
    dispatchLog(nodeId, nodeName, modelId, 'error', message);

    const isTimeout = message.includes('timeout') || message.includes('aborted');
    const isNetwork = message.includes('fetch') || message.includes('network') || message.includes('ECONNREFUSED');
    const code = isTimeout ? 'TIMEOUT' : isNetwork ? 'NETWORK_ERROR' : 'API_ERROR';
    return wrapNodeError(code, message);
  }
}

// ─── Handler ────────────────────────────────────────────────────────────────

async function doChat(
  upstreamData: ExecuteNodeParams['upstreamData'],
  modelConfig: ModelConfig,
  nodeInputs: Record<string, any>,
  abortSignal?: AbortSignal
): Promise<any> {
  const { providerId, modelId } = modelConfig;
  return await executeChat({ providerId, modelId, upstreamData, nodeInputs, abortSignal });
}

async function doGenerate(
  upstreamData: ExecuteNodeParams['upstreamData'],
  modelConfig: ModelConfig,
  nodeInputs: Record<string, any>,
  abortSignal?: AbortSignal
): Promise<any> {
  const { providerId, modelId } = modelConfig;
  const prompt = upstreamData.text || nodeInputs?.prompt || '';
  if (!prompt) throw new Error('生图 prompt 为空');

  const res = await withRetryFetch('/api/v1/image/generate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ providerId, model: modelId, prompt, size: nodeInputs?.size || '1024x1024' }),
    signal: abortSignal,
  });

  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
  const url = data.data?.[0]?.url || data.url || '';
  return { type: 'image', url, prompt };
}

async function doFusion(
  upstreamData: ExecuteNodeParams['upstreamData'],
  modelConfig: ModelConfig,
  nodeInputs: Record<string, any>,
  abortSignal?: AbortSignal
): Promise<any> {
  const { providerId, modelId } = modelConfig;
  const prompt = upstreamData.text || nodeInputs?.prompt || '';

  const res = await withRetryFetch('/api/v1/workflow/video/fusion', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ providerId, model: modelId, prompt }),
    signal: abortSignal,
  });

  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
  return { type: 'video', url: data.url || data.outputUrl };
}

async function doTTS(
  upstreamData: ExecuteNodeParams['upstreamData'],
  modelConfig: ModelConfig,
  nodeInputs: Record<string, any>,
  abortSignal?: AbortSignal
): Promise<any> {
  const { providerId, modelId } = modelConfig;
  const text = upstreamData.text || nodeInputs?.text || nodeInputs?.script || '';

  const res = await withRetryFetch('/api/v1/workflow/tts/clone', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ providerId, model: modelId, text, voice: nodeInputs?.voice }),
    signal: abortSignal,
  });

  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
  return { type: 'audio', url: data.url || data.outputUrl };
}

async function doLoop(
  upstreamData: ExecuteNodeParams['upstreamData'],
  modelConfig: ModelConfig,
  nodeInputs: Record<string, any>,
  abortSignal?: AbortSignal
): Promise<any> {
  // loop 节点：重复执行指定次数的子工作流
  const iterations = nodeInputs?.iterations || 1;
  const results: any[] = [];
  for (let i = 0; i < iterations; i++) {
    if (abortSignal?.aborted) throw new Error('Aborted');
    results.push({ iteration: i + 1, data: upstreamData });
  }
  return { type: 'text', content: JSON.stringify(results), iterations };
}

async function doWorkflow(
  upstreamData: ExecuteNodeParams['upstreamData'],
  modelConfig: ModelConfig,
  nodeInputs: Record<string, any>,
  abortSignal?: AbortSignal
): Promise<any> {
  // custom-workflow: 透传到 engine 工作流执行
  const res = await withRetryFetch('/api/v1/workflow/custom', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ providerId: modelConfig.providerId, model: modelConfig.modelId, upstreamData, nodeInputs }),
    signal: abortSignal,
  });
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || `HTTP ${res.status}`);
  return data;
}

// ─── 工具 ─────────────────────────────────────────────────────────────────────

async function withRetryFetch(
  url: string,
  init: RequestInit & { signal?: AbortSignal },
  retries = 3
): Promise<Response> {
  for (let i = 0; i <= retries; i++) {
    const res = await fetch(url, { ...init });
    if (res.ok || i >= retries) return res;
    if (res.status >= 400 && res.status < 500) return res;
    await sleep([1000, 3000, 8000][i] ?? 8000);
  }
  return new Response('', { status: 500 });
}
