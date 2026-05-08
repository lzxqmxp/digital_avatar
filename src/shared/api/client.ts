import { isMock, isCpu } from '@shared/config/runtimeMode'
import { ApiPaths, type ApiResponse } from '@shared/types/api'
import type {
  SessionStartRequest,
  SessionStartResponse,
  SessionStopRequest,
  SessionStopResponse,
  SessionStatusResponse,
  LiveConnectRequest,
  LiveConnectResponse,
  LiveDisconnectRequest,
  LiveDisconnectResponse,
  QueueEnqueueRequest,
  QueueEnqueueResponse,
  QueueInsertRequest,
  QueueInsertResponse,
  ScriptRewriteRequest,
  ScriptRewriteResponse,
  ModerationCheckRequest,
  ModerationCheckResponse,
  ReviewDecisionRequest,
  ReviewDecisionResponse,
  TtsSynthesizeRequest,
  TtsSynthesizeResponse,
  AvatarStartRequest,
  AvatarStartResponse,
  StreamStartRequest,
  StreamStartResponse,
  MetricsResponse
} from '@shared/types/api'

const BASE_URL = 'http://localhost:3000'

export async function callApi<T>(
  path: string,
  method: string = 'GET',
  body?: unknown
): Promise<ApiResponse<T>> {
  if (isMock) {
    const { mockCall } = await import('@runtime/mock/handlers')
    return mockCall<T>(path, method, body)
  }

  if (isCpu) {
    // 数据类路径（M3）→ IPC → Main SQLite
    const { trySqliteBackedApi } = await import('@runtime/mock/handlers')
    const sqliteResult = await trySqliteBackedApi<T>(path, method, body)
    if (sqliteResult !== null) {
      return sqliteResult
    }
    // 媒体路径 → LiveTalking
    const { liveTalkingCall } = await import('@runtime/adapters/livetalking')
    return liveTalkingCall<T>(path, method, body)
  }

  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: body !== undefined ? JSON.stringify(body) : undefined
    })
    const json = (await res.json()) as ApiResponse<T>
    return json
  } catch (e) {
    return {
      ok: false,
      data: null,
      message: e instanceof Error ? e.message : 'Network error'
    }
  }
}

export const apiClient = {
  sessionStart: (body: SessionStartRequest) =>
    callApi<SessionStartResponse>(ApiPaths.SESSION_START, 'POST', body),

  sessionStop: (body: SessionStopRequest) =>
    callApi<SessionStopResponse>(ApiPaths.SESSION_STOP, 'POST', body),

  sessionStatus: () => callApi<SessionStatusResponse>(ApiPaths.SESSION_STATUS, 'GET'),

  liveConnect: (body: LiveConnectRequest) =>
    callApi<LiveConnectResponse>(ApiPaths.LIVE_CONNECT, 'POST', body),

  liveDisconnect: (body: LiveDisconnectRequest) =>
    callApi<LiveDisconnectResponse>(ApiPaths.LIVE_DISCONNECT, 'POST', body),

  queueEnqueue: (body: QueueEnqueueRequest) =>
    callApi<QueueEnqueueResponse>(ApiPaths.QUEUE_ENQUEUE, 'POST', body),

  queueInsert: (body: QueueInsertRequest) =>
    callApi<QueueInsertResponse>(ApiPaths.QUEUE_INSERT, 'POST', body),

  scriptRewrite: (body: ScriptRewriteRequest) =>
    callApi<ScriptRewriteResponse>(ApiPaths.SCRIPT_REWRITE, 'POST', body),

  moderationCheck: (body: ModerationCheckRequest) =>
    callApi<ModerationCheckResponse>(ApiPaths.MODERATION_CHECK, 'POST', body),

  reviewDecision: (body: ReviewDecisionRequest) =>
    callApi<ReviewDecisionResponse>(ApiPaths.REVIEW_DECISION, 'POST', body),

  ttsSynthesize: (body: TtsSynthesizeRequest) =>
    callApi<TtsSynthesizeResponse>(ApiPaths.TTS_SYNTHESIZE, 'POST', body),

  avatarStart: (body: AvatarStartRequest) =>
    callApi<AvatarStartResponse>(ApiPaths.AVATAR_START, 'POST', body),

  streamStart: (body: StreamStartRequest) =>
    callApi<StreamStartResponse>(ApiPaths.STREAM_START, 'POST', body),

  metrics: () => callApi<MetricsResponse>(ApiPaths.METRICS, 'GET')
}

/**
 * Retrieve the remote MediaStream from the active WebRTC session.
 * Only meaningful after avatarStart() succeeds; returns null in mock mode.
 */
export async function getAvatarRemoteStream(): Promise<MediaStream | null> {
  if (isCpu) {
    const { getRemoteStreamPromise } = await import('@runtime/adapters/livetalking')
    return getRemoteStreamPromise()
  }
  return null
}
