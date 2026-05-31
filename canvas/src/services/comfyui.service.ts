const GATEWAY_URL = '';

export interface ComfyUIWorkflowField {
  id: string;
  nodeId: string;
  fieldName: string;
  name: string;
  type: 'text' | 'image' | 'number' | 'select';
  default: any;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
}

export interface ComfyUIWorkflow {
  id: string;
  title: string;
  description: string;
  filename: string;
  fields: ComfyUIWorkflowField[];
  thumbnail?: string;
  category: string;
}

export class ComfyUIService {
  /**
   * 获取所有可用工作流
   */
  public static async listWorkflows(): Promise<ComfyUIWorkflow[]> {
    const res = await fetch(`${GATEWAY_URL}/api/v1/comfyui/workflows`);
    const data = await res.json();
    if (data.success && data.workflows) {
      return data.workflows;
    }
    throw new Error(data.error || '获取工作流列表失败');
  }

  /**
   * 获取单个工作流配置
   */
  public static async getWorkflow(id: string): Promise<ComfyUIWorkflow> {
    const res = await fetch(`${GATEWAY_URL}/api/v1/comfyui/workflows/${id}`);
    const data = await res.json();
    if (data.success && data.workflow) {
      return data.workflow;
    }
    throw new Error(data.error || '获取工作流失败');
  }

  /**
   * 获取工作流原始 JSON
   */
  public static async getWorkflowJson(id: string): Promise<any> {
    const res = await fetch(`${GATEWAY_URL}/api/v1/comfyui/workflows/${id}/json`);
    const data = await res.json();
    if (data.success && data.json) {
      return data.json;
    }
    throw new Error(data.error || '获取工作流 JSON 失败');
  }

  /**
   * 解析任意 ComfyUI 工作流 JSON
   */
  public static async parseWorkflowJson(json: any): Promise<ComfyUIWorkflowField[]> {
    const res = await fetch(`${GATEWAY_URL}/api/v1/comfyui/workflows/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ json })
    });
    const data = await res.json();
    if (data.success && data.fields) {
      return data.fields;
    }
    throw new Error(data.error || '解析工作流失败');
  }

  /**
   * 保存自定义工作流
   */
  public static async saveWorkflow(workflow: ComfyUIWorkflow): Promise<void> {
    const res = await fetch(`${GATEWAY_URL}/api/v1/comfyui/workflows`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(workflow)
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || '保存工作流失败');
    }
  }

  /**
   * 删除自定义工作流
   */
  public static async deleteWorkflow(id: string): Promise<void> {
    const res = await fetch(`${GATEWAY_URL}/api/v1/comfyui/workflows/${id}`, {
      method: 'DELETE'
    });
    const data = await res.json();
    if (!data.success) {
      throw new Error(data.error || '删除工作流失败');
    }
  }

  /**
   * 执行本地 ComfyUI 工作流
   */
  public static async executeWorkflow(
    workflowIdOrJson: string,
    inputs: Record<string, any>,
    mappings: any[]
  ): Promise<string> {
    const res = await fetch(`${GATEWAY_URL}/api/v1/custom-workflow/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: 'local_comfyui',
        workflowIdOrJson,
        inputs,
        mappings
      })
    });
    const data = await res.json();
    if (data.success && data.outputUrl) {
      return data.outputUrl;
    }
    throw new Error(data.error || '执行工作流失败');
  }
}
