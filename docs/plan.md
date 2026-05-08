# 数字人直播系统 — 开发计划（唯一基线）

> **本文档是项目唯一的执行规划基线。** 所有历史版本文档（plan-v6、vibecoding-plan-v1、plan-real-backend-integration）已弃用，未来所有迭代在本文件中进行。
>
> 需求规格：[requirements-spec-v7.md](requirements-spec-v7.md) | 技术设计：[technical-design-v7.md](technical-design-v7.md) | 按钮映射：[button-action-api-map-v1.md](button-action-api-map-v1.md)

---

## 1. 项目概述

Electron + Vue 3 + TypeScript 桌面应用，用于 AI 驱动的数字人直播。连接抖音直播间，转发弹幕，通过 TTS + Wav2Lip 引擎驱动数字人，并包含运营工具（话术管理、AI 回复策略、ASR、模型/账号管理）。

**技术栈：** Electron (Node) + Vue 3 + Python (LiveTalking) + SQLite + FFmpeg
**首发平台：** 抖音 | **并发：** 单机 1 路 | **最低 GPU：** RTX 3060

### 1.1 运行模式

| 模式 | 用途 | 数字人能力 |
|------|------|-----------|
| `dev-mock` | 前期开发/联调 | 内存 mock，无外部依赖 |
| `dev-cpu` | 中期联调 | 本地 LiveTalking 推理（Wav2Lip/MuseTalk） |
| `prod-cloud-gpu` | 上线验收 | 远端 GPU 推理 |

---

## 2. 架构总览

```
Renderer (Vue 3)          Pinia Store → apiClient
    ↕ IPC (preload bridge)
Electron Main (Node)
    ├── SQLite DB         数据持久化（scripts/policies/models/accounts）
    ├── LLM Client        改写/生成/风控（云 API）  ← 2026-05-08 新增
    ├── LiveTalking Mgr   子进程生命周期管理        ← 2026-05-08 新增
    │       ↕ HTTP localhost:8010
    └── LiveTalking (Python)
            ├── POST /human      TTS + 播报
            ├── POST /offer      WebRTC SDP 协商
            └── POST /is_speaking 状态查询
```

### 2.1 路由策略（dev-cpu 模式）

| 路径类别 | 路由目标 | 说明 |
|---------|---------|------|
| session/live/queue/tts/avatar/stream | → LiveTalking HTTP API | `runtime/adapters/livetalking.ts` |
| scripts/policies/writer/models/accounts/asr | → IPC → Main SQLite | 通过 `trySqliteBackedApi` 从 mock/handlers 复用 |
| moderation/rewrite | → LiveTalking 适配器（内置词库） | 待接入云 LLM API |

### 2.2 关键文件

| 文件 | 职责 |
|------|------|
| `electron/main/index.ts` | 应用入口、窗口创建、IPC 注册、LiveTalking 启动 |
| `electron/main/livetalking-process.ts` | LiveTalking 子进程管理（启动/健康检查/停止） |
| `electron/main/mock-api-db.ts` | SQLite 持久化层 |
| `src/shared/api/client.ts` | API 客户端，三模式路由分发 |
| `src/shared/api/llm-client.ts` | LLM 云 API 客户端 |
| `runtime/mock/handlers.ts` | dev-mock 全链路模拟 + SQLite 桥接 |
| `runtime/adapters/livetalking.ts` | LiveTalking HTTP 适配器 + WebRTC 流捕获 |

---

## 3. 里程碑状态

### M0 — 架构冻结 ✅ 100%

- [x] Action 常量字典（`src/shared/types/actions.ts`）
- [x] API 路径与类型（`src/shared/types/api.ts`）
- [x] 错误码枚举与消息映射
- [x] 三模式运行配置（`src/shared/config/runtimeMode.ts`）

### M1 — 主链路打通 ✅ 90%（mock 完成，真实链路待 GPU 验证）

