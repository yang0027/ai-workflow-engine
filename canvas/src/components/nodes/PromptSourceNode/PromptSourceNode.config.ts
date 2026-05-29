import React from 'react';

export interface PromptSourceNodeData {
  label?: string;
  inputs?: {
    text?: string;
    model?: string;
    mode?: string;
    [key: string]: any;
  };
  outputs?: {
    text?: string;
    output?: string;
  };
}

export interface PromptSourceNodeProps {
  id: string;
  data: PromptSourceNodeData;
  selected?: boolean;
  style?: React.CSSProperties;
}

export interface TableRow {
  scene: string;
  prompt: string;
  tts: string;
}

export interface DownstreamType {
  type: string;
  label: string;
}

export const DOWNSTREAM_TYPES: DownstreamType[] = [
  { type: 'llm-service', label: '🧠 剧本分镜专家' },
  { type: 'image-service', label: '🎨 智能生图 Agent' }
];

export const LYRIC_MODELS = ['Suno-v3', 'Suno-v4', 'Chirp-v3.5', 'Llama-Lyrics-v2'];

export const WORK_MODES = [
  { id: 'text', label: '📝 智能文本/剧本' },
  { id: 'lyrics', label: '🎵 音乐歌词' }
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
  transition: 'all 0.2s cubic-bezier(0.4, 0, 0.2, 1)'
};

export const NODE_STYLE: React.CSSProperties = {
  minWidth: '320px',
  minHeight: '280px',
  background: 'rgba(15, 23, 42, 0.85)',
  borderRadius: '12px',
  padding: '16px',
  color: '#fff',
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
};
