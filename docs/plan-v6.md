# 数字人直播系统 Plan V6（工作区版）

## 0. 文档定位

本文件用于非编码阶段的需求与技术评审，作为当前唯一可执行规划基线。

## 1. 冻结约束

1. 首发平台：抖音。
2. 并发目标：单机 1 路会话。
3. 资产来源：仅导入现有数字人资产，不做训练流程。
4. 音频输入：桌面音频回采优先。
5. 云边边界：LLM/TTS 云端，唇形推理本地 GPU。
6. 最低硬件：RTX 3060。
7. 默认引擎：Wav2Lip。
8. 虚拟摄像头：P1（Beta）。
9. OBS 去重：P1。
10. 回复策略：半自动，命中敏感词强制人工确认。
11. 审核超时：20 秒转待审。
12. 队列上限：1000（单会话）。

## 2. 技术架构

### 2.1 分层架构

1. 交互层（Electron Renderer）

- 页面渲染、按钮动作采集、设备选择。

2. 编排层（Electron Main + Node）

- 会话状态机、队列调度、风控分流、插件网关。

3. 推理媒体层（Python + FFmpeg）

- ASR、TTS 对接、Avatar 推理、混流编码、推流输出。

4. 数据观测层（SQLite + Logs + Metrics）

- 配置存储、审计日志、指标采集、告警。

### 2.2 进程拓扑

1. process_ui: electron_renderer
2. process_orchestrator: electron_main_node
3. process_asr: python_asr
4. process_avatar: python_avatar_infer
5. process_media: python_media
6. cloud_services: llm_api + tts_api

### 2.3 通信约束

1. Renderer <-> Main: IPC。
2. Node <-> Python: HTTP/REST（127.0.0.1）。
3. Node <-> Cloud: HTTPS（超时 + 重试 + 熔断）。

## 3. 技术实现方案（多套）

### 3.1 S1 A-Base（MVP 推荐）

1. 组件：Electron + Node + Python FastAPI + SQLite + FFmpeg。
2. 优点：实现快、可调试性好、最贴合单会话目标。
3. 风险：后续并发扩展需要拆分编排器。

### 3.2 S2 A-Plus（Beta 升级）

1. 在 S1 基础上拆分媒体进程，增加守护和自动恢复。
2. 优点：稳定性更强，故障域更小。
3. 风险：链路复杂度上升。

### 3.3 S3 B-Lite（并发预研）

1. 增加多会话调度池，可选 Redis 单机队列。
2. 优点：为 2-3 路并发做准备。
3. 风险：超出 MVP 周期与复杂度。

## 4. 技术路径

1. M0 架构冻结（1 周）

- 接口字典、状态机、错误码字典完成。

2. M1 主链路打通（1-2 周）

- 直播消息 -> 改写 -> 风控 -> TTS -> 推理 -> 推流。
- 闸门：口型首帧 <= 500ms，finalfps >= 25。

3. M2 核心页面闭环（1 周）

- AI直播、数字人、设置页面按钮可用。
- 闸门：按钮成功率 >= 99%。

4. M3 运营页面闭环（1 周）

- 话术管理、AI回复、写话术、模型管理、直播账号、音转文字。

5. M4 稳定性达标（1 周）

- 8 小时连续运行，自动恢复成功率 >= 99%。

6. M5 Beta 增强（可选）

- 虚拟摄像头、OBS 去重（不破坏 M1 指标）。

## 5. 接口设计（V1）

### 5.1 会话与编排

1. POST /api/v1/session/start

- 入参：account_id, model_id, stream_mode
- 出参：session_id, status

2. POST /api/v1/session/stop

- 入参：session_id
- 出参：status

3. GET /api/v1/session/status

- 入参：session_id
- 出参：state, inferfps, finalfps, queue_usage_ratio

### 5.2 直播与队列

1. POST /api/v1/live/connect

- 入参：platform, room_id, token
- 出参：task_id, state

2. POST /api/v1/live/disconnect

- 入参：task_id
- 出参：state

3. POST /api/v1/queue/enqueue

- 入参：session_id, text, priority
- 出参：queue_id, position

4. POST /api/v1/queue/insert

- 入参：session_id, text, priority=high
- 出参：queue_id, position

### 5.3 改写与风控

1. POST /api/v1/script/rewrite

- 入参：session_id, raw_text, policy_id
- 出参：rewritten_text, risk_tag

