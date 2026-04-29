# Digital Avatar Live - 数字人直播系统

<div align="center">

**基于 Electron + Vue + Python 的实时数字人直播解决方案**

[![Electron](https://img.shields.io/badge/Electron-39.2.6-47848F?logo=electron)](https://www.electronjs.org/)
[![Vue](https://img.shields.io/badge/Vue-3.5.25-4FC08D?logo=vue.js)](https://vuejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5.9.3-3178C6?logo=typescript)](https://www.typescriptlang.org/)
[![Python](https://img.shields.io/badge/Python-FastAPI-3776AB?logo=python)](https://fastapi.tiangolo.com/)

</div>

## 📖 项目简介

Digital Avatar Live 是一个面向抖音平台的实时数字人直播系统，支持将直播弹幕自动转换为数字人语音播报，实现智能化互动直播。系统采用云边协同架构，LLM/TTS 云端处理，唇形推理本地 GPU 加速，确保低延迟、高质量的直播体验。

### ✨ 核心特性

- **🎯 实时直播闭环**：直播消息到数字人播报端到端首帧 ≤ 500ms
- **🤖 智能回复策略**：支持半自动审核，敏感词命中强制人工确认
- **🎬 多引擎支持**：默认 Wav2Lip，支持 MuseTalk 等唇形同步引擎
- **📝 话术管理**：完整的话术库、策略配置、文案生成与改写能力
- **🔧 灵活配置**：支持多平台 API 接入、TTS 音色选择、音频设备管理
- **📊 可观测性**：完整的指标监控、审计日志、故障自动恢复
- **🖥️ 硬件要求**：最低 RTX 3060，单机单会话稳定运行

## 🏗️ 技术架构

### 分层架构

```
┌─────────────────────────────────────────┐
│       交互层 (Electron Renderer)         │
│   Vue 3 + TypeScript + Pinia + Router   │
└──────────────┬──────────────────────────┘
               │ IPC
┌──────────────▼──────────────────────────┐
│      编排层 (Electron Main + Node)       │
│   会话状态机 | 队列调度 | 风控分流       │
└──────────────┬──────────────────────────┘
        HTTP/REST │
┌──────────────▼──────────────────────────┐
│     推理媒体层 (Python + FFmpeg)         │
│   ASR | TTS | Avatar Infer | Media      │
└──────────────┬──────────────────────────┘
               │ HTTPS
┌──────────────▼──────────────────────────┐
│        云服务层 (Cloud APIs)             │
│   LLM API | TTS API | Moderation API    │
└─────────────────────────────────────────┘
```

### 进程拓扑

1. **process_ui**: Electron Renderer (Vue 3 界面)
2. **process_orchestrator**: Electron Main + Node (业务编排)
3. **process_asr**: Python ASR 服务 (语音识别)
4. **process_avatar**: Python Avatar Inference (唇形推理)
5. **process_media**: Python Media Service (混流推流)
6. **cloud_services**: LLM API + TTS API (云端服务)

### 技术栈

| 层级     | 技术选型                                                    |
| -------- | ----------------------------------------------------------- |
| 前端框架 | Electron 39 + Vue 3.5 + TypeScript 5.9                      |
| 状态管理 | Pinia 3.0                                                   |
| 路由管理 | Vue Router 5.0                                              |
| 构建工具 | electron-vite 5.0 + Vite 7.2                                |
| 后端编排 | Node.js (Electron Main)                                     |
| 推理服务 | Python FastAPI + Wav2Lip/MuseTalk                           |
| 媒体处理 | FFmpeg                                                      |
| 数据存储 | SQLite (配置/审计/策略)                                     |
| 通信协议 | IPC (Renderer↔Main), HTTP/REST (Node↔Python), HTTPS (Cloud) |

## 🚀 快速开始

### 环境要求

- **Node.js**: >= 18.x
- **Python**: >= 3.9
- **GPU**: NVIDIA RTX 3060 或更高（支持 CUDA）
- **操作系统**: Windows 10/11, macOS, Linux

### 安装依赖

```bash
# 克隆项目
git clone <repository-url>
cd digital_avatar

# 安装 Node.js 依赖
npm install

# 安装 Python 依赖（推理服务）
cd runtime
pip install -r requirements.txt
```

### 开发模式

```bash
# 启动开发服务器（mock 模式）
npm run dev

# 类型检查
npm run typecheck

# 代码格式化
npm run format

# 代码 lint
npm run lint
```

### 抖音弹幕直连（主进程内置）

项目已内置抖音直播间直连能力，不再依赖外部 dycast 客户端或 relay 转发服务。

1. 启动本项目：`npm run dev`
2. 打开 AI直播 页面，输入直播间房间号
3. 点击“加载直播间数据”
4. 在“直播房间实时信息流”观察弹幕/礼物/点赞/进场/关注与房间统计
5. 可选：打开“弹幕自动入队”，将聊天弹幕自动写入业务队列

说明：

- 直连状态、重连次数、最近消息时间会在 AI直播 页面实时显示。
- 当直连不可用时，页面会提示错误并自动回退到模拟流。

### 构建应用

```bash
# 构建所有平台
npm run build

# 仅构建 Windows
npm run build:win

# 仅构建 macOS
npm run build:mac

# 仅构建 Linux
npm run build:linux

# 构建免安装包（用于测试）
npm run build:unpack
```

## 📁 项目结构

```
digital_avatar/
├── docs/                      # 项目文档
│   ├── requirements-spec-v7.md       # 需求规格说明书
│   ├── technical-design-v7.md        # 技术设计文档
│   ├── plan-v6.md                    # 项目计划
│   └── button-action-api-map-v1.md   # 按钮-API 映射表
├── electron/                  # Electron 主进程
│   ├── main/
│   │   └── index.ts                  # 主进程入口
│   └── preload/
│       ├── index.ts                  # 预加载脚本
│       └── index.d.ts                # 类型定义
├── src/                       # 源代码
│   ├── features/              # 功能模块
│   │   ├── asr/               # 音转文字
│   │   ├── avatar/            # 数字人管理
│   │   │   ├── AvatarPage.vue
│   │   │   └── ModelPage.vue         # 模型管理
│   │   ├── live/              # AI 直播
│   │   │   └── LivePage.vue
│   │   │   └── AccountPage.vue       # 直播账号
│   │   ├── reply/             # AI 回复
│   │   │   └── PolicyPage.vue        # 策略管理
│   │   ├── script/            # 话术管理
│   │   │   ├── ScriptPage.vue        # 话术库
│   │   │   └── WriterPage.vue        # 写话术
│   │   └── settings/          # 系统设置
│   │       └── SettingsPage.vue
│   ├── renderer/              # 渲染进程
│   │   └── src/
│   │       ├── components/           # 通用组件
│   │       │   ├── AppLayout.vue     # 应用布局
│   │       │   └── Versions.vue
│   │       ├── router/               # 路由配置
│   │       │   └── index.ts
│   │       ├── assets/               # 静态资源
│   │       ├── App.vue               # 根组件
│   │       └── main.ts               # 入口文件
│   └── shared/                # 共享模块
│       ├── api/               # API 客户端
│       │   ├── client.ts             # HTTP 客户端
│       │   ├── audit.ts              # 审计日志
│       │   └── index.ts
│       ├── store/             # 状态管理
│       │   ├── session.ts            # 会话状态
│       │   ├── live.ts               # 直播状态
│       │   ├── avatar.ts             # 数字人状态
│       │   └── index.ts
│       ├── types/             # 类型定义
│       │   ├── actions.ts            # 动作字典
│       │   ├── api.ts                # API 类型
│       │   ├── ipc-channels.ts       # IPC 通道
│       │   └── index.ts
│       └── config/            # 配置
│           └── runtimeMode.ts        # 运行模式
├── runtime/                   # Python 运行时
│   ├── adapters/                     # 适配器
│   └── mock/                         # Mock 服务
│       ├── handlers.ts               # Mock 处理器
│       └── index.ts
├── out/                       # 编译输出
├── package.json               # 项目配置
├── tsconfig.json              # TypeScript 配置
├── electron.vite.config.ts    # Electron Vite 配置
└── electron-builder.yml       # Electron Builder 配置
```

## 🎯 功能模块

### 1. AI 直播页面

实时直播消息处理与数字人播报控制。

**核心功能**：

- 直播间数据加载与消息监听
- 消息提醒开关
- TTS 试听与会话控制（运行/暂停/停止）
- 音画同步开关
- 模型热切换
- 文本插播与发送
- 账号接入管理
- 消息初始化

**性能指标**：

- 首次拉取 ≤ 3s
- 首播报 ≤ 2s
- 口型偏差 ≤ 120ms
- 模型切换 ≤ 3s

### 2. 数字人页面

数字人资产管理与推理引擎配置。

**核心功能**：

- 视频素材导入（MP4/MOV）
- 推理引擎选择（Wav2Lip/MuseTalk）
- 摄像头模式切换
- 音频设备刷新与管理
- 预览窗口显示
- 推理会话启停

**性能指标**：

- 素材导入 ≤ 2s
- 首帧渲染 ≤ 500ms
- 引擎切换 ≤ 1s

### 3. 设置页面

系统配置与云端服务管理。

**核心功能**：

- LLM/TTS 平台配置保存
- 语音引擎轮换
- API 服务启停
- 参数恢复默认值
- 音频输出设备刷新
- 改写提示词模板管理

### 4. 话术管理

话术库的增删改查与批量操作。

**核心功能**：

- 话术导入（CSV/XLSX/JSON）
- 话术导出
- 新建/编辑/保存话术
- 启用/禁用话术
- 批量删除
- 标签管理

**性能指标**：

- 1万条导入 ≤ 10s
- 导出 ≤ 3s

### 5. AI 回复

回复策略的配置、测试与发布。

**核心功能**：

- 新建策略模板
- 策略参数配置（temperature、max_reply_len、risk_mode）
- 策略测试（LLM 模拟回复）
- 策略发布与版本管理
- 策略回滚

**性能指标**：

- 策略测试 ≤ 2s
- 策略发布 ≤ 3s
- 回滚 ≤ 2s

### 6. 写话术

AI 辅助文案生成与改写。

**核心功能**：

- 场景与风格选择
- AI 生成候选文案
- 文案改写
- 敏感词检测
- 草稿保存
- 发布到话术库

**性能指标**：

- 首批生成 ≤ 3s
- 改写 ≤ 2s
- 敏感词检测 ≤ 1s

### 7. 模型管理

数字人模型的导入、校验与版本管理。

**核心功能**：

- 模型导入（.pth/.onnx/.engine）
- 模型校验（权重与依赖）
- 模型启用/禁用
- 模型回滚
- 模型删除

**性能指标**：

- 模型导入 ≤ 5s
- 模型校验 ≤ 8s
- 模型切换 ≤ 3s

### 8. 直播账号

多平台直播账号管理与授权。

**核心功能**：

- 新增账号
- 授权登录
- 账号启用/停用
- 连通性测试
- 账号删除

**性能指标**：

- 授权流程 ≤ 60s
- 连通性测试 ≤ 2s

### 9. 音转文字（ASR）

实时语音识别与字幕生成。

**核心功能**：

- 开始/暂停/停止监听
- 人工纠错提交
- 文本导出（TXT/SRT）

**性能指标**：

- 首字幕 ≤ 800ms
- 导出 ≤ 2s

### 10. OBS 去重（P1 功能）

OBS 集成与内容去重。

**核心功能**：

- OBS WebSocket 连接
- 去重策略启停
- 阈值配置
- 差异预览

## 🔧 配置说明

### 运行模式

系统支持三种运行模式，通过 `src/shared/config/runtimeMode.ts` 配置：

1. **dev-mock**: 开发模式，使用 Mock 服务
2. **dev-cpu**: 开发模式，使用 CPU 推理
3. **prod-cloud-gpu**: 生产模式，使用云端服务 + GPU 推理

### 环境变量

```bash
# .env
VITE_APP_RUNTIME_MODE=dev-mock

# .env.dev-cpu
VITE_APP_RUNTIME_MODE=dev-cpu
VITE_LIVETALKING_BASE_URL=http://localhost:8010

# .env.prod-cloud-gpu
VITE_APP_RUNTIME_MODE=prod-cloud-gpu
```

### 抖音真实弹幕接入（内置直连）

Electron Main 会直接完成房间信息获取、签名、`im/fetch` 和 WebSocket 推送解析，并把标准化消息推送到 AI直播页面“直播房间实时信息流”。

1. 启动本项目：`npm run dev`
2. 在 AI直播 页面输入抖音直播间房间号并点击“加载直播间数据”
3. 观察实时信息流中是否出现弹幕/礼物/点赞/进场/关注/统计消息

说明：

- 连接中断会自动重连（有重连上限），状态会显示在页面指标区。
- 直连不可用时会自动回退到模拟流，保障页面链路可用。

### 数据库

系统使用 SQLite 存储以下数据：

- `sessions`: 会话信息
- `queue_items`: 队列项
- `review_items`: 待审项
- `policies`: 回复策略
- `models`: 模型元数据
- `audits`: 审计日志

## 📊 性能指标

### 关键指标定义

| 指标                  | 说明         | 目标值   |
| --------------------- | ------------ | -------- |
| latency_p95_ms        | P95 延迟     | ≤ 500ms  |
| inferfps              | 推理帧率     | ≥ 25 fps |
| finalfps              | 输出帧率     | ≥ 25 fps |
| queue_usage_ratio     | 队列使用率   | ≤ 80%    |
| queue_drop_count      | 队列丢弃计数 | 最小化   |
| recovery_success_rate | 恢复成功率   | ≥ 99%    |

### 稳定性要求

- 连续运行 8 小时不崩溃
- 自动恢复成功率 ≥ 99%
- 关键按钮操作成功率 ≥ 99%

## 🛠️ 开发指南

### 代码规范

项目使用 ESLint + Prettier 进行代码质量控制：

```bash
# 检查代码
npm run lint

# 格式化代码
npm run format

# 类型检查
npm run typecheck
```

### 添加新功能

1. **定义按钮动作**：在 `src/shared/types/actions.ts` 中添加 button_id
2. **定义 API 接口**：在 `src/shared/types/api.ts` 中添加请求/响应类型
3. **实现页面组件**：在 `src/features/` 下创建新页面
4. **注册路由**：在 `src/renderer/src/router/index.ts` 中注册路由
5. **添加 Mock handler**：在 `runtime/mock/handlers.ts` 中添加 Mock 逻辑
6. **更新审计日志**：确保关键操作写入审计日志

### 调试技巧

```bash
# 启用 Electron DevTools
# 在开发模式下自动开启

# 查看主进程日志
npm run dev

# 查看渲染进程日志
# 打开浏览器控制台 (Ctrl+Shift+I)
```

## 📝 文档索引

- [需求规格说明书](docs/requirements-spec-v7.md) - 按钮级需求定义
- [技术设计文档](docs/technical-design-v7.md) - 技术架构与接口设计
- [项目计划](docs/plan-v6.md) - 里程碑与实施路径
- [按钮-API 映射表](docs/button-action-api-map-v1.md) - 按钮与接口对应关系

## 🗺️ 开发路线图

### M0 - 架构冻结 ✅

- [x] 接口清单、状态机、错误码字典完成

### M1 - 主链路打通 🔄

- [x] Mock 链路实现（改写 → 风控 → TTS → 播报）
- [ ] 真实服务联调（Avatar 推理 + 推流）

### M2 - 核心页面闭环 ✅

- [x] AI直播、数字人、设置页面可完整操作

### M3 - 运营页面闭环 ✅

- [x] 话术管理、AI回复、写话术、模型管理、直播账号、音转文字

### M4 - 稳定性与观测 ⏳

- [ ] 8 小时稳定运行验证
- [ ] 完整指标看板与告警

### M5 - P1 能力增强 ⏳

- [ ] OBS 去重
- [ ] 虚拟摄像头

## 🤝 贡献指南

欢迎提交 Issue 和 Pull Request！

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

## 📄 许可证

本项目采用 MIT 许可证 - 详见 [LICENSE](LICENSE) 文件

## 👥 团队

由 Alibaba Cloud 技术团队提供支持

---

<div align="center">

**Made with ❤️ by Digital Avatar Team**

[⭐ Star this repo](https://github.com/your-repo/digital_avatar)

</div>
