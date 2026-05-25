import {
  WorkflowInputMapping,
  WorkflowOutputMapping,
  WorkflowParam,
  WorkflowParamType,
  WorkflowTemplateCapability,
} from './types.js';

const TEXT_FIELDS = new Set(['text', 'prompt', 'global_prompt', 'instruction', 'custom_clone_text']);
const IMAGE_FIELDS = new Set(['image', 'image1', 'image2', 'image3', 'image4', 'vl_resize_image1']);
const AUDIO_FIELDS = new Set(['audio', 'custom_clone_audio']);
const VIDEO_FIELDS = new Set(['video', 'video_url', 'videos']);
const SIZE_FIELDS = new Set(['width', 'height', 'custom_width', 'custom_height', 'target_size', 'reel_height']);
const SAMPLING_FIELDS = new Set(['seed', 'noise_seed', 'steps', 'cfg', 'denoise', 'duration_frames', 'duration_seconds', 'frame_rate']);
const MODEL_FIELDS = new Set(['ckpt_name', 'unet_name', 'model_name', 'lora_name', 'vae_name', 'clip_name', 'clip_name1', 'clip_name2']);
const IGNORED_FIELDS = new Set(['model', 'clip', 'vae', 'positive', 'negative', 'latent_image', 'samples', 'conditioning', 'type', 'device', 'mode', 'key_opt']);

export interface WorkflowParseResult {
  format: 'api_json' | 'workflow_json';
  paramsSchema: WorkflowParam[];
  inputMappings: WorkflowInputMapping[];
  outputMapping?: WorkflowOutputMapping;
  rawWorkflowJson: Record<string, any>;
}

export class WorkflowTemplateParser {
  public static parseWorkflowJson(input: string | Record<string, any>, capability: WorkflowTemplateCapability = 'workflow'): WorkflowParseResult {
    const parsed = typeof input === 'string' ? JSON.parse(input) : input;

    if (this.isComfyWorkflowJson(parsed)) {
      return this.parseComfyWorkflowJson(parsed, capability);
    }

    return this.parseComfyApiJson(parsed, capability);
  }

  private static parseComfyApiJson(workflow: Record<string, any>, capability: WorkflowTemplateCapability): WorkflowParseResult {
    const paramsSchema: WorkflowParam[] = [];
    const inputMappings: WorkflowInputMapping[] = [];
    let outputMapping: WorkflowOutputMapping | undefined;

    for (const nodeId of Object.keys(workflow)) {
      const node = workflow[nodeId] || {};
      const classType = node.class_type || node.type || '';
      const inputs = node.inputs || {};

      if (!outputMapping) {
        outputMapping = this.inferOutputMapping(nodeId, classType, inputs, capability);
      }

      for (const fieldName of Object.keys(inputs)) {
        const defaultValue = inputs[fieldName];
        if (!this.isEditableValue(defaultValue) || IGNORED_FIELDS.has(fieldName)) {
          continue;
        }

        const type = this.inferParamType(fieldName, classType, defaultValue);
        const exposed = this.shouldExposeByDefault(fieldName, classType, type);
        const param: WorkflowParam = {
          id: this.paramId(nodeId, fieldName),
          nodeId,
          classType,
          fieldName,
          label: this.makeLabel(nodeId, fieldName, classType),
          type,
          defaultValue,
          exposed,
        };

        paramsSchema.push(param);

        const mapping = this.inferInputMapping(param);
        if (mapping) {
          inputMappings.push(mapping);
        }
      }
    }

    return {
      format: 'api_json',
      paramsSchema,
      inputMappings: this.dedupeMappings(inputMappings),
      outputMapping,
      rawWorkflowJson: workflow,
    };
  }

  private static parseComfyWorkflowJson(workflow: Record<string, any>, capability: WorkflowTemplateCapability): WorkflowParseResult {
    const apiLike: Record<string, any> = {};
    const nodes = Array.isArray(workflow.nodes) ? workflow.nodes : [];

    for (const node of nodes) {
      const nodeId = String(node.id);
      const inputs: Record<string, any> = {};
      const widgetInputs = Array.isArray(node.inputs) ? node.inputs.filter((item: any) => item?.widget?.name) : [];
      const widgetValues = Array.isArray(node.widgets_values) ? node.widgets_values : [];

      widgetInputs.forEach((input: any, index: number) => {
        inputs[input.widget.name] = widgetValues[index];
      });

      apiLike[nodeId] = {
        class_type: node.type || '',
        inputs,
        _meta: {
          title: node.title || node.type || '',
        },
      };
    }

    const result = this.parseComfyApiJson(apiLike, capability);
    return {
      ...result,
      format: 'workflow_json',
      rawWorkflowJson: workflow,
    };
  }

