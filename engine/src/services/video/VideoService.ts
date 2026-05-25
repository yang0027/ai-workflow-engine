import { RunningHubClient, RunningHubNodeInfo } from '../../lib/RunningHubClient.js';
import { SettingsService } from '../settings/SettingsService.js';
import axios from 'axios';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const OUTPUTS_DIR = path.resolve(__dirname, '../../../data/outputs');

export interface VideoFusionRequest {
  imageBase64: string;      // 前级渲染图 (Base64)
  audioBase64: string;      // 克隆配音音频 (Base64)
  width?: number;           // 画幅宽度
  height?: number;          // 画幅高度
  duration?: number;        // 时长 (秒)
  workflowId?: string;      // ComfyUI 工作流 ID
  providerId?: string;      // 视频 API 服务商，如 'grsai'，'runninghub'
  mode?: 'direct' | 'comfy';
}

interface DirectTaskInfo {
  taskId: string;
  providerId: string;
  baseUrl: string;
  apiKey: string;
  status: 'PENDING' | 'SUCCESS' | 'FAILED';
  videoUrl?: string;
  error?: string;
}

export class VideoService {
  private client: RunningHubClient;
  private defaultWorkflowId = '2047974142976204801';
  
  // 用于内存中维护 Direct API 异步视频任务状态与服务商绑定关系
  private directTasks: Map<string, DirectTaskInfo> = new Map();

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
   * 视频融合 (Video Node) 异步任务拉起
   */
  public async fuseVideo(req: VideoFusionRequest): Promise<{ taskId: string; direct?: boolean; videoUrl?: string }> {
    const {
      imageBase64,
      audioBase64,
      width = 512,
      height = 512,
      duration = 5,
      workflowId = this.defaultWorkflowId,
      providerId = 'runninghub',
      mode = 'comfy',
    } = req;

    console.log(`[VideoService] 📹 Initiating video. Mode: ${mode}, Provider: ${providerId}, Size: ${width}x${height}`);

    // ==========================================
    // 模式一：Direct API 专用视频生成接口流转
    // ==========================================
    if (mode === 'direct' || providerId !== 'runninghub') {
      const settingsService = SettingsService.getInstance();
      const providerConfig = settingsService.getRawProviderConfig(providerId);

      const apiKey = providerConfig?.apiKey || '';
      const baseUrl = providerConfig?.baseUrl || '';

      console.log(`[VideoService] 🚀 Direct API Video triggered for ${providerId}`);

      try {
        if (providerId === 'grsai') {
          // 完美还原 Toonflow 官方 vendor 物理适配 grsai.ts 里的 cURL API
          const cleanUrl = baseUrl.endsWith('/') ? baseUrl.slice(0, -1) : baseUrl;
          const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${apiKey.replace(/^Bearer\s+/i, '')}`
          };

          const requestBody = {
            model: 'doubao-seedance-1-5-pro-251215', // Grsai 支持的视频模型
            prompt: 'An elegant cinematic video flow.',
            aspectRatio: width > height ? '16:9' : '9:16',
            firstFrameUrl: imageBase64,
            webHook: '-1',
            shutProgress: true
          };

          const submitResp = await axios.post(`${cleanUrl}/v1/video/veo`, requestBody, { headers });
          
          if (submitResp.data.code === 0 && submitResp.data.data?.id) {
            const taskId = submitResp.data.data.id;
            this.directTasks.set(taskId, {
              taskId,
              providerId,
              baseUrl: cleanUrl,
              apiKey,
              status: 'PENDING'
            });
            console.log(`[VideoService] Direct task successfully submitted: ${taskId}`);
            return { taskId, direct: true };
          } else {
            throw new Error(submitResp.data.msg || 'Grsai 任务提交接口未返回有效 id');
          }
        }
      } catch (err: any) {
        console.error(`[VideoService] Direct API video submission failed: ${err.message}`);
        throw err;
      }
    }

    // ==========================================
    // 模式二：RunningHub / ComfyUI 工作流灌参流转
    // ==========================================
    const cloudImageName = await this.client.uploadReference(imageBase64, 'image');
    const cloudAudioName = await this.client.uploadReference(audioBase64, 'audio');

    console.log(`[VideoService] 💾 Image reference uploaded: ${cloudImageName}`);
    console.log(`[VideoService] 💾 Audio reference uploaded: ${cloudAudioName}`);

    const nodeInfoList: RunningHubNodeInfo[] = [
      { nodeId: '269', fieldName: 'image', fieldValue: cloudImageName },
      { nodeId: '447', fieldName: 'audio', fieldValue: cloudAudioName },
      { nodeId: '314', fieldName: 'value', fieldValue: width },
      { nodeId: '299', fieldName: 'value', fieldValue: height },
      { nodeId: '427', fieldName: 'value', fieldValue: duration },
    ];

    const taskId = await this.client.createTask(workflowId, nodeInfoList);
    console.log(`[VideoService] 🚀 RunningHub Video Fusion Task created: ${taskId}`);

    return { taskId };
  }

  /**
   * 查询视频融合的生成状态与最终视频 URL
   */
  public async getVideoResult(taskId: string): Promise<{ status: string; videoUrl?: string }> {
    // 1. 如果属于 Direct Tasks
    if (this.directTasks.has(taskId)) {
      const taskInfo = this.directTasks.get(taskId)!;
      
      if (taskInfo.status === 'SUCCESS' || taskInfo.status === 'FAILED') {
        return { 
          status: taskInfo.status, 
          videoUrl: taskInfo.videoUrl 
        };
      }

      // 如果是 Grsai，进行轮询查询
      try {
        if (taskInfo.providerId === 'grsai') {
          const headers = {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${taskInfo.apiKey.replace(/^Bearer\s+/i, '')}`
          };
          
          const resp = await axios.post(`${taskInfo.baseUrl}/v1/draw/result`, { id: taskId }, { headers });
          if (resp.data.code === 0 && resp.data.data) {
            const taskData = resp.data.data;
            if (taskData.status === 'succeeded') {
              const persistedUrl = await this.downloadAndPersist(taskData.url);
              taskInfo.status = 'SUCCESS';
              taskInfo.videoUrl = persistedUrl;
              this.directTasks.set(taskId, taskInfo);
              return { status: 'SUCCESS', videoUrl: persistedUrl };
            } else if (taskData.status === 'failed') {
              taskInfo.status = 'FAILED';
              taskInfo.error = taskData.failure_reason || 'Video generation failed';
              this.directTasks.set(taskId, taskInfo);
              return { status: 'FAILED' };
            }
          }
        }
      } catch (err: any) {
        console.error(`[VideoService] Error polling direct task status: ${err.message}`);
      }

      return { status: 'RUNNING' };
    }

