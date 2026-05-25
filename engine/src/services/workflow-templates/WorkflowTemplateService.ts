import fs from 'fs';
import path from 'path';
import { randomUUID } from 'crypto';
import { fileURLToPath } from 'url';
import { WorkflowTemplateParser } from './WorkflowTemplateParser.js';
import {
  WorkflowParseRequest,
  WorkflowTemplate,
  WorkflowTemplateUpsertRequest,
} from './types.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const TEMPLATE_PATH = path.resolve(__dirname, '../../../data/workflow-templates.json');

export class WorkflowTemplateService {
  private static instance: WorkflowTemplateService;
  private templates: WorkflowTemplate[] = [];

  private constructor() {
    this.loadFromFile();
  }

  public static getInstance(): WorkflowTemplateService {
    if (!WorkflowTemplateService.instance) {
      WorkflowTemplateService.instance = new WorkflowTemplateService();
    }
    return WorkflowTemplateService.instance;
  }

  public listTemplates(): WorkflowTemplate[] {
    this.loadFromFile();
    return this.templates;
  }

  public getTemplate(id: string): WorkflowTemplate | null {
    this.loadFromFile();
    return this.templates.find((item) => item.id === id) || null;
  }

  public parseTemplate(request: WorkflowParseRequest) {
    if (!request.workflowJson) {
      throw new Error('workflowJson is required');
    }

    return WorkflowTemplateParser.parseWorkflowJson(request.workflowJson, request.capability || 'workflow');
  }

  public saveTemplate(input: WorkflowTemplateUpsertRequest): WorkflowTemplate {
    if (!input.name || !input.source || !input.capability) {
      throw new Error('name, source and capability are required');
    }

    this.loadFromFile();

    const now = new Date().toISOString();
    const id = input.id || randomUUID();
    const existing = this.templates.find((item) => item.id === id);
    const parsedRawJson = typeof input.rawWorkflowJson === 'string'
      ? JSON.parse(input.rawWorkflowJson)
      : input.rawWorkflowJson;

    let paramsSchema = input.paramsSchema || [];
    let inputMappings = input.inputMappings || [];
    let outputMapping = input.outputMapping;

    if (parsedRawJson && paramsSchema.length === 0) {
      const parsed = WorkflowTemplateParser.parseWorkflowJson(parsedRawJson, input.capability);
      paramsSchema = parsed.paramsSchema;
      inputMappings = inputMappings.length > 0 ? inputMappings : parsed.inputMappings;
      outputMapping = outputMapping || parsed.outputMapping;
    }

    const next: WorkflowTemplate = {
      id,
      name: input.name,
      source: input.source,
      capability: input.capability,
      workflowRef: input.workflowRef,
      webLink: input.webLink,
      rawWorkflowJson: parsedRawJson,
      paramsSchema,
      inputMappings,
      outputMapping,
      description: input.description,
      previewImage: input.previewImage,
      createdAt: existing?.createdAt || now,
      updatedAt: now,
    };

    if (existing) {
      this.templates = this.templates.map((item) => item.id === id ? next : item);
    } else {
      this.templates = [next, ...this.templates];
    }

    this.saveToFile();
    return next;
  }

  public deleteTemplate(id: string): boolean {
    this.loadFromFile();
    const before = this.templates.length;
    this.templates = this.templates.filter((item) => item.id !== id);
    const deleted = this.templates.length !== before;
    if (deleted) this.saveToFile();
    return deleted;
  }

  private loadFromFile() {
    try {
      if (!fs.existsSync(TEMPLATE_PATH)) {
        this.templates = [];
        return;
      }

      const raw = fs.readFileSync(TEMPLATE_PATH, 'utf-8');
      this.templates = raw.trim() ? JSON.parse(raw) : [];
    } catch (err) {
      console.error('[WorkflowTemplateService] Failed to load templates:', err);
      this.templates = [];
    }
  }

  private saveToFile() {
    const dir = path.dirname(TEMPLATE_PATH);
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    fs.writeFileSync(TEMPLATE_PATH, JSON.stringify(this.templates, null, 2), 'utf-8');
  }
}