- [x] dev-mock：直播消息 → 改写 → 风控 → TTS → 播报
- [x] LiveTalking 适配器 HTTP 联调（`runtime/adapters/livetalking.ts`）
- [x] WebRTC SDP 协商 + 远程流捕获
- [ ] GPU 环境性能验证（口型首帧 ≤ 500ms，finalfps ≥ 25）

### M2 — 核心页面闭环 ✅ 95%

- [x] AI直播页（LivePage.vue）
- [x] 数字人页（AvatarPage.vue）含 WebRTC 视频预览
- [x] 设置页（SettingsPage.vue）
- [x] Dycast 代理页（DycastDelegatePage.vue）

### M3 — 运营页面闭环 ✅ 95%

- [x] 话术管理（ScriptPage.vue）CRUD
- [x] AI回复策略（PolicyPage.vue）
- [x] 写话术（WriterPage.vue）
- [x] 模型管理（ModelPage.vue）
- [x] 直播账号（AccountPage.vue）
- [x] 音转文字（AsrPage.vue）

### M4 — 真实后端联调 ✅ 代码完成，待 GPU 环境实测

- [x] dev-cpu M3 数据路径路由到 IPC SQLite（`trySqliteBackedApi`）
- [x] LiveTalking 适配器增强（fetch 超时、敏感词检测）
- [x] LiveTalking 进程生命周期管理（`livetalking-process.ts`）
- [x] LLM 客户端（`llm-client.ts`，含 mock fallback）
- [ ] GPU 环境端到端验证
- [ ] 8 小时稳定性测试

### M5 — Beta 增强 ⏳ 未开始

- [ ] 虚拟摄像头
- [ ] OBS 去重

---

## 4. 已完成任务（2026-05-08）

### 4.1 dev-cpu 模式路由修复

`isCpu` 分支改为双路由策略：先尝试 `trySqliteBackedApi`（IPC → SQLite），命中 M3 数据路径则返回；未命中则转发到 `liveTalkingCall`（LiveTalking HTTP）。

**文件：** `src/shared/api/client.ts:44-51` `runtime/mock/handlers.ts:929-930`

### 4.2 LiveTalking 适配器增强

- `fetchWithTimeout(url, options, 5000ms)` — 统一超时包装
- `MODERATION_CHECK` — 内置敏感词检测（`['违禁', '敏感词']`）
- `SCRIPT_REWRITE` — 空文本校验 + `[改写]` 标注
- WebRTC `getRemoteStreamPromise()` — 远程流捕获

**文件：** `runtime/adapters/livetalking.ts`

### 4.3 LiveTalking 进程管理

`electron/main/livetalking-process.ts` — 子进程生命周期：
- `startLiveTalking()` — spawn Python + 健康检查轮询（500ms × 30 = 15s 超时）
- `stopLiveTalking()` — SIGTERM → 5s → SIGKILL
- `app.whenReady()` 中按 `dev-cpu` 模式自动启动

**文件：** `electron/main/livetalking-process.ts` `electron/main/index.ts:104-109` `package.json`

### 4.4 LLM 客户端

`src/shared/api/llm-client.ts`：
- `llmRewrite(text, style?)` — 话术改写（OpenAI 兼容 API + mock fallback）
- `llmGenerateReply(text, config?)` — AI 回复生成
- `localSensitiveCheck(text)` — 本地敏感词检测

**文件：** `src/shared/api/llm-client.ts`

---

## 5. 下一步任务（优先级排序）

### 5.1 P0 — GPU 环境端到端验证

```bash
# 终端 1: LiveTalking
cd /path/to/livetalking && python app.py

# 终端 2: Electron
cd digital_avatar && npm run dev
```

验证清单：
1. 会话启动 → `POST /api/v1/session/start` 返回 running
2. 文字播报 → `POST /api/v1/queue/enqueue` → LiveTalking `/human` 被调用
3. 数字人启动 → WebRTC SDP Offer → 预览窗口显示视频
4. 话术管理 → CRUD 数据持久化（刷新后存在）
5. 风控检测 → 含「违禁」文本返回 `risk_level: 'high'`
6. 关闭 LiveTalking → 提示 "LiveTalking unreachable"

