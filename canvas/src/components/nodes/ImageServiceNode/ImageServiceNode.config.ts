// ImageServiceNode.config.ts
// 图像渲染节点配置与类型定义

export interface ImageServiceNodeProps {
  id: string;
  data: {
    label?: string;
    progress?: number;
    inputs?: {
      prompt?: string;
      providerId?: string;
      model?: string;
      size?: string;
      cfg?: number;
      steps?: number;
      aspectRatio?: string;
      quality?: string;
      resolution?: string;
      refImages?: string[];
      faceRef?: string;
      customTemplate?: any;
      runningHubTemplateId?: string;
      runningHubWorkflowName?: string;
      [key: string]: any;
    };
    outputs?: {
      image?: string;
      output?: string;
      errorMsg?: string;
      [key: string]: any;
    };
  };
  selected?: boolean;
}

export const SPEC_ASPECT_RATIOS = [
  { value: '1:1', label: '1:1' },
  { value: '2:3', label: '2:3' },
  { value: '3:2', label: '3:2' },
  { value: '4:5', label: '4:5' },
  { value: '5:4', label: '5:4' },
  { value: '16:9', label: '16:9' },
  { value: '9:16', label: '9:16' },
  { value: '21:9', label: '21:9' },
  { value: '3:4', label: '3:4' },
  { value: '4:3', label: '4:3' },
  { value: '公众号封面', label: '微信公众号封面' },
  { value: '小红书封面', label: '小红书封面' },
  { value: '公众号配图', label: '微信公众号配图' },
  { value: '抖音封面', label: '抖音短视频封面' },
  { value: '快手封面', label: '快手短视频封面' },
  { value: 'bilibili封面', label: 'B站视频封面' },
  { value: 'YouTube封面', label: 'YouTube封面' }
];
