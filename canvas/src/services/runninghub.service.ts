import { RunningHubWorkflow } from '../config/runninghub.config';

const GATEWAY_URL = 'http://localhost:3000';

export class RunningHubService {
  /**
   * 获取所有注册的工作流（合并默认配置与用户自定义的）
   */
  public static getWorkflows(): RunningHubWorkflow[] {
    const saved = localStorage.getItem('custom_runninghub_workflows');
    const custom = saved ? JSON.parse(saved) : [];
    
    // 默认自带的工作流
    const defaults: RunningHubWorkflow[] = [
      {
        id: '2034899011521482754',
        name: '🎨 RunningHub 极简文生图 (Flux)',
        appId: '2034899011521482754',
        description: '极速且纯粹的云端文生图工作流，支持画面尺寸的自适应微调。',
        nodeInfoList: [
          { nodeId: '33', fieldName: 'text', fieldValue: '', description: '提示词' },
          { nodeId: '21', fieldName: 'width', fieldValue: '1024', description: '宽度' },
          { nodeId: '21', fieldName: 'height', fieldValue: '1024', description: '高度' }
        ],
        capability: 'image'
      },
      {
        id: 'rh_wf_face_consistency',
        name: '🎭 RunningHub 面部一致性洗图',
        appId: '2053799323917402114',
        description: '智能提取 Flux 面部原画特征，并在云端进行高精面部重采样。',
        nodeInfoList: [
          { nodeId: '5148', fieldName: 'text', fieldValue: '', description: '提示词' },
          { nodeId: '10', fieldName: 'image', fieldValue: '', description: '参考图' }
        ],
        capability: 'image'
      },
      {
        id: 'rh_wf_style_transfer',
        name: '🎨 RunningHub 艺术流派跨界重绘',
        appId: '2053799323917402115',
        description: '一键将常规图片洗成赛博朋克、日系动漫或中国古典水墨风。',
        nodeInfoList: [
          { nodeId: '6', fieldName: 'image', fieldValue: '', description: '原图' },
          { nodeId: '12', fieldName: 'style', fieldValue: 'cyberpunk', description: '风格' }
        ],
        capability: 'image'
      }
    ];

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