### 5.2 P0 — 稳定性验收（M4）

- 8 小时连续运行，自动恢复成功率 ≥ 99%
- 指标采集：队列深度、GPU 利用率、错误率、端到端时延
- 异常场景：LiveTalking 崩溃重启、网络断开重连、队列满载

### 5.3 P1 — LLM 真实接入

将 `livetalking.ts` 的 `SCRIPT_REWRITE` 和 `MODERATION_CHECK` 从本地 stub 改为调用 `llm-client.ts` 的云 API。

### 5.4 P1 — Beta 功能（M5）

- 虚拟摄像头输出
- OBS 去重

---

## 6. 文档体系

本文档是唯一执行规划基线。以下文档为专项参考：

| 文档 | 用途 |
|------|------|
| [requirements-spec-v7.md](requirements-spec-v7.md) | 按钮级需求定义、验收标准 |
| [technical-design-v7.md](technical-design-v7.md) | 架构、接口、里程碑详细设计 |
| [button-action-api-map-v1.md](button-action-api-map-v1.md) | 按钮→Action→API 映射表 |

### 弃用文档

以下文档内容已合并到本文件，不再维护：

- ~~plan-v6.md~~ — 内容合并至本文档 §3-§4
- ~~vibecoding-plan-v1.md~~ — AI 执行指导（Phase 0-5 已完成）
- ~~plan-real-backend-integration.md~~ — 真实后端联调计划（已执行完毕）
- ~~development-doc-index-v7.md~~ — 文档索引（由本文档替代）

---

## 7. 后端 API ↔ 前端页面映射（完成情况检查）

> 检查日期：2026-05-08。后端 API 定义在 `src/shared/types/api.ts`（`ApiPaths`），Mock 实现在 `runtime/mock/handlers.ts`，前端页面在 `src/features/*/`。

### 7.1 Core API（会话/直播/队列/审核）

| # | API Path | 后端 Mock | 前端页面 | 前端函数 | 完成 |
|---|----------|-----------|---------|---------|------|
| 1 | `POST /api/v1/session/start` | ✅ handlers.ts:219 | LivePage.vue / SettingsPage.vue | `onRuntimeToggle`, `onModelRotate`, `onEngineRotate` | ✅ |
| 2 | `POST /api/v1/session/stop` | ✅ handlers.ts:231 | LivePage.vue | `onTtsStop`, `onStop` | ✅ |
| 3 | `GET /api/v1/session/status` | ✅ handlers.ts:243 | LivePage.vue | `onInitMessages` via `sessionStore.fetchStatus()` | ✅ |
| 4 | `POST /api/v1/live/connect` | ✅ handlers.ts:252 | LivePage.vue | `onFetchStart` via `liveStore.connect()` | ✅ |
| 5 | `POST /api/v1/live/disconnect` | ✅ handlers.ts:269 | LivePage.vue | `onFetchStop`, `onAccountClose` | ✅ |
| 6 | `POST /api/v1/queue/enqueue` | ✅ handlers.ts:280 | LivePage.vue | 自动入队 (`liveStore.autoQueue`) | ✅ |
| 7 | `POST /api/v1/queue/insert` | ✅ handlers.ts:296 | LivePage.vue | `onInsert` | ✅ |
| 8 | `POST /api/v1/script/rewrite` | ✅ handlers.ts:311 | LivePage.vue | `onSendText` pipeline step 1 | ✅ |
| 9 | `POST /api/v1/moderation/check` | ✅ handlers.ts:320 | LivePage.vue | `onSendText` pipeline step 2 | ✅ |
| 10 | `POST /api/v1/review/decision` | ✅ handlers.ts:331 | **无前端调用** | — | ⚠️ 未使用 |
| 11 | `POST /api/v1/tts/synthesize` | ✅ handlers.ts:341 | LivePage.vue | `onTtsPreview`, `onSendText` step 4 | ✅ |
| 12 | `POST /api/v1/avatar/start` | ✅ handlers.ts:351 | AvatarPage.vue | `onStart` via `avatarStore.start()` | ✅ |
| 13 | `POST /api/v1/stream/start` | ✅ handlers.ts:360 | SettingsPage.vue | `onApiStart` | ✅ |
| 14 | `GET /api/v1/metrics` | ✅ handlers.ts:370 | **无前端调用** | — | ⚠️ 未使用 |

