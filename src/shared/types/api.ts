// API paths, request/response types, error codes

// ---------------------------------------------------------------------------
// API Path Constants
// ---------------------------------------------------------------------------

export const ApiPaths = {
  SESSION_START: '/api/v1/session/start',
  SESSION_STOP: '/api/v1/session/stop',
  SESSION_STATUS: '/api/v1/session/status',
  LIVE_CONNECT: '/api/v1/live/connect',
  LIVE_DISCONNECT: '/api/v1/live/disconnect',
  QUEUE_ENQUEUE: '/api/v1/queue/enqueue',
  QUEUE_INSERT: '/api/v1/queue/insert',
  SCRIPT_REWRITE: '/api/v1/script/rewrite',
  MODERATION_CHECK: '/api/v1/moderation/check',
  REVIEW_DECISION: '/api/v1/review/decision',
  TTS_SYNTHESIZE: '/api/v1/tts/synthesize',
  AVATAR_START: '/api/v1/avatar/start',
  STREAM_START: '/api/v1/stream/start',
  METRICS: '/api/v1/metrics',
  // M3 - Script management
  SCRIPTS_LIST: '/api/v1/scripts',
  SCRIPTS_CREATE: '/api/v1/scripts/create',
  SCRIPTS_UPDATE: '/api/v1/scripts/update',
  SCRIPTS_DELETE: '/api/v1/scripts/delete',
  SCRIPTS_STATUS: '/api/v1/scripts/status',
  // M3 - Policy (AI回复)
  POLICIES_LIST: '/api/v1/policies',
  POLICIES_CREATE: '/api/v1/policies/create',
  POLICIES_SAVE: '/api/v1/policies/save',
  POLICIES_TEST: '/api/v1/policies/test',
  POLICIES_PUBLISH: '/api/v1/policies/publish',
  POLICIES_ROLLBACK: '/api/v1/policies/rollback',
  // M3 - Writer (写话术)
  WRITER_GENERATE: '/api/v1/writer/generate',
  WRITER_REWRITE: '/api/v1/writer/rewrite',
  WRITER_SENSITIVE_CHECK: '/api/v1/writer/sensitive-check',
  WRITER_SAVE_DRAFT: '/api/v1/writer/save-draft',
  WRITER_PUBLISH: '/api/v1/writer/publish',
  // M3 - Model management
  MODELS_LIST: '/api/v1/models',
  MODELS_IMPORT: '/api/v1/models/import',
  MODELS_VERIFY: '/api/v1/models/verify',
  MODELS_ENABLE: '/api/v1/models/enable',
  MODELS_ROLLBACK: '/api/v1/models/rollback',
  MODELS_DELETE: '/api/v1/models/delete',
  // M3 - Account management
  ACCOUNTS_LIST: '/api/v1/accounts',
  ACCOUNTS_CREATE: '/api/v1/accounts/create',
  ACCOUNTS_AUTH: '/api/v1/accounts/auth',
  ACCOUNTS_STATUS: '/api/v1/accounts/status',
  ACCOUNTS_HEALTH: '/api/v1/accounts/health',
  ACCOUNTS_DELETE: '/api/v1/accounts/delete',
  // M3 - ASR (音转文字)
  ASR_START: '/api/v1/asr/start',
  ASR_PAUSE: '/api/v1/asr/pause',
  ASR_STOP: '/api/v1/asr/stop',
  ASR_CORRECTION: '/api/v1/asr/correction',
  ASR_EXPORT: '/api/v1/asr/export'
} as const

export type ApiPath = (typeof ApiPaths)[keyof typeof ApiPaths]

// ---------------------------------------------------------------------------
// Error Codes
// ---------------------------------------------------------------------------

