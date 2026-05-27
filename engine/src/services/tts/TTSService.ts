import { RunningHubClient, RunningHubNodeInfo } from '../../lib/RunningHubClient.js';
import { SettingsService } from '../settings/SettingsService.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUTS_DIR = path.resolve(__dirname, '../../../data/outputs');

export interface TTSCloneRequest {
  audioBase64?: string;
  characterName: string;
  text?: string; // 台词
  workflowId?: string; // 可选的 ComfyUI 工作流 ID
  providerId?: string; // 选取的第三方音频 API，如 'fishaudio'，'grsai'，'minimax' 等
  model?: string; // 选取的模型，如 's1'，'s3'，'tts-clone-pro' 等
  referenceId?: string; // 新增自定义音色 ID (reference_id)
  mode?: 'direct' | 'comfy'; // 'direct' 表示直接向第三方专用 API 发起 cURL HTTP 请求，'comfy' 表示走 ComfyUI
}

export class TTSService {
  private client: RunningHubClient;
  private defaultWorkflowId = '2029428174693601281';

  constructor(client: RunningHubClient) {
    this.client = client;
    this.ensureOutputsDirectory();
  }

  private ensureOutputsDirectory() {
    if (!fs.existsSync(OUTPUTS_DIR)) {
      fs.mkdirSync(OUTPUTS_DIR, { recursive: true });
    }
  }

  /**
   * 基于角色名称生成固定的防音色抖动 Seed 算法 (自愈种子)
   */
  private getSeedFromCharacterName(name: string): number {
    let hash = 5381;
    for (let i = 0; i < name.length; i++) {
      hash = (hash * 33) ^ name.charCodeAt(i);
    }
    return Math.abs(hash >>> 0);
  }

  /**
   * 声音克隆 (TTS Node) 云端与 Direct API 双驱调用
   */
  public async cloneVoice(req: TTSCloneRequest): Promise<{ taskId: string; seed: number; audioUrl?: string; direct?: boolean }> {
    const { 
      audioBase64 = '', 
      characterName, 
      text = '大家好，我是 Toonflow 声音克隆助理。', 
      workflowId = this.defaultWorkflowId,
      providerId = 'runninghub',
      model,
      referenceId,
      mode = 'comfy' 
    } = req;

    console.log(`[TTSService] 🎙️ Starting voice clone. Character: ${characterName}, Mode: ${mode}, Provider: ${providerId}`);

    const calculatedSeed = this.getSeedFromCharacterName(characterName);

    // ==========================================
    // 模式一：Direct API 专用第三方音频接口流转
    // ==========================================
    if (mode === 'direct' || providerId !== 'runninghub') {
      const settingsService = SettingsService.getInstance();
      const providerConfig = settingsService.getRawProviderConfig(providerId);
      
      const apiKey = providerConfig?.apiKey || '';
      const baseUrl = providerConfig?.baseUrl || '';

      console.log(`[TTSService] 🚀 Direct API flow triggered. BaseUrl: ${baseUrl}`);

      // 提取纯 Base64 (去除 data:audio/mp3;base64, 前缀)
      const cleanBase64 = audioBase64.replace(/^data:audio\/[a-zA-Z0-9]+;base64,/, '');

      try {
        if (providerId === 'fishaudio' || providerId.includes('fish')) {
          // 真实向 Fish Audio 官方 API 发起请求
          // POST https://api.fish.audio/v1/tts
          const cleanUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
          const ttsUrl = cleanUrl.includes('/v1') ? `${cleanUrl}/tts` : `${cleanUrl}/v1/tts`;

          // 核心重构：支持前端友好显示名称（如 fish-speech-1.4）与后端物理 API 真实 ID（s1/s3）的自愈映射自锁
          let finalModel = model || 's3';
          const lowerM = finalModel.toLowerCase();
          if (lowerM.includes('1.4') || lowerM.includes('s1')) {
            finalModel = 's1';
          } else if (lowerM.includes('1.5') || lowerM.includes('s3')) {
            finalModel = 's3';
          }

          console.log(`[TTSService] Sending cURL POST request to Fish Audio: ${ttsUrl}, model: ${finalModel}`);

          // 构建 Fish Audio API 智能负载
          const payload: any = {
            text: text,
            normalize: true,
            format: 'mp3',
            model: finalModel
          };

          if (referenceId && referenceId.trim()) {
            payload.reference_id = referenceId.trim();
            console.log(`[TTSService] Using reference_id (Voice ID): ${referenceId.trim()}`);
          } else if (audioBase64) {
            const cleanBase64 = audioBase64.replace(/^data:audio\/[a-zA-Z0-9]+;base64,/, '');
            payload.reference_audio = cleanBase64;
            console.log(`[TTSService] Using zero-shot reference_audio Base64`);
          } else {
            throw new Error('零样本提示音频 与 声音ID (reference_id) 不能同时为空。');
          }

          const response = await axios.post(ttsUrl, payload, {
            headers: {
              'Authorization': `Bearer ${apiKey}`,
              'Content-Type': 'application/json'
            },
            responseType: 'arraybuffer',
            timeout: 15000
          });

          // 保存生成的音频
          const filename = `tts-${characterName}-${Date.now()}.mp3`;
          const fileBuffer = Buffer.from(response.data);
          const filePath = path.join(OUTPUTS_DIR, filename);
          fs.writeFileSync(filePath, fileBuffer);

          const minioOk = await this.uploadToMinio(filename, fileBuffer);
          const audioUrl = minioOk
            ? `http://localhost:19000/workflows/${filename}`
            : `http://localhost:4000/outputs/${filename}`;
          console.log(`[TTSService] 🎉 Direct Fish Audio voice generated successfully: ${audioUrl}`);

          return {
            taskId: `direct-task-${Date.now()}`,
            seed: calculatedSeed,
            audioUrl: audioUrl,
            direct: true
          };
        } else if (providerId === 'grsai' || providerId === 'minimax') {
          // 其他三方 API Direct 调用
          const response = await axios.post(`${baseUrl}/v1/tts/generate`, {
            text: text,
            voice_ref: audioBase64.replace(/^data:audio\/[a-zA-Z0-9]+;base64,/, ''),
            model: model || 'tts-clone-pro' // 优先使用用户在节点中选中的大模型名字
          }, {
            headers: { 'Authorization': `Bearer ${apiKey}` },
            responseType: 'arraybuffer',
            timeout: 12000
          });

          const filename = `tts-${characterName}-${Date.now()}.mp3`;
          const fileBuffer = Buffer.from(response.data);
          const filePath = path.join(OUTPUTS_DIR, filename);
          fs.writeFileSync(filePath, fileBuffer);

          const minioOk = await this.uploadToMinio(filename, fileBuffer);
          const audioUrl = minioOk
            ? `http://localhost:19000/workflows/${filename}`
            : `http://localhost:4000/outputs/${filename}`;

          return {
            taskId: `direct-task-${Date.now()}`,
            seed: calculatedSeed,
            audioUrl: audioUrl,
            direct: true
          };
        }
      } catch (err: any) {
        console.error(`[TTSService] Direct API 调用失败: ${err.message}`);
        throw err;
      }
    }

    // ==========================================
    // 模式二：RunningHub / ComfyUI 工作流灌参流转
    // ==========================================
    const cloudFileName = await this.client.uploadReference(audioBase64, 'audio');
    console.log(`[TTSService] 💾 Reference audio uploaded to RunningHub: ${cloudFileName}`);

    const nodeInfoList: RunningHubNodeInfo[] = [
      { nodeId: '20', fieldName: 'audio', fieldValue: cloudFileName },
      { nodeId: '331', fieldName: 'audio', fieldValue: cloudFileName },
      { nodeId: '24', fieldName: 'text', fieldValue: characterName },
      { nodeId: '14', fieldName: 'seed', fieldValue: calculatedSeed }
    ];

    const taskId = await this.client.createTask(workflowId, nodeInfoList);
    console.log(`[TTSService] 🚀 RunningHub Task created successfully: ${taskId}`);

    return { taskId, seed: calculatedSeed };
  }

