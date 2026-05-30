/**
 * 带重试的 fetch 封装
 * - 网络错误（超时/断连）：自动重试3次，间隔递增
 * - 业务错误（4xx）：不重试，直接抛错
 */

export interface RetryOptions {
  retries: number;
  delays: number[];
  abortSignal?: AbortSignal;
  onRetry?: (attempt: number, err: Error, delay: number) => void;
}

/**
 * 最后一个 Error 会作为最终结果抛出（重试耗尽后）
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const { retries, delays, abortSignal, onRetry } = options;
  let lastError: Error = new Error('never thrown');

  for (let attempt = 0; attempt <= retries; attempt++) {
    if (abortSignal?.aborted) {
      lastError = new Error('Aborted');
      break;
    }

    try {
      return await fn();
    } catch (err: any) {
      lastError = err instanceof Error ? err : new Error(String(err));

      // 4xx 业务错误，不重试
      const status = err.status ?? err.response?.status;
      if (status && status >= 400 && status < 500) {
        throw lastError;
      }

      // 非最后一次
      if (attempt < retries) {
        const delay = delays[attempt] ?? delays[delays.length - 1] ?? 1000;
        onRetry?.(attempt + 1, lastError, delay);
        await sleep(delay);
      }
    }
  }

  throw lastError;
}

export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * 将节点执行包装为统一 NodeResult 格式
 */
export function wrapNodeResult<T>(result: T, durationMs: number) {
  return {
    success: true as const,
    data: result,
    durationMs,
  };
}

export function wrapNodeError(
  code: 'NODE_EXEC_ERROR' | 'API_ERROR' | 'TIMEOUT' | 'INVALID_INPUT' | 'NETWORK_ERROR',
  message: string,
  detail?: any
) {
  return {
    success: false as const,
    error: {
      code,
      message,
      detail,
    },
  };
}
