import { PresetWorkflow } from './preset-workflow.interface';

export const rhVr360Pano: PresetWorkflow = {
  id: 'vr-360-pano',
  name: '🌐 VR360° Panoramic 全景 4K 引擎',
  appId: '2053799323917402118',
  source: 'runninghub',
  capability: 'video',
  description: '智能将 2D 参考图拉伸并重塑为 360° 无缝物理全景球幕视频，极佳的沉浸式场景。',
  cover: 'https://images.unsplash.com/photo-1617802690992-15d93263d3a9?w=400&q=80',
  tag: '🌐 沉浸',
  color: '#06b6d4',
  nodeInfoList: [
    { nodeId: '10', fieldName: 'image', fieldValue: '', description: '参考图' }
  ]
};
