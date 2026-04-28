# Digital Avatar VibeCoding 落地计划 V1

## 1. 目标与适用范围
本计划用于指导 AI 工具从 0 开始完成以下工作：
1. 使用 electron-vite-vue 建立桌面端基础工程。
2. 按当前仓库需求文档与技术文档落地可运行骨架。
3. 在无 GPU 环境下完成开发、联调、打包与部署验证。

本计划的输入基线：
1. docs/requirements-spec-v7.md
2. docs/technical-design-v7.md

## 2. 核心原则（防发散）
1. 先闭环后优化：先跑通单路主链路，再谈高性能。
2. 契约优先：先定义按钮 action 与接口契约，再写实现。
3. 双模式运行：开发模式（mock/cpu）与生产模式（cloud-gpu）共存。
4. 每步可验收：每个阶段必须有可执行检查命令与 DoD（完成定义）。

## 3. 建议运行模式（无 GPU 开发优先）
| 模式 | 用途 | 数字人能力 | 目标 |
| --- | --- | --- | --- |
| dev-mock | 前期开发、联调 | 预录视频 + 假响应 | 最高速度打通交互与状态机 |
| dev-cpu | 中期联调 | 低分辨率低帧率推理或替身服务 | 验证链路稳定性 |
| prod-cloud-gpu | 上线前验收 | 远端 GPU 推理 | 验证效果与性能指标 |

说明：本仓库当前环境默认从 dev-mock 起步。

## 4. Phase-by-Phase 执行路径

### Phase 0 - 初始化与基线冻结（0.5 天）
目标：创建工程并固化执行边界。

AI 执行动作：
1. 创建 Electron 基础工程（基于 electron-vite-vue）。
2. 建立 docs/ 与 src/ 的映射关系清单。
3. 写入运行模式开关配置（APP_RUNTIME_MODE=dev-mock/dev-cpu/prod-cloud-gpu）。

建议命令：
1. git clone https://github.com/electron-vite/electron-vite-vue.git digital-avatar-app
2. cd digital-avatar-app
3. npm install
4. npm run dev

DoD：
1. 应用可启动。
2. 主进程、预加载、渲染进程目录结构完整。
3. 模式开关存在且可读取。

### Phase 1 - 目录重构与模块脚手架（1 天）
目标：将模板升级为业务可扩展结构。

目标目录建议：
1. electron/main
2. electron/preload
3. src/app
4. src/features/live
5. src/features/avatar
6. src/features/settings
7. src/features/script
8. src/features/reply
9. src/features/asr
10. src/shared/api
11. src/shared/store
12. src/shared/types
13. runtime/mock
14. runtime/adapters
15. scripts

AI 执行动作：
1. 建立 feature-based 目录与空白模块入口。
2. 建立统一 IPC 通道常量与类型定义。
3. 建立统一 API 客户端层（仅封装，不实现业务）。

DoD：
1. 各 feature 可独立挂载。
2. 无循环依赖。
3. npm run dev 可正常热更新。

### Phase 2 - 契约先行（1 天）
目标：先落接口契约与按钮 action 契约。

AI 执行动作：
1. 以 requirements-spec-v7.md 为准，生成按钮 action 映射表。
2. 以 technical-design-v7.md 为准，生成 API 路径与请求响应类型。
3. 为每个 P0 按钮补齐成功/失败状态机事件。

关键产物：
1. src/shared/types/actions.ts
2. src/shared/types/api.ts
3. docs/button-action-api-map-v1.md

DoD：
1. P0 按钮均可映射到 action_id 与 api_path。
2. 错误码可映射到 UI 可读提示。
3. 所有契约能通过类型检查。

### Phase 3 - dev-mock 闭环（1-2 天）
目标：在无 GPU 条件下跑通全链路。

AI 执行动作：
1. 创建 mock 服务：live、rewrite、moderation、tts、avatar、stream、metrics。
2. 实现最小闭环：消息输入 -> 改写 -> 风控 -> 语音占位 -> 数字人占位 -> 推流占位。
3. 完成核心页面按钮的可操作反馈。

建议先覆盖页面：
1. AI直播
2. 数字人
3. 设置

DoD：
1. 主链路可重复执行。
2. 关键按钮均有成功与失败反馈。
3. 审计日志可记录 button_id、action、result。