    // 2. 正常走 RunningHub 流程
    const status = await this.client.getTaskStatus(taskId);
    if (status === 'SUCCESS') {
      const cloudVideoUrl = await this.client.getTaskOutputs(taskId);
      const persistedUrl = await this.downloadAndPersist(cloudVideoUrl);
      return { status, videoUrl: persistedUrl };
    }
    return { status };
  }

  /**
   * 极极简 MinIO 上传逻辑，将视频同步注入 19000 端口的对象存储中
   */
  private async uploadToMinio(filename: string, buffer: Buffer): Promise<boolean> {
    try {
      const mimeType = 'video/mp4';
      console.log(`[MinIO Linkage] 📦 [Video] 正在同步分发 ${filename} 到本地 MinIO 存储桶...`);
      await axios.put(`http://localhost:19000/workflows/${filename}`, buffer, {
        headers: {
          'Content-Type': mimeType
        },
        timeout: 5000
      });
      console.log(`[MinIO Linkage] 🎉 [Video] 物理分发成功！MinIO 地址: http://localhost:19000/workflows/${filename}`);
      return true;
    } catch (e: any) {
      console.warn(`[MinIO Linkage] ⚠️ [Video] 同步到 MinIO 失败 (降级由本地静态服务接管): ${e.message}`);
      return false;
    }
  }

  /**
   * 下载云端视频文件并物理存盘 + 上传 MinIO
   */
  private async downloadAndPersist(cloudUrl: string): Promise<string> {
    try {
      console.log(`[VideoService] 💾 [MinIO Linkage] 正在从云端下载生成的视频... ${cloudUrl}`);
      const response = await axios({
        method: 'get',
        url: cloudUrl,
        responseType: 'arraybuffer',
        timeout: 60000
      });
      const fileBuffer = Buffer.from(response.data);
      const ext = path.extname(new URL(cloudUrl).pathname) || '.mp4';
      const filename = `video-rh-${Date.now()}-${Math.floor(Math.random() * 10000)}${ext}`;
      const filePath = path.join(OUTPUTS_DIR, filename);
      
      fs.writeFileSync(filePath, fileBuffer);
      console.log(`[VideoService] 📁 文件物理落地成功: ${filePath}`);

      const minioOk = await this.uploadToMinio(filename, fileBuffer);
      if (minioOk) {
        return `http://localhost:19000/workflows/${filename}`;
      } else {
        return `http://localhost:4000/outputs/${filename}`;
      }
    } catch (e: any) {
      console.error(`[VideoService] ⚠️ 下载/存储视频发生异常: ${e.message}`);
      return cloudUrl;
    }
  }
}
