import { ImageAdapter, VideoAdapter, TTSAdapter, LLMAdapter, AIConfig, ProviderRequest } from '../types.js';

export class OpenAIImageAdapter implements ImageAdapter {
  public provider = 'openai';

  public buildGenerateRequest(config: AIConfig, prompt: string, size: string, options?: any): ProviderRequest {
    return {
      url: `${config.baseUrl}/images/generations`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: {
        model: config.model || 'dall-e-3',
        prompt: prompt,
        size: size || '1024x1024',
        n: 1,
        response_format: 'url'
      }
    };
  }

  public parseGenerateResponse(result: any): { isAsync: boolean; taskId?: string; imageUrl?: string } {
    const url = result?.data?.[0]?.url || result?.url;
    if (url) {
      return { isAsync: false, imageUrl: url };
    }
    const taskId = result?.id || result?.taskId || result?.task_id;
    if (taskId) {
      return { isAsync: true, taskId };
    }
    throw new Error(`生图响应解析异常: ${JSON.stringify(result)}`);
  }

  public buildPollRequest(config: AIConfig, taskId: string): ProviderRequest {
    return {
      url: `${config.baseUrl}/tasks/${taskId}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: null
    };
  }

  public parsePollResponse(result: any): { status: 'pending' | 'processing' | 'completed' | 'failed'; imageUrl?: string; error?: string } {
    const status = (result?.status || 'failed').toLowerCase();
    if (status === 'success' || status === 'completed') {
      const url = result?.data?.[0]?.url || result?.url || result?.output;
      return { status: 'completed', imageUrl: url };
    }
    if (status === 'failed' || status === 'error') {
      return { status: 'failed', error: result?.error?.message || '生成失败' };
    }
    return { status: 'processing' };
  }
}

export class OpenAIVideoAdapter implements VideoAdapter {
  public provider = 'openai';

  public buildGenerateRequest(config: AIConfig, prompt: string, options?: any): ProviderRequest {
    return {
      url: `${config.baseUrl}/video/generations`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: {
        model: config.model || 'vidu-video-model',
        prompt: prompt,
        aspect_ratio: options?.aspectRatio || '16:9'
      }
    };
  }

  public parseGenerateResponse(result: any): { isAsync: boolean; taskId?: string; videoUrl?: string } {
    const taskId = result?.id || result?.taskId || result?.task_id;
    const url = result?.url || result?.video_url;
    if (url) {
      return { isAsync: false, videoUrl: url };
    }
    if (taskId) {
      return { isAsync: true, taskId };
    }
    throw new Error(`视频生成响应解析异常: ${JSON.stringify(result)}`);
  }

  public buildPollRequest(config: AIConfig, taskId: string): ProviderRequest {
    return {
      url: `${config.baseUrl}/tasks/${taskId}`,
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: null
    };
  }

  public parsePollResponse(result: any): { status: 'pending' | 'processing' | 'completed' | 'failed'; videoUrl?: string; error?: string } {
    const status = (result?.status || 'failed').toLowerCase();
    if (status === 'success' || status === 'completed') {
      const url = result?.data?.[0]?.url || result?.url || result?.output;
      return { status: 'completed', videoUrl: url };
    }
    if (status === 'failed' || status === 'error') {
      return { status: 'failed', error: result?.error?.message || '生成失败' };
    }
    return { status: 'processing' };
  }
}

export class OpenAITTSAdapter implements TTSAdapter {
  public provider = 'openai';

  public buildGenerateRequest(config: AIConfig, text: string, speakerId: string, options?: any): ProviderRequest {
    return {
      url: `${config.baseUrl}/audio/speech`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: {
        model: config.model || 'tts-1',
        input: text,
        voice: speakerId || 'alloy',
        response_format: 'mp3'
      }
    };
  }

  public parseGenerateResponse(result: any): { audioUrlOrBase64: string; format: string } {
    const audioUrl = result?.url || result?.audio_url || result?.data?.[0]?.url;
    if (audioUrl) {
      return { audioUrlOrBase64: audioUrl, format: 'mp3' };
    }
    throw new Error(`TTS 响应解析异常: ${JSON.stringify(result)}`);
  }
}

export class OpenAILLMAdapter implements LLMAdapter {
  public provider = 'openai';

  public buildChatRequest(config: AIConfig, messages: Array<{ role: string; content: string }>, options?: any): ProviderRequest {
    return {
      url: `${config.baseUrl}/chat/completions`,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.apiKey}`
      },
      body: {
        model: config.model || 'deepseek-chat',
        messages: messages,
        temperature: options?.temperature ?? 0.7,
        max_tokens: options?.max_tokens ?? 2000
      }
    };
  }

  public parseChatResponse(result: any): string {
    if (result?.choices?.[0]?.message?.content) {
      return result.choices[0].message.content;
    }
    throw new Error(`OpenAI LLM 响应解析异常: ${JSON.stringify(result)}`);
  }
}
