import type { Edge, Node } from '@xyflow/react';

export type UpstreamMediaType = 'text' | 'image' | 'video' | 'audio' | 'unknown';

export interface UpstreamItem {
  /** 上游节点 ID */
  nodeId: string;
  /** 上游节点类型，如 upload-node / image-service / prompt-source */
  nodeType?: string;
  /** 上游节点名称，优先读取 data.label / data.title */
  nodeName: string;
  /** 上游 sourceHandle，用于明确端口取值 */
  sourceHandle?: string | null;
  /** 当前节点 targetHandle，用于区分 input / port_prompt 等 */
  targetHandle?: string | null;
  /** 归一化后的数据类型 */
  type: UpstreamMediaType;
  /** 实际传入值：文本、MinIO URL、普通 URL、data URL 等 */
  value: string;
}

export interface UpstreamData {
  /** 所有文本上游按换行合并，适合 prompt 注入 */
  text: string;
  /** 第一张上游图片，兼容现有单值写法 */
  image: string;
  /** 第一个上游视频，兼容现有单值写法 */
  video: string;
  /** 第一个上游音频，兼容现有单值写法 */
  audio: string;
  /** 所有上游条目，保留节点来源和类型信息 */
  all: UpstreamItem[];
  /** 多文本来源，供需要逐条处理的节点使用 */
  texts: string[];
  /** 多图片来源，供多参考图节点使用 */
  images: string[];
  /** 多视频来源 */
  videos: string[];
  /** 多音频来源 */
  audios: string[];
}

const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.ogg', '.m4a', '.aac', '.flac'];
const VIDEO_EXTENSIONS = ['.mp4', '.webm', '.mov', '.mkv', '.avi', '.mpeg', '.mpg'];
const IMAGE_EXTENSIONS = ['.png', '.jpg', '.jpeg', '.webp', '.gif', '.bmp', '.svg'];

function hasKnownExtension(value: string, extensions: string[]) {
  const cleanValue = value.split('?')[0].split('#')[0].toLowerCase();
  return extensions.some((ext) => cleanValue.endsWith(ext));
}

function isResourceUrl(value: string) {
  return (
    value.startsWith('http://') ||
    value.startsWith('https://') ||
    value.startsWith('data:') ||
    value.startsWith('blob:') ||
    hasKnownExtension(value, [...AUDIO_EXTENSIONS, ...VIDEO_EXTENSIONS, ...IMAGE_EXTENSIONS])
  );
}

function detectValueType(value: string, sourceNode: Node): UpstreamMediaType {
  const lowerValue = value.toLowerCase();
  const outputs = (sourceNode.data?.outputs || {}) as Record<string, any>;
  const inputs = (sourceNode.data?.inputs || {}) as Record<string, any>;
  const explicitType = String(outputs.fileType || inputs.fileType || outputs.type || inputs.type || '').toLowerCase();
  const nodeType = String(sourceNode.type || '').toLowerCase();

  if (
    explicitType === 'audio' ||
    nodeType.includes('tts') ||
    lowerValue.startsWith('data:audio/') ||
    hasKnownExtension(value, AUDIO_EXTENSIONS)
  ) {
    return 'audio';
  }

  if (
    explicitType === 'video' ||
    nodeType.includes('video') ||
    lowerValue.startsWith('data:video/') ||
    hasKnownExtension(value, VIDEO_EXTENSIONS)
  ) {
    return 'video';
  }

  if (
    explicitType === 'image' ||
    nodeType.includes('image') ||
    lowerValue.startsWith('data:image/') ||
    hasKnownExtension(value, IMAGE_EXTENSIONS)
  ) {
    return 'image';
  }

  if (!isResourceUrl(value)) {
    return 'text';
  }

  return 'unknown';
}

function readByPath(obj: Record<string, any>, path: string) {
  return path.split('.').reduce<any>((acc, key) => {
    if (acc && typeof acc === 'object') return acc[key];
    return undefined;
  }, obj);
}

function pickUpstreamValue(sourceNode: Node, sourceHandle?: string | null): string {
  const data = (sourceNode.data || {}) as Record<string, any>;
  const outputs = (data.outputs || {}) as Record<string, any>;
  const inputs = (data.inputs || {}) as Record<string, any>;

  // 优先按 sourceHandle 精准取值，避免多端口节点被 output 兜底误读。
  if (sourceHandle) {
    const candidates = [
      outputs[sourceHandle],
      inputs[sourceHandle],
      readByPath(data, sourceHandle),
    ];
    const hit = candidates.find((value) => typeof value === 'string' && value.trim().length > 0);
    if (hit) return hit;
  }

  const orderedCandidates = [
    outputs.output,
    outputs.image,
    outputs.video,
    outputs.audio,
    outputs.text,
    outputs.prompt,
    outputs.storyboard,
    inputs.fileUrl,
    inputs.image,
    inputs.video,
    inputs.audio,
    inputs.text,
    inputs.prompt,
  ];

  const value = orderedCandidates.find((item) => typeof item === 'string' && item.trim().length > 0);
  return value || '';
}

/**
 * 统一读取上游节点数据。
 *
 * 输入：当前节点 ID、React Flow edges、React Flow nodes。
 * 输出：文本、图片、视频、音频的首个值与完整列表，所有媒体 URL 均保持 MinIO/HTTP/data/blob 原样直通。
 */
export function getUpstreamData(nodeId: string, edges: Edge[], nodes: Node[]): UpstreamData {
  const incomingEdges = edges.filter((edge) => edge.target === nodeId);
  const all: UpstreamItem[] = [];
  const seen = new Set<string>();

  for (const edge of incomingEdges) {
    const sourceNode = nodes.find((node) => node.id === edge.source);
    if (!sourceNode) continue;

    const value = pickUpstreamValue(sourceNode, edge.sourceHandle);
    if (!value) continue;

    const type = detectValueType(value, sourceNode);
    const key = `${sourceNode.id}:${edge.sourceHandle || ''}:${edge.targetHandle || ''}:${value}`;
    if (seen.has(key)) continue;
    seen.add(key);

    all.push({
      nodeId: sourceNode.id,
      nodeType: sourceNode.type,
      nodeName: String((sourceNode.data as any)?.label || (sourceNode.data as any)?.title || sourceNode.id),
      sourceHandle: edge.sourceHandle,
      targetHandle: edge.targetHandle,
      type,
      value,
    });
  }

  const texts = all.filter((item) => item.type === 'text').map((item) => item.value);
  const images = all.filter((item) => item.type === 'image').map((item) => item.value);
  const videos = all.filter((item) => item.type === 'video').map((item) => item.value);
  const audios = all.filter((item) => item.type === 'audio').map((item) => item.value);

  return {
    text: texts.join('\n'),
    image: images[0] || '',
    video: videos[0] || '',
    audio: audios[0] || '',
    all,
    texts,
    images,
    videos,
    audios,
  };
}

export default getUpstreamData;
