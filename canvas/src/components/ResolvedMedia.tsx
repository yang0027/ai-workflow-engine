import React, { useState, useEffect } from 'react';

interface ResolvedMediaProps {
  url: string;
  type: 'image' | 'video' | 'audio';
  style?: React.CSSProperties;
  className?: string;
  controls?: boolean;
  onClick?: () => void;
  videoRef?: React.Ref<any>;
  autoPlay?: boolean;
  loop?: boolean;
  muted?: boolean;
  playsInline?: boolean;
  onEnded?: () => void;
}

// Convert Base64 Data URL to Blob for high-performance rendering without memory leaks or GPU crashes
function dataURItoBlob(dataURI: string): Blob {
  const parts = dataURI.split(',');
  if (parts.length < 2) {
    throw new Error('Invalid data URI');
  }
  const mimeMatch = parts[0].match(/:(.*?);/);
  const mimeString = mimeMatch ? mimeMatch[1] : 'image/png';
  
  // Safe decode of base64
  let byteString: string;
  try {
    byteString = atob(parts[1]);
  } catch (e) {
    // If decoding fails, try decoding URI component
    byteString = atob(decodeURIComponent(parts[1]));
  }

  const ab = new ArrayBuffer(byteString.length);
  const ia = new Uint8Array(ab);
  for (let i = 0; i < byteString.length; i++) {
    ia[i] = byteString.charCodeAt(i);
  }

  return new Blob([ab], { type: mimeString });
}

export function ResolvedMedia({
  url,
  type,
  style,
  className,
  controls,
  onClick,
  videoRef,
  autoPlay,
  loop,
  muted,
  playsInline,
  onEnded
}: ResolvedMediaProps) {
  const [resolvedUrl, setResolvedUrl] = useState<string>('');

  useEffect(() => {
    if (!url) {
      setResolvedUrl('');
      return;
    }

    let objectUrlToRevoke: string | null = null;
    let active = true;

    const processMediaData = (data: string) => {
      if (data.startsWith('data:')) {
        try {
          const blob = dataURItoBlob(data);
          const objUrl = URL.createObjectURL(blob);
          if (active) {
            objectUrlToRevoke = objUrl;
            setResolvedUrl(objUrl);
          }
        } catch (e) {
          console.error('[ResolvedMedia] Failed to convert base64 to Blob URL:', e);
          if (active) {
            setResolvedUrl(data); // Fallback to raw base64 if blob conversion fails
          }
        }
      } else {
        if (active) {
          setResolvedUrl(data);
        }
      }
    };

    if (url.startsWith('db://')) {
      const mediaId = url.replace('db://', '');
      
      const loadMedia = async () => {
        try {
          const getMedia = (window as any).getMediaFromDB;
          if (typeof getMedia === 'function') {
            const data = await getMedia(mediaId);
            if (active && data) {
              processMediaData(data);
              return;
            }
          }
        } catch (e) {
          console.error('[ResolvedMedia] IndexedDB read error:', e);
        }

        // Retry after a short delay if it's not registered yet
        setTimeout(async () => {
          try {
            const retryGetMedia = (window as any).getMediaFromDB;
            if (typeof retryGetMedia === 'function') {
              const data = await retryGetMedia(mediaId);
              if (active && data) {
                processMediaData(data);
              }
            }
          } catch (e) {
            console.error('[ResolvedMedia] IndexedDB retry error:', e);
          }
        }, 100);
      };

      loadMedia();
    } else {
      processMediaData(url);
    }

    return () => {
      active = false;
      if (objectUrlToRevoke) {
        try {
          URL.revokeObjectURL(objectUrlToRevoke);
        } catch (err) {
          console.error('[ResolvedMedia] Revocation failed:', err);
        }
      }
    };
  }, [url]);

  if (!resolvedUrl) {
    return (
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: 'rgba(255,255,255,0.4)',
          fontSize: '10px',
          width: '100%',
          height: '100%',
          ...style
        }}
      >
        <span>🔄 加载中...</span>
      </div>
    );
  }

  if (type === 'image') {
    return (
      <img
        src={resolvedUrl}
        alt="resolved media"
        style={style}
        className={className}
        onClick={onClick}
      />
    );
  } else if (type === 'video') {
    return (
      <video
        ref={videoRef}
        src={resolvedUrl}
        style={style}
        className={className}
        controls={controls}
        autoPlay={autoPlay}
        loop={loop}
        muted={muted}
        playsInline={playsInline}
        onClick={onClick}
        onEnded={onEnded}
      />
    );
  } else if (type === 'audio') {
    return (
      <audio
        ref={videoRef as any}
        src={resolvedUrl}
        style={style}
        className={className}
        controls={controls}
        autoPlay={autoPlay}
        loop={loop}
        onClick={onClick}
        onEnded={onEnded}
      />
    );
  }

  return null;
}