2. POST /api/v1/moderation/check

- 入参：text, dict_scope
- 出参：risk_level, hit_words

3. POST /api/v1/review/decision

- 入参：item_id, action(send/drop/rewrite)
- 出参：state

### 5.4 语音、推理、推流

1. POST /api/v1/tts/synthesize

- 入参：text, voice_id, speed
- 出参：audio_stream_ref

2. POST /api/v1/avatar/start

- 入参：session_id, avatar_id, engine
- 出参：state

3. POST /api/v1/stream/start

- 入参：session_id, mode(rtmp|webrtc), target
- 出参：state

4. GET /api/v1/metrics

- 出参：latency_p95_ms, inferfps, finalfps, gpu_util, queue_drop_count

## 6. 调用伪代码（流程级）

### 6.1 自动播报主链路

1. onLiveMessage(msg)
2. if queue.size >= 1000 then dropLowPriorityFIFO()
3. rewritten = rewrite(msg)
4. risk = moderationCheck(rewritten)
5. if risk.hit then toPendingReview(rewritten) and return
6. audioRef = ttsSynthesize(rewritten)
7. frameRef = avatarInfer(audioRef)
8. publish(frameRef, audioRef)
9. writeMetricsAndAudit()

### 6.2 插播按钮链路

1. onInsertClick(text)
2. validate(notBlank && len <= 120)
3. risk = moderationCheck(text)
4. if risk.hit then toPendingReview(text) else queueInsertHigh(text)
5. notifyUI(queuePosition)

### 6.3 故障恢复链路

1. if healthCheckFail || inferfps < threshold
2. state = degraded
3. pauseQueueConsume()
4. restartFailedProcess()
5. rebuildStreamChannel()
6. if success then state = running else state = error

## 7. 防发散检查

### 7.1 发散红线

1. MVP 不新增第二数据库或分布式中间件。
2. MVP 不引入多平台并行。
3. MVP 不引入多会话并发。
4. MVP 不引入 C++/Rust 自研媒体核。
5. 任何新增能力不得破坏首帧 <= 500ms。

### 7.2 可实现性结论

当前范围可实现，且未过度发散。按冻结边界推进可在 4-6 周完成演示级闭环。

## 8. 字段级校验矩阵（10 页面）

### 8.1 AI直播

| 字段ID           | 类型   | 必填 | 默认值 | 规则                  | 错误码                    |
| ---------------- | ------ | ---- | ------ | --------------------- | ------------------------- |
| live.platform    | enum   | 是   | douyin | 仅支持 douyin         | LIVE_PLATFORM_UNSUPPORTED |
| live.room_id     | string | 是   | 空     | ^[0-9]{6,20}$         | LIVE_ROOM_ID_INVALID      |
| live.token       | string | 是   | 空     | 长度 20-512           | LIVE_AUTH_401             |
| live.insert_text | string | 是   | 空     | 1-120，去空白后不可空 | SCRIPT_TEXT_INVALID       |
| live.queue_limit | int    | 是   | 1000   | 固定 1000             | QUEUE_OVERFLOW_1000       |

### 8.2 数字人

| 字段ID                  | 类型   | 必填 | 默认值   | 规则                     | 错误码                     |
| ----------------------- | ------ | ---- | -------- | ------------------------ | -------------------------- |
| avatar.asset_path       | path   | 是   | 空       | 文件存在且扩展名 mp4/mov | AVATAR_ASSET_NOT_FOUND     |
| avatar.engine           | enum   | 是   | wav2lip  | wav2lip/musetalk         | AVATAR_ENGINE_INVALID      |
| avatar.audio_source     | enum   | 是   | desktop  | desktop/mic              | AUDIO_SOURCE_INVALID       |
| avatar.output_device_id | string | 是   | 系统默认 | 必须在设备列表中         | AUDIO_DEVICE_NOT_FOUND     |
| avatar.window_mode      | enum   | 否   | embed    | embed/popup              | AVATAR_WINDOW_MODE_INVALID |

### 8.3 设置

