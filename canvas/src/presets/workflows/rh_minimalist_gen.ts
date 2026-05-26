import { PresetWorkflow } from './preset-workflow.interface';

export const rhMinimalistGen: PresetWorkflow = {
  id: '2034899011521482754',
  name: '🎨 Minimalistic Image Gen 极简生图模板',
  appId: '2034899011521482754',
  source: 'runninghub',
  capability: 'image',
  description: '专为极简主义生图研发，少数提示词即可出具强视觉冲击插画，支持画面尺寸的自适应微调。',
  cover: 'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=80',
  tag: '✨ 热门',
  color: '#f59e0b',
  nodeInfoList: [
    { nodeId: '33', fieldName: 'text', fieldValue: '', description: '提示词' },
    { nodeId: '21', fieldName: 'width', fieldValue: '1024', description: '宽度' },
    { nodeId: '21', fieldName: 'height', fieldValue: '1024', description: '高度' }
  ]
};
