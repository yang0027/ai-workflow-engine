# NewAPI / ZhangVIP 生图接口文档

## 概述

NewAPI（`api.zhangvip.top`）是一个 API 中转平台，底层对接各大厂商。它不自己处理图片生成，而是转发请求到原始厂商。

## 架构

```
Engine (submit) ──→ NewAPI ──→ 原始厂商（计费）
Engine (poll)   ──→ APIMart ──→ 原始厂商（不收费）
```

## 关键配置

```typescript
const NEW_API = {
  baseUrl: 'https://api.zhangvip.top',
  submitKey: 'Wgxda0oQv9JC8jr9k5F9mxulEULAnlBOyjOUnahJpvnX4HTF', // 不带 sk- 前缀
  endpoint: '/v1/images/generations',
}

const APIMART = {
  baseUrl: 'https://api.apimart.ai',
  pollKey: 'sk-XKmOcWp7L0l8ko1IqYbGu4qrmrHW2GHQHl31b4sZNXejoJJ', // 带 sk- 前缀
  endpoint: '/v1/images/generations',
}
```

## 支持的模型

| 模型 | 状态 | 说明 |
|---|---|---|
| `gpt-image-1` | ✅ | 支持，异步 |
| `gpt-image-2` | ⚠️ | NewAPI 文档无，实践可提交但可能失败 |
| `dall-e-2` | ✅ | 支持 |
| `dall-e-3` | ✅ | 支持 |

## Step 1：提交任务

**端点**: `POST https://api.zhangvip.top/v1/images/generations`

**请求头**: `Authorization: Bearer {key}`（key 不带 `sk-` 前缀）

**请求体**:
```json
{
  "model": "gpt-image-2",
  "prompt": "a cute orange cat",
  "size": "1024x1024",
  "n": 1
}
```

**响应**（异步任务）:
```json
{
  "code": 200,
  "data": [{
    "status": "submitted",
    "task_id": "task_01KSS94909FTYNFJ8RTHC6TXPP"
  }]
}
```

## Step 2：轮询结果

**轮询走 APIMart**（免费，不经过 NewAPI 计费）

**端点**: `POST https://api.apimart.ai/v1/images/generations`

**请求头**: `Authorization: Bearer {key}`（key 带 `sk-` 前缀）

**请求体**:
```json
{ "task_id": "task_01KSS94909FTYNFJ8RTHC6TXPP" }
```

**轮询间隔**: 5 秒

**超时**: 600 秒

**响应**（进行中）:
```json
{
  "data": [{
    "status": "pending",  // 或 "processing"
    "task_id": "task_01KSS94909FTYNFJ8RTHC6TXPP"
  }]
}
```

**响应**（完成）:
```json
{
  "data": [{
    "status": "completed",
    "url": "https://..."
  }]
}
```

**响应**（失败）:
```json
{
  "data": [{
    "status": "failed",
    "error": "..."
  }]
}
```

## 注意事项

1. **Key 前缀不同**: NewAPI 提交用无前缀 key，APIMart 轮询用 `sk-` 前缀 key
2. **轮询不收费**: APIMart 直连原始厂商，不走 NewAPI 计费
3. **异步模式**: 所有模型都返回 task_id，必须轮询
4. **兼容格式**: 响应中 `data` 可能是数组（`data[0]`）也可能是对象（`data`），适配器需要兼容
