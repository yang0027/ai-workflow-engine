import Fastify from 'fastify';
import cors from '@fastify/cors';
import websocket from '@fastify/websocket';

const fastify = Fastify({ logger: true });

// 注册 CORS 与 WebSocket
await fastify.register(cors, { origin: true });
await fastify.register(websocket);

const ENGINE_URL = 'http://localhost:4000';

// 1. 网关与底座微服务联合健康检查
fastify.get('/api/v1/health', async (request, reply) => {
  let engineStatus = 'offline';
  try {
    const res = await fetch(`${ENGINE_URL}/api/v1/engine/health`);
    if (res.ok) {
      const data: any = await res.json();
      engineStatus = data.status === 'ok' ? 'online' : 'error';
    }
  } catch (e) {
    engineStatus = 'offline';
  }

  return {
    status: 'ok',
    gateway: 'running',
    phase: 1,
    engine: engineStatus,
    timestamp: new Date().toISOString()
  };
});

// 万能物理跨域资源代理下载通道，彻底避开浏览器 CORS 限制与跳转劫持
fastify.get('/api/v1/download/proxy', async (request, reply) => {
  const { url, filename } = request.query as { url: string; filename?: string };
  if (!url) {
    reply.status(400).send({ error: 'Missing url query parameter' });
    return;
  }
  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Failed to fetch remote resource: ${response.statusText}`);
    }
    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    
    const cleanFilename = filename || `toonflow-media-${Date.now()}`;
    reply.header('Content-Disposition', `attachment; filename="${encodeURIComponent(cleanFilename)}"`);
    reply.header('Content-Type', response.headers.get('content-type') || 'application/octet-stream');
    reply.header('Access-Control-Allow-Origin', '*');
    
    reply.send(buffer);
  } catch (error: any) {
    reply.status(500).send({ error: `Proxy download failed: ${error.message}` });
  }
});

// 2. 导出为 n8n 工作流 DSL 物理接口
fastify.post('/api/v1/workflow/export', async (request, reply) => {
  const body = request.body as any;
  const nodes = body?.nodes || [];
  const edges = body?.edges || [];

  // 单向物理转译器：将 Canvas React Flow 拓扑无损映射为标准的 n8n 专家级工作流
  const n8nWorkflow = {
    meta: {
      templateId: "ai-workflow-engine-mvp"
    },
    nodes: nodes.map((node: any) => {
      let n8nType = 'n8n-nodes-base.httpRequest';
      let parameters: any = {
        url: '',
        method: 'POST',
        sendBody: true,
        bodyParameters: {
          parameters: []
        }
      };

      // 强映射映射机制
      if (node.type === 'tts' || node.id.includes('tts')) {
        parameters.url = `${ENGINE_URL}/api/v1/engine/tts/clone`;
        parameters.bodyParameters.parameters = [
          { name: 'audioBase64', value: '={{ $json.audioBase64 }}' },
          { name: 'characterName', value: '={{ $json.characterName }}' }
        ];
      } else if (node.type === 'video' || node.id.includes('video')) {
        parameters.url = `${ENGINE_URL}/api/v1/engine/video/fusion`;
        parameters.bodyParameters.parameters = [
          { name: 'imageBase64', value: '={{ $json.imageBase64 }}' },
          { name: 'audioBase64', value: '={{ $json.audioBase64 }}' },
          { name: 'width', value: '={{ $json.width || 512 }}' },
          { name: 'height', value: '={{ $json.height || 512 }}' }
        ];
      }

      return {
        parameters,
        id: `n8n-node-${node.id}`,
        name: node.data?.label || node.id,
        type: n8nType,
        typeVersion: 1,
        position: [node.position?.x || 0, node.position?.y || 0]
      };
    }),
    connections: edges.reduce((acc: any, edge: any) => {
      const sourceId = `n8n-node-${edge.source}`;
      const targetId = `n8n-node-${edge.target}`;
      
      if (!acc[sourceId]) acc[sourceId] = { main: [[]] };
      acc[sourceId].main[0].push({
        node: targetId,
        type: "main",
        index: 0
      });
      return acc;
    }, {})
  };

  return {
    success: true,
    n8nDSL: n8nWorkflow
  };
});

// 3. 声音克隆代理 (TTS Node)
fastify.post('/api/v1/workflow/tts/clone', async (request, reply) => {
  try {
    const response = await fetch(`${ENGINE_URL}/api/v1/engine/tts/clone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request.body),
    });
    
    const data = await response.json();
    return reply.status(response.status).send(data);
  } catch (err: any) {
    return reply.status(500).send({ error: `Engine unreachable: ${err.message}` });
  }
});

