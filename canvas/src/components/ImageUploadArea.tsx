import React, { useState, useEffect } from 'react';

interface ImageUploadAreaProps {
  displayVal: string;
  portId: string;
  onImageUploaded: (url: string) => void;
}

export function ImageUploadArea({ displayVal, portId, onImageUploaded }: ImageUploadAreaProps) {
  const [previewUrl, setPreviewUrl] = useState<string>('');
  const [loading, setLoading] = useState(false);

  // 解析预览 URL
  useEffect(() => {
    if (!displayVal) {
      setPreviewUrl('');
      return;
    }

    // data: URL - 直接使用
    if (displayVal.startsWith('data:')) {
      setPreviewUrl(displayVal);
      return;
    }

    // db:// 协议 - 尝试从 IndexedDB 读取
    if (displayVal.startsWith('db://')) {
      const mediaId = displayVal.replace('db://', '');
      const dbName = 'ToonflowDB';
      const storeName = 'mediaAssets';

      const request = indexedDB.open(dbName, 1);
      request.onsuccess = () => {
        try {
          const db = request.result;
          const tx = db.transaction(storeName, 'readonly');
          const store = tx.objectStore(storeName);
          const getRequest = store.get(mediaId);
          
          getRequest.onsuccess = () => {
            if (getRequest.result) {
              setPreviewUrl(getRequest.result.data);
            } else {
              setPreviewUrl('');
            }
          };
          getRequest.onerror = () => {
            console.warn('[ImageUploadArea] IndexedDB read failed for:', mediaId);
            setPreviewUrl('');
          };
        } catch (e) {
          console.warn('[ImageUploadArea] IndexedDB error:', e);
          setPreviewUrl('');
        }
      };
      request.onerror = () => {
        console.warn('[ImageUploadArea] IndexedDB open failed');
        setPreviewUrl('');
      };
      return;
    }

    // http/https URL - 直接使用
    if (displayVal.startsWith('http')) {
      setPreviewUrl(displayVal);
      return;
    }

    // 其他情况
    setPreviewUrl('');
  }, [displayVal]);

  // 处理文件上传
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setLoading(true);
    try {
      const reader = new FileReader();
      reader.onload = async (evt) => {
        const b64 = evt.target?.result as string;
        if (b64) {
          // 保存到 IndexedDB
          const mediaId = `media-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
          await saveToIndexedDB(mediaId, b64);
          // 同时上传到 ComfyUI 获取可用的文件名
          const comfyFilename = await uploadToComfyUI(file);
          if (comfyFilename) {
            // 使用 ComfyUI 文件名（优先）
            onImageUploaded(comfyFilename);
          } else {
            // 回退到 db:// 协议
            onImageUploaded(`db://${mediaId}`);
          }
        }
        setLoading(false);
      };
      reader.onerror = () => {
        console.error('[ImageUploadArea] FileReader error');
        setLoading(false);
      };
      reader.readAsDataURL(file);
    } catch (err) {
      console.error('[ImageUploadArea] Upload error:', err);
      setLoading(false);
    }
  };

  // 保存到 IndexedDB
  const saveToIndexedDB = (id: string, data: string): Promise<void> => {
    return new Promise((resolve, reject) => {
      const dbName = 'ToonflowDB';
      const request = indexedDB.open(dbName, 1);
      
      request.onupgradeneeded = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains('mediaAssets')) {
          db.createObjectStore('mediaAssets', { keyPath: 'id' });
        }
      };
      
      request.onsuccess = () => {
        try {
          const db = request.result;
          const tx = db.transaction('mediaAssets', 'readwrite');
          const store = tx.objectStore('mediaAssets');
          store.put({ id, data });
          tx.oncomplete = () => resolve();
          tx.onerror = () => reject(tx.error);
        } catch (e) {
          reject(e);
        }
      };
      request.onerror = () => reject(request.error);
    });
  };

  // 上传到 ComfyUI
  const uploadToComfyUI = async (file: File): Promise<string | null> => {
    try {
      const formData = new FormData();
      formData.append('image', file);

      const response = await fetch('http://localhost:3000/api/v1/comfyui/upload', {
        method: 'POST',
        body: formData
      });

      if (response.ok) {
        const data = await response.json();
        if (data.files && data.files[0]?.name) {
          return data.files[0].name;
        }
      }
    } catch (err) {
      console.warn('[ImageUploadArea] ComfyUI upload failed, will use db:// fallback');
    }
    return null;
  };

  return (
    <div
      onClick={() => document.getElementById(`upload-input-${portId}`)?.click()}
      style={{
        height: '70px',
        border: previewUrl ? '1px solid rgba(139,92,246,0.5)' : '1px dashed rgba(255,255,255,0.15)',
        borderRadius: '8px',
        background: previewUrl ? 'rgba(0,0,0,0.3)' : 'rgba(0,0,0,0.2)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        cursor: 'pointer',
        overflow: 'hidden',
        position: 'relative'
      }}
    >
      {loading ? (
        <span style={{ fontSize: '12px', color: '#a3a3a3' }}>⏳ 上传中...</span>
      ) : previewUrl ? (
        <img 
          src={previewUrl} 
          alt="Preview" 
          style={{ width: '100%', height: '100%', objectFit: 'cover' }} 
        />
      ) : (
        <span style={{ fontSize: '10px', color: 'rgba(255,255,255,0.4)' }}>📥 点击上传参考图</span>
      )}
      <input
        type="file"
        accept="image/*"
        id={`upload-input-${portId}`}
        onChange={handleFileChange}
        onClick={(e) => e.stopPropagation()}
        style={{ display: 'none' }}
      />
    </div>
  );
}

export default ImageUploadArea;
