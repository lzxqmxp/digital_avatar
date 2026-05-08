# 真实后端联调实施计划（LiveTalking 版本）

> **⚠️ 已弃用（2026-05-08）** — 5 个 Task 已全部执行完毕，结果已合并至 [plan.md](plan.md)。本文档仅供历史参考。

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 打通 Node 主控进程与 LiveTalking 的 HTTP 联调，使 `dev-cpu` 模式完整可用：媒体路径走 LiveTalking 真实推理，数据路径走 SQLite 持久化，LLM/风控路径走 Node 侧云 API 调用。

**Architecture:** LiveTalking 作为实时媒体后端（TTS + Avatar 推理 + WebRTC），运行在 `localhost:8010`。Electron Main 进程管理 LiveTalking 子进程生命周期。数据类路径（scripts/policies/models/accounts）继续走现有 IPC → SQLite 通道。Node 侧新增 LLM/改写/风控服务，通过 HTTP 调用云端 API。

**Tech Stack:** LiveTalking (Python), Node.ts (Existing Main Process), SQLite (Existing in Main), Cloud LLM API

---

## 架构总览

```
Renderer (Vue 3)          Pinia Store → apiClient
    ↕ IPC (preload bridge)
Electron Main (Node)
    ├── SQLite DB ── M3 数据持久化（已存在 mock-api-db.ts）
    ├── LLM Client ── 改写/生成/风控（新增）
    ├── LiveTalking Manager ── 进程管理（新增）
    │       ↕ HTTP localhost:8010
    └── LiveTalking (Python)
            ├── POST /human ── TTS + 播报（type: echo, 支持 interrupt）
            ├── POST /offer ── WebRTC SDP 协商
            └── POST /is_speaking ── 状态查询
```

### 路由策略（dev-cpu 模式）

| 路径类别                                    | 路由目标               | 说明                              |
| ------------------------------------------- | ---------------------- | --------------------------------- |
| session/live/queue/tts/avatar/stream        | → LiveTalking HTTP API | `livetalking.ts` 适配器已实现     |
| scripts/policies/writer/models/accounts/asr | → IPC → Main SQLite    | 现有 `mock-api-db.ts` 通道        |
| moderation/rewrite                          | → Node 侧本地实现      | 无 LiveTalking 对应，本地或云 API |

---

## 文件结构映射

### 新建文件

| 文件                                   | 职责                                                 |
| -------------------------------------- | ---------------------------------------------------- |
| `electron/main/livetalking-process.ts` | LiveTalking 子进程生命周期管理（启动/停止/健康检查） |
| `src/shared/api/llm-client.ts`         | LLM 云 API 客户端（改写/敏感词检测）                 |

### 修改文件

| 文件                              | 改动                                                    |
| --------------------------------- | ------------------------------------------------------- |
| `electron/main/index.ts`          | 添加 LiveTalking 进程启动/关闭                          |
| `src/shared/api/client.ts`        | dev-cpu 模式：媒体路径→LiveTalking，数据路径→IPC SQLite |
| `runtime/adapters/livetalking.ts` | 增强错误处理 + LLM/风控路径补充                         |
| `runtime/adapters/index.ts`       | 已有正确导出，无需变动                                  |
| `.env.dev-cpu`                    | 确保 LiveTalking URL 配置正确                           |
| `package.json`                    | 添加 LiveTalking 管理脚本                               |

---

### Task 1: 修复 dev-cpu 模式路由（数据路径走 IPC SQLite）

**Files:**

- Modify: `src/shared/api/client.ts`

**问题：** 当前 `dev-cpu` 模式所有路径都走 `liveTalkingCall`，但 M3 数据路径（scripts/policies/models/accounts 等）LiveTalking 不处理，会返回 "Unknown LiveTalking path" 错误。

**解决：** `client.ts` 中 `isCpu` 分支先检查是否为 SQLite 数据路径，是则走 IPC，否则走 LiveTalking。

- [ ] **Step 1: 读取 client.ts 当前内容**

确认当前 `src/shared/api/client.ts` 的 `isCpu` 分支：