export enum ErrorCode {
  AUTH_FAILED = 'AUTH_FAILED',
  ROOM_NOT_FOUND = 'ROOM_NOT_FOUND',
  MODEL_NOT_AVAILABLE = 'MODEL_NOT_AVAILABLE',
  FORMAT_NOT_SUPPORTED = 'FORMAT_NOT_SUPPORTED',
  QUEUE_OVERFLOW = 'QUEUE_OVERFLOW',
  TIMEOUT = 'TIMEOUT',
  GPU_OOM = 'GPU_OOM',
  STREAM_FAILED = 'STREAM_FAILED',
  REVIEW_TIMEOUT = 'REVIEW_TIMEOUT',
  INVALID_TEXT = 'INVALID_TEXT',
  DEVICE_OCCUPIED = 'DEVICE_OCCUPIED',
  PORT_OCCUPIED = 'PORT_OCCUPIED',
  VERSION_CONFLICT = 'VERSION_CONFLICT',
  NO_ACTIVE_TASK = 'NO_ACTIVE_TASK',
  STOP_FAILED = 'STOP_FAILED',
  // M3
  SCRIPT_TITLE_INVALID = 'SCRIPT_TITLE_INVALID',
  SCRIPT_CONTENT_INVALID = 'SCRIPT_CONTENT_INVALID',
  SCRIPT_STATUS_INVALID = 'SCRIPT_STATUS_INVALID',
  POLICY_NAME_INVALID = 'POLICY_NAME_INVALID',
  POLICY_VERSION_CONFLICT = 'POLICY_VERSION_CONFLICT',
  POLICY_TEST_FAILED = 'POLICY_TEST_FAILED',
  WRITER_INPUT_INVALID = 'WRITER_INPUT_INVALID',
  WRITER_OUTPUT_INVALID = 'WRITER_OUTPUT_INVALID',
  MODEL_FILE_INVALID = 'MODEL_FILE_INVALID',
  MODEL_ENGINE_MISMATCH = 'MODEL_ENGINE_MISMATCH',
  MODEL_VERIFY_FAILED = 'MODEL_VERIFY_FAILED',
  MODEL_IN_USE = 'MODEL_IN_USE',
  ACCOUNT_NAME_INVALID = 'ACCOUNT_NAME_INVALID',
  ACCOUNT_AUTH_TIMEOUT = 'ACCOUNT_AUTH_TIMEOUT',
  ACCOUNT_STATUS_INVALID = 'ACCOUNT_STATUS_INVALID',
  ACCOUNT_IN_USE = 'ACCOUNT_IN_USE',
  ASR_DEVICE_BUSY = 'ASR_DEVICE_BUSY',
  ASR_NOT_RUNNING = 'ASR_NOT_RUNNING',
  ASR_EXPORT_EMPTY = 'ASR_EXPORT_EMPTY'
}

export const ErrorCodeMessage: Record<ErrorCode, string> = {
  [ErrorCode.AUTH_FAILED]: '认证失败，请重新登录',
  [ErrorCode.ROOM_NOT_FOUND]: '直播间不存在或已关闭',
  [ErrorCode.MODEL_NOT_AVAILABLE]: '模型不可用，请检查模型状态',
  [ErrorCode.FORMAT_NOT_SUPPORTED]: '文件格式不支持',
  [ErrorCode.QUEUE_OVERFLOW]: '队列已满，请稍后重试',
  [ErrorCode.TIMEOUT]: '操作超时，请重试',
  [ErrorCode.GPU_OOM]: 'GPU 显存不足，请释放资源后重试',
  [ErrorCode.STREAM_FAILED]: '推流失败，请检查网络连接',
  [ErrorCode.REVIEW_TIMEOUT]: '审核超时，内容未能及时发送',
  [ErrorCode.INVALID_TEXT]: '文本内容无效或包含违禁词汇',
  [ErrorCode.DEVICE_OCCUPIED]: '设备正在被其他任务占用',
  [ErrorCode.PORT_OCCUPIED]: '端口已被占用，请更换端口',
  [ErrorCode.VERSION_CONFLICT]: '版本冲突，请刷新后重试',
  [ErrorCode.NO_ACTIVE_TASK]: '当前没有进行中的任务',
  [ErrorCode.STOP_FAILED]: '停止操作失败，请手动处理',
  // M3
  [ErrorCode.SCRIPT_TITLE_INVALID]: '话术标题无效（1-60字）',
  [ErrorCode.SCRIPT_CONTENT_INVALID]: '话术内容无效（1-120字）',
  [ErrorCode.SCRIPT_STATUS_INVALID]: '话术状态变更非法',
  [ErrorCode.POLICY_NAME_INVALID]: '策略名称无效（1-40字且唯一）',
  [ErrorCode.POLICY_VERSION_CONFLICT]: '策略版本冲突，请刷新后重试',
  [ErrorCode.POLICY_TEST_FAILED]: '策略测试失败，请检查样本文本',
  [ErrorCode.WRITER_INPUT_INVALID]: '输入文本无效（1-500字）',
  [ErrorCode.WRITER_OUTPUT_INVALID]: '输出文本无效，发布时需1-120字',
  [ErrorCode.MODEL_FILE_INVALID]: '模型文件格式不支持（需.pth/.onnx/.engine）',
  [ErrorCode.MODEL_ENGINE_MISMATCH]: '模型与引擎不匹配',
  [ErrorCode.MODEL_VERIFY_FAILED]: '模型校验失败，请查看报告',
  [ErrorCode.MODEL_IN_USE]: '模型正在使用中，无法删除',
  [ErrorCode.ACCOUNT_NAME_INVALID]: '账号名称无效（1-30字且唯一）',
  [ErrorCode.ACCOUNT_AUTH_TIMEOUT]: '账号授权超时，请重试',
  [ErrorCode.ACCOUNT_STATUS_INVALID]: '账号状态变更非法',
  [ErrorCode.ACCOUNT_IN_USE]: '账号正在使用中，无法删除',
  [ErrorCode.ASR_DEVICE_BUSY]: '音频设备被占用，请切换设备',
  [ErrorCode.ASR_NOT_RUNNING]: '识别服务未运行',
  [ErrorCode.ASR_EXPORT_EMPTY]: '暂无可导出的文本记录'
}

