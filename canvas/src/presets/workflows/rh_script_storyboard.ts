import { PresetWorkflow } from './preset-workflow.interface';

export const rhScriptStoryboard: PresetWorkflow = {
  id: 'script-storyboard',
  name: '🎬 Script Storyboard 剧本多分镜视频合成',
  appId: '2053799323917402117',
  source: 'runninghub',
  capability: 'video',
  description: '全自动剧本拆解与多级视频合成，完美融合文本旁白、镜头画面与音轨融合。',
  cover: 'https://images.unsplash.com/photo-1536240478700-b869ad10e128?w=400&q=80',
  tag: '🎬 电商',
  color: '#a855f7',
  nodeInfoList: [
    { nodeId: '2', fieldName: 'text', fieldValue: '', description: '旁白' }
  ]
};
