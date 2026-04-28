# Digital Avatar Live - Technical Design V7

## 1. 文档目的
本文件为技术落地文档，和需求文档配套，指导下一步开发实现。当前阶段仅文档，不进入编码。

## 2. 输入约束与设计原则
### 2.1 约束
1. 单机单会话优先。
2. 抖音单平台首发。
3. 推理本地 GPU，LLM/TTS 可用云端。
4. 默认模型 Wav2Lip，RTX 3060 为最低硬件。
5. P1 功能不影响 P0 指标。

### 2.2 设计原则
1. 主链路优先：先保证直播消息到播报闭环。
2. 可回滚：配置、模型、策略均可回滚。
3. 可观测：每个关键动作可追踪、可诊断。
4. 防发散：不提前引入复杂中间件和并发架构。

## 3. 技术方案对比
| 方案 | 组成 | 优点 | 风险 | 阶段建议 |
| --- | --- | --- | --- | --- |
| S1 A-Base | Electron + Node + Python + SQLite + FFmpeg | 实现最快，调试成本低 | 后续并发扩展需重构编排层 | MVP |
| S2 A-Plus | S1 + 独立媒体进程 + 强守护 | 稳定性更高，故障域更小 | 复杂度上升 | Beta |
| S3 B-Lite | S2 + 多会话调度 + 可选 Redis | 并发扩展友好 | 超出 MVP 周期 | 2.0 预研 |

当前建议：采用 S1，预留向 S2 升级的接口与部署位点。

## 4. 目标架构
### 4.1 逻辑分层
1. UI 层（Renderer）
- 负责展示和交互，不承担业务编排。

2. Orchestrator 层（Node Main）
- 会话状态机。
- 队列调度与优先级策略。
- 风控分流与待审机制。
- 下游服务调用与超时重试。

3. Runtime 层（Python）
- ASR 服务。
- Avatar 推理服务。
- Media 混流推流服务。

4. Data & Observability 层
- SQLite（配置、策略、账号、审计）。
- 日志与指标上报。

### 4.2 进程模型
1. electron_renderer
2. electron_main_node
3. python_asr
4. python_avatar_infer
5. python_media
6. cloud_llm_api
7. cloud_tts_api

### 4.3 通信策略
1. Renderer <-> Main：IPC（命令、状态、事件）。
2. Main <-> Python：HTTP/REST（127.0.0.1）。
3. Main <-> Cloud：HTTPS（超时、重试、熔断、降级）。

## 5. 技术路径与里程碑
### M0 架构冻结（1 周）
- 输出：接口清单、状态机、错误码字典。
- 闸门：P0 按钮均有 action_id 与回执。

### M1 主链路打通（1-2 周）
- 输出：直播消息 -> 改写 -> 风控 -> TTS -> 推理 -> 推流。
- 闸门：首帧 <= 500ms，finalfps >= 25。

### M2 核心页面闭环（1 周）
- 输出：AI直播、数字人、设置页面可完整操作。
- 闸门：按钮成功率 >= 99%。

### M3 运营页面闭环（1 周）
- 输出：话术管理、AI回复、写话术、模型管理、直播账号、音转文字。
- 闸门：半自动审核可闭环，超时转待审生效。

### M4 稳定性与观测（1 周）
- 输出：日志、指标、告警、恢复机制。
- 闸门：8 小时稳定，恢复成功率 >= 99%。

### M5 P1 能力（可选）
- 输出：OBS 去重、虚拟摄像头。
- 闸门：不降低 M1 指标。

## 6. 核心接口设计
### 6.1 会话接口
1. POST /api/v1/session/start
- req: account_id, model_id, stream_mode
- resp: session_id, status
- timeout: 3s, retry: 1

2. POST /api/v1/session/stop
- req: session_id
- resp: status
- timeout: 2s, retry: 1

3. GET /api/v1/session/status
- req: session_id
- resp: state, inferfps, finalfps, queue_usage_ratio
- timeout: 1s

