export type WorkflowTemplateSource = 'local_comfyui' | 'runninghub';
export type WorkflowTemplateCapability = 'image' | 'video' | 'audio' | 'workflow';
export type WorkflowParamType = 'text' | 'number' | 'boolean' | 'select' | 'image' | 'audio' | 'video';

export interface WorkflowParam {
  id: string;
  nodeId: string;
  classType: string;
  fieldName: string;
  label: string;
  type: WorkflowParamType;
  defaultValue: any;
  exposed: boolean;
  options?: string[];
}

export interface WorkflowInputMapping {
  inputPort: string;
  nodeId: string;
  fieldName: string;
  transform?: 'url' | 'base64' | 'file';
}

export interface WorkflowOutputMapping {
  type: 'image' | 'video' | 'audio' | 'text';
  nodeId?: string;
  fieldName?: string;
}

export interface WorkflowTemplate {
  id: string;
  name: string;
  source: WorkflowTemplateSource;
  capability: WorkflowTemplateCapability;
  workflowRef?: string;
  webLink?: string;
  rawWorkflowJson?: Record<string, any>;
  paramsSchema: WorkflowParam[];
  inputMappings: WorkflowInputMapping[];
  outputMapping?: WorkflowOutputMapping;
  description?: string;
  previewImage?: string;
  createdAt: string;
  updatedAt: string;
}

export interface WorkflowParseRequest {
  source: WorkflowTemplateSource;
  workflowJson: string | Record<string, any>;
  name?: string;
  capability?: WorkflowTemplateCapability;
}

export interface WorkflowTemplateUpsertRequest {
  id?: string;
  name: string;
  source: WorkflowTemplateSource;
  capability: WorkflowTemplateCapability;
  workflowRef?: string;
  webLink?: string;
  rawWorkflowJson?: Record<string, any> | string;
  paramsSchema?: WorkflowParam[];
  inputMappings?: WorkflowInputMapping[];
  outputMapping?: WorkflowOutputMapping;
  description?: string;
  previewImage?: string;
}