| 字段ID                | 类型   | 必填 | 默认值            | 规则                     | 错误码                 |
| --------------------- | ------ | ---- | ----------------- | ------------------------ | ---------------------- |
| cfg.rewrite.api_key   | string | 是   | 空                | 20-128，^[A-Za-z0-9_-]+$ | CFG_APIKEY_INVALID     |
| cfg.rewrite.model_id  | string | 是   | 空                | 3-64，^[A-Za-z0-9._-]+$  | CFG_MODEL_ID_INVALID   |
| cfg.tts.voice_id      | string | 是   | default_female_cn | 1-64                     | TTS_VOICE_ID_INVALID   |
| cfg.audio.output_gain | float  | 否   | 1.0               | 0.1-3.0                  | CFG_AUDIO_GAIN_INVALID |
| cfg.rewrite.prompt    | string | 否   | 默认模板          | 1-1200                   | CFG_PROMPT_INVALID     |

### 8.4 话术管理

| 字段ID             | 类型   | 必填 | 默认值 | 规则                   | 错误码                       |
| ------------------ | ------ | ---- | ------ | ---------------------- | ---------------------------- |
| script.title       | string | 是   | 空     | 1-60                   | SCRIPT_TITLE_INVALID         |
| script.content     | string | 是   | 空     | 1-120                  | SCRIPT_CONTENT_INVALID       |
| script.tags        | array  | 否   | []     | <=5 个，每个 <=20      | SCRIPT_TAG_INVALID           |
| script.status      | enum   | 是   | draft  | draft/enabled/disabled | SCRIPT_STATUS_INVALID        |
| script.import_file | file   | 否   | 空     | csv/xlsx/json          | SCRIPT_IMPORT_FORMAT_INVALID |

### 8.5 AI回复

| 字段ID               | 类型   | 必填 | 默认值 | 规则             | 错误码                     |
| -------------------- | ------ | ---- | ------ | ---------------- | -------------------------- |
| policy.name          | string | 是   | 空     | 1-40 且唯一      | POLICY_NAME_INVALID        |
| policy.temperature   | float  | 是   | 0.8    | 0.2-1.2          | POLICY_TEMPERATURE_INVALID |
| policy.max_reply_len | int    | 是   | 80     | 20-120           | POLICY_REPLY_LEN_INVALID   |
| policy.risk_mode     | enum   | 是   | semi   | manual/semi/auto | POLICY_RISK_MODE_INVALID   |
| policy.version       | int    | 是   | 自动   | 自增，不可回写   | POLICY_VERSION_CONFLICT    |

### 8.6 写话术

| 字段ID                 | 类型   | 必填 | 默认值   | 规则                       | 错误码                          |
| ---------------------- | ------ | ---- | -------- | -------------------------- | ------------------------------- |
| writer.scene           | enum   | 是   | product  | product/interaction/notice | WRITER_SCENE_INVALID            |
| writer.style           | enum   | 是   | friendly | friendly/professional/fast | WRITER_STYLE_INVALID            |
| writer.input_text      | string | 是   | 空       | 1-500                      | WRITER_INPUT_INVALID            |
| writer.output_text     | string | 否   | 空       | 发布时 1-120               | WRITER_OUTPUT_INVALID           |
| writer.sensitive_check | bool   | 否   | true     | true/false                 | WRITER_SENSITIVE_SWITCH_INVALID |

### 8.7 模型管理

| 字段ID            | 类型   | 必填 | 默认值   | 规则                                 | 错误码                |
| ----------------- | ------ | ---- | -------- | ------------------------------------ | --------------------- |
| model.name        | string | 是   | 空       | 1-40                                 | MODEL_NAME_INVALID    |
| model.file_path   | path   | 是   | 空       | 后缀 .pth/.onnx/.engine              | MODEL_FILE_INVALID    |
| model.engine_type | enum   | 是   | wav2lip  | wav2lip/musetalk                     | MODEL_ENGINE_MISMATCH |
| model.version     | string | 是   | 1.0.0    | semver                               | MODEL_VERSION_INVALID |
| model.status      | enum   | 是   | imported | imported/validated/active/deprecated | MODEL_STATUS_INVALID  |

### 8.8 OBS去重（P1）

| 字段ID                | 类型   | 必填 | 默认值 | 规则        | 错误码                |
| --------------------- | ------ | ---- | ------ | ----------- | --------------------- |
| obs.ws_url            | string | 是   | 空     | ^wss?://.+$ | OBS_URL_INVALID       |
| obs.ws_password       | string | 否   | 空     | 0-64        | OBS_AUTH_FAILED       |
| obs.dedupe_threshold  | float  | 是   | 0.85   | 0.00-1.00   | OBS_THRESHOLD_INVALID |
| obs.sample_window_sec | int    | 是   | 30     | 5-120       | OBS_WINDOW_INVALID    |
| obs.enabled           | bool   | 是   | false  | true/false  | OBS_NOT_CONNECTED     |

