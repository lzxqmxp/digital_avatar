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
  METRICS: '/api/v1/metrics'
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
  STOP_FAILED = 'STOP_FAILED'
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
  [ErrorCode.STOP_FAILED]: '停止操作失败，请手动处理'
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