// 4. 视频融合代理 (Video Node)
fastify.post('/api/v1/workflow/video/fusion', async (request, reply) => {
  try {
    const response = await fetch(`${ENGINE_URL}/api/v1/engine/video/fusion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request.body),
    });
    
    const data = await response.json();
    return reply.status(response.status).send(data);
  } catch (err: any) {
    return reply.status(500).send({ error: `Engine unreachable: ${err.message}` });
  }
});

// ============ 5. 网关代理：全局设置获取 ============
fastify.get('/api/v1/settings', async (request, reply) => {
  try {
    const response = await fetch(`${ENGINE_URL}/api/v1/engine/settings`);
    const data = await response.json();
    return reply.status(response.status).send(data);
  } catch (err: any) {
    return reply.status(500).send({ error: `Engine unreachable: ${err.message}` });
  }
});

// ============ 6. 网关代理：全局设置保存 ============
fastify.put('/api/v1/settings', async (request, reply) => {
  try {
    const response = await fetch(`${ENGINE_URL}/api/v1/engine/settings`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request.body)
    });
    const data = await response.json();
    return reply.status(response.status).send(data);
  } catch (err: any) {
    return reply.status(500).send({ error: `Engine unreachable: ${err.message}` });
  }
});

// ============ 7. 网关代理：ComfyUI 连接测试 ============
fastify.post('/api/v1/settings/comfy/test', async (request, reply) => {
  try {
    const response = await fetch(`${ENGINE_URL}/api/v1/engine/settings/comfy/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request.body)
    });
    const data = await response.json();
    return reply.status(response.status).send(data);
  } catch (err: any) {
    return reply.status(500).send({ error: `Engine unreachable: ${err.message}` });
  }
});

// ============ 8. 网关代理：三方厂商连接测试并拉取模型 ============
fastify.post('/api/v1/settings/provider/test', async (request, reply) => {
  try {
    const response = await fetch(`${ENGINE_URL}/api/v1/engine/settings/provider/test`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request.body)
    });
    const data = await response.json();
    return reply.status(response.status).send(data);
  } catch (err: any) {
    return reply.status(500).send({ error: `Engine unreachable: ${err.message}` });
  }
});

// ============ 9. 网关代理：自定义工作流智能参数解析 ============
fastify.post('/api/v1/custom-workflow/parse', async (request, reply) => {
  try {
    const response = await fetch(`${ENGINE_URL}/api/v1/engine/custom-workflow/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request.body)
    });
    const data = await response.json();
    return reply.status(response.status).send(data);
  } catch (err: any) {
    return reply.status(500).send({ error: `Engine unreachable: ${err.message}` });
  }
});

// ============ 10. 网关代理：自定义工作流通用执行 ============
fastify.post('/api/v1/custom-workflow/execute', async (request, reply) => {
  try {
    const response = await fetch(`${ENGINE_URL}/api/v1/engine/custom-workflow/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request.body)
    });
    const data = await response.json();
    return reply.status(response.status).send(data);
  } catch (err: any) {
    return reply.status(500).send({ error: `Engine unreachable: ${err.message}` });
  }
});

// ============ 11. 网关代理：技能中心 Skills CRUD 代理 ============
fastify.get('/api/v1/skills', async (request, reply) => {
  try {
    const response = await fetch(`${ENGINE_URL}/api/v1/engine/skills`);
    const data = await response.json();
    return reply.status(response.status).send(data);
  } catch (err: any) {
    return reply.status(500).send({ error: `Engine unreachable: ${err.message}` });
  }
});

fastify.get('/api/v1/skills/:id', async (request, reply) => {
  try {
    const { id } = request.params as { id: string };
    const response = await fetch(`${ENGINE_URL}/api/v1/engine/skills/${id}`);
    const data = await response.json();
    return reply.status(response.status).send(data);
  } catch (err: any) {
    return reply.status(500).send({ error: `Engine unreachable: ${err.message}` });
  }
});

fastify.post('/api/v1/skills', async (request, reply) => {
  try {
    const response = await fetch(`${ENGINE_URL}/api/v1/engine/skills`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request.body)
    });
    const data = await response.json();
    return reply.status(response.status).send(data);
  } catch (err: any) {
    return reply.status(500).send({ error: `Engine unreachable: ${err.message}` });
  }
});

