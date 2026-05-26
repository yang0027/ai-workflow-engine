import { PresetWorkflow } from './preset-workflow.interface';

export const rhFaceConsistency: PresetWorkflow = {
  id: 'rh_wf_face_consistency',
  name: '🎭 Face Consistency 面部一致性',
  appId: '2053799323917402114',
  source: 'runninghub',
  capability: 'image',
  description: '锁定角色五官比例与面部特征，使其在多个分镜中实现高一致性。',
  cover: 'https://images.unsplash.com/photo-1531746020798-e6953c6e8e04?w=400&q=80',
  tag: '🔥 推荐',
  color: '#a855f7',
  nodeInfoList: [
    { nodeId: '5148', fieldName: 'text', fieldValue: '', description: '提示词' },
    { nodeId: '10', fieldName: 'image', fieldValue: '', description: '参考图' }
  ]
};
