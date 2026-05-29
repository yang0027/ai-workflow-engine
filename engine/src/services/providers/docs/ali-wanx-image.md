# 阿里云百炼（DashScope）生图接口文档

## 概述

阿里云百炼（DashScope）提供 WanX 系列生图模型。接口分**同步**和**异步**两种模式。

## 关键端点

| 模式 | 端点 |
|---|---|
| 同步（推荐） | `POST https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation` |
| 异步 | `POST https://dashscope.aliyuncs.com/api/v1/services/aigc/image-generation/generation` + `GET https://dashscope.aliyuncs.com/api/v1/tasks/{task_id}` |

## 支持的模型

| 模型 | 推荐端点 | 模式 | 分辨率 |
|---|---|---|---|
| `wan2.7-image-pro` | multimodal-generation | 同步 | 1K / 2K / **4K** |
| `wan2.7-image` | multimodal-generation | 同步 | 1K / 2K |
| `qwen-image-2.0-pro` | image-generation | 异步 | 需确认 |

## 同步调用（推荐）

**端点**: `POST https://dashscope.aliyuncs.com/api/v1/services/aigc/multimodal-generation/generation`

**请求头**:
```
Authorization: Bearer {DASHSCOPE_API_KEY}
Content-Type: application/json
```

**请求体**:
```json
{
  "model": "wan2.7-image-pro",
  "input": {
    "messages": [{
      "role": "user",
      "content": [{
        "text": "一只可爱的橘猫在阳光下打盹"
      }]
    }]
  },
  "parameters": {
    "size": "2K",
    "n": 1,
    "watermark": false
  }
}
```

**响应**（直接返回图片 URL）:
```json
{
  "output": {
    "choices": [{
      "finish_reason": "stop",
      "message": {
        "role": "assistant",
        "content": [{
          "image_url": "https://dashscope-result.xxx.oss-cn-hangzhou.aliyuncs.com/..."
        }]
      }
    }]
  },
  "usage": { "total_tokens": 123 },
  "request_id": "..."
}
```

## 异步调用

**Step 1**: 提交任务

**端点**: `POST https://dashscope.aliyuncs.com/api/v1/services/aigc/image-generation/generation`

**额外请求头**: `X-DashScope-Async: enable`

**请求体**:
```json
{
  "model": "wan2.7-image-pro",
  "input": {
    "messages": [{
      "role": "user",
      "content": [{
        "text": "一只可爱的橘猫"
      }]
    }]
  },
  "parameters": {
    "size": "2K",
    "n": 1
  }
}
```

**响应**:
```json
{
  "output": {
    "task_id": "86ecf553-d340-4e21-xxxx"
  },
  "request_id": "..."
}
```

**Step 2**: 轮询结果

**端点**: `GET https://dashscope.aliyuncs.com/api/v1/tasks/{task_id}`

**请求头**: `Authorization: Bearer {DASHSCOPE_API_KEY}`

**轮询间隔**: 3 秒

**超时**: 600 秒

**响应**（进行中）:
```json
{
  "output": {
    "task_status": "PENDING"  // 或 PROCESSING
  },
  "request_id": "..."
}
```

**响应**（完成）:
```json
{
  "output": {
    "task_status": "SUCCEEDED",
    "results": [{
      "image_url": "https://dashscope-result.xxx.oss-cn-hangzhou.aliyuncs.com/..."
    }]
  },
  "request_id": "..."
}
```

## Engine 当前问题

Engine 的 `app.ts` 中，ali provider 使用的是 OpenAI 兼容端点 `/images/generations`，这在阿里云百炼上 **404**。

**修复方案**: 将 ali provider 接入 `AliWanxAdapter`，走原生 `/multimodal-generation/generation` 端点。

## Key 获取

阿里云百炼 API Key 格式: `sk-xxxxxxxx`，不带 `sk-` 前缀时 base64 编码使用。
