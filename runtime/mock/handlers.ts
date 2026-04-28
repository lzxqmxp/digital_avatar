import {
  ApiPaths,
  ErrorCode,
  type ApiResponse,
  type SessionStartRequest,
  type SessionStartResponse,
  type SessionStopRequest,
  type SessionStopResponse,
  type SessionStatusResponse,
  type LiveConnectRequest,
  type LiveConnectResponse,
  type LiveDisconnectRequest,
  type LiveDisconnectResponse,
  type QueueEnqueueRequest,
  type QueueEnqueueResponse,
  type QueueInsertRequest,
  type QueueInsertResponse,
  type ScriptRewriteRequest,
  type ScriptRewriteResponse,
  type ModerationCheckRequest,
  type ModerationCheckResponse,
  type ReviewDecisionRequest,
  type ReviewDecisionResponse,
  type TtsSynthesizeRequest,
  type TtsSynthesizeResponse,
  type AvatarStartResponse,
  type StreamStartRequest,
  type StreamStartResponse,
  type MetricsResponse
} from '@shared/types/api'

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function randomDelay(): Promise<void> {
  return delay(100 + Math.random() * 400)
}

function uuid(): string {
  return Math.random().toString(36).substring(2) + Date.now().toString(36)
}

function ok<T>(data: T): ApiResponse<T> {
  return { ok: true, data }
}

function err<T>(errorCode: ErrorCode, message: string): ApiResponse<T> {
  return { ok: false, data: null, errorCode, message }
}

let mockSessionId: string | null = null
let mockSessionState: 'idle' | 'running' | 'paused' | 'stopped' | 'degraded' | 'error' = 'idle'
let mockConnectionId: string | null = null

export async function mockCall<T>(
  path: string,
  _method: string,
  body?: unknown
): Promise<ApiResponse<T>> {
  switch (path) {
    case ApiPaths.SESSION_START: {
      await randomDelay()
      const req = body as SessionStartRequest
      mockSessionId = req?.room_id ? `sess-${req.room_id}-${uuid()}` : uuid()
      mockSessionState = 'running'
      return ok<SessionStartResponse>({
        session_id: mockSessionId,
        state: 'running',
        started_at: Date.now()
      }) as ApiResponse<T>
    }

    case ApiPaths.SESSION_STOP: {
      await randomDelay()
      const req = body as SessionStopRequest
      const id = req?.session_id || mockSessionId || uuid()
      mockSessionState = 'stopped'
      return ok<SessionStopResponse>({
        session_id: id,
        state: 'stopped',
        stopped_at: Date.now()
      }) as ApiResponse<T>
    }

    case ApiPaths.SESSION_STATUS: {
      await randomDelay()
      return ok<SessionStatusResponse>({
        session_id: mockSessionId || 'mock-session',
        state: mockSessionState,
        uptime_ms: Date.now() % 100000
      }) as ApiResponse<T>
    }

    case ApiPaths.LIVE_CONNECT: {
      await randomDelay()
      const req = body as LiveConnectRequest
      if (req?.room_id === 'bad') {
        return err<LiveConnectResponse>(
          ErrorCode.AUTH_FAILED,
          '认证失败，请重新登录'
        ) as ApiResponse<T>
      }
      mockConnectionId = uuid()
      return ok<LiveConnectResponse>({
        connection_id: mockConnectionId,
        room_id: req?.room_id || 'mock-room',
        connected_at: Date.now()
      }) as ApiResponse<T>
    }

    case ApiPaths.LIVE_DISCONNECT: {
      await randomDelay()
      const req = body as LiveDisconnectRequest
      const connId = req?.connection_id || mockConnectionId || uuid()
      mockConnectionId = null
      return ok<LiveDisconnectResponse>({
        connection_id: connId,
        disconnected_at: Date.now()
      }) as ApiResponse<T>
    }

    case ApiPaths.QUEUE_ENQUEUE: {
      await randomDelay()
      const req = body as QueueEnqueueRequest
      if (!req?.item?.text?.trim()) {
        return err<QueueEnqueueResponse>(
          ErrorCode.INVALID_TEXT,
          '文本内容无效或包含违禁词汇'
        ) as ApiResponse<T>
      }
      return ok<QueueEnqueueResponse>({
        queue_id: uuid(),
        position: Math.floor(Math.random() * 5) + 1,
        estimated_wait_ms: 2000
      }) as ApiResponse<T>
    }

    case ApiPaths.QUEUE_INSERT: {
      await randomDelay()
      const req = body as QueueInsertRequest
      if (!req?.item?.text?.trim()) {
        return err<QueueInsertResponse>(
          ErrorCode.INVALID_TEXT,
          '文本内容无效或包含违禁词汇'
        ) as ApiResponse<T>
      }
      return ok<QueueInsertResponse>({
        queue_id: uuid(),
        position: 0
      }) as ApiResponse<T>
    }

    case ApiPaths.SCRIPT_REWRITE: {
      await randomDelay()
      const req = body as ScriptRewriteRequest
      return ok<ScriptRewriteResponse>({
        rewritten_text: `[改写] ${req?.original_text || ''}`,
        tokens_used: 42
      }) as ApiResponse<T>
    }

    case ApiPaths.MODERATION_CHECK: {
      await randomDelay()
      const req = body as ModerationCheckRequest
      const isHigh = req?.text?.includes('违禁') ?? false
      return ok<ModerationCheckResponse>({
        risk_level: isHigh ? 'high' : 'safe',
        flagged_terms: isHigh ? ['违禁'] : [],
        suggestion: isHigh ? '请修改违禁内容后重试' : undefined
      }) as ApiResponse<T>
    }

    case ApiPaths.REVIEW_DECISION: {
      await randomDelay()
      const req = body as ReviewDecisionRequest
      return ok<ReviewDecisionResponse>({
        review_id: req?.review_id || uuid(),
        decision: req?.decision || 'approve',
        processed_at: Date.now()
      }) as ApiResponse<T>
    }

    case ApiPaths.TTS_SYNTHESIZE: {
      await randomDelay()
      const req = body as TtsSynthesizeRequest
      return ok<TtsSynthesizeResponse>({
        audio_url: `mock://audio/${uuid()}.wav`,
        duration_ms: 1200,
        voice_id: req?.voice_id || 'default'
      }) as ApiResponse<T>
    }

    case ApiPaths.AVATAR_START: {
      await randomDelay()
      return ok<AvatarStartResponse>({
        avatar_session_id: uuid(),
        stream_url: 'rtmp://localhost/mock',
        started_at: Date.now()
      }) as ApiResponse<T>
    }

    case ApiPaths.STREAM_START: {
      await randomDelay()
      const req = body as StreamStartRequest
      return ok<StreamStartResponse>({
        stream_id: uuid(),
        rtmp_url: req?.rtmp_url || 'rtmp://localhost/live',
        started_at: Date.now()
      }) as ApiResponse<T>
    }

    case ApiPaths.METRICS: {
      await randomDelay()
      return ok<MetricsResponse>({
        session_id: mockSessionId || 'mock-session',
        messages_processed: Math.floor(Math.random() * 100),
        tts_requests: Math.floor(Math.random() * 50),
        queue_depth: Math.floor(Math.random() * 10),
        uptime_ms: Date.now() % 100000,
        gpu_utilization: 0.3 + Math.random() * 0.4,
        error_count: 0
      }) as ApiResponse<T>
    }

    default:
      return { ok: false, data: null, message: `Unknown mock path: ${path}` }
  }
}
