export interface InputMapping {
  portId: string;
  nodeId: string;
  fieldName: string;
  displayName: string;
}

export interface CustomNodeData {
  label?: string;
  source?: 'local_comfyui' | 'runninghub';
  workflowIdOrJson?: string;
  mappings?: InputMapping[];
  inputs?: Record<string, any>; // 缓存用户手动输入或连线灌装的参数值
  outputs?: {
    errorMsg?: string;
    output?: string;
    image?: string;
    audio?: string;
    video?: string;
  };
  outputUrl?: string;
  onEdit?: (id: string) => void;
  isRunning?: boolean;
}

export interface CustomWorkflowNodeProps {
  id: string;
  data: CustomNodeData;
  selected?: boolean;
}

// React Flow Handle high fidelity style mapping
export const handleStyleBase: React.CSSProperties = {
  width: '10px',
  height: '10px',
  background: 'rgba(15, 23, 42, 0.95)',
  borderRadius: '50%',
  zIndex: 10
};