### 8.9 直播账号

| 字段ID                      | 类型   | 必填 | 默认值   | 规则                     | 错误码                          |
| --------------------------- | ------ | ---- | -------- | ------------------------ | ------------------------------- |
| account.platform            | enum   | 是   | douyin   | 仅支持 douyin            | ACCOUNT_PLATFORM_INVALID        |
| account.name                | string | 是   | 空       | 1-30 且唯一              | ACCOUNT_NAME_INVALID            |
| account.auth_token          | string | 是   | 空       | 非空，需加密存储         | ACCOUNT_TOKEN_EXPIRED           |
| account.health_interval_sec | int    | 是   | 60       | 固定 60                  | ACCOUNT_HEALTH_INTERVAL_INVALID |
| account.status              | enum   | 是   | disabled | enabled/disabled/expired | ACCOUNT_STATUS_INVALID          |

### 8.10 音转文字

| 字段ID                 | 类型  | 必填 | 默认值 | 规则        | 错误码                      |
| ---------------------- | ----- | ---- | ------ | ----------- | --------------------------- |
| asr.language           | enum  | 是   | zh-CN  | zh-CN/en-US | ASR_LANGUAGE_INVALID        |
| asr.sample_rate        | int   | 是   | 48000  | 16000/48000 | ASR_SAMPLE_RATE_UNSUPPORTED |
| asr.vad_threshold      | float | 是   | 0.5    | 0.0-1.0     | ASR_VAD_THRESHOLD_INVALID   |
| asr.segment_timeout_ms | int   | 是   | 800    | 300-3000    | ASR_SEGMENT_TIMEOUT_INVALID |
| asr.export_format      | enum  | 否   | txt    | txt/srt     | ASR_EXPORT_FORMAT_INVALID   |

## 9. 错误码总表（V1）

### 9.1 通用与配置

| 错误码                     | 模块 | 触发条件        | UI表现           | 自动恢复 |
| -------------------------- | ---- | --------------- | ---------------- | -------- |
| COMMON_TIMEOUT             | 通用 | 调用超时        | Toast + 重试按钮 | 是       |
| COMMON_NETWORK_UNREACHABLE | 通用 | 网络不可达      | 顶部告警         | 否       |
| COMMON_VALIDATION_FAILED   | 通用 | 字段校验失败    | 字段高亮         | 否       |
| CFG_APIKEY_INVALID         | 配置 | APIKey格式非法  | 禁止保存         | 否       |
| CFG_MODEL_ID_INVALID       | 配置 | ModelID格式非法 | 禁止保存         | 否       |
| CFG_SAVE_CONFLICT          | 配置 | 保存版本冲突    | 弹窗冲突提示     | 否       |

### 9.2 直播与队列

| 错误码                      | 模块 | 触发条件     | UI表现       | 自动恢复 |
| --------------------------- | ---- | ------------ | ------------ | -------- |
| LIVE_PLATFORM_UNSUPPORTED   | 直播 | 平台不支持   | 禁用连接     | 否       |
| LIVE_ROOM_ID_INVALID        | 直播 | 房间号非法   | 输入框报错   | 否       |
| LIVE_AUTH_401               | 直播 | 鉴权失败     | 连接失败提示 | 否       |
| LIVE_RATE_LIMITED           | 直播 | 平台限流     | 降级告警     | 是       |
| QUEUE_OVERFLOW_1000         | 队列 | 队列满       | 丢弃计数提示 | 是       |
| QUEUE_HIGH_PRIORITY_STARVED | 队列 | 高优先级饥饿 | 警告并重排   | 是       |

### 9.3 文本与风控

| 错误码                   | 模块 | 触发条件   | UI表现                      | 自动恢复 |
| ------------------------ | ---- | ---------- | --------------------------- | -------- |
| SCRIPT_TEXT_INVALID      | 文本 | 文本非法   | 禁止提交                    | 否       |
| SCRIPT_REWRITE_TIMEOUT   | 文本 | 改写超时   | 回退原文/重试               | 是       |
| MODERATION_HIT_SENSITIVE | 风控 | 命中敏感词 | 转待审                      | 否       |
| REVIEW_TIMEOUT_PENDING   | 风控 | 审核超时   | 标记 pending_review_timeout | 否       |
| POLICY_VERSION_CONFLICT  | 策略 | 版本冲突   | 要求刷新                    | 否       |