  /**
   * 获取克隆任务生成的音频 URL
   */
  public async getClonedAudioResult(taskId: string): Promise<{ status: string; audioUrl?: string }> {
    // 如果是 Direct API 瞬间完成的任务，直接返回已存的 URL
    if (taskId.startsWith('direct-task-')) {
      return { status: 'SUCCESS' }; 
    }

    const status = await this.client.getTaskStatus(taskId);
    if (status === 'SUCCESS') {
      const cloudAudioUrl = await this.client.getTaskOutputs(taskId);
      const persistedUrl = await this.downloadAndPersist(cloudAudioUrl);
      return { status, audioUrl: persistedUrl };
    }
    return { status };
  }

  /**
   * 极简 MinIO 上传逻辑，将音频同步注入 19000 端口的对象存储中
   */
  private async uploadToMinio(filename: string, buffer: Buffer): Promise<boolean> {
    try {
      let mimeType = 'audio/mpeg';
      if (filename.endsWith('.wav')) {
        mimeType = 'audio/wav';
      }
      console.log(`[MinIO Linkage] 📦 [TTS] 正在同步分发 ${filename} 到本地 MinIO 存储桶...`);
      await axios.put(`http://localhost:19000/workflows/${filename}`, buffer, {
        headers: {
          'Content-Type': mimeType
        },
        timeout: 5000
      });
      console.log(`[MinIO Linkage] 🎉 [TTS] 物理分发成功！MinIO 地址: http://localhost:19000/workflows/${filename}`);
      return true;
    } catch (e: any) {
      console.warn(`[MinIO Linkage] ⚠️ [TTS] 同步到 MinIO 失败 (降级由本地静态服务接管): ${e.message}`);
      return false;
    }
  }

  /**
   * 下载云端音频文件并物理存盘 + 上传 MinIO
   */
  private async downloadAndPersist(cloudUrl: string): Promise<string> {
    try {
      console.log(`[TTSService] 💾 [MinIO Linkage] 正在从云端下载生成的音频... ${cloudUrl}`);
      const response = await axios({
        method: 'get',
        url: cloudUrl,
        responseType: 'arraybuffer',
        timeout: 30000
      });
      const fileBuffer = Buffer.from(response.data);
      const ext = path.extname(new URL(cloudUrl).pathname) || '.mp3';
      const filename = `tts-rh-${Date.now()}-${Math.floor(Math.random() * 10000)}${ext}`;
      const filePath = path.join(OUTPUTS_DIR, filename);
      
      fs.writeFileSync(filePath, fileBuffer);
      console.log(`[TTSService] 📁 文件物理落地成功: ${filePath}`);

      const minioOk = await this.uploadToMinio(filename, fileBuffer);
      if (minioOk) {
        return `http://localhost:19000/workflows/${filename}`;
      } else {
        return `http://localhost:4000/outputs/${filename}`;
      }
    } catch (e: any) {
      console.error(`[TTSService] ⚠️ 下载/存储音频发生异常: ${e.message}`);
      return cloudUrl;
    }
  }
}