  private static isComfyWorkflowJson(value: any): boolean {
    return value && Array.isArray(value.nodes) && Array.isArray(value.links);
  }

  private static isEditableValue(value: any): boolean {
    return typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean';
  }

  private static inferParamType(fieldName: string, classType: string, value: any): WorkflowParamType {
    const lowerField = fieldName.toLowerCase();
    const lowerClass = classType.toLowerCase();

    if (IMAGE_FIELDS.has(lowerField) || lowerClass.includes('loadimage')) return 'image';
    if (AUDIO_FIELDS.has(lowerField) || lowerClass.includes('loadaudio')) return 'audio';
    if (VIDEO_FIELDS.has(lowerField) || lowerClass.includes('loadvideo')) return 'video';
    if (typeof value === 'boolean') return 'boolean';
    if (typeof value === 'number' || SIZE_FIELDS.has(lowerField) || SAMPLING_FIELDS.has(lowerField)) return 'number';
    if (MODEL_FIELDS.has(lowerField) || lowerField.includes('model_name') || lowerField.includes('sampler') || lowerField.includes('scheduler')) return 'select';
    return 'text';
  }

  private static shouldExposeByDefault(fieldName: string, classType: string, type: WorkflowParamType): boolean {
    const lowerField = fieldName.toLowerCase();
    const lowerClass = classType.toLowerCase();

    if (TEXT_FIELDS.has(lowerField)) return true;
    if (IMAGE_FIELDS.has(lowerField) || AUDIO_FIELDS.has(lowerField) || VIDEO_FIELDS.has(lowerField)) return true;
    if (SIZE_FIELDS.has(lowerField) || SAMPLING_FIELDS.has(lowerField)) return true;
    return false;
  }

  private static inferInputMapping(param: WorkflowParam): WorkflowInputMapping | null {
    if (param.type === 'image') {
      return { inputPort: 'image', nodeId: param.nodeId, fieldName: param.fieldName, transform: 'url' };
    }
    if (param.type === 'audio') {
      return { inputPort: 'audio', nodeId: param.nodeId, fieldName: param.fieldName, transform: 'url' };
    }
    if (param.type === 'video') {
      return { inputPort: 'video', nodeId: param.nodeId, fieldName: param.fieldName, transform: 'url' };
    }
    if (TEXT_FIELDS.has(param.fieldName.toLowerCase())) {
      return { inputPort: 'prompt', nodeId: param.nodeId, fieldName: param.fieldName };
    }
    return null;
  }

  private static inferOutputMapping(
    nodeId: string,
    classType: string,
    inputs: Record<string, any>,
    capability: WorkflowTemplateCapability,
  ): WorkflowOutputMapping | undefined {
    const lowerClass = classType.toLowerCase();
    if (lowerClass.includes('saveaudio')) return { type: 'audio', nodeId, fieldName: 'audio' };
    if (lowerClass.includes('videocombine') || lowerClass.includes('savevideo')) return { type: 'video', nodeId, fieldName: 'video' };
    if (lowerClass.includes('saveimage') || lowerClass.includes('previewimage')) return { type: 'image', nodeId, fieldName: 'images' };

    if (inputs?.images && capability === 'image') return { type: 'image', nodeId, fieldName: 'images' };
    if (inputs?.audio && capability === 'audio') return { type: 'audio', nodeId, fieldName: 'audio' };
    return undefined;
  }

  private static makeLabel(nodeId: string, fieldName: string, classType: string): string {
    const friendly: Record<string, string> = {
      text: '文本',
      prompt: '提示词',
      global_prompt: '全局提示词',
      instruction: '指令',
      image: '图片',
      audio: '音频',
      video: '视频',
      seed: '随机种子',
      noise_seed: '噪声种子',
      steps: '步数',
      width: '宽度',
      height: '高度',
      custom_width: '自定义宽度',
      custom_height: '自定义高度',
      cfg: 'CFG',
      denoise: '重绘强度',
    };
    return `${friendly[fieldName] || fieldName} [${nodeId}] (${classType || 'Unknown'})`;
  }

  private static paramId(nodeId: string, fieldName: string): string {
    return `${nodeId}_${fieldName}`.replace(/[^a-zA-Z0-9_-]/g, '_');
  }

  private static dedupeMappings(mappings: WorkflowInputMapping[]): WorkflowInputMapping[] {
    const seen = new Set<string>();
    return mappings.filter((item) => {
      const key = `${item.inputPort}:${item.nodeId}:${item.fieldName}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