### Phase 4 - dev-cpu 联调（1-2 天）
目标：替换部分 mock，验证真实依赖下稳定性。

AI 执行动作：
1. 接入云端 LLM/TTS。
2. 本地 avatar 推理先走低规格或替身策略。
3. 加入超时、重试、降级、回滚。

DoD：
1. 会话可持续运行 2 小时以上。
2. 异常可恢复，不出现僵死状态。
3. 指标面板能看到 latency、finalfps、queue_usage_ratio。

### Phase 5 - 打包与部署（1 天）
目标：形成可安装、可验证的交付物。

AI 执行动作：
1. 基于模板构建产物（模板默认 build 包含 electron-builder）。
2. 生成 Windows 打包产物与发布说明。
3. 提供 smoke test 脚本与回归清单。

建议命令：
1. npm run build
2. npm run preview

DoD：
1. 安装包可启动并进入主页面。
2. dev-mock 模式可跑通核心操作。
3. 发布说明包含已知限制与回滚方案。

## 5. AI 工具执行协议（VibeCoding 核心）

### 5.1 每轮输入模板（你给 AI）
1. 任务目标：一句话。
2. 输入文档：requirements-spec-v7.md / technical-design-v7.md 的具体章节。
3. 范围边界：允许改哪些目录，不允许改哪些目录。
4. 验收标准：至少 3 条可验证标准。
5. 输出要求：变更清单 + 风险 + 下一步。

### 5.2 每轮输出模板（AI 必须返回）
1. 修改文件列表。
2. 关键实现说明。
3. 验证命令与结果摘要。
4. 风险与回退方案。

### 5.3 强制门禁
1. 不允许跳过类型检查。
2. 不允许无契约直接写业务调用。
3. 不允许新增功能破坏既定性能目标。
4. 不允许擅自引入分布式中间件。

## 6. 任务拆解清单（可直接喂给 AI）

### Epic A：工程初始化
1. A1: 基于 electron-vite-vue 创建项目并可运行。
2. A2: 增加运行模式配置与环境变量读取。
3. A3: 生成项目目录与模块占位文件。

### Epic B：契约层
1. B1: 生成按钮 action 常量与类型。
2. B2: 生成 API 类型与错误码类型。
3. B3: 生成按钮到接口映射文档。

### Epic C：主链路
1. C1: mock live/rewrite/moderation/tts/avatar/stream。
2. C2: 打通 AI直播页面按钮闭环。
3. C3: 打通数字人与设置页面核心按钮闭环。

### Epic D：可观测与恢复
1. D1: 指标采集与展示。
2. D2: 异常重试、降级、回滚。
3. D3: 审计日志与错误码联动。

### Epic E：发布
1. E1: Windows 打包。
2. E2: 安装后 smoke test。
3. E3: 发布说明与回滚说明。

## 7. 部署流程（Windows）
1. 预检查：Node 版本、NPM、系统权限、网络可用性。
2. 构建：npm run build。
3. 产物检查：安装包、可执行文件、依赖文件完整性。
4. 安装验证：启动、页面加载、核心按钮可点击。
5. 运行验证：dev-mock 主链路循环 50 次不崩溃。
6. 发布归档：版本号、变更摘要、已知问题、回滚路径。

## 8. 风险与应对
1. 风险：无 GPU 导致真实推理性能不达标。
- 应对：开发阶段使用 dev-mock 与 dev-cpu，性能指标在 prod-cloud-gpu 阶段验收。

2. 风险：AI 工具过度发散。
- 应对：每轮必须绑定阶段任务与 DoD，超范围改动直接回退。

3. 风险：部署后环境差异导致失败。
- 应对：固定 Node 版本与依赖锁文件，保留 smoke test。

## 9. 第一周落地节奏（建议）
1. Day1: Phase 0 + Phase 1
2. Day2: Phase 2
3. Day3-Day4: Phase 3
4. Day5-Day6: Phase 4
5. Day7: Phase 5

## 10. 立即执行项（下一步）
1. 先由 AI 完成 Epic A（初始化）。
2. 再由 AI 完成 Epic B（契约层）。
3. 通过后进入 Epic C（主链路）。

以上顺序禁止颠倒。