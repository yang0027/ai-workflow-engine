/**
 * @file preset-workflow.interface.ts
 * @description 预设工作流的强类型结构接口，兼顾执行逻辑属性与工作流广场 UI 展示元数据。
 */

export interface PresetWorkflowField {
  nodeId: string;
  fieldName: string;
  fieldValue: string;
  description: string;
  fieldType?: 'string' | 'number' | 'boolean' | 'select' | 'image' | 'audio' | 'video';
}

export interface PresetWorkflow {
  id: string;                      // 唯一工作流 ID (与系统注册一致)
  name: string;                    // UI 界面友好展示的主标题
  appId?: string;                  // RunningHub 专属 App ID
  source: 'local_comfyui' | 'runninghub'; // 工作流物理来源分流
  capability: 'image' | 'video' | 'audio' | 'workflow'; // 工作流所归属的底层能力范畴
  description: string;             // 工作流的功能描述详情
  cover?: string;                  // 广场卡片渲染的预览封面图 (Unsplash 高精大图)
  tag?: string;                    // 广场卡片点缀的特性角标标签
  color?: string;                  // 卡片标签的标志渐变色彩
  nodeInfoList?: PresetWorkflowField[]; // RunningHub 专用字段输入映射表
  paramsSchema?: any[];            // 本地 ComfyUI 专属字段定义格式
  rawWorkflowJson?: any;           // 本地 ComfyUI 专用 API 拓扑 JSON 结构
}