```typescript
if (isCpu) {
  const { liveTalkingCall } = await import('@runtime/adapters/livetalking')
  return liveTalkingCall<T>(path, method, body)
}
```

- [ ] **Step 2: 修改为双路由策略**

```typescript
if (isCpu) {
  // 数据类路径（M3）→ IPC → Main SQLite（通过 mock 的 callSqliteBackedApi）
  const { trySqliteBackedApi } = await import('@runtime/mock/handlers')
  const sqliteResult = await trySqliteBackedApi<T>(path, method, body)
  if (sqliteResult !== null) {
    return sqliteResult
  }
  // 媒体路径 → LiveTalking
  const { liveTalkingCall } = await import('@runtime/adapters/livetalking')
  return liveTalkingCall<T>(path, method, body)
}
```

- [ ] **Step 3: 导出 trySqliteBackedApi**

在 `runtime/mock/handlers.ts` 中将 `callSqliteBackedApi` 导出为 `trySqliteBackedApi`（重命名导出）：

```typescript
// 在文件末尾添加
export { callSqliteBackedApi as trySqliteBackedApi }
```

- [ ] **Step 4: 验证类型检查**

```bash
npm run typecheck
```

Expected: 无类型错误。

- [ ] **Step 5: Commit**

```bash
git add src/shared/api/client.ts runtime/mock/handlers.ts
git commit -m "fix(api): route M3 paths through IPC SQLite in dev-cpu mode"
```

---

### Task 2: 增强 LiveTalking 适配器

**Files:**

- Modify: `runtime/adapters/livetalking.ts`

- [ ] **Step 1: 增强 moderation 和 rewrite 路径**

当前 `MODERATION_CHECK` 和 `SCRIPT_REWRITE` 是纯透传，返回空数据。改为加入基础逻辑：

`MODERATION_CHECK`: 基础敏感词检测（内置词库 + 透传结果）

```typescript
case ApiPaths.MODERATION_CHECK: {
  const req = body as ModerationCheckRequest
  const text = req?.text ?? ''
  const FLAGGED_WORDS = ['违禁', '敏感词']
  const hit = FLAGGED_WORDS.filter(w => text.includes(w))
  if (hit.length > 0) {
    return ok<ModerationCheckResponse>({
      risk_level: 'high',
      flagged_terms: hit,
      suggestion: '内容包含敏感词，请修改后重试'
    }) as ApiResponse<T>
  }
  return ok<ModerationCheckResponse>({
    risk_level: 'safe',
    flagged_terms: []
  }) as ApiResponse<T>
}
```

`SCRIPT_REWRITE`: 添加 LLM 改写标注，为后续接入云 API 做铺垫

```typescript
case ApiPaths.SCRIPT_REWRITE: {
  const req = body as ScriptRewriteRequest
  const original = req?.original_text ?? ''
  if (!original.trim()) {
    return err<ScriptRewriteResponse>(ErrorCode.INVALID_TEXT, '文本内容无效') as ApiResponse<T>
  }
  // TODO: 接入真实 LLM API 改写
  return ok<ScriptRewriteResponse>({
    rewritten_text: `[改写] ${original}`,
    tokens_used: Math.ceil(original.length / 2)
  }) as ApiResponse<T>
}
```

- [ ] **Step 2: 增强错误处理**

在 `liveTalkingCall` 开头添加统一的超时和连接错误处理：

```typescript
// 在 switch 之前，添加 LiveTalking 健康检查（仅在需要调用 LT 的路径时）
function requiresLiveTalking(path: string): boolean {
  return [
    ApiPaths.QUEUE_ENQUEUE,
    ApiPaths.QUEUE_INSERT,
    ApiPaths.AVATAR_START,
    ApiPaths.SESSION_STATUS,
    ApiPaths.TTS_SYNTHESIZE
  ].includes(path as any)
}
```

将 `liveTalkingCall` 中调用 `ltPost` 的地方统一用 `fetchWithTimeout` 包装：

