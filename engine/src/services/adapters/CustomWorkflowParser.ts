export interface ParsableParameter {
  nodeId: string;
  classType: string;
  fieldName: string;
  defaultValue: any;
  displayName: string;
}

export class CustomWorkflowParser {
  /**
   * 智能分析 ComfyUI API 格式 JSON 拓扑
   */
  public static parseComfyUIJson(workflowJsonStr: string): ParsableParameter[] {
    try {
      const workflow = JSON.parse(workflowJsonStr);
      const params: ParsableParameter[] = [];

      const nodeIds = Object.keys(workflow);
      for (const nodeId of nodeIds) {
        const node = workflow[nodeId];
        const classType = node.class_type || '';
        const inputs = node.inputs || {};

        // 识别常见的输入与参数修改节点
        if (classType === 'CLIPTextEncode') {
          if ('text' in inputs) {
            params.push({
              nodeId,
              classType,
              fieldName: 'text',
              defaultValue: inputs.text,
              displayName: `节点[${nodeId}] 文本输入 (CLIPTextEncode)`
            });
          }
        } else if (classType === 'KSampler' || classType === 'KSamplerAdvanced') {
          if ('seed' in inputs) {
            params.push({
              nodeId,
              classType,
              fieldName: 'seed',
              defaultValue: inputs.seed,
              displayName: `节点[${nodeId}] 随机种子 (KSampler.seed)`
            });
          }
          if ('steps' in inputs) {
            params.push({
              nodeId,
              classType,
              fieldName: 'steps',
              defaultValue: inputs.steps,
              displayName: `节点[${nodeId}] 采样步数 (KSampler.steps)`
            });
          }
        } else if (classType === 'LoadImage') {
          if ('image' in inputs) {
            params.push({
              nodeId,
              classType,
              fieldName: 'image',
              defaultValue: inputs.image,
              displayName: `节点[${nodeId}] 图片输入 (LoadImage)`
            });
          }
        } else if (classType === 'LoadAudio') {
          if ('audio' in inputs) {
            params.push({
              nodeId,
              classType,
              fieldName: 'audio',
              defaultValue: inputs.audio,
              displayName: `节点[${nodeId}] 音频输入 (LoadAudio)`
            });
          }
        } else {
          // 通用 fallback：如果输入项是普通 String 或者是 Number，并且不是对象连线引用，也可以作为可调整参数
          const inputKeys = Object.keys(inputs);
          for (const key of inputKeys) {
            const val = inputs[key];
            // 在 ComfyUI API 中，连线是用数组表示的，如 ["10", 0]。非数组且非对象的普通基本值，皆为可配置属性
            if (
              typeof val === 'string' || 
              typeof val === 'number' || 
              typeof val === 'boolean'
            ) {
              // 排除一些静态不需要的属性，如 sampler_name 等
              const ignoredKeys = ['sampler_name', 'scheduler', 'control_after_generate', 'type'];
              if (!ignoredKeys.includes(key)) {
                params.push({
                  nodeId,
                  classType,
                  fieldName: key,
                  defaultValue: val,
                  displayName: `节点[${nodeId}] ${key} (${classType})`
                });
              }
            }
          }
        }
      }

      return params;
    } catch (e: any) {
      throw new Error(`解析 ComfyUI JSON 失败: ${e.message}`);
    }
  }

  /**
   * 云端 RunningHub 参数解析：
   * 云端可以直接通过接口获取，或者对于用户填入的 RunningHub，我们提供最灵活的自定义节点 ID 和字段绑定。
   */
  public static parseRunningHubWorkflow(workflowId: string): ParsableParameter[] {
    // 由于 RunningHub 平台涉及不同私有工作流，我们这里默认预置几个通用输入点，
    // 同时允许用户在前端侧自己自由添加和指定 inputMappings，灵活性拉满！
    return [
      {
        nodeId: '6',
        classType: 'CLIPTextEncode',
        fieldName: 'text',
        defaultValue: '',
        displayName: '正向提示词 (CLIPTextEncode)'
      },
      {
        nodeId: '3',
        classType: 'KSampler',
        fieldName: 'seed',
        defaultValue: -1,
        displayName: '随机种子 (KSampler.seed)'
      },
      {
        nodeId: '269',
        classType: 'LoadImage',
        fieldName: 'image',
        defaultValue: '',
        displayName: '角色参考图输入 (LoadImage)'
      },
      {
        nodeId: '447',
        classType: 'LoadAudio',
        fieldName: 'audio',
        defaultValue: '',
        displayName: '配音音频输入 (LoadAudio)'
      }
    ];
  }
}
