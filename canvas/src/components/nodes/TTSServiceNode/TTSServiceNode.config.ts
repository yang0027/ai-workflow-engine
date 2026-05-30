// TTSServiceNode.config.ts
// 声音克隆/配音节点配置常量与类型定义

export interface TTSServiceNodeProps {
  id: string;
  data: {
    label?: string;
    progress?: number;
    inputs?: {
      mode?: 'direct' | 'workflow';
      providerId?: string;
      model?: string;
      characterName?: string;
      refAudio?: string;
      workflowIdOrJson?: string;
      activeTab?: 'standard' | 'aix';
      runningHubTemplateId?: string;
      customTemplate?: any;
      referenceId?: string;
      text?: string;
      [key: string]: any;
    };
    outputs?: {
      audio?: string;
      output?: string;
      errorMsg?: string;
      [key: string]: any;
    };
  };
  selected?: boolean;
}