### 7.2 M3 话术管理（ScriptPage.vue）

| # | API Path | 后端 Mock | 前端实现 | 完成 |
|---|----------|-----------|---------|------|
| 15 | `GET /api/v1/scripts` | ✅ handlers.ts:387 | `loadScripts()` → 列表展示 | ✅ |
| 16 | `POST /api/v1/scripts/create` | ✅ handlers.ts:395 | `onNew()` → 新建表单 | ✅ |
| 17 | `POST /api/v1/scripts/update` | ✅ handlers.ts:423 | `onSave(id)` → 行内编辑 | ✅ |
| 18 | `POST /api/v1/scripts/delete` | ✅ handlers.ts:433 | `onDelete()` → 批量选择删除 | ✅ |
| 19 | `POST /api/v1/scripts/status` | ✅ handlers.ts:449 | `onEnable()`, `onDisable()` → 批量切换 | ✅ |

**所有按钮：** `btn_script_new`, `btn_script_save`, `btn_script_enable`, `btn_script_disable`, `btn_script_delete`, `btn_script_import`, `btn_script_export` — 全部在 ScriptPage.vue 中实现 ✅

### 7.3 M3 AI回复策略（PolicyPage.vue）

| # | API Path | 后端 Mock | 前端实现 | 完成 |
|---|----------|-----------|---------|------|
| 20 | `GET /api/v1/policies` | ✅ handlers.ts:463 | `loadPolicies()` → 列表 | ✅ |
| 21 | `POST /api/v1/policies/create` | ✅ handlers.ts:471 | `onNew()` → 新建策略 | ✅ |
| 22 | `POST /api/v1/policies/save` | ✅ handlers.ts:495 | `onSave()` → 编辑参数（temperature/max_reply_len/risk_mode） | ✅ |
| 23 | `POST /api/v1/policies/test` | ✅ handlers.ts:510 | `onTest()` → 样本文本测试 | ✅ |
| 24 | `POST /api/v1/policies/publish` | ✅ handlers.ts:525 | `onPublish()` → 发布为 active | ✅ |
| 25 | `POST /api/v1/policies/rollback` | ✅ handlers.ts:545 | `onRollback()` → 指定版本回滚 | ✅ |

**所有按钮：** `btn_policy_new`, `btn_policy_save`, `btn_policy_test`, `btn_policy_publish`, `btn_policy_rollback` — 全部在 PolicyPage.vue 中实现 ✅

### 7.4 M3 写话术（WriterPage.vue）

| # | API Path | 后端 Mock | 前端实现 | 完成 |
|---|----------|-----------|---------|------|
| 26 | `POST /api/v1/writer/generate` | ✅ handlers.ts:569 | `onGenerate()` → 场景/风格选择生成候选 | ✅ |
| 27 | `POST /api/v1/writer/rewrite` | ✅ handlers.ts:587 | `onRewrite()` → 改写选中文案 | ✅ |
| **28** | **`POST /api/v1/writer/sensitive-check`** | ✅ handlers.ts:596 | **`onSensitiveCheck()` → WriterPage.vue:130-163** | ✅ **已实现！** |
| 29 | `POST /api/v1/writer/save-draft` | ✅ handlers.ts:606 | `onSaveDraft()` → 保存草稿 | ✅ |
| 30 | `POST /api/v1/writer/publish` | ✅ handlers.ts:621 | `onPublish()` → 发布到话术库 | ✅ |

