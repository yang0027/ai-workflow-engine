/**
 * 统一云原生存储物理上传服务 (MinIO Upload Client Service)
 */
export class UploadService {
  /**
   * 将 Base64 多媒体资源安全上传至 MinIO，获取标准公共可读 HTTP 链路
   * @param base64 原始 Base64 数据串
   * @param fileName 自定义文件名
   * @param fileType 多媒体分类: 'image' | 'video' | 'audio'
   * @returns 标准 HTTP URL，若网关异常则执行本地高自愈 Base64 降级直出
   */
  static async uploadBase64(
    base64: string, 
    fileName: string, 
    fileType: 'image' | 'video' | 'audio'
  ): Promise<string> {
    try {
      const res = await fetch('http://localhost:3000/api/v1/upload', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          file: base64,
          fileBase64: base64,
          filename: fileName,
          fileName,
          fileType
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        if (data.url) {
          return data.url;
        }
      }
      throw new Error(`统一网关响应状态异常: ${res.statusText}`);
    } catch (e: any) {
      console.warn('⚠️ MinIO 物理上传链路网络报错，自愈降级回退为本地高自愈 Blob 临时链接:', e.message);
      
      if (base64.startsWith('data:') && base64.length > 80000) {
        try {
          const parts = base64.split(',');
          if (parts.length >= 2) {
            const mimeMatch = parts[0].match(/:(.*?);/);
            const mimeString = mimeMatch ? mimeMatch[1] : 'image/png';
            
            const byteString = atob(parts[1]);
            const ab = new ArrayBuffer(byteString.length);
            const ia = new Uint8Array(ab);
            for (let i = 0; i < byteString.length; i++) {
              ia[i] = byteString.charCodeAt(i);
            }
            const blob = new Blob([ab], { type: mimeString });
            const blobUrl = URL.createObjectURL(blob);
            console.log('🛡️ [UploadService] 成功物理自愈：已将超限巨型 Base64 降级转换为高性能轻量 Blob URL:', blobUrl);
            return blobUrl;
          }
        } catch (blobErr: any) {
          console.error('[UploadService] 降级转换 Blob URL 发生异常，回退为原始 Base64:', blobErr.message);
        }
      }
      return base64;
    }
  }
}
