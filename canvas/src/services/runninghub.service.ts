import { ComfyUIService } from './comfyui.service';
import { RunningHubWorkflow } from '../config/runninghub.config';
import { PRESET_WORKFLOWS } from '../presets/workflows';

const GATEWAY_URL = 'http://localhost:3000';

export interface ComfyUIWorkflow {
  id: string;
  name: string;
  source: 'local_comfyui' | 'runninghub';
  filename?: string;
  workflowIdOrJson?: string;
  description: string;
  fields?: Array<{
    id: string;
    nodeId: string;
    fieldName: string;
    name: string;
    type: string;
    default: any;
  }>;
  capability: string;
}

export class RunningHubService {
  /**
   * 获取所有注册的工作流（合并默认配置与用户自定义的）
   */
  public static getWorkflows(): RunningHubWorkflow[] {
    const saved = localStorage.getItem('custom_runninghub_workflows');
    const custom = saved ? JSON.parse(saved) : [];
    
    // 默认自带的工作流，动态从独立的预设文件模块中读取
    const defaults: RunningHubWorkflow[] = PRESET_WORKFLOWS
      .filter(w => w.source === 'runninghub' && w.nodeInfoList)
      .map(w => ({
        id: w.id,
        name: w.name,
        appId: w.appId || w.id,
        description: w.description,
        nodeInfoList: w.nodeInfoList || [],
        capability: w.capability
      }));

    // 过滤掉被用户删除的内置默认工作流
    const deletedSaved = localStorage.getItem('deleted_default_workflows');
    const deletedIds: string[] = deletedSaved ? JSON.parse(deletedSaved) : [];
    const activeDefaults = defaults.filter((d) => !deletedIds.includes(d.id));

    // 去重，以 id 为准
    const all = [...custom];
    activeDefaults.forEach((def) => {
      if (!all.some((w) => w.id === def.id)) {
        all.push(def);
      }
    });

    return all;
  }

  /**
   * 保存用户自定义工作流
   */
  public static saveWorkflow(wf: RunningHubWorkflow) {
    const list = this.getCustomWorkflows();
    const index = list.findIndex((w) => w.id === wf.id);
    
    // 如果之前被标记为删除的默认工作流，重新保存时移出已删除列表
    const deletedSaved = localStorage.getItem('deleted_default_workflows');
    if (deletedSaved) {
      const deletedIds: string[] = JSON.parse(deletedSaved);
      if (deletedIds.includes(wf.id)) {
        const filtered = deletedIds.filter(id => id !== wf.id);
        localStorage.setItem('deleted_default_workflows', JSON.stringify(filtered));
      }
    }

    if (index >= 0) {
      list[index] = wf;
    } else {
      list.push(wf);
    }
    localStorage.setItem('custom_runninghub_workflows', JSON.stringify(list));
  }

  /**
   * 删除工作流
   */
  public static deleteWorkflow(id: string) {
    const list = this.getCustomWorkflows();
    const filtered = list.filter((w) => w.id !== id);
    localStorage.setItem('custom_runninghub_workflows', JSON.stringify(filtered));

    // 如果是内置工作流，记录到已删除列表
    const defaultIds = ['2034899011521482754', 'rh_wf_face_consistency', 'rh_wf_style_transfer'];
    if (defaultIds.includes(id)) {
      const deletedSaved = localStorage.getItem('deleted_default_workflows');
      const deletedIds: string[] = deletedSaved ? JSON.parse(deletedSaved) : [];
      if (!deletedIds.includes(id)) {
        deletedIds.push(id);
        localStorage.setItem('deleted_default_workflows', JSON.stringify(deletedIds));
      }
    }
  }

  /**
   * 恢复所有系统内置工作流
   */
  public static restoreDefaultWorkflows() {
    localStorage.removeItem('deleted_default_workflows');
  }

  private static getCustomWorkflows(): RunningHubWorkflow[] {
    const saved = localStorage.getItem('custom_runninghub_workflows');
    return saved ? JSON.parse(saved) : [];
  }

  /**
   * 执行自定义工作流 (向 Gateway 提交物理执行请求)
   */
  public static async executeCustomWorkflow(
    source: 'local_comfyui' | 'runninghub',
    workflowIdOrJson: string,
    inputs: Record<string, any>,
    mappings: any[]
  ): Promise<string> {
    const res = await fetch(`${GATEWAY_URL}/api/v1/custom-workflow/execute`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        source,
        workflowIdOrJson,
        inputs,
        mappings
      })
    });

    const data = await res.json();
    if (data.success && data.outputUrl) {
      return data.outputUrl;
    }
    throw new Error(data.error || '执行失败');
  }

  /**
   * 解析自定义工作流参数
   */
  public static async parseWorkflow(
    source: 'local_comfyui' | 'runninghub',
    workflowIdOrJson: string
  ): Promise<any[]> {
    const res = await fetch(`${GATEWAY_URL}/api/v1/custom-workflow/parse`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        source,
        workflowIdOrJson
      })
    });

    const data = await res.json();
    if (data.success && data.parameters) {
      return data.parameters;
    }
    throw new Error(data.error || '解析失败');
  }
}
