// LoopNode.config.ts
// 循环节点配置常量与类型定义

export interface LoopNodeProps {
  id: string;
  data: {
    label?: string;
    progress?: number;
    inputs?: {
      loopSource?: 'manual' | 'upstream';
      manualCount?: number;
      runMode?: 'sequential' | 'concurrent';
      maxConcurrent?: number;
      [key: string]: any;
    };
    outputs?: {
      currentIndex?: number;
      total?: number;
      currentVariables?: any;
      errorMsg?: string;
    };
  };
  selected?: boolean;
}

export const MIN_MANUAL_COUNT = 1;
export const MAX_MANUAL_COUNT = 10;

export const MIN_CONCURRENT_LIMIT = 1;
export const MAX_CONCURRENT_LIMIT = 5;
