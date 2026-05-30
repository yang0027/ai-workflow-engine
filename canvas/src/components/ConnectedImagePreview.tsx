import React, { useState, useEffect, useRef } from 'react';

interface ConnectedImagePreviewProps {
  imageValue: string;
  nodeId?: string;
  portId?: string;
  onComfyFilenameReady?: (comfyFilename: string) => void;
}

/**
 * 显示连线图片预览，自动将图片上传到 ComfyUI 并显示上传状态
 */
export function ConnectedImagePreview({ imageValue, nodeId, portId, onComfyFilenameReady }: ConnectedImagePreviewProps) {
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [comfyFilename, setComfyFilename] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [status, setStatus] = useState<'pending' | 'uploading' | 'ready' | 'error'>('pending');
  
  // 缓存已上传的 ComfyUI 文件名
  const uploadedCache = useRef<Map<string, string>>(new Map());

  useEffect(() => {
    if (!imageValue) {
      setPreviewUrl('');
      setComfyFilename(null);
      setStatus('pending');
      return;
    }

    // 如果缓存中有这个图片的 ComfyUI 文件名，直接使用
    if (uploadedCache.current.has(imageValue)) {
      const cachedFilename = uploadedCache.current.get(imageValue)!;
      setComfyFilename(cachedFilename);
      // 仍然需要设置预览 URL
      if (imageValue.startsWith('data:')) {
        setPreviewUrl(imageValue);
      } else if (imageValue.startsWith('db://')) {
        const mediaId = imageValue.replace('db://', '');
        loadFromIndexedDB(mediaId);
        return;
      } else if (imageValue.startsWith('http')) {
        setPreviewUrl(imageValue);
      } else {
        setPreviewUrl(`http://localhost:8188/view?filename=${encodeURIComponent(cachedFilename)}`);
      }
      setStatus('ready');
      return;
    }

    // data: URL - 直接使用
    if (imageValue.startsWith('data:')) {
      setPreviewUrl(imageValue);
      uploadToComfyUI(imageValue);
      return;
    }

    // db:// 协议 - 从 IndexedDB 读取
    if (imageValue.startsWith('db://')) {
      const mediaId = imageValue.replace('db://', '');
      loadFromIndexedDB(mediaId);
      return;
    }

    // http/https URL - 直接使用
    if (imageValue.startsWith('http')) {
      setPreviewUrl(imageValue);
      setStatus('ready');
      return;
    }

    // ComfyUI 文件名 - 直接使用
    if (imageValue.match(/\.(png|jpg|jpeg|webp|gif)$/i)) {
      setPreviewUrl(`http://localhost:8188/view?filename=${encodeURIComponent(imageValue)}`);
      setComfyFilename(imageValue);
      setStatus('ready');
      return;
    }

    setPreviewUrl('');
    setStatus('pending');
  }, [imageValue]);

  // 通知父组件 ComfyUI 文件名准备好
  useEffect(() => {
    if (comfyFilename && onComfyFilenameReady) {
      onComfyFilenameReady(comfyFilename);
    }
  }, [comfyFilename, onComfyFilenameReady]);

  // 从 IndexedDB 加载图片
  const loadFromIndexedDB = async (mediaId: string) => {
    const getMedia = (window as any).getMediaFromDB;
    if (typeof getMedia === 'function') {
      try {
        const base64 = await getMedia(mediaId);
        if (base64) {
          setPreviewUrl(base64);
          uploadToComfyUI(base64);
          return;
        }
      } catch (e) {
        console.warn('[ConnectedImagePreview] 全局 getMediaFromDB 读取失败:', e);
      }
    }

    // 后备原生手写方案
    const dbName = 'ToonflowDB';
    const storeName = 'mediaAssets';

    try {
      const request = indexedDB.open(dbName, 1);
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains(storeName)) {
          db.createObjectStore(storeName, { keyPath: 'id' });
        }
      };
      
      request.onsuccess = () => {
        try {
          const db = request.result;
          const tx = db.transaction(storeName, 'readonly');
          const store = tx.objectStore(storeName);
          const getRequest = store.get(mediaId);
          
          getRequest.onsuccess = () => {
            if (getRequest.result) {
              const dataUrl = getRequest.result.data;
              setPreviewUrl(dataUrl);
              uploadToComfyUI(dataUrl);
            } else {
              setStatus('error');
            }
          };
          getRequest.onerror = () => setStatus('error');
        } catch (e) {
          setStatus('error');
        }
      };
      request.onerror = () => setStatus('error');
    } catch (err) {
      setStatus('error');
    }
  };

  // 上传到 ComfyUI
  const uploadToComfyUI = async (dataUrl: string) => {
    // 如果缓存中有，直接返回
    if (uploadedCache.current.has(dataUrl)) {
      const cached = uploadedCache.current.get(dataUrl)!;
      setComfyFilename(cached);
      setStatus('ready');
      return;
    }

    setStatus('uploading');
    setLoading(true);

    try {
      // 将 data URL 转换为 Blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      const file = new File([blob], 'image.png', { type: blob.type || 'image/png' });

      const formData = new FormData();
      formData.append('image', file);

      const uploadRes = await fetch('/api/v1/comfyui/upload', {
        method: 'POST',
        body: formData
      });

      if (uploadRes.ok) {
        const result = await uploadRes.json();
        if (result.files && result.files[0]?.name) {
          const filename = result.files[0].name;
          setComfyFilename(filename);
          setStatus('ready');
          // 缓存文件名
          uploadedCache.current.set(dataUrl, filename);
          console.log('[Preview] ✅ 已同步到 ComfyUI:', filename);
        } else {
          setStatus('error');
        }
      } else {
        setStatus('error');
      }
    } catch (err) {
      console.error('[Preview] 上传失败:', err);
      setStatus('error');
    } finally {
      setLoading(false);
    }
  };

  const statusColors: Record<string, string> = {
    pending: 'rgba(255,255,255,0.1)',
    uploading: 'rgba(139, 92, 246, 0.1)',
    ready: 'rgba(34, 197, 94, 0.1)',
    error: 'rgba(239, 68, 68, 0.1)'
  };

  const statusIcons: Record<string, string> = {
    pending: '🔗',
    uploading: '⏳',
    ready: '✓',
    error: '⚠️'
  };

  const statusText: Record<string, string> = {
    pending: '连线中...',
    uploading: '同步到 ComfyUI...',
    ready: comfyFilename || '已就绪',
    error: '同步失败'
  };

  return (
    <div style={{
      height: '70px',
      border: `1px solid ${status === 'error' ? 'rgba(239, 68, 68, 0.5)' : status === 'ready' ? 'rgba(34, 197, 94, 0.5)' : 'rgba(139, 92, 246, 0.5)'}`,
      borderRadius: '8px',
      background: statusColors[status],
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      position: 'relative'
    }}>
      {previewUrl ? (
        <>
          <img 
            src={previewUrl} 
            alt="Preview" 
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
          />
          <div style={{
            position: 'absolute',
            bottom: '0',
            left: '0',
            right: '0',
            background: 'rgba(0,0,0,0.75)',
            padding: '3px 6px',
            fontSize: '8px',
            color: status === 'error' ? '#ef4444' : status === 'ready' ? '#22c55e' : '#e9d5ff',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px'
          }}>
            {loading && <span style={{ animation: 'spin 1s linear infinite' }}>🔄</span>}
            {statusIcons[status]} {statusText[status]}
          </div>
        </>
      ) : (
        <span style={{ fontSize: '10px', color: status === 'error' ? '#ef4444' : '#a3a3a3' }}>
          {statusIcons[status]} {statusText[status]}
        </span>
      )}
    </div>
  );
}

export default ConnectedImagePreview;