// ---------------------------------------------------------------------------
// Generic Response Wrapper
// ---------------------------------------------------------------------------

export type ApiResponse<T> = {
  ok: boolean
  data: T | null
  errorCode?: ErrorCode
  message?: string
}

// ---------------------------------------------------------------------------
// Shared Domain Types
// ---------------------------------------------------------------------------

export type SessionState = 'idle' | 'running' | 'paused' | 'stopped' | 'degraded' | 'error'

export type RiskLevel = 'safe' | 'low' | 'medium' | 'high'

// ---------------------------------------------------------------------------
// Session API  (POST /api/v1/session/start | stop, GET /api/v1/session/status)
// ---------------------------------------------------------------------------

export type SessionStartRequest = {
  room_id: string
  account_id: string
  config?: Record<string, unknown>
}

export type SessionStartResponse = {
  session_id: string
  state: SessionState
  started_at: number
}

export type SessionStopRequest = {
  session_id: string
}

export type SessionStopResponse = {
  session_id: string
  state: SessionState
  stopped_at: number
}

export type SessionStatusResponse = {
  session_id: string
  state: SessionState
  uptime_ms: number
}

// ---------------------------------------------------------------------------
// Live API  (POST /api/v1/live/connect | disconnect)
// ---------------------------------------------------------------------------

export type LiveConnectRequest = {
  room_id: string
  platform: string
  account_id: string
}

export type LiveConnectResponse = {
  connection_id: string
  room_id: string
  connected_at: number
}

export type LiveDisconnectRequest = {
  connection_id: string
}

export type LiveDisconnectResponse = {
  connection_id: string
  disconnected_at: number
}

// ---------------------------------------------------------------------------
// Queue API  (POST /api/v1/queue/enqueue | insert)
// ---------------------------------------------------------------------------

export type QueueItem = {
  text: string
  priority?: number
  source?: string
}

export type QueueEnqueueRequest = {
  session_id: string
  item: QueueItem
}

export type QueueEnqueueResponse = {
  queue_id: string
  position: number
  estimated_wait_ms: number
}

export type QueueInsertRequest = {
  session_id: string
  item: QueueItem
  position: number
}

export type QueueInsertResponse = {
  queue_id: string
  position: number
}

// ---------------------------------------------------------------------------
// Script API  (POST /api/v1/script/rewrite)
// ---------------------------------------------------------------------------

export type ScriptRewriteRequest = {
  original_text: string
  style?: string
  max_length?: number
}

export type ScriptRewriteResponse = {
  rewritten_text: string
  tokens_used: number
}

// ---------------------------------------------------------------------------
// Moderation API  (POST /api/v1/moderation/check)
// ---------------------------------------------------------------------------

export type ModerationCheckRequest = {
  text: string
  context?: string
}

