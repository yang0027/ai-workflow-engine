/**
 * index.ts — GridNode 统一导出入口
 *
 * 外部只需从此文件导入：
 *   import GridNode from './GridNode';
 *   import { useGridNodeLogic } from './GridNode';
 */

export { default }             from './GridNode';
export { useGridNodeLogic }    from './GridNode.logic';
export * from './GridNode.config';
