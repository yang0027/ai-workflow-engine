import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { CustomWorkflowPayload, InputMapping } from '../types.js';
import { SettingsService } from '../../settings/SettingsService.js';
import { RunningHubClient, RunningHubNodeInfo } from '../../../lib/RunningHubClient.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 存放生成文件的静态目录
const OUTPUT_DIR = path.resolve(__dirname, '../../../../data/outputs');

export class RunningHubAdapter {
  private settingsService: SettingsService;

  constructor() {
    this.settingsService = SettingsService.getInstance();
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
  }

  /**
   * 核心：执行云端 RunningHub 自定义工作流并智能灌参
   */
  public async executeCustomWorkflow(payload: CustomWorkflowPayload): Promise<string> {
    console.log('[RunningHubAdapter] ⚡ 开始执行云端 RunningHub 自定义工作流...');

    // 1. 获取 RunningHub API Key
    const config = this.settingsService.getRawProviderConfig('runninghub');
    if (!config || !config.apiKey || !config.enabled) {
      throw new Error('云端 RunningHub 未配置或未启用。请先在全局设置面板中配置 RunningHub API Key 并勾选开启。');
    }

    const client = new RunningHubClient({
      apiKey: config.apiKey,
      baseUrl: config.baseUrl
    });

    const workflowId = payload.workflowIdOrJson;
    if (!workflowId) {
      throw new Error('RunningHub 运行所需的工作流 ID 不能为空。');
    }

    // 2. 组装输入映射参数为 nodeInfoList
    const nodeInfoList: RunningHubNodeInfo[] = [];

    for (const map of payload.mappings) {
      const value = payload.inputs[map.portId];
      if (value === undefined) {
        console.warn(`[RunningHubAdapter] ⚠️ 端口 ${map.portId} 连线未传入数据，跳过灌参`);
        continue;
      }

      // 如果数据是 base64 类型（例如前级生图输出直接是 base64），
      // 我们需要通过 RunningHub 客户端先把资源上传到云端媒体服务器，得到云端文件名
      let fieldValue = value;
      if (typeof value === 'string' && (value.startsWith('data:') || value.length > 5000)) {
        console.log(`[RunningHubAdapter] 📤 检测到大文本或 Base64 资源，正在自动上传云端媒体暂存...`);
        try {
          const type = value.includes('audio') ? 'audio' : 'image';
          fieldValue = await client.uploadReference(value, type);
          console.log(`[RunningHubAdapter] 🎉 上传暂存成功，获得云端文件名: ${fieldValue}`);
        } catch (e: any) {
          throw new Error(`RunningHub 上传资源媒体失败: ${e.message}`);
        }
      }

      console.log(`[RunningHubAdapter] ⚙️ 组装参数: 节点 ${map.nodeId} [${map.fieldName}] = ${fieldValue}`);
      nodeInfoList.push({
        nodeId: map.nodeId,
        fieldName: map.fieldName,
        fieldValue: fieldValue
      });
    }

    // 3. 发送任务创建请求 (升级为 v2 规范)
    let taskId = '';
    try {
      console.log('[RunningHubAdapter] 📤 nodeInfoList 送检数据:', JSON.stringify(nodeInfoList, null, 2));
      taskId = await client.createTaskV2(workflowId, nodeInfoList);
      console.log(`[RunningHubAdapter] 🚀 任务创建成功 (v2)，RunningHub Task ID: ${taskId}`);
    } catch (e: any) {
      const debugInfo = `\n[调试送检参数]: ${JSON.stringify(nodeInfoList)}`;
      throw new Error(`RunningHub 任务创建失败: ${e.message}${debugInfo}`);
    }

    // 4. 轮询任务状态与直接获取生成文件链接 (OpenAPI v2 规范)
    console.log(`[RunningHubAdapter] ⏳ 启动任务状态轮询...`);
    let isSuccess = false;
    let cloudFileUrl = '';
    const maxPolls = 100; // 最多轮询 100 次
    for (let i = 0; i < maxPolls; i++) {
      await new Promise((resolve) => setTimeout(resolve, 2000));
      try {
        const taskRes = await client.getTaskStatusV2(taskId);
        console.log(`[RunningHubAdapter] 📊 任务 ${taskId} 状态: ${taskRes.status}, 进度: ${taskRes.progress}%`);
        
        if (taskRes.status === 'SUCCESS') {
          isSuccess = true;
          // 从 images 列表中获取第一个图片下载链接
          const outputImg = taskRes.images?.[0];
          if (!outputImg?.downloadUrl) {
            throw new Error('RunningHub 任务成功但未能在响应中解析到有效的输出媒体 URL。');
          }
          cloudFileUrl = outputImg.downloadUrl;
          console.log(`[RunningHubAdapter] 🎉 成功获取云端生成媒体链接: ${cloudFileUrl}`);
          break;
        }
        if (taskRes.status === 'FAILED' || taskRes.status === 'ERROR') {
          throw new Error('RunningHub 任务在云端执行失败或超时。');
        }
      } catch (e: any) {
        console.warn(`[RunningHubAdapter] ⚠️ 轮询状态异常: ${e.message}`);
        // 如果是抛出执行失败的错误，直接向上抛出
        if (e.message.includes('执行失败')) {
          throw e;
        }
      }
    }

    if (!isSuccess || !cloudFileUrl) {
      throw new Error(`RunningHub 任务轮询超时，未能在预定时间内生成结果或提取链接。`);
    }


    // 6. 下载该文件并物理存盘到本地
    console.log(`[RunningHubAdapter] 💾 正在下载生成文件到本地...`);
    let downloadedUrl = '';
    try {
      const response = await axios({
        method: 'get',
        url: cloudFileUrl,
        responseType: 'arraybuffer',
        timeout: 60000
      });

      const fileBuffer = Buffer.from(response.data);
      const ext = path.extname(new URL(cloudFileUrl).pathname) || '.png';
      const uniqueName = `runninghub-${Date.now()}-${Math.floor(Math.random() * 10000)}${ext}`;
      const targetPath = path.resolve(OUTPUT_DIR, uniqueName);

      fs.writeFileSync(targetPath, fileBuffer);
      console.log(`[RunningHubAdapter] 📁 文件物理落地成功: ${targetPath}`);

      // 7. 同步联动上传到本地 MinIO
      const minioOk = await this.uploadToMinio(uniqueName, fileBuffer);
      if (minioOk) {
        downloadedUrl = `http://localhost:19000/workflows/${uniqueName}`;
      } else {
        downloadedUrl = `http://localhost:4000/outputs/${uniqueName}`;
      }
    } catch (e: any) {
      console.error(`[RunningHubAdapter] 下载或存储输出文件发生异常: ${e.message}`);
      // 容错：降级直接返回云端链接
      downloadedUrl = cloudFileUrl;
    }

    return downloadedUrl;
  }

  /**
   * 极简 MinIO 上传逻辑，将生成结果同步注入 19000 端口的对象存储中
   */
  private async uploadToMinio(filename: string, buffer: Buffer): Promise<boolean> {
    try {
      let mimeType = 'image/png';
      if (filename.endsWith('.mp4')) {
        mimeType = 'video/mp4';
      } else if (filename.endsWith('.mp3')) {
        mimeType = 'audio/mpeg';
      } else if (filename.endsWith('.wav')) {
        mimeType = 'audio/wav';
      }
      console.log(`[MinIO Linkage] 📦 正在同步分发 ${filename} 到本地 MinIO 存储桶...`);
      await axios.put(`http://localhost:19000/workflows/${filename}`, buffer, {
        headers: {
          'Content-Type': mimeType
        },
        timeout: 5000
      });
      console.log(`[MinIO Linkage] 🎉 物理分发成功！MinIO 地址: http://localhost:19000/workflows/${filename}`);
      return true;
    } catch (e: any) {
      console.warn(`[MinIO Linkage] ⚠️ 同步到 MinIO 失败 (降级由本地静态服务接管): ${e.message}`);
      return false;
    }
  }
}
