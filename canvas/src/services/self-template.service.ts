export interface SelfCreatedTemplate {
  id: string;
  name: string;
  description: string;
  createdAt: number;
  nodeCount: number;
  edgeCount: number;
  nodes: any[];
  edges: any[];
  cover?: string;
}

export class SelfTemplateService {
  private static STORAGE_KEY = 'toonflow_self_created_templates';

  // 1. 获取所有自建模板列表
  public static getTemplates(): SelfCreatedTemplate[] {
    try {
      const data = localStorage.getItem(this.STORAGE_KEY);
      return data ? JSON.parse(data) : [];
    } catch (e) {
      console.error('获取自创建模板列表失败:', e);
      return [];
    }
  }

  // 2. 保存新模板（仅序列化传入的框选 nodes 及其 edges 连线关系）
  public static saveTemplate(
    name: string,
    description: string,
    nodes: any[],
    edges: any[]
  ): SelfCreatedTemplate {
    const list = this.getTemplates();
    
    // 自动根据节点类型分发一些好看的预设 Unsplash 封面
    const covers = [
      'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=400&q=80',
      'https://images.unsplash.com/photo-1634017839464-5c339ebe3cb4?w=400&q=80',
      'https://images.unsplash.com/photo-1617791160505-6f006e121980?w=400&q=80',
      'https://images.unsplash.com/photo-1635070041078-e363dbe005cb?w=400&q=80',
      'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=400&q=80'
    ];
    const randomCover = covers[Math.floor(Math.random() * covers.length)];

    // 过滤得到只属于框选 nodes 之间的有效连线
    const nodeIds = new Set(nodes.map(n => n.id));
    const innerEdges = edges.filter(
      e => nodeIds.has(e.source) && nodeIds.has(e.target)
    );

    const newTemplate: SelfCreatedTemplate = {
      id: `self_tpl_${Date.now()}`,
      name: name.trim() || '未命名自建连线模板',
      description: description.trim() || '基于画布框选打包保存的 AI 智能节点连线模板',
      createdAt: Date.now(),
      nodeCount: nodes.length,
      edgeCount: innerEdges.length,
      nodes: nodes.map(n => ({
        ...n,
        selected: false // 重置选择状态
      })),
      edges: innerEdges,
      cover: randomCover
    };

    list.unshift(newTemplate); // 自动置顶
    localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list));
    return newTemplate;
  }

  // 3. 物理删除模板
  public static deleteTemplate(id: string): boolean {
    try {
      const list = this.getTemplates();
      const filtered = list.filter(t => t.id !== id);
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(filtered));
      return true;
    } catch (e) {
      console.error('删除自建模板失败:', e);
      return false;
    }
  }

  // 4. 智能图拓扑 ID 冲突自愈合并装载算法 (核心)
  // 当实例化模板时，生成全套唯一的 Node ID，并更新对应的 Edges，防止多次连线网络装载时发生 ID 碰撞
  public static healAndPrepareData(
    template: SelfCreatedTemplate,
    currentCenterPos: { x: number; y: number }
  ): { nodes: any[]; edges: any[] } {
    const idMap: Record<string, string> = {};
    const timestamp = Date.now();

    // A. 寻找模板节点外包围盒的中心点，用于完美对齐当前的视口中心
    let minX = Infinity;
    let minY = Infinity;
    template.nodes.forEach(n => {
      if (n.position.x < minX) minX = n.position.x;
      if (n.position.y < minY) minY = n.position.y;
    });

    if (minX === Infinity) minX = 0;
    if (minY === Infinity) minY = 0;

    // B. 自愈重映射所有 Node ID
    const healedNodes = template.nodes.map((n, idx) => {
      const randStr = Math.random().toString(36).substring(2, 7);
      const newId = `${n.type || 'node'}_${timestamp}_${randStr}`;
      idMap[n.id] = newId;

      // 相对原模板左上角的偏移量，加上当前的视口中心坐标，实现居中对齐，并留有少量随机偏移防完美重叠
      const offsetPos = {
        x: n.position.x - minX,
        y: n.position.y - minY
      };

      return {
        ...n,
        id: newId,
        selected: true, // 默认处于选中状态以便用户装载后直接拖动微调
        position: {
          x: currentCenterPos.x + offsetPos.x + (idx * 15), // 微小层叠防重合
          y: currentCenterPos.y + offsetPos.y + (idx * 15)
        }
      };
    });

    // C. 自愈重映射所有 Edge ID 及其连线指针
    const healedEdges = template.edges.map(e => {
      const newSource = idMap[e.source];
      const newTarget = idMap[e.target];
      const randStr = Math.random().toString(36).substring(2, 7);
      const newEdgeId = `e_${newSource}_${newTarget}_${timestamp}_${randStr}`;

      return {
        ...e,
        id: newEdgeId,
        source: newSource,
        target: newTarget,
        selected: false
      };
    });

    return {
      nodes: healedNodes,
      edges: healedEdges
    };
  }
}
