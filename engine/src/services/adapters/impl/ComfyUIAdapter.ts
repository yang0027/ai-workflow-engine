import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import axios from 'axios';
import FormData from 'form-data';
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
   * 将图片数据上传到 ComfyUI
   * @param host ComfyUI 主机地址
   * @param imageData base64 data URL 或 Buffer
   * @param filename 文件名
   * @returns ComfyUI 文件名
   */
  private async uploadImageToComfyUI(host: string, imageData: string | Buffer, filename: string): Promise<string> {
    let buffer: Buffer;
    let contentType = 'image/png';

    // 处理 base64 data URL
    if (typeof imageData === 'string') {
      if (imageData.startsWith('data:')) {
        const match = imageData.match(/^data:([^;]+);base64,(.+)$/);
        if (match) {
          contentType = match[1];
          buffer = Buffer.from(match[2], 'base64');
        } else {
          throw new Error('无效的 base64 图片格式');
        }
      } else if (imageData.startsWith('http')) {
        // 如果是 URL，先下载
        const response = await axios.get(imageData, { responseType: 'arraybuffer' });
        buffer = Buffer.from(response.data);
        contentType = String(response.headers['content-type'] || 'image/png');
      } else {
        throw new Error('不支持的图片格式');
      }
    } else {
      buffer = imageData;
    }

    // 确保文件名有正确的扩展名
    const extMap: Record<string, string> = {
      'image/png': '.png',
      'image/jpeg': '.jpg',
      'image/webp': '.webp',
      'image/jpg': '.jpg'
    };
    const ext = extMap[contentType] || path.extname(filename) || '.png';
    const safeFilename = path.basename(filename, path.extname(filename)) + ext;

    // 使用 form-data 上传
    const formData = new FormData();
    formData.append('image', buffer, {
      filename: safeFilename,
      contentType: contentType
    });

    const response = await axios.post(`${host}/upload/image`, formData, {
      headers: formData.getHeaders(),
      timeout: 30000
    });

    if (response.data && response.data.name) {
      console.log(`[ComfyUIAdapter] 📤 图片已上传到 ComfyUI: ${response.data.name}`);
      return response.data.name;
    }

    throw new Error(`上传图片到 ComfyUI 失败: ${JSON.stringify(response.data)}`);
  }

  /**
   * 处理图片输入值
   * @param host ComfyUI 主机地址
   * @param value 输入值 (db://, data:, http://, 或 ComfyUI 文件名)
   * @returns ComfyUI 可识别的文件名
   */
  private async resolveImageInput(host: string, value: any): Promise<string> {
    if (typeof value !== 'string' || !value) {
      return value;
    }

    // 如果已经是 ComfyUI 文件名（不含特殊协议），直接返回
    if (value.match(/\.(png|jpg|jpeg|webp|gif)$/i) && !value.startsWith('db://') && !value.startsWith('data:')) {
      return value;
    }

    // 如果是 db:// 协议或 data: URL 或其他 URL，需要上传到 ComfyUI
    if (value.startsWith('db://') || value.startsWith('data:') || value.startsWith('http')) {
      const timestamp = Date.now();
      const filename = `canvas_${timestamp}.png`;
      try {
        return await this.uploadImageToComfyUI(host, value, filename);
      } catch (err: any) {
        console.warn(`[ComfyUIAdapter] ⚠️ 图片上传失败: ${err.message}，使用原始值`);
        return value;
      }
    }

    return value;
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

    // 3. 动态灌参：遍历 mappings，处理图片上传
    for (const map of payload.mappings) {
      let value = payload.inputs[map.portId];
      if (value === undefined || value === '') {
        console.warn(`[ComfyUIAdapter] ⚠️ 端口 ${map.portId} 未传入数据，使用工作流默认值`);
        continue;
      }

      // 检查是否是图片类型的字段
      const fieldNameLower = (map.fieldName || '').toLowerCase();
      const isImageField = fieldNameLower.includes('image') || fieldNameLower.includes('img') || fieldNameLower.includes('pic');

      // 如果是图片字段，需要上传到 ComfyUI
      if (isImageField) {
        try {
          value = await this.resolveImageInput(host, value);
          console.log(`[ComfyUIAdapter] 📤 图片已处理: ${map.portId} -> ${value}`);
        } catch (err: any) {
          console.warn(`[ComfyUIAdapter] ⚠️ 图片处理失败: ${err.message}`);
        }
      }

      // 寻找节点
      const targetNode = workflowJson[map.nodeId];
      if (!targetNode) {
        console.warn(`[ComfyUIAdapter] ⚠️ 工作流 JSON 中找不到节点 ID: ${map.nodeId}`);
        continue;
      }

      if (!targetNode.inputs) {
        targetNode.inputs = {};
      }

      // 强力覆写参数
      const displayValue = typeof value === 'string' && value.length > 100 ? value.substring(0, 100) + '...' : value;
      console.log(`[ComfyUIAdapter] ⚙️ 灌参: 节点 ${map.nodeId} [${map.fieldName}] = ${displayValue}`);
      targetNode.inputs[map.fieldName] = value;
    }

    // 4. 提交任务到 ComfyUI
    let promptId = '';
    try {
      console.log('[ComfyUIAdapter] 📋 提交到 ComfyUI 的工作流:', JSON.stringify(workflowJson).substring(0, 500) + '...');
      const response = await axios.post(`${host}/prompt`, {
        prompt: workflowJson
      });
      if (response.data && response.data.prompt_id) {
        promptId = response.data.prompt_id;
        console.log(`[ComfyUIAdapter] 🚀 任务提交成功，Prompt ID: ${promptId}`);
      } else {
        throw new Error(JSON.stringify(response.data));
      }
    } catch (e: any) {
      const errorDetail = e.response?.data || e.message;
      console.error(`[ComfyUIAdapter] ❌ ComfyUI /prompt 提交失败:`, errorDetail);
      throw new Error(`ComfyUI /prompt 提交失败: ${typeof errorDetail === 'object' ? JSON.stringify(errorDetail) : errorDetail}`);
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

        const gatewayUrl = process.env.GATEWAY_URL || 'http://localhost:3000';
        downloadedUrl = `${gatewayUrl}/api/v1/download/proxy?url=http://localhost:4000/outputs/${encodeURIComponent(uniqueName)}`;
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
