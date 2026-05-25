import axios from 'axios';
import https from 'https';

export interface RunningHubNodeInfo {
  nodeId: string;
  fieldName: string;
  fieldValue: any;
}

export interface RunningHubClientConfig {
  apiKey: string;
  baseUrl?: string;
}

export class RunningHubClient {
  private apiKey: string;
  private baseUrl: string;
  private httpsAgent: https.Agent;

  constructor(config: RunningHubClientConfig) {
    this.apiKey = config.apiKey;
    this.baseUrl = (config.baseUrl || 'https://www.runninghub.cn').replace(/\/+$/, '');
    this.httpsAgent = new https.Agent({
      rejectUnauthorized: false, // 强制跳过非安全 TLS 拦截校验，穿透本地开发代理
      keepAlive: true
    });
  }

  /**
   * 1. 资源文件上传 (支持音视频/图片)
   * 对应 OpenAPI 物理节点：/openapi/v2/media/upload/binary
   */
  public async uploadReference(
    base64Data: string,
    fileType: 'image' | 'audio' | 'video'
  ): Promise<string> {
    if (fileType !== 'image') {
      // 非图片资源目前云端通常直接以 base64 形式暂存，或在此处处理音视频直传
      return base64Data;
    }

    try {
      let rawBase64 = base64Data.replace(/^data:image\/\w+;base64,/, '');
      const boundary = `----TFBoundary${Date.now()}`;
      const imgBuffer = Buffer.from(rawBase64, 'base64');
      
      const header = Buffer.from(
        `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="ref.png"\r\nContent-Type: image/png\r\n\r\n`
      );
      const footer = Buffer.from(`\r\n--${boundary}--\r\n`);
      const body = Buffer.concat([header, imgBuffer, footer]);

      const response = await axios.post(
        `${this.baseUrl}/openapi/v2/media/upload/binary`,
        body,
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': `multipart/form-data; boundary=${boundary}`,
            'Content-Length': body.length,
          },
          timeout: 120000,
          maxBodyLength: Infinity,
          maxContentLength: Infinity,
        }
      );

      if (response.data.code === 0 && response.data.data?.fileName) {
        return response.data.data.fileName;
      }
      