**所有按钮：** `btn_writer_generate`, `btn_writer_rewrite`, `btn_writer_sensitive_check`, `btn_writer_save_draft`, `btn_writer_publish` — **全部在 WriterPage.vue 中实现** ✅

> **⚠️ 敏感词说明：** `btn_writer_sensitive_check`（敏感词检测）已经在 WriterPage.vue 中完整实现：
> - **JS 逻辑**（第 130-163 行）：调用 `/api/v1/writer/sensitive-check`，返回命中词列表 `hit_words`，区分 safe/unsafe
> - **UI 呈现**（第 322-331 行）："敏感词检测"按钮，第 308-312 行显示命中词红色标签
> - **Mock 后端**（handlers.ts:596-604）：基于文本中是否含"违禁"关键词做检测
> - 但系统**缺少独立的敏感词库管理页面**（CRUD 管理敏感词列表），当前敏感词是硬编码在 Mock/LiveTalking 适配器中的

### 7.5 M3 模型管理（ModelPage.vue）

| # | API Path | 后端 Mock | 前端实现 | 完成 |
|---|----------|-----------|---------|------|
| 31 | `GET /api/v1/models` | ✅ handlers.ts:640 | `loadModels()` → 列表展示 | ✅ |
| 32 | `POST /api/v1/models/import` | ✅ handlers.ts:648 | `onImportFile()` → 文件选择 + 上传 | ✅ |
| 33 | `POST /api/v1/models/verify` | ✅ handlers.ts:670 | `onVerify(id)` → 校验按钮 | ✅ |
| 34 | `POST /api/v1/models/enable` | ✅ handlers.ts:688 | `onEnable(id)` → 启用（自动禁用其他 active） | ✅ |
| 35 | `POST /api/v1/models/rollback` | ✅ handlers.ts:710 | `onRollback(id)` → 回滚到 validated | ✅ |
| 36 | `POST /api/v1/models/delete` | ✅ handlers.ts:726 | `onDelete(id)` → 不允许删除 active 模型 | ✅ |

**所有按钮：** `btn_model_import`, `btn_model_verify`, `btn_model_enable`, `btn_model_rollback`, `btn_model_delete` — 全部在 ModelPage.vue 中实现 ✅

### 7.6 M3 直播账号（AccountPage.vue）

| # | API Path | 后端 Mock | 前端实现 | 完成 |
|---|----------|-----------|---------|------|
| 37 | `GET /api/v1/accounts` | ✅ handlers.ts:752 | `loadAccounts()` → 列表 | ✅ |
| 38 | `POST /api/v1/accounts/create` | ✅ handlers.ts:760 | `onNew()` → 新建 | ✅ |
| 39 | `POST /api/v1/accounts/auth` | ✅ handlers.ts:780 | `onAuth(id)` → 授权登录 | ✅ |
| 40 | `POST /api/v1/accounts/status` | ✅ handlers.ts:797 | `onEnable(id)`, `onDisable(id)` → 启用/停用 | ✅ |
| 41 | `POST /api/v1/accounts/health` | ✅ handlers.ts:807 | `onHealthTest(id)` → 连通性延迟测试 | ✅ |
| 42 | `POST /api/v1/accounts/delete` | ✅ handlers.ts:823 | `onDelete(id)` → 不允许删除 enabled 账号 | ✅ |

**所有按钮：** `btn_account_new`, `btn_account_auth`, `btn_account_enable`, `btn_account_disable`, `btn_account_health_test`, `btn_account_delete` — 全部在 AccountPage.vue 中实现 ✅

### 7.7 M3 音转文字 ASR（AsrPage.vue）

