import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import { CustomWorkflowPayload, InputMapping } from '../types.js';
import { SettingsService } from '../../settings/SettingsService.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 存放生成文件的静态目录
const OUTPUT_DIR = path.resolve(__dirname, '../../../../data/outputs');

export class ComfyUIAdapter {
  private settingsService: SettingsService;

  constructor() {
    this.settingsService = SettingsService.getInstance();
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }
  }

  /**
   * 负载均衡：获取目前在线且健康的 ComfyUI 实例
   */
  private async getHealthyInstance(): Promise<string> {
    const settings = this.settingsService.getSettings();
    const instances = settings.comfyui_instances || ['127.0.0.1:8188'];

    for (const addr of instances) {
      try {
        const host = addr.startsWith('http') ? addr : `http://${addr}`;
        const res = await axios.get(`${host}/system_stats`, { timeout: 1500 });
        if (res.status === 200) {
          return addr; // 返回第一个健康的实例
        }
      } catch (e) {
        console.warn(`[ComfyUIAdapter] ⚠️ 实例 ${addr} 离线，正在轮询下一个...`);
      }
    }
    throw new Error('当前无可用的 ComfyUI 本地实例，请先在设置面板中添加并启动。');
  }

  /**
   * 核心：执行自定义 ComfyUI 工作流并智能灌参
   */
  public async executeCustomWorkflow(payload: CustomWorkflowPayload): Promise<string> {
    console.log('[ComfyUIAdapter] ⚡ 开始执行本地 ComfyUI 自定义工作流...');

    // 1. 获取健康实例
    const activeAddress = await this.getHealthyInstance();
    const host = activeAddress.startsWith('http') ? activeAddress : `http://${activeAddress}`;

    // 2. 解析工作流 JSON 字符串
    let workflowJson: any;
    try {
      workflowJson = typeof payload.workflowIdOrJson === 'string'
        ? JSON.parse(payload.workflowIdOrJson)
        : payload.workflowIdOrJson;
    } catch (e) {
      throw new Error(`解析 ComfyUI 工作流 JSON 失败，请确保格式为 API 格式: ${e}`);
    }

    // 3. 动态灌参：遍历 mappings
    payload.mappings.forEach((map: InputMapping) => {
      const value = payload.inputs[map.portId];
      if (value === undefined) {
        console.warn(`[ComfyUIAdapter] ⚠️ 端口 ${map.portId} 连线未传入数据，使用工作流默认值`);
        return;
      }

      // 递归寻找节点
      const targetNode = workflowJson[map.nodeId];
      if (!targetNode) {
        throw new Error(`工作流 JSON 中找不到映射指定的节点 ID: ${map.nodeId}`);
      }

      if (!targetNode.inputs) {
        targetNode.inputs = {};
      }

      // 强力覆写参数
      console.log(`[ComfyUIAdapter] ⚙️ 正在灌参: 节点 ${map.nodeId} [${map.fieldName}] = ${value}`);
      targetNode.inputs[map.fieldName] = value;
    });

    // 4. 提交任务到 ComfyUI
    let promptId = '';
    try {
      const response = await axios.post(`${host}/prompt`, {
        prompt: workflowJson
      });
      if (response.data && response.data.prompt_id) {
        promptId = response.data.prompt_id;
        console.log(`[ComfyUIAdapter] 🚀 任务提交成功，ComfyUI Prompt ID: ${promptId}`);
      } else {
        throw new Error(JSON.stringify(response.data));
      }
    } catch (e: any) {
      throw new Error(`ComfyUI /prompt 提交失败: ${e.message}`);
    }

    // 5. 轮询 `/history/{promptId}`
    console.log(`[ComfyUIAdapter] ⏳ 启动状态轮询...`);
    let outputs: any = null;
    const maxPolls = 120; // 最多轮询 2 分钟
    for (let i = 0; i < maxPolls; i++) {
      await new Promise((resolve) => setTimeout(resolve, 1500));
      try {
        const historyRes = await axios.get(`${host}/history/${promptId}`);
        const historyData = historyRes.data;
        
        if (historyData && historyData[promptId]) {
          console.log(`[ComfyUIAdapter] 🎉 ComfyUI 任务渲染成功！开始解析输出。`);
          outputs = historyData[promptId].outputs;
          break;
        }
      } catch (e: any) {
        console.warn(`[ComfyUIAdapter] ⚠️ 轮询历史失败一次: ${e.message}`);
      }
    }

    if (!outputs) {
      throw new Error(`ComfyUI 任务轮询超时或执行失败，请检查本地 ComfyUI 控制台输出。`);
    }

    // 6. 解析 outputs 文件并进行物理下载存盘
    let downloadedUrl = '';
    const nodeIds = Object.keys(outputs);
    for (const nodeId of nodeIds) {
      const nodeOutput = outputs[nodeId];
      // 兼容图片及视频输出节点
      const files = nodeOutput.images || nodeOutput.gifs || nodeOutput.videos || [];
      if (files.length > 0) {
        const file = files[0];
        const filename = file.filename;
        const subfolder = file.subfolder || '';
        const type = file.type || 'output';

        // 构造 ComfyUI 的文件视图路径
        const viewUrl = `${host}/view?filename=${encodeURIComponent(filename)}&subfolder=${encodeURIComponent(subfolder)}&type=${encodeURIComponent(type)}`;
        console.log(`[ComfyUIAdapter] 💾 发现生成文件: ${filename}，开始物理拉取存盘...`);

        // 执行流下载
        const downloadResponse = await axios({
          method: 'get',
          url: viewUrl,
          responseType: 'arraybuffer'
        });

        const fileBuffer = Buffer.from(downloadResponse.data);
        
        // 采用 UUID 防止重名冲突
        const ext = path.extname(filename) || '.png';
        const uniqueName = `comfy-${Date.now()}-${Math.floor(Math.random() * 10000)}${ext}`;
        const targetPath = path.resolve(OUTPUT_DIR, uniqueName);
        
        fs.writeFileSync(targetPath, fileBuffer);
        console.log(`[ComfyUIAdapter] 📁 文件物理落地成功: ${targetPath}`);

        // 7. 物理联动：同步上传到 MinIO 的 workflows 桶中
        await this.uploadToMinio(uniqueName, fileBuffer);

        downloadedUrl = `http://localhost:4000/outputs/${uniqueName}`;
        break; // 只要解析到第一个有效的输出即可
      }
    }

    if (!downloadedUrl) {
      throw new Error('ComfyUI 任务已完成，但未在任何节点发现输出文件。');
    }

    return downloadedUrl;
  }

  /**
   * 极简 MinIO 上传逻辑，将生成结果同步注入 19000 端口的对象存储中
   */
  private async uploadToMinio(filename: string, buffer: Buffer) {
    try {
      // 1. 尝试初始化/确保 workflows 桶存在 (匿名 PUT 上传在 MinIO 中如果桶不存在会报 404)
      // 我们在网关或后端以标准 PUT 传输到 MinIO 19000
      // 默认 MinIO 的账户是 minioadmin/minioadmin
      const mimeType = filename.endsWith('.mp4') ? 'video/mp4' : 'image/png';
      
      console.log(`[MinIO Linkage] 📦 正在同步分发 ${filename} 到本地 MinIO 存储桶...`);
      await axios.put(`http://localhost:19000/workflows/${filename}`, buffer, {
        headers: {
          'Content-Type': mimeType
        },
        timeout: 3000
      });
      console.log(`[MinIO Linkage] 🎉 物理分发成功！MinIO 地址: http://localhost:19000/workflows/${filename}`);
    } catch (e: any) {
      // 容错降级：如果 MinIO 未拉起或未配置 Bucket，不阻塞整体画布引擎
      console.warn(`[MinIO Linkage] ⚠️ 同步到 MinIO 失败 (降级由本地静态服务接管): ${e.message}`);
    }
  }
}