### 9.4 TTS/ASR/推理

| 错误码                      | 模块 | 触发条件     | UI表现           | 自动恢复 |
| --------------------------- | ---- | ------------ | ---------------- | -------- |
| TTS_PROVIDER_UNAVAILABLE    | TTS  | 云服务不可用 | 切换备用音色提示 | 是       |
| TTS_VOICE_ID_INVALID        | TTS  | 音色ID非法   | 试听失败提示     | 否       |
| ASR_DEVICE_BUSY             | ASR  | 设备占用     | 提示切换设备     | 否       |
| ASR_SAMPLE_RATE_UNSUPPORTED | ASR  | 采样率不支持 | 自动回退采样率   | 是       |
| AVATAR_ASSET_NOT_FOUND      | 推理 | 素材不存在   | 禁止启动         | 否       |
| AVATAR_ENGINE_INVALID       | 推理 | 引擎非法     | 启动失败         | 否       |
| AVATAR_INFER_FPS_LOW        | 推理 | inferfps过低 | 性能告警         | 是       |
| GPU_OOM_RECOVERABLE         | 推理 | 显存不足     | 自动降级重试     | 是       |

### 9.5 推流与外设

| 错误码                    | 模块 | 触发条件         | UI表现         | 自动恢复 |
| ------------------------- | ---- | ---------------- | -------------- | -------- |
| STREAM_RTMP_CONNECT_FAIL  | 推流 | RTMP连接失败     | 推流失败提示   | 是       |
| STREAM_WEBRTC_ICE_FAIL    | 推流 | ICE协商失败      | 预览中断告警   | 是       |
| STREAM_OUTPUT_DEVICE_LOST | 输出 | 输出设备丢失     | 自动切默认设备 | 是       |
| OBS_NOT_CONNECTED         | OBS  | 未连接时启用去重 | 禁止启用       | 否       |
| OBS_AUTH_FAILED           | OBS  | OBS鉴权失败      | 连接失败提示   | 否       |

### 9.6 账号与模型

| 错误码                 | 模块 | 触发条件         | UI表现         | 自动恢复 |
| ---------------------- | ---- | ---------------- | -------------- | -------- |
| ACCOUNT_TOKEN_EXPIRED  | 账号 | 令牌过期         | 状态置 expired | 否       |
| ACCOUNT_STATUS_INVALID | 账号 | 状态迁移非法     | 拒绝操作       | 否       |
| MODEL_FILE_INVALID     | 模型 | 文件类型不支持   | 导入失败       | 否       |
| MODEL_ENGINE_MISMATCH  | 模型 | 模型与引擎不匹配 | 启用失败       | 否       |
| MODEL_ROLLBACK_FAILED  | 模型 | 回滚失败         | 提示人工介入   | 否       |

## 10. 三条主链路时序文本

### 10.1 时序 A：会话启动

参与者：UI -> Main Orchestrator -> Live Adapter -> Python Avatar -> Media Service -> RTMP/WebRTC

1. UI 点击启动，发送 session.start（< 50ms）。
2. Main 校验配置与设备（< 150ms）。
3. Main 建立直播连接（< 500ms）。
4. Main 调用 /session/init 预热（< 500ms）。
5. Main 启动输出管道（< 300ms）。
6. Main 返回 running（< 100ms）。
7. 总预算：1.6s 内进入可播报。

### 10.2 时序 B：自动播报

参与者：Live Adapter -> Main -> Rewrite -> Moderation -> TTS -> Avatar Infer -> Media

1. 收弹幕后入队（< 20ms）。
2. 调用改写（< 1200ms）。
3. 调用敏感词检测（< 200ms）。
4. 命中敏感词则转待审。
5. 未命中则 TTS 首包（< 800ms）。
6. 推理首帧（< 500ms）。
7. 混流输出（< 120ms/帧）。

### 10.3 时序 C：故障恢复

参与者：Metrics Watcher -> Main -> Supervisor -> Python Services -> UI

1. 发现健康检查失败或 fps 连续 5s 低于阈值。
2. 状态转 degraded，暂停低优先级入队。
3. 重启异常子进程（最多 2 次）。
4. 重建媒体通道并复检。
5. 成功转 running，失败转 error 并提示人工介入。

## 11. 本轮结论与下一步