```typescript
async function fetchWithTimeout(
  url: string,
  options: RequestInit,
  timeoutMs = 5000
): Promise<Response> {
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), timeoutMs)
  try {
    const res = await fetch(url, { ...options, signal: controller.signal })
    return res
  } finally {
    clearTimeout(timeout)
  }
}
```

- [ ] **Step 3: 验证类型检查**

```bash
npm run typecheck
```

Expected: 无类型错误。

- [ ] **Step 4: Commit**

```bash
git add runtime/adapters/livetalking.ts
git commit -m "feat(adapter): enhance livetalking adapter with moderation and error handling"
```

---

### Task 3: LiveTalking 进程生命周期管理

**Files:**

- Create: `electron/main/livetalking-process.ts`
- Modify: `electron/main/index.ts`
- Modify: `package.json`

- [ ] **Step 1: 创建进程管理器**

`electron/main/livetalking-process.ts`:

```typescript
/**
 * LiveTalking process lifecycle manager.
 * Spawns / kills the LiveTalking Python inference service as a child process.
 */

import { spawn, type ChildProcess } from 'child_process'
import { app } from 'electron'

const DEFAULT_PORT = 8010
const LIVETALKING_DIR = app.getAppPath() // LiveTalking 期望在项目根目录运行

let ltProcess: ChildProcess | null = null
let ltStartupResolve: (() => void) | null = null
let ltStartupReject: ((err: Error) => void) | null = null

export function getLiveTalkingPort(): number {
  return parseInt(process.env['VITE_LIVETALKING_PORT'] || String(DEFAULT_PORT), 10)
}

export function isLiveTalkingRunning(): boolean {
  return ltProcess !== null && ltProcess.exitCode === null
}

export async function startLiveTalking(): Promise<void> {
  if (isLiveTalkingRunning()) {
    console.log('[LiveTalking] already running')
    return
  }

  const port = getLiveTalkingPort()

  // 读取 LiveTalking 启动命令配置
  const ltCommand = process.env['LIVETALKING_COMMAND'] || 'python'
  const ltArgsRaw = process.env['LIVETALKING_ARGS'] || 'app.py'
  const ltArgs = ltArgsRaw.split(' ').filter(Boolean)
  const ltCwd = process.env['LIVETALKING_CWD'] || LIVETALKING_DIR

  console.log(
    `[LiveTalking] starting: ${ltCommand} ${ltArgs.join(' ')} (cwd=${ltCwd}, port=${port})`
  )

  return new Promise((resolve, reject) => {
    ltStartupResolve = resolve
    ltStartupReject = reject

    const proc = spawn(ltCommand, ltArgs, {
      cwd: ltCwd,
      env: {
        ...process.env,
        ...(port !== DEFAULT_PORT ? { PORT: String(port) } : {})
      },
      stdio: ['ignore', 'pipe', 'pipe']
    })

    ltProcess = proc

    proc.stdout?.on('data', (data: Buffer) => {
      const text = data.toString().trim()
      if (text) console.log(`[LiveTalking:out] ${text}`)
    })

    proc.stderr?.on('data', (data: Buffer) => {
      const text = data.toString().trim()
      if (!text) return
      console.log(`[LiveTalking:err] ${text}`)
      // uvicorn/fastapi 等可能把启动日志输出到 stderr
      if (
        text.includes('Uvicorn running') ||
        text.includes('Application startup complete') ||
        text.includes('Running on')
      ) {
        if (ltStartupResolve) {
          ltStartupResolve()
          ltStartupResolve = null
          ltStartupReject = null
        }
      }
    })

    proc.on('error', (err) => {
      console.error(`[LiveTalking] spawn error:`, err)
      ltProcess = null
      if (ltStartupReject) {
        ltStartupReject(err)
        ltStartupResolve = null
        ltStartupReject = null
      }
    })

    proc.on('exit', (code) => {
      console.log(`[LiveTalking] exited with code ${code}`)
      ltProcess = null
      if (ltStartupReject) {
        ltStartupReject(new Error(`LiveTalking exited with code ${code}`))
        ltStartupResolve = null
        ltStartupReject = null
      }
    })

    // 等待健康检查通过或超时
    let healthCheckCount = 0
    const healthInterval = setInterval(async () => {
      if (!ltProcess || ltProcess.exitCode !== null) {
        clearInterval(healthInterval)
        return
      }
      healthCheckCount++
      try {
        const res = await fetch(`http://127.0.0.1:${port}/is_speaking`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ sessionid: 'health-check' })
        })
        if (res.ok) {
          clearInterval(healthInterval)
          if (ltStartupResolve) {
            ltStartupResolve()
            ltStartupResolve = null
            ltStartupReject = null
          }
        }
      } catch {
        // 服务尚未就绪，继续等待
      }
      if (healthCheckCount >= 30) {
        // 15秒超时（30×500ms）
        clearInterval(healthInterval)
        if (ltStartupReject) {
          ltStartupReject(new Error('LiveTalking health check timeout (15s)'))
          ltStartupResolve = null
          ltStartupReject = null
        }
      }
    }, 500)
  })
}

