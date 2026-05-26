import { PresetWorkflow } from './preset-workflow.interface';

export const rhIpPersona: PresetWorkflow = {
  id: 'rh_wf_ip_persona',
  name: '🎨 IP Persona Creation 品牌IP形象创建',
  appId: '2053799323917402116',
  source: 'runninghub',
  capability: 'image',
  description: '支持快速派生机甲、萌趣、虚拟偶像等一致性三视图。',
  cover: 'https://images.unsplash.com/photo-1561070791-2526d30994b5?w=400&q=80',
  tag: '🎨 创意',
  color: '#ec4899',
  nodeInfoList: [
    { nodeId: '3', fieldName: 'text', fieldValue: '', description: '提示词' }
  ]
};
