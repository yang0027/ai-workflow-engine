import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const WORKFLOWS_DIR = path.resolve(__dirname, '../../../../data/workflows');
const WORKFLOW_CONFIG_DIR = path.resolve(__dirname, '../../../../data/workflow-configs');

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

export interface ComfyUIWorkflowConfig {
  id: string;
  title: string;
  description: string;
  filename: string;
  fields: ComfyUIWorkflowField[];
  thumbnail?: string;
  category: string;
}

export class ComfyUIWorkflowService {
  private static instance: ComfyUIWorkflowService;
  private workflows: Map<string, ComfyUIWorkflowConfig> = new Map();

  private constructor() {
    this.ensureDirectories();
    this.loadBuiltInWorkflows();
  }

  public static getInstance(): ComfyUIWorkflowService {
    if (!ComfyUIWorkflowService.instance) {
      ComfyUIWorkflowService.instance = new ComfyUIWorkflowService();
    }
    return ComfyUIWorkflowService.instance;
  }

  private ensureDirectories(): void {
    if (!fs.existsSync(WORKFLOWS_DIR)) {
      fs.mkdirSync(WORKFLOWS_DIR, { recursive: true });
    }
    if (!fs.existsSync(WORKFLOW_CONFIG_DIR)) {
      fs.mkdirSync(WORKFLOW_CONFIG_DIR, { recursive: true });
    }
  }

  private loadBuiltInWorkflows(): void {
    // 内置工作流配置
    const builtInConfigs: ComfyUIWorkflowConfig[] = [
      {
        id: 'z-image',
        title: 'Z-Image 文生图',
        description: '基础文生图工作流，支持尺寸调节和随机种子',
        filename: 'Z-Image.json',
        category: 'image',
        fields: [
          {
            id: 'prompt',
            nodeId: '23',
            fieldName: 'text',
            name: '提示词',
            type: 'text',
            default: ''
          },
          {
            id: 'width',
            nodeId: '144',
            fieldName: 'width',
            name: '宽度',
            type: 'number',
            default: 1024,
            min: 256,
            max: 2048,
            step: 64
          },
          {
            id: 'height',
            nodeId: '144',
            fieldName: 'height',
            name: '高度',
            type: 'number',
            default: 1024,
            min: 256,
            max: 2048,
            step: 64
          }
        ]
      },
      {
        id: 'flux-klein',
        title: 'Flux2-Klein 图生图',
        description: 'Flux2 模型图生图工作流，支持风格迁移',
        filename: 'Flux2-Klein.json',
        category: 'image',
        fields: [
          {
            id: 'prompt',
            nodeId: '6',
            fieldName: 'text',
            name: '提示词',
            type: 'text',
            default: ''
          },
          {
            id: 'image',
            nodeId: '5',
            fieldName: 'image',
            name: '参考图',
            type: 'image',
            default: ''
          }
        ]
      },
      {
        id: 'upscale',
        title: '图片放大',
        description: 'SDXL 级别的图片超分辨率放大',
        filename: 'upscale.json',
        category: 'enhance',
        fields: [
          {
            id: 'image',
            nodeId: '10',
            fieldName: 'image',
            name: '输入图片',
            type: 'image',
            default: ''
          },
          {
            id: 'scale',
            nodeId: '13',
            fieldName: 'scale',
            name: '放大倍数',
            type: 'select',
            default: '2',
            options: ['2', '4']
          }
        ]
      }
    ];

    builtInConfigs.forEach(wf => {
      this.workflows.set(wf.id, wf);
    });
  }

  public listWorkflows(): ComfyUIWorkflowConfig[] {
    return Array.from(this.workflows.values());
  }

  public getWorkflow(id: string): ComfyUIWorkflowConfig | undefined {
    return this.workflows.get(id);
  }

  public getWorkflowJson(filename: string): any {
    const filePath = path.join(WORKFLOWS_DIR, filename);
    if (!fs.existsSync(filePath)) {
      // 尝试从参考项目复制
      const refPath = path.join('E:', '无限画布参考', 'workflows', filename);
      if (fs.existsSync(refPath)) {
        if (!fs.existsSync(WORKFLOWS_DIR)) {
          fs.mkdirSync(WORKFLOWS_DIR, { recursive: true });
        }
        fs.copyFileSync(refPath, filePath);
      }
    }
    
    if (fs.existsSync(filePath)) {
      const content = fs.readFileSync(filePath, 'utf-8');
      return JSON.parse(content);
    }
    return null;
  }

  public parseWorkflowFields(workflowJson: any): ComfyUIWorkflowField[] {
    const fields: ComfyUIWorkflowField[] = [];
    
    if (!workflowJson || typeof workflowJson !== 'object') {
      return fields;
    }

    for (const [nodeId, nodeData] of Object.entries(workflowJson)) {
      if (!nodeData || typeof nodeData !== 'object') continue;
      
      const node = nodeData as any;
      const classType = node.class_type || node.classType || '';
      const inputs = node.inputs || {};

      for (const [fieldName, fieldValue] of Object.entries(inputs)) {
        const fieldId = `${nodeId}_${fieldName}`;
        const fieldType = this.inferFieldType(fieldValue);
        
        fields.push({
          id: fieldId,
          nodeId: String(nodeId),
          fieldName: String(fieldName),
          name: this.formatFieldName(fieldName),
          type: fieldType,
          default: fieldValue
        });
      }
    }

    return fields;
  }

  private inferFieldType(value: any): 'text' | 'image' | 'number' | 'select' {
    if (typeof value === 'string') {
      if (value.includes('.png') || value.includes('.jpg') || value.includes('.jpeg')) {
        return 'image';
      }
      if (value.length > 100) {
        return 'text';
      }
      return 'text';
    }
    if (typeof value === 'number') {
      return 'number';
    }
    if (Array.isArray(value) && value.length > 0) {
      return 'select';
    }
    return 'text';
  }

  private formatFieldName(name: string): string {
    return name
      .replace(/_/g, ' ')
      .replace(/([A-Z])/g, ' $1')
      .replace(/^\w/, c => c.toUpperCase())
      .trim();
  }

  public saveCustomWorkflow(config: ComfyUIWorkflowConfig): void {
    this.workflows.set(config.id, config);
    const configPath = path.join(WORKFLOW_CONFIG_DIR, `${config.id}.json`);
    fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  }

  public deleteCustomWorkflow(id: string): boolean {
    const config = this.workflows.get(id);
    if (!config) return false;
    
    this.workflows.delete(id);
    const configPath = path.join(WORKFLOW_CONFIG_DIR, `${id}.json`);
    if (fs.existsSync(configPath)) {
      fs.unlinkSync(configPath);
    }
    return true;
  }
}
