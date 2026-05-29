import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

// ============ CanvasService - 画布服务 ============
// 负责画布的 CRUD 操作、回收站管理、版本快照
// 存储位置：engine/data/canvases/

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 画布数据结构
interface CanvasData {
  id: string;
  name: string;
  nodes: any[];
  edges: any[];
  createdAt: string;
  updatedAt: string;
  deletedAt?: string | null;
}

// 快照数据结构
interface CanvasSnapshot {
  id: string;
  canvasId: string;
  nodes: any[];
  edges: any[];
  createdAt: string;
  name: string;
}

export class CanvasService {
  private static instance: CanvasService;
  private dataDir: string;
  private canvasesFile: string;
  private snapshotsDir: string;
  private canvases: Map<string, CanvasData> = new Map();

  private constructor() {
    this.dataDir = path.join(__dirname, '..', '..', 'data', 'canvases');
    this.canvasesFile = path.join(this.dataDir, 'canvases.json');
    this.snapshotsDir = path.join(this.dataDir, 'snapshots');
    this.ensureDataDir();
    this.loadCanvases();
  }

  static getInstance(): CanvasService {
    if (!CanvasService.instance) {
      CanvasService.instance = new CanvasService();
    }
    return CanvasService.instance;
  }

  // 确保数据目录存在
  private ensureDataDir(): void {
    if (!fs.existsSync(this.dataDir)) {
      fs.mkdirSync(this.dataDir, { recursive: true });
    }
    if (!fs.existsSync(this.snapshotsDir)) {
      fs.mkdirSync(this.snapshotsDir, { recursive: true });
    }
  }

  // 从文件加载画布数据
  private loadCanvases(): void {
    try {
      if (fs.existsSync(this.canvasesFile)) {
        const data = fs.readFileSync(this.canvasesFile, 'utf-8');
        const arr: CanvasData[] = JSON.parse(data);
        this.canvases = new Map(arr.map(c => [c.id, c]));
      }
    } catch (err) {
      console.error('[CanvasService] Failed to load canvases:', err);
      this.canvases = new Map();
    }
  }

  // 保存画布数据到文件
  private saveCanvases(): void {
    try {
      const arr = Array.from(this.canvases.values());
      fs.writeFileSync(this.canvasesFile, JSON.stringify(arr, null, 2));
    } catch (err) {
      console.error('[CanvasService] Failed to save canvases:', err);
    }
  }