fastify.delete('/api/v1/skills/:id', async (request, reply) => {
  try {
    const { id } = request.params as { id: string };
    const response = await fetch(`${ENGINE_URL}/api/v1/engine/skills/${id}`, {
      method: 'DELETE'
    });
    const data = await response.json();
    return reply.status(response.status).send(data);
  } catch (err: any) {
    return reply.status(500).send({ error: `Engine unreachable: ${err.message}` });
  }
});

// ============ 12. 网关代理：通用大语言模型调度代理 ============
fastify.post('/api/v1/llm/chat', async (request, reply) => {
  try {
    const response = await fetch(`${ENGINE_URL}/api/v1/engine/llm/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request.body)
    });
    const data = await response.json();
    return reply.status(response.status).send(data);
  } catch (err: any) {
    return reply.status(500).send({ error: `Engine unreachable: ${err.message}` });
  }
});

// ============ 13. 网关代理：通用智能生图调度代理 ============
fastify.post('/api/v1/image/generate', async (request, reply) => {
  try {
    const response = await fetch(`${ENGINE_URL}/api/v1/engine/image/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request.body)
    });
    const data = await response.json();
    return reply.status(response.status).send(data);
  } catch (err: any) {
    return reply.status(500).send({ error: `Engine unreachable: ${err.message}` });
  }
});

// ============ 14. 网关代理：统一工作流模板库 ============
fastify.get('/api/v1/workflow-templates', async (request, reply) => {
  try {
    const response = await fetch(`${ENGINE_URL}/api/v1/engine/workflow-templates`);
    const data = await response.json();
    return reply.status(response.status).send(data);
  } catch (err: any) {
    return reply.status(500).send({ error: `Engine unreachable: ${err.message}` });
  }
});

fastify.get('/api/v1/workflow-templates/:id', async (request, reply) => {
  try {
    const { id } = request.params as { id: string };
    const response = await fetch(`${ENGINE_URL}/api/v1/engine/workflow-templates/${id}`);
    const data = await response.json();
    return reply.status(response.status).send(data);
  } catch (err: any) {
    return reply.status(500).send({ error: `Engine unreachable: ${err.message}` });
  }
});

fastify.post('/api/v1/workflow-templates/parse', async (request, reply) => {
  try {
    const response = await fetch(`${ENGINE_URL}/api/v1/engine/workflow-templates/parse`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request.body)
    });
    const data = await response.json();
    return reply.status(response.status).send(data);
  } catch (err: any) {
    return reply.status(500).send({ error: `Engine unreachable: ${err.message}` });
  }
});

fastify.post('/api/v1/workflow-templates', async (request, reply) => {
  try {
    const response = await fetch(`${ENGINE_URL}/api/v1/engine/workflow-templates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request.body)
    });
    const data = await response.json();
    return reply.status(response.status).send(data);
  } catch (err: any) {
    return reply.status(500).send({ error: `Engine unreachable: ${err.message}` });
  }
});

fastify.put('/api/v1/workflow-templates/:id', async (request, reply) => {
  try {
    const { id } = request.params as { id: string };
    const response = await fetch(`${ENGINE_URL}/api/v1/engine/workflow-templates/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request.body)
    });
    const data = await response.json();
    return reply.status(response.status).send(data);
  } catch (err: any) {
    return reply.status(500).send({ error: `Engine unreachable: ${err.message}` });
  }
});

fastify.delete('/api/v1/workflow-templates/:id', async (request, reply) => {
  try {
    const { id } = request.params as { id: string };
    const response = await fetch(`${ENGINE_URL}/api/v1/engine/workflow-templates/${id}`, {
      method: 'DELETE'
    });
    const data = await response.json();
    return reply.status(response.status).send(data);
  } catch (err: any) {
    return reply.status(500).send({ error: `Engine unreachable: ${err.message}` });
  }
});

// ==================== Real DAG Topology Orchestrator & Multi-Service Linking ====================