| # | API Path | 后端 Mock | 前端实现 | 完成 |
|---|----------|-----------|---------|------|
| 43 | `POST /api/v1/asr/start` | ✅ handlers.ts:849 | `onStart()` → 启动监听 + 模拟输入 | ✅ |
| 44 | `POST /api/v1/asr/pause` | ✅ handlers.ts:867 | `onPause()` → 暂停识别 | ✅ |
| 45 | `POST /api/v1/asr/stop` | ✅ handlers.ts:882 | `onStop()` → 停止并清理 | ✅ |
| 46 | `POST /api/v1/asr/correction` | ✅ handlers.ts:898 | `onCorrectionSubmit()` → 行内纠错提交 | ✅ |
| 47 | `POST /api/v1/asr/export` | ✅ handlers.ts:909 | `onExport()` → TXT/SRT 格式导出 | ✅ |

**所有按钮：** `btn_asr_start`, `btn_asr_pause`, `btn_asr_stop`, `btn_asr_correction_submit`, `btn_asr_export` — 全部在 AsrPage.vue 中实现 ✅

### 7.8 特别页面

| 页面 | 后端 API | 前端实现 | 完成 |
|------|---------|---------|------|
| DycastDelegatePage.vue | 无 API 调用，纯 iframe 嵌入 | `dycastUrlInput` + iframe 加载 | ✅ |
| SettingsPage.vue | 调用 sessionStart/Stop/streamStart | API 服务 + 提供商配置 + 引擎轮换 + Prompt 保存 | ✅ |

### 7.9 未使用 API 汇总

| API Path | 问题 | 建议 |
|----------|------|------|
| `POST /api/v1/review/decision` | 定义了类型和 mock，但无前端页面调用 | 可在 LivePage 审核弹窗中集成，当 moderation check 为 high risk 时弹出人工审核 |
| `GET /api/v1/metrics` | 定义了类型和 mock，但无前端页面调用 | 可在 SettingsPage 或 LivePage 添加指标面板 |

### 7.10 未实现功能（Actions 已定义但无页面）

| Action ID | 所属页面 | 状态 |
|-----------|---------|------|
| `btn_obs_connect` | OBS 去重（Page H） | ⏳ M5 未开始 |
| `btn_obs_start_dedup` | OBS 去重 | ⏳ M5 未开始 |
| `btn_obs_stop_dedup` | OBS 去重 | ⏳ M5 未开始 |
| `btn_obs_apply_threshold` | OBS 去重 | ⏳ M5 未开始 |
| `btn_obs_preview_diff` | OBS 去重 | ⏳ M5 未开始 |

### 7.8 敏感词库管理（SensitiveWordsPage.vue）

| # | API Path | 后端实现 | 前端页面 | 前端函数 | 完成 |
|---|----------|---------|---------|---------|------|
| 48 | `GET /api/v1/sensitive-words` | ✅ mock-api-db.ts CRUD | SensitiveWordsPage.vue | `loadWords()` → 列表 | ✅ |
| 49 | `POST /api/v1/sensitive-words/create` | ✅ mock-api-db.ts CRUD | SensitiveWordsPage.vue | `onAddWord()` → 新建表单 | ✅ |
| 50 | `POST /api/v1/sensitive-words/update` | ✅ mock-api-db.ts CRUD | SensitiveWordsPage.vue | `onSaveEdit(id)` → 行内编辑 | ✅ |
| 51 | `POST /api/v1/sensitive-words/delete` | ✅ mock-api-db.ts CRUD | SensitiveWordsPage.vue | `onDeleteWord(id)` → 确认删除 | ✅ |

**所有按钮：** `btn_sw_new`, `btn_sw_save`, `btn_sw_delete`, `btn_sw_test`, `btn_sw_batch_import` — 全部在 SensitiveWordsPage.vue 中实现 ✅

