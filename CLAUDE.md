# CLAUDE.md

本文档为 Claude Code（claude.ai/code）在本仓库中工作时提供指引。

## 项目概述

Digital Avatar Live —— 基于 Electron + Vue 3 + TypeScript 的桌面应用，用于 AI 驱动的数字人直播。连接抖音直播间，转发弹幕，通过 TTS + Wav2Lip/SadTalker/DiffTalk 引擎驱动数字人，并包含运营工具（话术管理、AI 回复策略、ASR、模型/账号管理）。

**开发计划：** [docs/plan.md](docs/plan.md) — 项目唯一执行规划基线（里程碑、任务、路线图）。

## 命令

```bash
# 开发服务器（热重载）
npm run dev

# 类型检查（构建前运行）
npm run typecheck

# 代码检查
npm run lint

# 格式化
npm run format

# 生产构建
npm run build

# 打包指定平台
npm run build:win
npm run build:mac
npm run build:linux

# 免打包构建（用于测试）
npm run build:unpack

# 预览生产构建
npm run start

# 单独运行类型检查
npm run typecheck:node   # 主进程 TS
npm run typecheck:web    # 渲染进程 TS/Vue
```

## 架构

### 进程模型（Electron）

```
electron/main/           ← 主进程（Node.js）
  index.ts                 - 应用入口、窗口创建、IPC 处理器注册
  douyin-direct-client.ts  - 抖音直播 WebSocket 客户端（签名、连接、重连、消息解码）
  dycast-relay-server.ts   - WebSocket 中继服务器（将实时评论转发到渲染进程 + 外部客户端）
  douyin/                  - 抖音直播消息的 Protobuf 解码器
  mock-api-db.ts           - 模拟后端 API 数据库

electron/preload/         ← 预加载（上下文桥接）
  index.ts                 - 通过 contextBridge 向渲染进程暴露 IPC 通道

src/renderer/             ← 渲染进程（Vue 3 SPA）
  src/main.ts              - Vue 应用引导（Pinia、Router）
  src/App.vue + components/AppLayout.vue  - 外壳（侧边栏导航 + 工作区）
  src/router/index.ts      - 基于哈希的路由，指向各功能页面
```

### 前端页面（src/features/）

| 路由        | 页面                          | 用途                                     |
| ----------- | ----------------------------- | ---------------------------------------- |
| `/live`     | `live/LivePage.vue`           | AI 直播控制面板（连接、会话、队列）      |
| `/dycast`   | `live/DycastDelegatePage.vue` | 嵌入 dycast_1 页面，用于抖音连接         |
| `/avatar`   | `avatar/AvatarPage.vue`       | 数字人控制（引擎、预览）                 |
| `/models`   | `avatar/ModelPage.vue`        | 模型版本库（导入、校验、启用）           |
| `/settings` | `settings/SettingsPage.vue`   | 系统设置                                 |
| `/scripts`  | `script/ScriptPage.vue`       | 话术管理 CRUD                            |
| `/writer`   | `script/WriterPage.vue`       | 话术编写工作台（生成、改写、敏感词检测） |
| `/policy`   | `reply/PolicyPage.vue`        | AI 回复策略配置                          |
| `/accounts` | `live/AccountPage.vue`        | 直播账号管理                             |
| `/asr`      | `asr/AsrPage.vue`             | 语音识别中心                             |

### 共享层（src/shared/）

- **`shared/store/`** — Pinia 状态仓库：`live.ts`（直播间状态、消息处理、弹幕自动排队）、`avatar.ts`（数字人会话）、`session.ts`（全局会话状态）
- **`shared/api/client.ts`** — API 客户端，支持运行时模式分发（mock / cpu / cloud-gpu 后端）
- **`shared/types/api.ts`** — 所有 API 请求/响应类型、路径常量、错误码
- **`shared/types/ipc-channels.ts`** — Electron IPC 通道名称常量
- **`shared/dycast-core/`** — 浏览器端 DyCast 库：抖音直播 WebSocket 客户端（dycast.ts）、Protobuf 消息模型（model.ts）、签名辅助方法、中继客户端（relay.ts）
- **`shared/config/runtimeMode.ts`** — 从 `VITE_APP_RUNTIME_MODE` 环境变量检测运行时模式

### 运行时模式

通过 `.env` 文件控制三种模式：

- **`dev-mock`** — 完全模拟，无硬件/云端调用（默认）
- **`dev-cpu`** — 本地 CPU 推理（Whisper、TTS）
- **`prod-cloud-gpu`** — 生产环境，使用云端 GPU 后端

### 关键数据流

1. **实时评论流**：抖音 WebSocket → `douyin-direct-client.ts`（主进程）→ IPC `live:comment` → 渲染进程 → `useLiveStore.consumeDycastEnvelope()` → 房间事件 + 消息展示 + 自动排队
2. **中继流**：DyCast 客户端 → `dycast-relay-server.ts`（WS 中继，端口 18765）→ 通过 IPC 或外部 WS 客户端到达渲染进程
3. **API 调用流**：功能页面 → Pinia store action → `apiClient` → `callApi()` → 对应运行时后端（mock/cpu/cloud-gpu）
4. **数字人流**：前端 → `/api/v1/avatar/start` → 引擎（Wav2Lip/SadTalker/DiffTalk）→ 流 URL → video 元素

## 关键技术细节

- **基于哈希的路由**（`createWebHashHistory`）— Electron 的 `file://` 协议必需
- **启用上下文隔离** — 渲染进程通过 preload 暴露的 `window.api` 访问主进程
- **Vite 代理** 已配置 `/dylive`（抖音直播）和 `/socket`（抖音 WebSocket）— 详见 `electron.vite.config.ts`
- **Electron builder** 已配置 Windows（NSIS）、macOS（DMG）、Linux（AppImage/snap/deb）
- **Protobuf 解码器** 在 `electron/main/douyin/model.ts` 中解码抖音二进制消息帧
- **消息去重** 在 `useLiveStore` 中通过 `seenDycastMessageIds` Set 实现，上限 6000 条
- **自动排队** 通过 Promise 链将弹幕入队操作串行化，避免惊群效应