// 拓扑排序算法 (Kahn 算法)
function topologicalSort(nodes: any[], edges: any[]): any[] {
  const adjList = new Map<string, string[]>();
  const inDegree = new Map<string, number>();

  nodes.forEach(node => {
    adjList.set(node.id, []);
    inDegree.set(node.id, 0);
  });

  edges.forEach(edge => {
    if (adjList.has(edge.source) && adjList.has(edge.target)) {
      adjList.get(edge.source)!.push(edge.target);
      inDegree.set(edge.target, (inDegree.get(edge.target) || 0) + 1);
    }
  });

  const queue: string[] = [];
  inDegree.forEach((degree, nodeId) => {
    if (degree === 0) {
      queue.push(nodeId);
    }
  });

  const sortedIds: string[] = [];
  while (queue.length > 0) {
    const curr = queue.shift()!;
    sortedIds.push(curr);

    const neighbors = adjList.get(curr) || [];
    neighbors.forEach(neighbor => {
      const nextDegree = (inDegree.get(neighbor) || 0) - 1;
      inDegree.set(neighbor, nextDegree);
      if (nextDegree === 0) {
        queue.push(neighbor);
      }
    });
  }

  if (sortedIds.length !== nodes.length) {
    throw new Error('工作流拓扑图中检测到环路循环，拓扑排序失败！');
  }

  return sortedIds.map(id => nodes.find(n => n.id === id)!);
}

// 物理级 WebSocket 连接映射池
const wsConnections = new Map<string, any[]>();

function broadcastWorkflowEvent(workflowId: string, data: any) {
  const sockets = wsConnections.get(workflowId) || [];
  fastify.log.info(`[WS Broadcast] 发送事件: ${data.event} 到工作流 ${workflowId}, 活跃监听数: ${sockets.length}`);
  for (const socket of sockets) {
    if (socket.readyState === 1 /* OPEN */) {
      try {
        socket.send(JSON.stringify(data));
      } catch (err) {
        fastify.log.error(err);
      }
    }
  }
}

// 后台异步工作流物理执行引擎
// 物理级下游子图扫描函数
function findDownstreamSubgraph(loopNodeId: string, sortedNodes: any[], edges: any[]): Set<string> {
  const subgraphNodeIds = new Set<string>();
  const queue: string[] = [loopNodeId];

  while (queue.length > 0) {
    const currentId = queue.shift()!;
    const outgoing = edges.filter(e => e.source === currentId);
    outgoing.forEach(edge => {
      if (!subgraphNodeIds.has(edge.target)) {
        subgraphNodeIds.add(edge.target);
        queue.push(edge.target);
      }
    });
  }

  return subgraphNodeIds;
}