**集成链路：**
- `livetalking.ts` MODERATION_CHECK → 动态调用 `SENSITIVE_WORDS_LIST` API 获取词库，替代硬编码列表
- `llm-client.ts` `localSensitiveCheck()` → 接受外部传入 `customWords`，支持动态词库
- `handlers.ts` WRITER_SENSITIVE_CHECK / MODERATION_CHECK → 使用扩展 8 词列表（违禁/敏感词/违规/赌博/色情/诈骗/暴力/血腥）
- SQLite 种子数据：15 个初始化敏感词，分 4 组（default/illegal/politics/insult/violence），支持 severity 分级

### 7.9 特别页面

| 页面 | 后端 API | 前端实现 | 完成 |
|------|---------|---------|------|
| DycastDelegatePage.vue | 无 API 调用，纯 iframe 嵌入 | `dycastUrlInput` + iframe 加载 | ✅ |
| SettingsPage.vue | 调用 sessionStart/Stop/streamStart | API 服务 + 提供商配置 + 引擎轮换 + Prompt 保存 | ✅ |

### 7.10 未使用 API 汇总

| API Path | 问题 | 建议 |
|----------|------|------|
| `POST /api/v1/review/decision` | 定义了类型和 mock，但无前端页面调用 | 可在 LivePage 审核弹窗中集成，当 moderation check 为 high risk 时弹出人工审核 |
| `GET /api/v1/metrics` | 定义了类型和 mock，但无前端页面调用 | 可在 SettingsPage 或 LivePage 添加指标面板 |

### 7.11 未实现功能（Actions 已定义但无页面）

| Action ID | 所属页面 | 状态 |
|-----------|---------|------|
| `btn_obs_connect` | OBS 去重（Page H） | ⏳ M5 未开始 |
| `btn_obs_start_dedup` | OBS 去重 | ⏳ M5 未开始 |
| `btn_obs_stop_dedup` | OBS 去重 | ⏳ M5 未开始 |
| `btn_obs_apply_threshold` | OBS 去重 | ⏳ M5 未开始 |
| `btn_obs_preview_diff` | OBS 去重 | ⏳ M5 未开始 |

### 7.12 敏感词功能专项说明（已完成 ✅）

系统中有**三层敏感词机制**，现已全部打通：

**第一层：WriterPage 写话术页面的敏感词检测（已实现 ✅）**
- 前端按钮 `btn_writer_sensitive_check` → 调用 `POST /api/v1/writer/sensitive-check`
- WriterPage.vue:130-163 已实现完整的检测逻辑：发送文本 → 获取命中词 → 展示红色标签
- Mock 后端（handlers.ts）基于扩展 8 词列表做匹配

**第二层：LivePage 发送管线的内容审核（已实现 ✅）**
- `onSendText()` pipeline step 2 调用 `POST /api/v1/moderation/check`
- LiveTalking 适配器动态调用 `SENSITIVE_WORDS_LIST` API 获取词库

**第三层：敏感词库管理页面 SensitiveWordsPage.vue（已实现 ✅）**
- 完整 CRUD：增删改查敏感词，支持 severity（high/medium/low）和 group 分组
- 测试工具：输入文本检测命中词，红色标签展示
- SQLite 持久化：15 个种子词，4 个分组
- 路由 `/sensitive-words`，侧边栏导航"敏感词库"

---

## 8. 变更日志

| 日期 | 版本 | 变更 |
|------|------|------|
| 2026-05-08 | V9 | 新增敏感词库管理页面（SensitiveWordsPage.vue），SQLite CRUD，路由/导航注册，plan.md 映射更新 |
| 2026-05-08 | V8 | 新增 §7 后端 API ↔ 前端页面映射检查；记录敏感词功能状态 |
| 2026-05-08 | V7 | 合并 plan-v6 + vibecoding-plan-v1 + plan-real-backend-integration → 唯一基线；记录 M4 完成状态；标记旧文档弃用 |
| 2026-04-30 | V6 | 运营页面闭环完成，按钮映射表建立 |
| 2026-04-27 | V1 | 初始需求规划，7 阶段定义 |
