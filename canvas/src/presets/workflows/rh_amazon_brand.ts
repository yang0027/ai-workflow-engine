import { PresetWorkflow } from './preset-workflow.interface';

export const rhAmazonBrand: PresetWorkflow = {
  id: 'amazon-brand-a',
  name: '🛒 Amazon Brand A+ 品牌电商卡片视频',
  appId: '2053799323917402120',
  source: 'runninghub',
  capability: 'video',
  description: '将产品主图与卖点词一键组合，灌注高档动态场景与专业商用质感合成特效。',
  cover: 'https://images.unsplash.com/photo-1581291518633-83b4ebd1d83e?w=400&q=80',
  tag: '🛒 经典',
  color: '#eab308',
  nodeInfoList: [
    { nodeId: '11', fieldName: 'image', fieldValue: '', description: '产品图' }
  ]
};