export type ModerationCheckResponse = {
  risk_level: RiskLevel
  flagged_terms: string[]
  suggestion?: string
}

// ---------------------------------------------------------------------------
// Review API  (POST /api/v1/review/decision)
// ---------------------------------------------------------------------------

export type ReviewDecision = 'approve' | 'reject' | 'revise'

export type ReviewDecisionRequest = {
  review_id: string
  decision: ReviewDecision
  revised_text?: string
  reason?: string
}

export type ReviewDecisionResponse = {
  review_id: string
  decision: ReviewDecision
  processed_at: number
}

// ---------------------------------------------------------------------------
// TTS API  (POST /api/v1/tts/synthesize)
// ---------------------------------------------------------------------------

export type TtsSynthesizeRequest = {
  text: string
  voice_id?: string
  speed?: number
  pitch?: number
}

export type TtsSynthesizeResponse = {
  audio_url: string
  duration_ms: number
  voice_id: string
}

// ---------------------------------------------------------------------------
// Avatar API  (POST /api/v1/avatar/start)
// ---------------------------------------------------------------------------

export type AvatarStartRequest = {
  model_id: string
  engine: string
  camera_mode?: string
  audio_device?: string
}

export type AvatarStartResponse = {
  avatar_session_id: string
  stream_url: string
  started_at: number
}

// ---------------------------------------------------------------------------
// Stream API  (POST /api/v1/stream/start)
// ---------------------------------------------------------------------------

export type StreamStartRequest = {
  session_id: string
  rtmp_url?: string
  resolution?: string
  bitrate?: number
}

export type StreamStartResponse = {
  stream_id: string
  rtmp_url: string
  started_at: number
}

// ---------------------------------------------------------------------------
// Metrics API  (GET /api/v1/metrics)
// ---------------------------------------------------------------------------

export type MetricsResponse = {
  session_id: string
  messages_processed: number
  tts_requests: number
  queue_depth: number
  uptime_ms: number
  gpu_utilization?: number
  error_count: number
}

// ---------------------------------------------------------------------------
// Script Management API  (CRUD /api/v1/scripts)
// ---------------------------------------------------------------------------

export type ScriptStatus = 'draft' | 'enabled' | 'disabled'

export type ScriptItem = {
  id: string
  title: string
  content: string
  tags: string[]
  status: ScriptStatus
  created_at: number
  updated_at: number
}

export type ScriptListResponse = {
  items: ScriptItem[]
  total: number
}

export type ScriptCreateRequest = {
  title: string
  content: string
  tags?: string[]
}

export type ScriptCreateResponse = ScriptItem

export type ScriptUpdateRequest = {
  id: string
  title?: string
  content?: string
  tags?: string[]
  status?: ScriptStatus
}

export type ScriptUpdateResponse = ScriptItem

export type ScriptDeleteRequest = { id: string }
export type ScriptDeleteResponse = { id: string; deleted_at: number }

export type ScriptStatusRequest = { id: string; status: ScriptStatus }
export type ScriptStatusResponse = ScriptItem

// ---------------------------------------------------------------------------
// Policy (AI回复) API  (/api/v1/policies)
// ---------------------------------------------------------------------------

export type PolicyRiskMode = 'manual' | 'semi' | 'auto'
export type PolicyStatus = 'draft' | 'active' | 'inactive'

export type PolicyItem = {
  id: string
  name: string
  temperature: number
  max_reply_len: number
  risk_mode: PolicyRiskMode
  version: number
  status: PolicyStatus
  created_at: number
  updated_at: number
}

export type PolicyListResponse = { items: PolicyItem[]; total: number }

export type PolicyCreateRequest = { name: string }
export type PolicyCreateResponse = PolicyItem

export type PolicySaveRequest = {
  id: string
  name?: string
  temperature?: number
  max_reply_len?: number
  risk_mode?: PolicyRiskMode
}
export type PolicySaveResponse = PolicyItem

export type PolicyTestRequest = { id: string; sample_text: string }
export type PolicyTestResponse = { reply: string; tokens_used: number }

export type PolicyPublishRequest = { id: string }
export type PolicyPublishResponse = { id: string; version: number; status: PolicyStatus }

