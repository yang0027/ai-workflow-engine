/**
 * @file index.ts
 * @description 统一收集并导出所有物理拆分的内置预设工作流，便于前端弹窗与服务层进行模块化管理及高弹性拓展。
 */

import { rhFaceConsistency } from './rh_face_consistency';
import { rhStyleTransfer } from './rh_style_transfer';
import { rhMinimalistGen } from './rh_minimalist_gen';
import { rhIpPersona } from './rh_ip_persona';
import { rhScriptStoryboard } from './rh_script_storyboard';
import { rhVr360Pano } from './rh_vr_360_pano';
import { rhSeedance } from './rh_seedance';
import { rhAmazonBrand } from './rh_amazon_brand';
import { PresetWorkflow } from './preset-workflow.interface';

export * from './preset-workflow.interface';

// 全局注册的内置工作流池
export const PRESET_WORKFLOWS: PresetWorkflow[] = [
  rhFaceConsistency,
  rhStyleTransfer,
  rhMinimalistGen,
  rhIpPersona,
  rhScriptStoryboard,
  rhVr360Pano,
  rhSeedance,
  rhAmazonBrand
];