### 6.2 直播与队列接口
1. POST /api/v1/live/connect
- req: platform, room_id, token
- resp: task_id, state

2. POST /api/v1/live/disconnect
- req: task_id
- resp: state

3. POST /api/v1/queue/enqueue
- req: session_id, text, priority
- resp: queue_id, position

4. POST /api/v1/queue/insert
- req: session_id, text, priority=high
- resp: queue_id, position

### 6.3 文本和风控接口
1. POST /api/v1/script/rewrite
- req: session_id, raw_text, policy_id
- resp: rewritten_text, risk_tag

2. POST /api/v1/moderation/check
- req: text, dict_scope
- resp: risk_level, hit_words

3. POST /api/v1/review/decision
- req: item_id, action(send/drop/rewrite)
- resp: state

### 6.4 语音推理推流接口
1. POST /api/v1/tts/synthesize
- req: text, voice_id, speed
- resp: audio_stream_ref

2. POST /api/v1/avatar/start
- req: session_id, avatar_id, engine
- resp: state

3. POST /api/v1/stream/start
- req: session_id, mode(rtmp|webrtc), target
- resp: state

4. GET /api/v1/metrics
- resp: latency_p95_ms, inferfps, finalfps, gpu_util, queue_drop_count

## 7. 调用伪代码
### 7.1 自动播报主链路
1. onLiveMessage(msg)
2. if queue.size >= 1000 then dropLowPriorityFIFO()
3. rewritten = rewrite(msg)
4. risk = moderationCheck(rewritten)
5. if risk.hit then toPendingReview(rewritten) and return
6. audioRef = ttsSynthesize(rewritten)
7. frameRef = avatarInfer(audioRef)
8. publish(frameRef, audioRef)
9. writeMetricsAndAudit()

### 7.2 插播链路
1. onInsertClick(text)
2. validate(notBlank && len <= 120)
3. risk = moderationCheck(text)
4. if risk.hit then toPendingReview(text) else queueInsertHigh(text)
5. notifyUI(queuePosition)

### 7.3 故障恢复链路
1. if healthCheckFail || inferfps < threshold
2. setState(degraded)
3. pauseQueueConsume()
4. restartFailedProcess()
5. rebuildStreamChannel()
6. if success then setState(running) else setState(error)

## 8. 数据与日志设计
### 8.1 SQLite 表建议
1. sessions
- session_id, account_id, model_id, state, created_at, updated_at

2. queue_items
- queue_id, session_id, text, priority, state, created_at

3. review_items
- review_id, session_id, text, risk_level, decision, timeout_at

4. policies
- policy_id, name, version, config_json, status

5. models
- model_id, name, engine_type, version, status, file_path

6. audits
- audit_id, session_id, button_id, action, result, error_code, ts

### 8.2 指标定义
1. latency_p95_ms
2. inferfps
3. finalfps
4. queue_usage_ratio
5. queue_drop_count
6. recovery_success_rate

## 9. 错误处理与恢复策略
1. 调用超时
- 策略：1 次自动重试 + 指数退避。

2. 鉴权失败
- 策略：停止当前链路，提示重新授权。

3. 显存不足
- 策略：自动降级参数并重试；失败则进入 error。

4. 推流失败
- 策略：重建输出通道，最多重试 2 次。

5. 审核超时
- 策略：状态置 pending_review_timeout，等待人工处理。

## 10. 防发散清单
1. 不新增第二数据库到 MVP。
2. 不引入分布式中间件到 MVP。
3. 不引入多平台并行接入。
4. 不引入多会话并发。
5. 不引入 C++/Rust 自研媒体核。
6. 不允许新增能力破坏首帧 <= 500ms。

## 11. 开发交接说明
1. 先按 requirements-spec-v7.md 的按钮级定义拆解任务。
2. 每个任务必须绑定：按钮ID、接口路径、错误码、验收指标。
3. 每个里程碑结束必须完成一轮回归和指标复核。
4. 当前阶段只做文档，不做代码实现。
