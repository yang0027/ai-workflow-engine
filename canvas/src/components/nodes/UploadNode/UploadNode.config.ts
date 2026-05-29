import React from 'react';

export interface UploadNodeData {
  label?: string;
  progress?: number;
  inputs?: {
    fileType?: 'image' | 'video' | 'audio';
    fileUrl?: string;
    fileName?: string;
  };
  outputs?: {
    output?: string;
    fileType?: 'image' | 'video' | 'audio';
    errorMsg?: string;
  };
  isNew?: boolean;
}

export interface UploadNodeProps {
  id: string;
  data: UploadNodeData;
  selected?: boolean;
}

export interface DownstreamType {
  type: string;
  label: string;
}

export const DOWNSTREAM_TYPES: DownstreamType[] = [
  { type: 'image-service', label: '🎨 智能生图 Agent' },
  { type: 'video-fusion', label: '📹 视频合成 Fusion' }
];

export const HANDLE_STYLE: React.CSSProperties = {
  width: '24px',
  height: '24px',
  background: 'rgba(15, 23, 42, 0.95)',
  border: '1.5px solid rgba(168, 85, 247, 0.85)',
  borderRadius: '50%',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: 'rgba(168, 85, 247, 1)',
  cursor: 'crosshair',
  boxShadow: '0 0 10px rgba(168, 85, 247, 0.45)',
  fontWeight: 'bold',
  fontSize: '14px',
  userSelect: 'none',
  lineHeight: '24px',
  top: '50%',
  transform: 'translateY(-50%)',
  position: 'absolute',
  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)',
};

export const LIGHT_PRESETS = [
  '林布兰光', '蝴蝶光', '环状光', '派拉蒙光', '分割光', '显色光'
];

export const DIRECTION_MAP: Record<string, number> = {
  '正面': 0, '侧面': 90, '俯视': 30, '仰视': -30,
  '左45°': 45, '右45°': -45, '背面': 180, '顶视': 90
};

export const DIRECTIONS = Object.keys(DIRECTION_MAP);

export const CROP_RATIOS = ['1:1', '4:3', '16:9', '9:16', '21:9', '3:4', '2:3'];

export const SUB_PANEL_TYPES = ['angle', 'light', 'camera', 'hd', 'grid', 'crop'] as const;
export type SubPanelType = typeof SUB_PANEL_TYPES[number];
