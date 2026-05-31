const GATEWAY_URL = '';

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

export interface WorkflowParseResponse {
  success: boolean;
  format: 'api_json' | 'workflow_json';
  paramsSchema: WorkflowParam[];
  inputMappings: WorkflowInputMapping[];
  outputMapping?: WorkflowOutputMapping;
  rawWorkflowJson: Record<string, any>;
}

export class WorkflowTemplateService {
  public static async listTemplates(): Promise<WorkflowTemplate[]> {
    const data = await this.request('/api/v1/workflow-templates');
    return data.templates || [];
  }

  public static async getTemplate(id: string): Promise<WorkflowTemplate> {
    const data = await this.request(`/api/v1/workflow-templates/${encodeURIComponent(id)}`);
    return data.template;
  }

  public static async parseTemplate(payload: {
    source: WorkflowTemplateSource;
    workflowJson: string | Record<string, any>;
    name?: string;
    capability?: WorkflowTemplateCapability;
  }): Promise<WorkflowParseResponse> {
    return this.request('/api/v1/workflow-templates/parse', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
  }

  public static async saveTemplate(payload: {
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
  }): Promise<WorkflowTemplate> {
    const method = payload.id ? 'PUT' : 'POST';
    const path = payload.id
      ? `/api/v1/workflow-templates/${encodeURIComponent(payload.id)}`
      : '/api/v1/workflow-templates';
    const data = await this.request(path, {
      method,
      body: JSON.stringify(payload),
    });
    return data.template;
  }

  public static async deleteTemplate(id: string): Promise<void> {
    await this.request(`/api/v1/workflow-templates/${encodeURIComponent(id)}`, {
      method: 'DELETE',
    });
  }

  private static async request(path: string, init: RequestInit = {}) {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);
    try {
      const url = `${GATEWAY_URL}${path}`;
      console.log('[WorkflowTemplateService] → GET', url);
      const res = await fetch(url, {
        ...init,
        signal: controller.signal,
        headers: {
          'Content-Type': 'application/json',
          ...(init.headers || {}),
        },
      });
      clearTimeout(timeoutId);
      console.log('[WorkflowTemplateService] ← status', res.status, url);
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || `请求失败: ${res.status}`);
      }
      return data;
    } catch (e: any) {
      clearTimeout(timeoutId);
      if (e.name === 'AbortError') {
        throw new Error('请求超时');
      }
      console.error('[WorkflowTemplateService] ✗', path, e.message, e.stack?.split('\n')[1]);
      throw e;
    }
  }
}
