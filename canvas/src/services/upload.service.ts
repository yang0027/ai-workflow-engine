/**
 * 统一云原生存储物理上传服务 (MinIO Upload Client Service)
 * 策略：MinIO 失败直接抛错，禁止静默降级为 base64/db://
 */
export class UploadService {
  /**
   * 直接上传 File 对象（FormData 二进制传输，无 base64 膨胀）
   * 推荐用于大文件（视频、音频），避免 1.33x base64 膨胀导致 Failed to fetch
   * @param file 原始 File 对象
   * @param fileType 多媒体分类
   * @returns 标准 MinIO HTTP URL
   * @throws 上传失败时直接抛出错误
   */
  static async uploadFile(
    file: File,
    fileType: 'image' | 'video' | 'audio'
  ): Promise<string> {
    const formData = new FormData();
    formData.append('file', file);
    formData.append('filename', file.name);
    formData.append('fileType', fileType);

    const res = await fetch('http://localhost:3000/api/v1/upload/multipart', {
      method: 'POST',
      body: formData
      // 注意：不设 Content-Type，让浏览器自动设 multipart/form-data boundary
    });

    if (!res.ok) {
      throw new Error(`MinIO 上传失败: HTTP ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    if (!data.url) {
      throw new Error('MinIO 上传成功但未返回有效 URL，请检查网关响应格式');
    }

    return data.url;
  }

  /**
   * 将 Base64 多媒体资源安全上传至 MinIO（适用于已有 base64 的场景，如 AI 生成图）
   * @param base64 原始 Base64 数据串
   * @param fileName 自定义文件名
   * @param fileType 多媒体分类
   * @returns 标准 MinIO HTTP URL
   * @throws 上传失败时直接抛出错误
   */
  static async uploadBase64(
    base64: string,
    fileName: string,
    fileType: 'image' | 'video' | 'audio'
  ): Promise<string> {
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

    if (!res.ok) {
      throw new Error(`MinIO 上传失败: HTTP ${res.status} ${res.statusText}`);
    }

    const data = await res.json();
    if (!data.url) {
      throw new Error('MinIO 上传成功但未返回有效 URL，请检查网关响应格式');
    }

    return data.url;
  }
}