  // ============ 画布列表（不含已删除）===========
  list(): CanvasData[] {
    return Array.from(this.canvases.values())
      .filter(c => !c.deletedAt)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  // ============ 获取单个画布 ============
  get(id: string): CanvasData | undefined {
    return this.canvases.get(id);
  }

  // ============ 创建画布 ============
  create(name: string = '未命名画布'): CanvasData {
    const now = new Date().toISOString();
    const canvas: CanvasData = {
      id: randomUUID(),
      name,
      nodes: [],
      edges: [],
      createdAt: now,
      updatedAt: now
    };
    this.canvases.set(canvas.id, canvas);
    this.saveCanvases();
    return canvas;
  }

  // ============ 更新画布（同时创建快照）===========
  update(id: string, data: { name?: string; nodes?: any[]; edges?: any[]; snapshot?: boolean }): CanvasData | null {
    const canvas = this.canvases.get(id);
    if (!canvas || canvas.deletedAt) return null;

    const oldNodes = canvas.nodes;
    const oldEdges = canvas.edges;

    if (data.name !== undefined) canvas.name = data.name;
    if (data.nodes !== undefined) canvas.nodes = data.nodes;
    if (data.edges !== undefined) canvas.edges = data.edges;
    canvas.updatedAt = new Date().toISOString();

    // 当内容变化时创建快照（节点或连线有实际内容才保存）
    if (data.snapshot !== false && ((data.nodes && data.nodes.length > 0) || (data.edges && data.edges.length > 0))) {
      this.createSnapshot(canvas.id, oldNodes, oldEdges, canvas.name, '更新前');
    }

    this.saveCanvases();
    return canvas;
  }

  // ============ 软删除（移入回收站）===========
  delete(id: string): boolean {
    const canvas = this.canvases.get(id);
    if (!canvas) return false;
    canvas.deletedAt = new Date().toISOString();
    this.saveCanvases();
    return true;
  }

  // ============ 恢复画布 ============
  restore(id: string): boolean {
    const canvas = this.canvases.get(id);
    if (!canvas || !canvas.deletedAt) return false;
    canvas.deletedAt = null;
    canvas.updatedAt = new Date().toISOString();
    this.saveCanvases();
    return true;
  }

  // ============ 永久删除（包含快照）===========
  permanentDelete(id: string): boolean {
    // 删除快照目录
    const snapshotPath = path.join(this.snapshotsDir, id);
    if (fs.existsSync(snapshotPath)) {
      fs.rmSync(snapshotPath, { recursive: true, force: true });
    }
    return this.canvases.delete(id) && this.saveCanvases() as any || true;
  }

  // ============ 回收站列表 ============
  listDeleted(): CanvasData[] {
    return Array.from(this.canvases.values())
      .filter(c => c.deletedAt)
      .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
  }

  // ============ 创建快照 ============
  createSnapshot(canvasId: string, nodes: any[], edges: any[], name: string, note: string = ''): CanvasSnapshot {
    const snapshot: CanvasSnapshot = {
      id: randomUUID(),
      canvasId,
      nodes: JSON.parse(JSON.stringify(nodes)),  // 深拷贝
      edges: JSON.parse(JSON.stringify(edges)),
      createdAt: new Date().toISOString(),
      name: `${name} - ${note} ${new Date().toLocaleString('zh-CN')}`
    };

    // 每个画布一个快照目录
    const canvasSnapshotDir = path.join(this.snapshotsDir, canvasId);
    if (!fs.existsSync(canvasSnapshotDir)) {
      fs.mkdirSync(canvasSnapshotDir, { recursive: true });
    }

    const snapshotFile = path.join(canvasSnapshotDir, `${snapshot.id}.json`);
    fs.writeFileSync(snapshotFile, JSON.stringify(snapshot, null, 2));

    // 限制每个画布最多保留 20 个快照
    this.cleanupOldSnapshots(canvasId, 20);

    return snapshot;
  }

  // ============ 获取画布快照列表 ============
  listSnapshots(canvasId: string): CanvasSnapshot[] {
    const canvasSnapshotDir = path.join(this.snapshotsDir, canvasId);
    if (!fs.existsSync(canvasSnapshotDir)) {
      return [];
    }

    try {
      const files = fs.readdirSync(canvasSnapshotDir)
        .filter(f => f.endsWith('.json'))
        .map(f => {
          const content = fs.readFileSync(path.join(canvasSnapshotDir, f), 'utf-8');
          return JSON.parse(content) as CanvasSnapshot;
        })
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      return files;
    } catch (err) {
      console.error('[CanvasService] Failed to list snapshots:', err);
      return [];
    }
  }

  // ============ 获取单个快照 ============
  getSnapshot(canvasId: string, snapshotId: string): CanvasSnapshot | null {
    const snapshotFile = path.join(this.snapshotsDir, canvasId, `${snapshotId}.json`);
    if (!fs.existsSync(snapshotFile)) {
      return null;
    }
    try {
      return JSON.parse(fs.readFileSync(snapshotFile, 'utf-8'));
    } catch (err) {
      console.error('[CanvasService] Failed to get snapshot:', err);
      return null;
    }
  }

  // ============ 回滚到指定快照 ============
  rollback(canvasId: string, snapshotId: string): CanvasData | null {
    const snapshot = this.getSnapshot(canvasId, snapshotId);
    if (!snapshot) return null;

    const canvas = this.canvases.get(canvasId);
    if (!canvas) return null;

    // 保存当前状态为快照
    this.createSnapshot(canvasId, canvas.nodes, canvas.edges, canvas.name, '回滚前');

    // 恢复到指定快照
    canvas.nodes = snapshot.nodes;
    canvas.edges = snapshot.edges;
    canvas.updatedAt = new Date().toISOString();

    this.saveCanvases();
    return canvas;
  }

  // ============ 清理旧快照（保留最新 N 个）===========
  private cleanupOldSnapshots(canvasId: string, keepCount: number): void {
    const snapshots = this.listSnapshots(canvasId);
    if (snapshots.length <= keepCount) return;

    // 删除多余的旧快照
    const toDelete = snapshots.slice(keepCount);
    const canvasSnapshotDir = path.join(this.snapshotsDir, canvasId);
    for (const snapshot of toDelete) {
      const snapshotFile = path.join(canvasSnapshotDir, `${snapshot.id}.json`);
      if (fs.existsSync(snapshotFile)) {
        fs.unlinkSync(snapshotFile);
      }
    }
  }
}