export type PolicyRollbackRequest = { id: string; target_version: number }
export type PolicyRollbackResponse = { id: string; version: number }

// ---------------------------------------------------------------------------
// Writer (写话术) API  (/api/v1/writer)
// ---------------------------------------------------------------------------

export type WriterScene = 'product' | 'interaction' | 'notice'
export type WriterStyle = 'friendly' | 'professional' | 'fast'

export type WriterGenerateRequest = {
  scene: WriterScene
  style: WriterStyle
  input_text: string
}
export type WriterGenerateResponse = { candidates: string[] }

export type WriterRewriteRequest = { text: string; constraint?: string }
export type WriterRewriteResponse = { original: string; rewritten: string }

export type WriterSensitiveCheckRequest = { text: string }
export type WriterSensitiveCheckResponse = { hit_words: string[]; safe: boolean }

export type WriterSaveDraftRequest = { text: string; scene: WriterScene; style: WriterStyle }
export type WriterSaveDraftResponse = { draft_id: string; saved_at: number }

export type WriterPublishRequest = { draft_id: string; tags?: string[] }
export type WriterPublishResponse = { script_id: string; published_at: number }

// ---------------------------------------------------------------------------
// Model Management API  (/api/v1/models)
// ---------------------------------------------------------------------------

export type ModelEngineType = 'wav2lip' | 'musetalk'
export type ModelStatus = 'imported' | 'validated' | 'active' | 'deprecated'

export type ModelItem = {
  id: string
  name: string
  engine_type: ModelEngineType
  version: string
  status: ModelStatus
  file_path: string
  created_at: number
}

export type ModelListResponse = { items: ModelItem[]; total: number }

export type ModelImportRequest = {
  name: string
  engine_type: ModelEngineType
  version: string
  file_path: string
}
export type ModelImportResponse = ModelItem

export type ModelVerifyRequest = { id: string }
export type ModelVerifyResponse = { id: string; passed: boolean; report?: string }

export type ModelEnableRequest = { id: string }
export type ModelEnableResponse = { id: string; status: ModelStatus }

export type ModelRollbackRequest = { id: string }
export type ModelRollbackResponse = { id: string; status: ModelStatus }

export type ModelDeleteRequest = { id: string }
export type ModelDeleteResponse = { id: string; deleted_at: number }

// ---------------------------------------------------------------------------
// Account Management API  (/api/v1/accounts)
// ---------------------------------------------------------------------------

export type AccountStatus = 'enabled' | 'disabled' | 'expired'

export type AccountItem = {
  id: string
  name: string
  platform: string
  status: AccountStatus
  auth_token?: string
  created_at: number
}

export type AccountListResponse = { items: AccountItem[]; total: number }

export type AccountCreateRequest = { name: string; platform: string }
export type AccountCreateResponse = AccountItem

export type AccountAuthRequest = { id: string }
export type AccountAuthResponse = { id: string; auth_url: string; expires_at: number }

export type AccountStatusRequest = { id: string; status: AccountStatus }
export type AccountStatusResponse = AccountItem

export type AccountHealthRequest = { id: string }
export type AccountHealthResponse = { id: string; latency_ms: number; ok: boolean }

export type AccountDeleteRequest = { id: string }
export type AccountDeleteResponse = { id: string; deleted_at: number }

// ---------------------------------------------------------------------------
// ASR (音转文字) API  (/api/v1/asr)
// ---------------------------------------------------------------------------

export type AsrState = 'idle' | 'listening' | 'paused' | 'stopped'
export type AsrExportFormat = 'txt' | 'srt'

export type AsrStartRequest = { language?: string; sample_rate?: number }
export type AsrStartResponse = { session_id: string; state: AsrState; started_at: number }

export type AsrPauseRequest = { session_id: string }
export type AsrPauseResponse = { session_id: string; state: AsrState }

export type AsrStopRequest = { session_id: string }
export type AsrStopResponse = { session_id: string; state: AsrState; stopped_at: number }

export type AsrCorrectionRequest = {
  session_id: string
  segment_id: string
  corrected_text: string
}
export type AsrCorrectionResponse = { segment_id: string; updated_at: number }

export type AsrExportRequest = { session_id: string; format: AsrExportFormat }
export type AsrExportResponse = { download_url: string; format: AsrExportFormat }
