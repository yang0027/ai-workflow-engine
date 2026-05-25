import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const SKILLS_DIR = path.resolve(__dirname, '../../../data/skills');

export interface Skill {
  id: string;
  name: string;
  description: string;
  type: 'chat' | 'image' | 'tts' | 'video';
  systemPrompt: string;
}

export class SkillsService {
  private static instance: SkillsService;

  private constructor() {
    this.ensureSkillsDirectory();
  }

  public static getInstance(): SkillsService {
    if (!SkillsService.instance) {
      SkillsService.instance = new SkillsService();
    }
    return SkillsService.instance;
  }

  private ensureSkillsDirectory() {
    try {
      if (!fs.existsSync(SKILLS_DIR)) {
        fs.mkdirSync(SKILLS_DIR, { recursive: true });
      }

      // 写入默认的出厂 Skills
      const defaultSkills: Skill[] = [
        {
          id: 'storyboard-expert',
          name: '📖 剧本分镜专家',
          description: '基于输入剧本，自动分析分镜头正反词与分镜脚本',
          type: 'chat',
          systemPrompt: '你是一位世界级的短剧分镜导演与剧本专家。请基于用户输入的小说/剧本，分析出每一个镜头的关键要素，包括：镜头序号、画面描述（英文提示词，适合Flux/SD生图）、正向词、反向词、角色参考以及镜头时长、配音台词。'
        },
        {
          id: 'flux-character',
          name: '🎨 Flux 塑角专家',
          description: '基于提示词与角色参考生成镜头画面，确保角色外貌与画风一致性',
          type: 'image',
          systemPrompt: 'You are a professional Flux/SD image prompter. Enhance the input prompt to generate state-of-the-art cinematic quality, focusing on photorealistic facial features, high-fidelity textures, and consistent character aesthetics based on standard facial references. Use terms like: cinematic lighting, 8k resolution, detailed skin texture, hyper-detailed, masterpiece.'
        },
        {
          id: 'tts-tone',
          name: '🗣️ 音频语气控制',
          description: 'RunningHub/Direct API 音色一致性配音与语气情感克隆控制',
          type: 'tts',
          systemPrompt: '配音语气控制：请在生成台词配音时，注意维持音色的一致性与语气的抑扬顿挫，情感需要饱满且贴合当前镜头的戏剧冲突。'
        }
      ];

      for (const skill of defaultSkills) {
        const filePath = path.join(SKILLS_DIR, `${skill.id}.json`);
        if (!fs.existsSync(filePath)) {
          fs.writeFileSync(filePath, JSON.stringify(skill, null, 2), 'utf-8');
        }
      }
    } catch (e) {
      console.error('[SkillsService] 确保技能目录和默认配置自举失败:', e);
    }
  }

  public getSkills(): Skill[] {
    this.ensureSkillsDirectory();
    try {
      const files = fs.readdirSync(SKILLS_DIR);
      const skills: Skill[] = [];
      for (const file of files) {
        if (file.endsWith('.json')) {
          const content = fs.readFileSync(path.join(SKILLS_DIR, file), 'utf-8');
          skills.push(JSON.parse(content));
        }
      }
      return skills;
    } catch (e) {
      console.error('[SkillsService] 获取技能列表失败:', e);
      return [];
    }
  }

  public getSkillById(id: string): Skill | null {
    try {
      const filePath = path.join(SKILLS_DIR, `${id}.json`);
      if (fs.existsSync(filePath)) {
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content);
      }
    } catch (e) {
      console.error(`[SkillsService] 获取技能 ${id} 失败:`, e);
    }
    return null;
  }

  public saveSkill(skill: Skill) {
    this.ensureSkillsDirectory();
    try {
      const filePath = path.join(SKILLS_DIR, `${skill.id}.json`);
      fs.writeFileSync(filePath, JSON.stringify(skill, null, 2), 'utf-8');
    } catch (e) {
      console.error(`[SkillsService] 保存技能 ${skill.id} 失败:`, e);
      throw e;
    }
  }

  public deleteSkill(id: string) {
    try {
      const filePath = path.join(SKILLS_DIR, `${id}.json`);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (e) {
      console.error(`[SkillsService] 删除技能 ${id} 失败:`, e);
      throw e;
    }
  }
}
