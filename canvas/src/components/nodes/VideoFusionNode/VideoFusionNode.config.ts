// VideoFusionNode.config.ts
// 视频合成节点配置常量与类型定义

export interface VideoFusionNodeProps {
  id: string;
  data: {
    label?: string;
    title?: string;
    progress?: number;
    inputs?: {
      prompt?: string;
      refImage?: string;
      refVideo?: string;
      refAudio?: string;
      image?: string;
      audio?: string;
      providerId?: string;
      model?: string;
      width?: number;
      height?: number;
      duration?: number;
      activeTab?: 'standard' | 'aix';
      runningHubTemplateId?: string;
      [key: string]: any;
    };
    outputs?: {
      video?: string;
      errorMsg?: string;
      output?: string;
    };
  };
  selected?: boolean;
}
