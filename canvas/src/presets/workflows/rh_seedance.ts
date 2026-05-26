import { PresetWorkflow } from './preset-workflow.interface';

export const rhSeedance: PresetWorkflow = {
  id: 'seedance-滿血',
  name: '🔥 Seedance 2.0 物理骨骼舞蹈视频重绘',
  appId: '2053799323917402119',
  source: 'runninghub',
  capability: 'video',
  description: '将预置音画与人物动态完美同步，重构光影并产出流畅、无抖动且一致性完美的视频。',
  cover: 'https://images.unsplash.com/photo-1578632767115-351597cf2477?w=400&q=80',
  tag: '🔥 狂热',
  color: '#f97316',
  nodeInfoList: [
    { nodeId: '8', fieldName: 'video', fieldValue: '', description: '舞蹈视频' }
  ]
};
