export interface RunningHubWorkflow {
  id: string;
  name: string;
  appId: string;
  description: string;
  nodeInfoList: any[];
  capability?: 'image' | 'video' | 'audio' | 'workflow';
}

export const DEFAULT_RUNNINGHUB_WORKFLOWS: RunningHubWorkflow[] = [
  {
    id: 'rh_wf_face_consistency',
    name: '🎭 RunningHub 面部一致性洗图',
    appId: '2053799323917402114',
    description: '智能提取 Flux 面部原画特征，并在云端进行高精面部重采样。',
    nodeInfoList: [
      {
        nodeId: '5148',
        fieldName: 'text',
        fieldValue: '',
        description: '提示词'
      },
      {
        nodeId: '10',
        fieldName: 'image',
        fieldValue: '',
        description: '参考图'
      }
    ]
  },
  {
    id: 'rh_wf_style_transfer',
    name: '🎨 RunningHub 艺术流派跨界重绘',
    appId: '2053799323917402115',
    description: '一键将常规图片洗成赛博朋克、日系动漫或中国古典水墨风。',
    nodeInfoList: [
      {
        nodeId: '6',
        fieldName: 'image',
        fieldValue: '',
        description: '原图'
      },
      {
        nodeId: '12',
        fieldName: 'style',
        fieldValue: 'cyberpunk',
        description: '风格'
      }
    ]
  }
];