      throw new Error(response.data.msg || 'Unknown upload response');
    } catch (error: any) {
      console.error('[RunningHub] ❌ uploadReference Exception:', error.message);
      throw new Error(`RunningHub Asset Upload Failed: ${error.message}`);
    }
  }

  /**
   * 2. 发起 ComfyUI 任务 (高级)
   * 对应 OpenAPI 物理节点：/task/openapi/create
   */
  public async createTask(
    workflowId: string,
    nodeInfoList: RunningHubNodeInfo[]
  ): Promise<string> {
    try {
      const response = await axios.post(
        `${this.baseUrl}/task/openapi/create`,
        {
          apiKey: this.apiKey,
          workflowId: workflowId.replace(/^runninghub:/, ''),
          nodeInfoList,
        },
        {
          headers: {
            'Content-Type': 'application/json',
          },
        }
      );

      if (response.data.code === 0 && response.data.data?.taskId) {
        return response.data.data.taskId;
      }

      throw new Error(response.data.msg || 'Task creation rejected by cloud');
    } catch (error: any) {
      console.error('[RunningHub] ❌ createTask Exception:', error.message);
      throw new Error(`RunningHub Task Creation Failed: ${error.message}`);
    }
  }

  /**
   * 3. 查询任务状态
   * 对应 OpenAPI 物理节点：/task/openapi/status
   */
  public async getTaskStatus(taskId: string): Promise<'RUNNING' | 'SUCCESS' | 'FAILED' | 'ERROR'> {
    try {
      const response = await axios.post(`${this.baseUrl}/task/openapi/status`, {
        apiKey: this.apiKey,
        taskId,
      });

      const data = response.data.data || response.data;
      if (typeof data === 'string') {
        return data as any;
      }
      return (data.status || 'RUNNING') as any;
    } catch (error: any) {
      console.error('[RunningHub] ❌ getTaskStatus Exception:', error.message);
      return 'RUNNING';
    }
  }

  /**
   * 4. 获取任务输出文件
   * 对应 OpenAPI 物理节点：/task/openapi/outputs
   */
  public async getTaskOutputs(taskId: string): Promise<string> {
    try {
      const response = await axios.post(`${this.baseUrl}/task/openapi/outputs`, {
        apiKey: this.apiKey,
        taskId,
      });

      const oData = response.data.data || response.data;
      const results = Array.isArray(oData) ? oData : (oData.results || [oData]);
      const fileUrl = results[0]?.fileUrl || results[0]?.url;

      if (!fileUrl) {
        throw new Error('No output file URL parsed from results');
      }

      return fileUrl;
    } catch (error: any) {
      console.error('[RunningHub] ❌ getTaskOutputs Exception:', error.message);
      throw new Error(`RunningHub Output Parsing Failed: ${error.message}`);
    }
  }

  /**
   * 5. v2: 提交 AI 应用或工作流任务 (OpenAPI v2)
   */
  public async createTaskV2(
    appIdOrWorkflowId: string,
    nodeInfoList: RunningHubNodeInfo[]
  ): Promise<string> {
    const isWorkflow = appIdOrWorkflowId.startsWith('wf_') || !/^\d+$/.test(appIdOrWorkflowId);
    const urlPath = isWorkflow 
      ? `/openapi/v2/run/workflow/${appIdOrWorkflowId}`
      : `/openapi/v2/run/ai-app/${appIdOrWorkflowId}`;

    console.log(`[RunningHubClient] 🚀 正在通过 v2 接口创建任务, path: ${urlPath}`);

    const maxRetries = 3;
    let delay = 1000;

    for (let attempt = 1; attempt <= maxRetries; attempt++) {
      try {
        const response = await axios.post(
          `${this.baseUrl}${urlPath}`,
          {
            nodeInfoList,
          },
          {
            headers: {
              'Authorization': `Bearer ${this.apiKey}`,
              'Content-Type': 'application/json',
            },
            httpsAgent: this.httpsAgent, // 开启 httpsAgent 强力穿透本地代理
            timeout: 15000 // 15秒握手超时
          }
        );

        const resData = response.data;
        if (resData) {
          if (resData.taskId && (!resData.errorCode || resData.errorCode === '0' || resData.errorCode === '')) {
            return resData.taskId;
          }
          if (resData.code === 0 && resData.data?.taskId) {
            return resData.data.taskId;
          }
        }

        const errMsg = resData?.errorMessage || resData?.msg || resData?.message || (typeof resData === 'object' ? JSON.stringify(resData) : String(resData));
        throw new Error(errMsg);

      } catch (error: any) {
        console.warn(`[RunningHubClient] ⚠️ createTaskV2 尝试第 ${attempt}/${maxRetries} 次失败: ${error.message}`);
        
        const isNetworkIssue = error.message.includes('disconnected') || error.message.includes('socket') || error.message.includes('timeout') || error.message.includes('ECONNRESET');
        if (attempt === maxRetries || !isNetworkIssue) {
          const errDetail = error.response?.data 
            ? (typeof error.response.data === 'object' ? JSON.stringify(error.response.data) : String(error.response.data)) 
            : error.message;
          throw new Error(`RunningHub Task V2 Creation Failed: ${errDetail}`);
        }

        // 指数退避式等待后重试
        await new Promise(resolve => setTimeout(resolve, delay));
        delay *= 2;
      }
    }

    throw new Error('RunningHub 任务创建因未知原因彻底失败。');
  }

  /**
   * 6. v2: 查询任务状态与结果 (OpenAPI v2)
   */
  public async getTaskStatusV2(taskId: string): Promise<{
    status: 'RUNNING' | 'SUCCESS' | 'FAILED' | 'ERROR';
    progress: number;
    images?: Array<{ nodeId: string; downloadUrl: string; fileName: string }>;
  }> {
    try {
      console.log(`[RunningHubClient] 🔍 查询任务状态 (v2), taskId: ${taskId}`);
      const response = await axios.post(
        `${this.baseUrl}/openapi/v2/query`,
        { taskId },
        {
          headers: {
            'Authorization': `Bearer ${this.apiKey}`,
            'Content-Type': 'application/json',
          },
        }
      );

      const res = response.data;
      if (!res) {
        throw new Error('Empty response from cloud when querying task status');
      }

      // 处理明确的云端错误信息
      if (res.errorCode && res.errorCode !== '0') {
        throw new Error(res.errorMessage || `Query failed with errorCode ${res.errorCode}`);
      }

      const statusVal = String(res.status || 'RUNNING').toUpperCase();
      let status: 'RUNNING' | 'SUCCESS' | 'FAILED' | 'ERROR' = 'RUNNING';

      if (statusVal === 'SUCCESS') {
        status = 'SUCCESS';
      } else if (statusVal === 'FAILED' || statusVal === 'ERROR') {
        status = 'FAILED';
      }

      // 将 results 中的 url 兼容转换至 images downloadUrl
      const images = (res.results || []).map((item: any) => ({
        nodeId: item.nodeId || '',
        downloadUrl: item.url || '',
        fileName: ''
      }));

      // 如果是 SUCCESS 状态，但 images 为空，可能需要记录 warning
      if (status === 'SUCCESS' && images.length === 0) {
        console.warn('[RunningHubClient] ⚠️ 任务成功但 results 列表为空');
      }

      return {
        status,
        progress: status === 'SUCCESS' ? 100 : 50, // 云端没有提供具体百分比时，给予模拟进度
        images,
      };
    } catch (error: any) {
      const errDetail = error.response?.data 
        ? (typeof error.response.data === 'object' ? JSON.stringify(error.response.data) : String(error.response.data)) 
        : error.message;
      console.error('[RunningHub] ❌ getTaskStatusV2 Exception:', errDetail);
      // 为了防止个别网络抖动导致直接被判定为任务失败，返回 RUNNING 供下一次轮询，或者抛出异常让轮询器接管
      return { status: 'RUNNING', progress: 0 };
    }
  }
}

