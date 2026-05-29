/**
 * 统一参数映射钩子 (useParamMapper)
 *
 * 职责：统一管理 text/image/video/audio/width/height/batch_size 等参数的：
 *  - 类型检测（从 unifiedParams 的 fieldName / description / type 推断）
 *  - 取值来源（从 data.inputs 或 resolvedRef* 数组按索引映射）
 *  - 返回格式（aixInputs Record + dynamicMappings 数组）
 *
 * 适用范围：
 *  - useImageNodeLogic AIX 模式
 *  - useVideoNodeLogic AIX 模式
 *  - useTTSNodeLogic AIX 模式
 */
import { useMemo } from 'react';

// ====================== 类型定义 ======================

/** unifiedParams 中的每个参数项 */
export interface UnifiedParam {
  portId: string;
  nodeId: string;
  fieldName: string;
  fieldType: 'string' | 'number';
  fieldValue: any;
  description?: string;
  exposed?: boolean;
  type?: string; // 'image' | 'video' | 'audio' | 'text' 等
}

/** 用户输入上下文（各节点自行维护） */
export interface ParamContext {
  /** 用户在前端面板输入的原始值 */
  inputs: Record<string, any>;
  /** 尺寸字符串，如 "1024x1024"（仅 image 节点） */
  size?: string;
  /** 默认宽高（video 节点直接用此值） */
  defaultWidth?: number;
  defaultHeight?: number;
  /** 已解析的多媒体引用（按索引映射到对应参数位） */
  resolvedText?: string;
  resolvedImages?: string[];
  resolvedVideo?: string;
  resolvedAudio?: string | string[];
  /** 面部参考图（优先级高于 resolvedImages[0]） */
  resolvedFaceRef?: string;
  /** cfg / steps 默认值（仅 image） */
  defaultCfg?: number;
  defaultSteps?: number;
}

export interface DynamicMapping {
  portId: string;
  nodeId: string;
  fieldName: string;
  displayName: string;
  value: any;
}

export interface UseParamMapperReturn {
  /** 映射后的参数字典（直接传给 RunningHubService.executeCustomWorkflow 的 inputs） */
  aixInputs: Record<string, any>;
  /** 参数字典数组（用于执行链路） */
  dynamicMappings: DynamicMapping[];
}

// ====================== 参数类型检测 ======================

/** 根据字段名/描述/类型判断参数能力 */
function detectParamType(p: UnifiedParam): 'text' | 'image' | 'video' | 'audio' | 'width' | 'height' | 'batch_size' | 'cfg' | 'steps' | 'duration' | 'number' | 'other' {
  const fn = p.fieldName.toLowerCase();
  const desc = (p.description || '').toLowerCase();
  const t = (p.type || '').toLowerCase();
  const ft = (p.fieldType || '').toLowerCase();

  if (t === 'text' || fn === 'text' || fn === 'prompt' || fn === 'instruction' ||
      fn === 'description' || desc.includes('提示词') || desc.includes('文本') ||
      desc.includes('指令') || desc.includes('台词')) {
    return 'text';
  }
  if (t === 'image' || fn === 'image' || fn === 'faceref' || fn === 'img' || fn === 'refimage' ||
      fn === 'ref_image' || fn === 'face_ref' || desc.includes('图片') ||
      desc.includes('图像') || desc.includes('参考图')) {
    return 'image';
  }
  if (t === 'video' || fn === 'video' || fn === 'refvideo' || fn === 'ref_video' ||
      fn === 'clip' || desc.includes('视频')) {
    return 'video';
  }
  if (t === 'audio' || fn === 'audio' || fn === 'refaudio' || fn === 'ref_audio' ||
      fn === 'voice' || fn === 'clip_audio' || desc.includes('音频') ||
      desc.includes('声音') || desc.includes('配音') || desc.includes('语音')) {
    return 'audio';
  }
  if (fn === 'width' || fn === 'w') {
    return 'width';
  }
  if (fn === 'height' || fn === 'h') {
    return 'height';
  }
  if (fn === 'batch_size' || fn === 'batchsize' || fn === 'count' || fn === 'number') {
    return 'batch_size';
  }
  if (fn === 'cfg' || fn === 'cfg_scale' || desc.includes('cfg') || desc.includes('引导强度')) {
    return 'cfg';
  }
  if (fn === 'steps' || fn === 'num_steps' || desc.includes('步数') || desc.includes('采样步数')) {
    return 'steps';
  }
  if (fn === 'duration' || fn === 'length' || fn === 'seconds' ||
      desc.includes('时长') || desc.includes('秒')) {
    return 'duration';
  }
  if (ft === 'number' || typeof p.fieldValue === 'number') {
    return 'number';
  }
  return 'other';
}

// ====================== 核心映射逻辑（纯函数） ======================

