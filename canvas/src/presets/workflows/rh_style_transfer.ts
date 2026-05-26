import { PresetWorkflow } from './preset-workflow.interface';

export const rhStyleTransfer: PresetWorkflow = {
  id: 'rh_wf_style_transfer',
  name: '🎨 Artistic Style Transfer 艺术流派重绘',
  appId: '2053799323917402115',
  source: 'runninghub',
  capability: 'image',
  description: '在水墨、赛博朋克与未来主义之间进行大融合重绘。',
  cover: 'https://images.unsplash.com/photo-1541701494587-cb58502866ab?w=400&q=80',
  tag: '🖌️ 风格',
  color: '#10b981',
  nodeInfoList: [
    { nodeId: '6', fieldName: 'image', fieldValue: '', description: '原图' },
    { nodeId: '12', fieldName: 'style', fieldValue: 'cyberpunk', description: '风格' }
  ]
};