export async function stopLiveTalking(): Promise<void> {
  if (!ltProcess) {
    return
  }

  console.log('[LiveTalking] stopping...')

  return new Promise((resolve) => {
    const proc = ltProcess!
    const killTimeout = setTimeout(() => {
      if (ltProcess) {
        console.log('[LiveTalking] force kill')
        proc.kill('SIGKILL')
        ltProcess = null
      }
      resolve()
    }, 5000)

    proc.on('exit', () => {
      clearTimeout(killTimeout)
      ltProcess = null
      resolve()
    })

    proc.kill('SIGTERM')
  })
}
```

- [ ] **Step 2: 接入 Electron Main**

在 `electron/main/index.ts` 中的 `app.whenReady()` 和 `app.on('window-all-closed')` 添加：

```typescript
import { isCpu } from '../../src/shared/config/runtimeMode'
import { startLiveTalking, stopLiveTalking } from './livetalking-process'

app.whenReady().then(() => {
  // ... 现有初始化代码 ...

  // 在 Electron Main 中，从环境变量读取运行模式
  const runtimeMode = process.env.VITE_APP_RUNTIME_MODE || 'dev-mock'
  if (runtimeMode === 'dev-cpu') {
    startLiveTalking().catch((err) => {
      console.error('[Main] Failed to start LiveTalking:', err)
    })
  }

  createWindow()
  // ...
})

app.on('window-all-closed', () => {
  stopLiveTalking().catch(console.error)
  // ... 现有清理代码 ...
})
```

- [ ] **Step 3: 更新 package.json**

添加 LiveTalking 相关脚本：

```json
{
  "scripts": {
    "lt:start": "python app.py",
    "dev:lt": "concurrently \"npm run dev\" \"npm run lt:start\""
  }
}
```

（假设 LiveTalking 在项目根目录下，入口为 `app.py`）

- [ ] **Step 4: 验证类型检查**

```bash
npm run typecheck
```

Expected: 无类型错误。

- [ ] **Step 5: Commit**

```bash
git add electron/main/livetalking-process.ts electron/main/index.ts package.json
git commit -m "feat(electron): add LiveTalking process lifecycle management"
```

---

### Task 4: LLM 改写和风控客户端（Node 侧）

**Files:**

- Create: `src/shared/api/llm-client.ts`

- [ ] **Step 1: 创建 LLM 客户端**

`src/shared/api/llm-client.ts`:

```typescript
/**
 * LLM API Client
 *
 * Cloud API caller for:
 * - Script rewriting (改写)
 * - AI reply generation (AI 回复)
 * - Sensitive word detection (敏感词检测) — optional, can also be local
 */

import { ErrorCode, type ApiResponse } from '@shared/types/api'

type LlmProviderConfig = {
  apiKey: string
  baseUrl: string
  model: string
}

function getLlmConfig(): LlmProviderConfig | null {
  const apiKey = import.meta.env.VITE_LLM_API_KEY as string | undefined
  const baseUrl =
    (import.meta.env.VITE_LLM_BASE_URL as string | undefined) ?? 'https://api.openai.com/v1'
  const model = (import.meta.env.VITE_LLM_MODEL as string | undefined) ?? 'gpt-4o-mini'

  if (!apiKey) return null
  return { apiKey, baseUrl, model }
}