/** 纯函数版本：给定参数列表和上下文，返回映射后的结果 */
export function mapParams(params: UnifiedParam[], ctx: ParamContext): UseParamMapperReturn {
  const inputs: Record<string, any> = {};
  const mappings: DynamicMapping[] = [];

  let textIdx = 0;
  let imageIdx = 0;
  let videoIdx = 0;
  let audioIdx = 0;

  for (const p of params) {
    const inputKey = p.portId;
    const isNum = p.fieldType === 'number' || typeof p.fieldValue === 'number';
    const type = detectParamType(p);
    let rawVal: any;

    switch (type) {
      case 'text':
        rawVal = textIdx === 0
          ? (ctx.resolvedText || '')
          : (ctx.inputs[inputKey] !== undefined ? ctx.inputs[inputKey] : p.fieldValue);
        textIdx++;
        break;

      case 'image': {
        const refImage = ctx.resolvedFaceRef || '';
        if (imageIdx === 0 && refImage) {
          rawVal = refImage;
        } else {
          rawVal = (ctx.resolvedImages?.[imageIdx] || refImage || '');
        }
        imageIdx++;
        break;
      }

      case 'video':
        rawVal = ctx.resolvedVideo || ctx.inputs[inputKey] || p.fieldValue || '';
        videoIdx++;
        break;

      case 'audio':
        if (Array.isArray(ctx.resolvedAudio)) {
          rawVal = (ctx.resolvedAudio[audioIdx] || ctx.inputs[inputKey] || p.fieldValue || '');
        } else {
          rawVal = audioIdx === 0
            ? (ctx.resolvedAudio || ctx.inputs[inputKey] || p.fieldValue || '')
            : (ctx.inputs[inputKey] || p.fieldValue || '');
        }
        audioIdx++;
        break;

      case 'width': {
        let w: number;
        if (ctx.size) {
          const parts = ctx.size.split('x');
          w = parseInt(parts[0]) || ctx.defaultWidth || 1024;
        } else {
          w = ctx.inputs.width ?? ctx.inputs[inputKey] ?? ctx.defaultWidth ?? 1024;
        }
        rawVal = isNum ? w : String(w);
        break;
      }

      case 'height': {
        let h: number;
        if (ctx.size) {
          const parts = ctx.size.split('x');
          h = parseInt(parts[1]) || ctx.defaultHeight || 1024;
        } else {
          h = ctx.inputs.height ?? ctx.inputs[inputKey] ?? ctx.defaultHeight ?? 1024;
        }
        rawVal = isNum ? h : String(h);
        break;
      }

      case 'batch_size':
        rawVal = isNum ? 1 : '1';
        break;

      case 'cfg':
        rawVal = isNum
          ? (ctx.inputs.cfg ?? ctx.defaultCfg ?? 7.0)
          : String(ctx.inputs.cfg ?? ctx.defaultCfg ?? 7.0);
        break;

      case 'steps':
        rawVal = isNum
          ? (ctx.inputs.steps ?? ctx.defaultSteps ?? 20)
          : String(ctx.inputs.steps ?? ctx.defaultSteps ?? 20);
        break;

      case 'duration':
        rawVal = isNum
          ? (ctx.inputs.duration ?? ctx.inputs[inputKey] ?? 5)
          : String(ctx.inputs.duration ?? ctx.inputs[inputKey] ?? '5');
        break;

      case 'number':
        rawVal = isNum
          ? (ctx.inputs[inputKey] ?? p.fieldValue)
          : String(ctx.inputs[inputKey] ?? p.fieldValue);
        break;

      default:
        rawVal = ctx.inputs[inputKey] !== undefined ? ctx.inputs[inputKey] : p.fieldValue;
        break;
    }

    if (isNum && typeof rawVal === 'string') {
      const parsed = parseFloat(rawVal);
      if (!isNaN(parsed)) rawVal = parsed;
    }

    inputs[inputKey] = rawVal;
    mappings.push({
      portId: inputKey,
      nodeId: p.nodeId,
      fieldName: p.fieldName,
      displayName: p.description || p.fieldName,
      value: rawVal,
    });
  }

  return { aixInputs: inputs, dynamicMappings: mappings };
}

// ====================== React 钩子 ======================

/**
 * 统一参数映射 React 钩子
 * @param params unifiedParams 列表（三个节点共用同一结构）
 * @param ctx 节点各自的上下文
 */
export function useParamMapper(params: UnifiedParam[], ctx: ParamContext): UseParamMapperReturn {
  return useMemo(() => mapParams(params, ctx), [
    params, ctx.inputs, ctx.size, ctx.defaultWidth, ctx.defaultHeight,
    ctx.resolvedText, ctx.resolvedImages, ctx.resolvedVideo, ctx.resolvedAudio,
    ctx.resolvedFaceRef, ctx.defaultCfg, ctx.defaultSteps,
  ]);
}