// 物理级微服务单节点调用执行引擎
async function executeSingleNode(node: any, inputs: any): Promise<any> {
  let outputs: any = {};

  if (node.type === 'prompt-source') {
    outputs = {
      text: inputs.text || ''
    };
  } else if (node.type === 'llm-service') {
    const providerId = inputs.providerId || 'minimax';
    const model = inputs.model || 'minimax-m2.7-chat';
    const promptText = inputs.prompt || inputs.input || '';

    let systemPrompt = '';
    if (inputs.skillId) {
      try {
        const skillRes = await fetch(`${ENGINE_URL}/api/v1/engine/skills/${inputs.skillId}`);
        if (skillRes.ok) {
          const skillData: any = await skillRes.json();
          systemPrompt = skillData.systemPrompt || '';
        }
      } catch (e: any) {
        fastify.log.warn(`[LLM Bind] 获取 Skill [${inputs.skillId}] 模板失败: ${e.message}`);
      }
    }

    const llmRes = await fetch(`${ENGINE_URL}/api/v1/engine/llm/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        providerId,
        model,
        messages: [{ role: 'user', content: promptText }],
        systemPrompt
      })
    });

    if (!llmRes.ok) {
      throw new Error(`[LLM 引擎] 返回错误码 ${llmRes.status}: ${await llmRes.text()}`);
    }

    const data: any = await llmRes.json();
    const content = data.choices?.[0]?.message?.content || '';

    outputs = {
      storyboard: content
    };
  } else if (node.type === 'image-service') {
    const providerId = inputs.providerId || 'minimax';
    const model = inputs.model || 'flux-schnell';
    const promptText = inputs.prompt || inputs.input || '';
    const size = inputs.size || '1024x1024';

    const imgRes = await fetch(`${ENGINE_URL}/api/v1/engine/image/generate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        providerId,
        model,
        prompt: promptText,
        size,
        response_format: 'b64_json'
      })
    });

    if (!imgRes.ok) {
      throw new Error(`[生图引擎] 返回错误码 ${imgRes.status}: ${await imgRes.text()}`);
    }

    const data: any = await imgRes.json();
    const b64 = data.data?.[0]?.b64_json || '';
    const url = data.data?.[0]?.url || '';

    outputs = {
      image: url,
      imageBase64: b64 ? `data:image/png;base64,${b64}` : ''
    };
  } else if (node.type === 'tts-service') {
    const providerId = inputs.providerId || 'minimax';
    const model = inputs.model || 'fish-speech-1.4';
    const characterName = inputs.characterName || '数字少女';
    const textVal = inputs.text || inputs.prompt || '大家好，我是 Toonflow 声音克隆助理。';
    const modeVal = inputs.mode || 'direct';

    const defaultAudioB64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const audioBase64 = inputs.audioBase64 || inputs.audio || defaultAudioB64;

    const ttsRes = await fetch(`${ENGINE_URL}/api/v1/engine/tts/clone`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        audioBase64,
        characterName,
        text: textVal,
        providerId,
        model,
        mode: modeVal
      })
    });

    if (!ttsRes.ok) {
      throw new Error(`[TTS 引擎] 返回错误码 ${ttsRes.status}: ${await ttsRes.text()}`);
    }

    const data: any = await ttsRes.json();
    const taskId = data.taskId;
    let audioUrl = data.audioUrl || '';

    if (taskId && !audioUrl) {
      let polled = false;
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 1500));
        const statusRes = await fetch(`${ENGINE_URL}/api/v1/engine/tts/status/${taskId}`);
        if (statusRes.ok) {
          const statusVal: any = await statusRes.json();
          if (statusVal.status === 'SUCCESS') {
            audioUrl = statusVal.audioUrl || audioUrl;
            polled = true;
            break;
          } else if (statusVal.status === 'FAILED') {
            throw new Error(`底座声音克隆失败: ${statusVal.error || '任务失败'}`);
          }
        }
      }
      if (!polled && !audioUrl) {
        throw new Error(`声音克隆生成超时`);
      }
    }

    outputs = {
      audio: audioUrl,
      audioBase64
    };
  } else if (node.type === 'video-fusion') {
    const providerId = inputs.providerId || 'vidu';
    const model = inputs.model || 'vidu-high-speed';
    const width = inputs.width || 512;
    const height = inputs.height || 512;
    const duration = inputs.duration || 5;

    const defaultB64 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
    const imageBase64 = inputs.imageBase64 || inputs.image || defaultB64;
    const audioBase64 = inputs.audioBase64 || inputs.audio || defaultB64;

    const vidRes = await fetch(`${ENGINE_URL}/api/v1/engine/video/fusion`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        imageBase64,
        audioBase64,
        width,
        height,
        duration,
        providerId,
        model
      })
    });

    if (!vidRes.ok) {
      throw new Error(`[视频融合引擎] 返回错误码 ${vidRes.status}: ${await vidRes.text()}`);
    }

    const data: any = await vidRes.json();
    const taskId = data.taskId;
    let videoUrl = data.videoUrl || '';

    if (taskId && !videoUrl) {
      let polled = false;
      for (let i = 0; i < 30; i++) {
        await new Promise(r => setTimeout(r, 1500));
        const statusRes = await fetch(`${ENGINE_URL}/api/v1/engine/video/status/${taskId}`);
        if (statusRes.ok) {
          const statusVal: any = await statusRes.json();
          if (statusVal.status === 'SUCCESS') {
            videoUrl = statusVal.videoUrl || videoUrl;
            polled = true;
            break;
          } else if (statusVal.status === 'FAILED') {
            throw new Error(`底座视频融合失败: ${statusVal.error || '任务失败'}`);
          }
        }
      }
      if (!polled && !videoUrl) {
        throw new Error(`视频融合渲染超时`);
      }
    }

    outputs = {
      video: videoUrl
    };
  } else if (node.type === 'custom-workflow') {
    const customRes = await fetch(`${ENGINE_URL}/api/v1/engine/custom-workflow/execute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        source: node.data.source || 'local_comfyui',
        workflowIdOrJson: node.data.workflowIdOrJson,
        inputs,
        mappings: node.data.mappings || []
      })
    });

    if (!customRes.ok) {
      throw new Error(`[自定义 ComfyUI 引擎] 执行失败: ${await customRes.text()}`);
    }

    const data: any = await customRes.json();
    if (data.success && data.outputUrl) {
      outputs = {
        video: data.outputUrl,
        image: data.outputUrl,
        outputUrl: data.outputUrl
      };
    } else {
      throw new Error(data.error || '工作流执行成功但未返回有效媒体成果');
    }
  }

  return outputs;
}

// 后台异步工作流物理执行引擎
async function executeWorkflowJob(workflowId: string, sortedNodes: any[], edges: any[]) {
  const nodeOutputs: Record<string, any> = {};
  const totalNodes = sortedNodes.length;
  let completedCount = 0;
  const skippedNodeIds = new Set<string>();

  try {
    for (const node of sortedNodes) {
      // 如果属于某个被 Loop 支配的下游子图，在顶层调度中跳过
      if (skippedNodeIds.has(node.id)) {
        fastify.log.info(`[Loop Scheduler] 节点 [${node.data?.label || node.id}] 属于循环支配子图，顶层已自动跳过`);
        continue;
      }

      // A. 发送节点开始执行通知
      broadcastWorkflowEvent(workflowId, {
        event: 'node_start',
        nodeId: node.id
      });

      // 发送全局进度信息给前端进度条
      const startPct = Math.round((completedCount / totalNodes) * 100) + 2;
      broadcastWorkflowEvent(workflowId, {
        event: 'progress',
        progress: Math.min(startPct, 98),
        msg: `⚡ 正在物理执行节点 [${node.data?.label || node.id}]...`,
        status: `${node.type.replace('-', '_')}_running`
      });

      // B. 动态数据流动解析：合并前级节点 outputs 与当前节点默认 inputs
      const inputs: Record<string, any> = {};
      const defaultInputs = node.data?.inputs || {};

      // 1) 填充静态配置表单
      Object.keys(defaultInputs).forEach(key => {
        inputs[key] = defaultInputs[key];
      });

      // 2) 寻找指向当前节点的连线，获取前级实际输出并覆盖
      if (node.type === 'custom-workflow') {
        const mappings = node.data?.mappings || [];
        mappings.forEach((map: any) => {
          const edge = edges.find(e => e.target === node.id && e.targetHandle === map.portId);
          if (edge) {
            const srcOutputs = nodeOutputs[edge.source];
            if (srcOutputs) {
              let val = srcOutputs[edge.sourceHandle || 'output'];
              if (val === undefined) {
                val = srcOutputs.text || srcOutputs.storyboard || srcOutputs.image || srcOutputs.audio || srcOutputs.video || srcOutputs.outputUrl || srcOutputs.output;
              }
              inputs[map.portId] = val;
            }
          } else {
            inputs[map.portId] = node.data.inputs?.[map.portId] || node.data.inputs?.[`${map.nodeId}_${map.fieldName}`] || '';
          }
        });
      } else {
        const incomingEdges = edges.filter(e => e.target === node.id);
        incomingEdges.forEach(edge => {
          const srcOutputs = nodeOutputs[edge.source];
          if (srcOutputs) {
            const sourceHandle = edge.sourceHandle || 'output';
            const targetHandle = edge.targetHandle || 'input';

            let val = srcOutputs[sourceHandle];
            if (val === undefined) {
              val = srcOutputs.text || srcOutputs.storyboard || srcOutputs.image || srcOutputs.audio || srcOutputs.video || srcOutputs.outputUrl || srcOutputs.output;
            }
            inputs[targetHandle] = val;
          }
        });
      }

      // C. 遇到循环迭代控制器节点
      let outputs: any = {};

      try {
        if (node.type === 'loop-node') {
          const subgraphNodeIds = findDownstreamSubgraph(node.id, sortedNodes, edges);
          // 标记跳过，防止大循环重复拉起子图节点
          subgraphNodeIds.forEach(id => skippedNodeIds.add(id));

          const loopSource = inputs.loopSource || 'manual';
          const manualCount = inputs.manualCount || 3;
          const runMode = inputs.runMode || 'concurrent';
          const maxConcurrent = inputs.maxConcurrent || 3;

          let items: any[] = [];
          if (loopSource === 'manual') {
            items = Array.from({ length: manualCount }, (_, i) => ({ index: i + 1 }));
          } else {
            const connectedInput = inputs.input || '';
            if (connectedInput) {
              try {
                const parsed = JSON.parse(connectedInput);
                if (Array.isArray(parsed)) {
                  items = parsed;
                } else {
                  items = [parsed];
                }
              } catch (e) {
                items = connectedInput.split('\n')
                  .map((l: string) => l.trim())
                  .filter((l: string) => l)
                  .map((l: string) => ({ text: l, prompt: l }));
              }
            }
          }

          const total = items.length;
          fastify.log.info(`[Loop Scheduler] 遇到批量循环迭代控制流 [${node.id}]，总项数: ${total}，模式: ${runMode}`);

          const subgraphSorted = sortedNodes.filter(n => subgraphNodeIds.has(n.id));
          const results: any[] = [];

          if (total > 0) {
            const runBranchTask = async (taskIndex: number) => {
              const item = items[taskIndex];
              const branchOutputs = { ...nodeOutputs };

              const itemVal = typeof item === 'object' ? (item.prompt || item.text || JSON.stringify(item)) : item;
              branchOutputs[node.id] = {
                output: itemVal,
                currentIndex: taskIndex + 1,
                total,
                currentVariables: item
              };

              // 依次执行子图节点
              for (const subNode of subgraphSorted) {
                broadcastWorkflowEvent(workflowId, {
                  event: 'node_start',
                  nodeId: subNode.id
                });

                const subInputs: Record<string, any> = {};
                if (subNode.type === 'custom-workflow') {
                  const mappings = subNode.data?.mappings || [];
                  mappings.forEach((map: any) => {
                    const edge = edges.find(e => e.target === subNode.id && e.targetHandle === map.portId);
                    if (edge) {
                      const srcOutputs = branchOutputs[edge.source];
                      if (srcOutputs) {
                        let val = srcOutputs[edge.sourceHandle || 'output'];
                        if (val === undefined) {
                          val = srcOutputs.text || srcOutputs.storyboard || srcOutputs.image || srcOutputs.audio || srcOutputs.video || srcOutputs.outputUrl || srcOutputs.output;
                        }
                        subInputs[map.portId] = val;
                      }
                    } else {
                      subInputs[map.portId] = subNode.data.inputs?.[map.portId] || subNode.data.inputs?.[`${map.nodeId}_${map.fieldName}`] || '';
                    }
                  });
                } else {
                  const subDefaultInputs = subNode.data?.inputs || {};
                  Object.keys(subDefaultInputs).forEach(key => {
                    subInputs[key] = subDefaultInputs[key];
                  });

                  const subIncomingEdges = edges.filter(e => e.target === subNode.id);
                  subIncomingEdges.forEach(edge => {
                    const srcOutputs = branchOutputs[edge.source];
                    if (srcOutputs) {
                      const sourceHandle = edge.sourceHandle || 'output';
                      const targetHandle = edge.targetHandle || 'input';
                      let val = srcOutputs[sourceHandle];
                      if (val === undefined) {
                        val = srcOutputs.text || srcOutputs.storyboard || srcOutputs.image || srcOutputs.audio || srcOutputs.video || srcOutputs.outputUrl || srcOutputs.output;
                      }
                      subInputs[targetHandle] = val;
                    }
                  });
                }

                try {
                  const subOutputs = await executeSingleNode(subNode, subInputs);
                  branchOutputs[subNode.id] = subOutputs;

                  broadcastWorkflowEvent(workflowId, {
                    event: 'node_success',
                    nodeId: subNode.id,
                    outputs: subOutputs
                  });
                } catch (subErr: any) {
                  broadcastWorkflowEvent(workflowId, {
                    event: 'node_error',
                    nodeId: subNode.id,
                    message: subErr.message || '子节点执行发生错误'
                  });
                  throw subErr;
                }
              }

              results[taskIndex] = branchOutputs;
            };

            if (runMode === 'concurrent') {
              // 并发暴击带并发限制数控制
              let index = 0;
              const workers: Promise<void>[] = [];

              const executeNext = async (): Promise<void> => {
                if (index >= total) return;
                const taskIndex = index++;

                // 物理向前端通告当前迭代进度
                broadcastWorkflowEvent(workflowId, {
                  event: 'node_success',
                  nodeId: node.id,
                  outputs: {
                    currentIndex: taskIndex + 1,
                    total,
                    currentVariables: items[taskIndex]
                  }
                });

                await runBranchTask(taskIndex);
                await executeNext();
              };

              for (let w = 0; w < Math.min(maxConcurrent, total); w++) {
                workers.push(executeNext());
              }
              await Promise.all(workers);
            } else {
              // 顺序模式串联执行
              for (let i = 0; i < total; i++) {
                broadcastWorkflowEvent(workflowId, {
                  event: 'node_success',
                  nodeId: node.id,
                  outputs: {
                    currentIndex: i + 1,
                    total,
                    currentVariables: items[i]
                  }
                });

                await runBranchTask(i);
              }
            }
          }

          // 循环执行完毕后，执行物理收集，汇总所有的图片、视频、音频
          const imageNodeId = subgraphSorted.find(n => n.type === 'image-service')?.id;
          const videoNodeId = subgraphSorted.find(n => n.type === 'video-fusion')?.id;
          const audioNodeId = subgraphSorted.find(n => n.type === 'tts-service')?.id;

          outputs = {
            images: results.map(r => r?.[imageNodeId!]?.image).filter(Boolean),
            videos: results.map(r => r?.[videoNodeId!]?.video).filter(Boolean),
            audios: results.map(r => r?.[audioNodeId!]?.audio).filter(Boolean),
            currentIndex: total,
            total
          };
        } else {
          // 普通节点正常执行微服务
          outputs = await executeSingleNode(node, inputs);
        }
      } catch (nodeErr: any) {
        broadcastWorkflowEvent(workflowId, {
          event: 'node_error',
          nodeId: node.id,
          message: nodeErr.message || '节点执行发生错误'
        });
        throw nodeErr;
      }

      // D. 本地缓存 outputs，广播单个节点成功通知
      nodeOutputs[node.id] = outputs;

      broadcastWorkflowEvent(workflowId, {
        event: 'node_success',
        nodeId: node.id,
        outputs
      });

      completedCount++;
      const endPct = Math.round((completedCount / totalNodes) * 100);
      broadcastWorkflowEvent(workflowId, {
        event: 'progress',
        progress: endPct,
        msg: `🎉 节点 [${node.data?.label || node.id}] 执行成功！成果已即时灌注完成`,
        status: `${node.type.replace('-', '_')}_success`
      });
    }

    // E. 广播全链路流转圆满成功
    broadcastWorkflowEvent(workflowId, {
      event: 'success',
      progress: 100,
      msg: '🎉 全链路排期物理流转已圆满成功！成果已渲染在画布节点中。',
      outputs: nodeOutputs
    });

  } catch (err: any) {
    fastify.log.error(`工作流 [${workflowId}] 执行发生严重物理阻断:`, err);
    broadcastWorkflowEvent(workflowId, {
      event: 'error',
      message: err.message || '编排任务调度中心发生未知错误'
    });
  }
}

// 物理拓扑检验与异步流转调度核心 POST 接口
fastify.post('/api/v1/workflow/run', async (request, reply) => {
  const { workflowId = 'session-1', nodes = [], edges = [] } = request.body as any;

  try {
    // 1) 拓扑排序与环路检测
    const sorted = topologicalSort(nodes, edges);

    // 2) 异步激活工作流多服务执行
    executeWorkflowJob(workflowId, sorted, edges);

    return {
      success: true,
      workflowId,
      message: '拓扑排序校验通过，工作流异步流转引擎已物理激活启动！'
    };
  } catch (err: any) {
    return reply.status(400).send({
      success: false,
      error: err.message || '拓扑结构校验异常，包含闭环或失效节点！'
    });
  }
});

// 5. WebSocket 进度推送接口 (具备真实状态轮询与物理通知推送)
fastify.register(async function (fastify) {
  fastify.get('/ws/workflow/:id', { websocket: true }, (connection, req) => {
    const params = req.params as { id: string };
    const socket = connection.socket || connection;
    fastify.log.info(`[WS] 画布客户端已建立 WebSocket 连接，监听工作流: ${params.id}`);

    if (!wsConnections.has(params.id)) {
      wsConnections.set(params.id, []);
    }
    wsConnections.get(params.id)!.push(socket);

    socket.send(JSON.stringify({
      event: 'connected',
      message: 'Workflow progress monitor activated.',
      workflowId: params.id
    }));

    socket.on('close', () => {
      fastify.log.info(`[WS] 画布长连接已正常释放销毁: ${params.id}`);
      const list = wsConnections.get(params.id) || [];
      const index = list.indexOf(socket);
      if (index !== -1) {
        list.splice(index, 1);
      }
      if (list.length === 0) {
        wsConnections.delete(params.id);
      }
    });

    socket.on('message', async (message: any) => {
      const payload = JSON.parse(message.toString());
      fastify.log.info(`[WS] 收到画布控制命令: ${JSON.stringify(payload)}`);
      
      // 保持向后兼容：如果前端依然通过 ws 发送 action: start 来拉起
      // 我们也可以在这里手动拉起，但最好前端统一走 POST /api/v1/workflow/run
    });
  });
});

// 启动服务 (监听在 3000 端口)
const start = async () => {
  try {
    await fastify.listen({ port: 3000, host: '0.0.0.0' });
    console.log('🚀 API Gateway successfully listening on port 3000');
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }
};

start();