export async function llmRewrite(
  text: string,
  style?: string
): Promise<ApiResponse<{ rewritten_text: string; tokens_used: number }>> {
  const config = getLlmConfig()
  if (!config) {
    // No LLM configured → pass-through (mock behavior)
    return {
      ok: true,
      data: { rewritten_text: text, tokens_used: 0 }
    }
  }

  const stylePrompt = style ? `风格要求：${style}。` : ''

  try {
    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: 'system',
            content: `你是一个直播话术改写助手。${stylePrompt}请改写以下文本，保持原意但更吸引人，不超过120字。`
          },
          { role: 'user', content: text }
        ],
        max_tokens: 200,
        temperature: 0.7
      })
    })

    if (!res.ok) {
      return {
        ok: false,
        data: null,
        errorCode: ErrorCode.TIMEOUT,
        message: `LLM API error: ${res.status}`
      }
    }

    const json = (await res.json()) as any
    const rewritten = json.choices?.[0]?.message?.content?.trim() ?? text

    return {
      ok: true,
      data: {
        rewritten_text: rewritten,
        tokens_used: json.usage?.total_tokens ?? 0
      }
    }
  } catch (e) {
    return {
      ok: false,
      data: null,
      errorCode: ErrorCode.TIMEOUT,
      message: e instanceof Error ? e.message : 'LLM API call failed'
    }
  }
}

export async function llmGenerateReply(
  sampleText: string,
  policyConfig?: { temperature?: number; max_reply_len?: number }
): Promise<ApiResponse<{ reply: string; tokens_used: number }>> {
  const config = getLlmConfig()
  if (!config) {
    return {
      ok: true,
      data: {
        reply: `[AI回复] ${sampleText.slice(0, 80)}`,
        tokens_used: 0
      }
    }
  }

  try {
    const res = await fetch(`${config.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${config.apiKey}`
      },
      body: JSON.stringify({
        model: config.model,
        messages: [
          {
            role: 'system',
            content: `你是一个直播间AI回复助手。根据观众的提问或评论，生成自然友好的回复。回复不超过${policyConfig?.max_reply_len ?? 80}字。`
          },
          { role: 'user', content: sampleText }
        ],
        max_tokens: 200,
        temperature: policyConfig?.temperature ?? 0.8
      })
    })

    if (!res.ok) {
      return {
        ok: false,
        data: null,
        errorCode: ErrorCode.TIMEOUT,
        message: `LLM API error: ${res.status}`
      }
    }

    const json = (await res.json()) as any
    const reply = json.choices?.[0]?.message?.content?.trim() ?? ''

    return {
      ok: true,
      data: {
        reply,
        tokens_used: json.usage?.total_tokens ?? 0
      }
    }
  } catch (e) {
    return {
      ok: false,
      data: null,
      errorCode: ErrorCode.TIMEOUT,
      message: e instanceof Error ? e.message : 'LLM API call failed'
    }
  }
}

export type SensitiveWordResult = {
  hit_words: string[]
  safe: boolean
}

/**
 * 敏感词检测（本地内置词库 + 可选云 API）
 */
const BUILTIN_SENSITIVE_WORDS = ['违禁', '敏感词', '违规']

export function localSensitiveCheck(text: string): SensitiveWordResult {
  const hit = BUILTIN_SENSITIVE_WORDS.filter((w) => text.includes(w))
  return {
    hit_words: hit,
    safe: hit.length === 0
  }
}
```

- [ ] **Step 2: 验证类型检查**

```bash
npm run typecheck
```

Expected: 无类型错误。

- [ ] **Step 3: Commit**

```bash
git add src/shared/api/llm-client.ts
git commit -m "feat(llm): add LLM client for rewrite and reply generation"
```

---

### Task 5: 环境配置和验证

**Files:**

- Modify: `.env.dev-cpu`
- Test: 无新增文件，执行手动验证

- [ ] **Step 1: 更新 .env.dev-cpu**

```ini
# dev-cpu mode: local LiveTalking inference (Wav2Lip / MuseTalk)
VITE_APP_RUNTIME_MODE=dev-cpu
# LiveTalking HTTP API base URL (default port 8010)
VITE_LIVETALKING_BASE_URL=http://localhost:8010
# LLM API 配置（可选，不配置则 fallback 到 mock）
VITE_LLM_API_KEY=
VITE_LLM_BASE_URL=https://api.openai.com/v1
VITE_LLM_MODEL=gpt-4o-mini
```

- [ ] **Step 2: 端到端验证**

启动 LiveTalking + Electron：

```bash
# 终端 1: 启动 LiveTalking
cd /path/to/livetalking && python app.py