1. 已补齐：技术架构、实现方案、技术路径、接口与伪代码。
2. 已补齐：10 页面字段级校验矩阵、错误码总表、3 条主链路时序文本。
3. 已完成：防发散复核，当前范围可实现。
4. 下一轮建议：补充 button_id -> api_path -> error_code 映射与压测验收模板。

## 12. 项目核查完成标记（2026-04-28）

### 12.1 里程碑状态

1. [x] M0 架构冻结（已落地）

- 已有 action 常量字典、API 路径与类型、运行模式配置与基础状态机字段。

2. [ ] M1 主链路打通（部分完成）

- 已实现 dev-mock 链路：改写 -> 风控 -> TTS -> 播报状态反馈。
- 未完成真实链路：Avatar 推理帧与推流发布尚未接入真实服务编排。

3. [x] M2 核心页面闭环（已落地）

- AI直播、数字人、设置三页已可操作，关键按钮具备成功/失败反馈与审计写入。

4. [x] M3 运营页面闭环（已落地）

- 话术管理（ScriptPage.vue）：新建、保存、启用/禁用、批量删除、导入/导出全部按钮已实现。
- AI回复（PolicyPage.vue）：新建策略、保存、测试、发布、回滚全部按钮已实现。
- 写话术（WriterPage.vue）：生成、改写、敏感词检测、保存草稿、发布到话术库全部按钮已实现。
- 模型管理（ModelPage.vue）：导入、校验、启用、回滚、删除全部按钮已实现。
- 直播账号（AccountPage.vue）：新增、授权、启用/停用、连通性测试、删除全部按钮已实现。
- 音转文字（AsrPage.vue）：开始/暂停/停止监听、纠错提交、导出全部按钮已实现。
- 6 个页面已注册路由与侧边栏导航。
- Mock handlers 已覆盖所有 M3 API 路径。

5. [ ] M4 稳定性达标（未开始）

- 尚未形成 8 小时长稳、恢复成功率验证与完整指标看板。

6. [ ] M5 Beta 增强（未开始）

- 虚拟摄像头、OBS 去重尚未进入实现。

### 12.2 功能完成标记（按当前代码）

1. [x] 基础工程与运行模式

- Electron + Vue + TypeScript 工程可启动。
- dev-mock/dev-cpu/prod-cloud-gpu 运行模式已配置。

2. [x] 契约层

- button_id 动作字典已建立。
- API 路径、请求/响应类型、错误码映射已建立（含 M3 扩展）。

3. [x] 核心页面（P0）

- AI直播页面：已实现主要按钮交互、消息初始化、发送/插播、会话控制。
- 数字人页面：已实现素材选择、引擎切换、刷新设备、启动/停止、预览。
- 设置页面：已实现平台保存、API 启停、重置、提示词保存等基础动作。

4. [x] Store 与 Mock 服务

- session/live/avatar store 已接入。
- mock handlers 已覆盖 session/live/queue/rewrite/moderation/tts/avatar/stream/metrics。
- mock handlers 已扩展覆盖 M3 全部 API 路径（scripts/policies/writer/models/accounts/asr）。

5. [x] 运营页面（M3）

- 话术管理、AI回复策略、写话术、模型管理、直播账号、音转文字 6 个页面已实现。
- 所有按钮均有成功/失败反馈与审计写入。
- 字段级校验（标题/内容/状态/版本/文件格式等）已落实。

6. [ ] 真实后端编排与跨进程链路

- 当前调用默认走 mock，尚未完成 Node <-> Python 的真实服务联调闭环。

### 12.3 核查依据（代码位置）

1. 路由与核心页面：src/renderer/src/router/index.ts
2. 核心页面实现：src/features/live/LivePage.vue、src/features/avatar/AvatarPage.vue、src/features/settings/SettingsPage.vue
3. 运营页面实现：src/features/script/ScriptPage.vue、src/features/reply/PolicyPage.vue、src/features/script/WriterPage.vue、src/features/avatar/ModelPage.vue、src/features/live/AccountPage.vue、src/features/asr/AsrPage.vue
4. 动作与接口契约：src/shared/types/actions.ts、src/shared/types/api.ts
5. API 客户端与 mock：src/shared/api/client.ts、runtime/mock/handlers.ts
6. 状态管理与审计：src/shared/store/session.ts、src/shared/store/live.ts、src/shared/store/avatar.ts、src/shared/api/audit.ts