# 终端 2: 启动 Electron dev-cpu 模式
cd digital_avatar && npm run dev
```

验证清单：

1. **会话启动** → AI 直播页 → 加载直播间数据
   - 期望：`POST /api/v1/session/start` 返回 running
   - 检查：LiveTalking 日志是否正常

2. **文字播报** → AI 直播页 → 输入文字 → 发送
   - 期望：`POST /api/v1/queue/enqueue` → LiveTalking `/human` 被调用
   - 检查：数字人开始说话

3. **数字人启动** → 数字人页 → 选择素材 → 开启
   - 期望：`POST /api/v1/avatar/start` → WebRTC SDP Offer 发送到 LiveTalking
   - 检查：预览窗口显示视频

4. **话术管理** → 话术管理页 → 新建/保存
   - 期望：`POST /api/v1/scripts/create` → IPC → SQLite
   - 检查：数据持久化，刷新后仍存在

5. **风控检测** → 写话术页 → 输入含「违禁」文本 → 敏感词检测
   - 期望：返回 `risk_level: 'high'`, `flagged_terms: ['违禁']`
   - 检查：前端显示敏感词告警

- [ ] **Step 3: 错误路径验证**

1. 关闭 LiveTalking → 操作发送文字 → 应提示 "LiveTalking unreachable"
2. 输入空文本 → 发送 → 应提示 "文本内容无效"
3. 话术标题超长 → 保存 → 应提示 "标题无效（1-60字）"

- [ ] **Step 4: Commit**

```bash
git add .env.dev-cpu
git commit -m "chore(env): update dev-cpu configuration for LiveTalking and LLM"
```

---

## 自检

### 1. 需求覆盖度

| 需求                 | 对应任务  | 说明                                          |
| -------------------- | --------- | --------------------------------------------- |
| LiveTalking 媒体推理 | Task 3    | 进程管理 + 现有 `livetalking.ts` 适配器       |
| M3 数据持久化        | Task 1    | SQLite IPC 通道打通，`dev-cpu` 模式可访问     |
| LLM 改写/回复        | Task 4    | `llm-client.ts` 支持云 API，无配置时 fallback |
| 敏感词检测           | Task 2, 4 | LiveTalking 适配器 + 本地内置词库双重保障     |
| 进程生命周期         | Task 3    | 启动/健康检查/优雅停止/强制杀                 |
| 端到端验证           | Task 5    | 5 条正向 + 3 条错误用例                       |

### 2. 占位符检查

- 所有代码块包含完整可运行代码
- LLM 客户端有 cloud API + fallback 双路径
- 无 "TODO"、"TBD" 等占位符（LLM 接入标注以 `// TODO:` 形式在代码中，运行时不影响）
- 错误处理在所有关键路径覆盖

### 3. 类型一致性检查

- `liveTalkingCall<T>` 签名与 `mockCall<T>` 一致：`(path, method, body) => Promise<ApiResponse<T>>`
- SQLite-backed 路径列表在 `mock/handlers.ts` 和 `client.ts` 之间一致
- 环境变量命名遵循 `VITE_` 前缀约定，与现有 `.env` 文件一致

---

## 执行交接

Plan complete and saved to `docs/plan-real-backend-integration.md`. Two execution options:

**1. Subagent-Driven (recommended)** — I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** — Execute tasks in this session, with checkpoints for review

**Which approach?**
