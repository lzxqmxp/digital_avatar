/**
 * LiveTalking Adapter
 *
 * Translates the project's internal /api/v1/* API paths to the actual
 * LiveTalking HTTP API running at http://localhost:8010.
 *
 * Mapping overview:
 *  /api/v1/session/start      → local session init (no direct LT endpoint)
 *  /api/v1/session/stop       → close WebRTC PeerConnection + local cleanup
 *  /api/v1/session/status     → POST /is_speaking
 *  /api/v1/live/connect       → local stub (platform adapter owns this)
 *  /api/v1/live/disconnect    → local stub
 *  /api/v1/queue/enqueue      → POST /human  { type: 'echo' }
 *  /api/v1/queue/insert       → POST /human  { type: 'echo', interrupt: true }
 *  /api/v1/script/rewrite     → pass-through stub (LLM not in LT scope)
 *  /api/v1/moderation/check   → pass-through stub (moderation not in LT scope)
 *  /api/v1/review/decision    → pass-through stub
 *  /api/v1/tts/synthesize     → POST /human  { type: 'echo' }  (LT handles TTS internally)
 *  /api/v1/avatar/start       → POST /offer  (WebRTC SDP negotiation)
 *  /api/v1/stream/start       → stub (RTMP transport configured via LT startup args)
 *  /api/v1/metrics            → local session counters
 */

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
  type ModerationCheckResponse,
  type ReviewDecisionRequest,
  type ReviewDecisionResponse,
  type TtsSynthesizeRequest,
  type TtsSynthesizeResponse,
  type AvatarStartRequest,
  type AvatarStartResponse,
  type StreamStartRequest,
  type StreamStartResponse,
  type MetricsResponse
} from '@shared/types/api'

// ---------------------------------------------------------------------------
// Config
// ---------------------------------------------------------------------------

const LIVETALKING_BASE: string =
  (import.meta.env.VITE_LIVETALKING_BASE_URL as string | undefined) ?? 'http://localhost:8010'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function generateId(): string {
  return crypto.randomUUID()
}

function ok<T>(data: T): ApiResponse<T> {
  return { ok: true, data }
}

function err<T>(errorCode: ErrorCode, message: string): ApiResponse<T> {
  return { ok: false, data: null, errorCode, message }
}

interface LtResponse {
  code: number
  msg: string
  data?: unknown
}

async function ltPost(path: string, body: unknown): Promise<LtResponse> {
  const res = await fetch(`${LIVETALKING_BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  })
  return res.json() as Promise<LtResponse>
}

// ---------------------------------------------------------------------------
// In-memory session tracking
// ---------------------------------------------------------------------------

interface LtSession {
  sessionId: string
  startedAt: number
  messageCount: number
  ttsCount: number
  errorCount: number
  peerConnection: RTCPeerConnection | null
}

let activeSession: LtSession | null = null

// ---------------------------------------------------------------------------
// Main dispatch
// ---------------------------------------------------------------------------

export async function liveTalkingCall<T>(
  path: string,
  _method: string,
  body?: unknown
): Promise<ApiResponse<T>> {
  switch (path) {
    // ── Session ────────────────────────────────────────────────────────────

    case ApiPaths.SESSION_START: {
      const req = body as SessionStartRequest
      const sessionId = `lt-${req?.room_id || 'default'}-${generateId()}`
      activeSession = {
        sessionId,
        startedAt: Date.now(),
        messageCount: 0,
        ttsCount: 0,
        errorCount: 0,
        peerConnection: null
      }
      return ok<SessionStartResponse>({
        session_id: sessionId,
        state: 'running',
        started_at: activeSession.startedAt
      }) as ApiResponse<T>
    }

    case ApiPaths.SESSION_STOP: {
      const req = body as SessionStopRequest
      if (activeSession?.peerConnection) {
        activeSession.peerConnection.close()
        activeSession.peerConnection = null
      }
      const stoppedId = activeSession?.sessionId ?? req?.session_id ?? 'unknown'
      activeSession = null
      return ok<SessionStopResponse>({
        session_id: stoppedId,
        state: 'stopped',
        stopped_at: Date.now()
      }) as ApiResponse<T>
    }

    case ApiPaths.SESSION_STATUS: {
      if (!activeSession) {
        return ok<SessionStatusResponse>({
          session_id: 'none',
          state: 'idle',
          uptime_ms: 0
        }) as ApiResponse<T>
      }
      let state: SessionStatusResponse['state'] = 'running'
      try {
        const res = await ltPost('/is_speaking', { sessionid: activeSession.sessionId })
        if (res.code !== 0) state = 'error'
      } catch {
        state = 'error'
        activeSession.errorCount++
      }
      return ok<SessionStatusResponse>({
        session_id: activeSession.sessionId,
        state,
        uptime_ms: Date.now() - activeSession.startedAt
      }) as ApiResponse<T>
    }

    // ── Live connect (platform adapter – not in LiveTalking scope) ─────────

    case ApiPaths.LIVE_CONNECT: {
      const req = body as LiveConnectRequest
      return ok<LiveConnectResponse>({
        connection_id: generateId(),
        room_id: req?.room_id || 'default',
        connected_at: Date.now()
      }) as ApiResponse<T>
    }

    case ApiPaths.LIVE_DISCONNECT: {
      const req = body as LiveDisconnectRequest
      return ok<LiveDisconnectResponse>({
        connection_id: req?.connection_id ?? generateId(),
        disconnected_at: Date.now()
      }) as ApiResponse<T>
    }

    // ── Queue → /human ─────────────────────────────────────────────────────

    case ApiPaths.QUEUE_ENQUEUE: {
      const req = body as QueueEnqueueRequest
      if (!req?.item?.text?.trim()) {
        return err<QueueEnqueueResponse>(ErrorCode.INVALID_TEXT, '文本内容无效') as ApiResponse<T>
      }
      try {
        const res = await ltPost('/human', {
          sessionid: req.session_id || activeSession?.sessionId || '0',
          type: 'echo',
          text: req.item.text
        })
        if (res.code !== 0) {
          return err<QueueEnqueueResponse>(ErrorCode.STREAM_FAILED, res.msg) as ApiResponse<T>
        }
        if (activeSession) activeSession.messageCount++
        return ok<QueueEnqueueResponse>({
          queue_id: generateId(),
          position: 1,
          estimated_wait_ms: 1000
        }) as ApiResponse<T>
      } catch (e) {
        if (activeSession) activeSession.errorCount++
        return err<QueueEnqueueResponse>(ErrorCode.TIMEOUT, String(e)) as ApiResponse<T>
      }
    }

    case ApiPaths.QUEUE_INSERT: {
      const req = body as QueueInsertRequest
      if (!req?.item?.text?.trim()) {
        return err<QueueInsertResponse>(ErrorCode.INVALID_TEXT, '文本内容无效') as ApiResponse<T>
      }
      try {
        const res = await ltPost('/human', {
          sessionid: req.session_id || activeSession?.sessionId || '0',
          type: 'echo',
          text: req.item.text,
          interrupt: true
        })
        if (res.code !== 0) {
          return err<QueueInsertResponse>(ErrorCode.STREAM_FAILED, res.msg) as ApiResponse<T>
        }
        if (activeSession) activeSession.messageCount++
        return ok<QueueInsertResponse>({
          queue_id: generateId(),
          position: 0
        }) as ApiResponse<T>
      } catch (e) {
        if (activeSession) activeSession.errorCount++
        return err<QueueInsertResponse>(ErrorCode.TIMEOUT, String(e)) as ApiResponse<T>
      }
    }

    // ── Script rewrite (LLM – not in LiveTalking scope; pass-through) ──────

    case ApiPaths.SCRIPT_REWRITE: {
      const req = body as ScriptRewriteRequest
      return ok<ScriptRewriteResponse>({
        rewritten_text: req?.original_text ?? '',
        tokens_used: 0
      }) as ApiResponse<T>
    }

    // ── Moderation (not in LiveTalking scope; pass as safe) ─────────────────

    case ApiPaths.MODERATION_CHECK: {
      return ok<ModerationCheckResponse>({
        risk_level: 'safe',
        flagged_terms: []
      }) as ApiResponse<T>
    }

    // ── Review decision (not in LiveTalking scope) ──────────────────────────

    case ApiPaths.REVIEW_DECISION: {
      const req = body as ReviewDecisionRequest
      return ok<ReviewDecisionResponse>({
        review_id: req?.review_id ?? generateId(),
        decision: req?.decision ?? 'approve',
        processed_at: Date.now()
      }) as ApiResponse<T>
    }

    // ── TTS → /human (LiveTalking handles TTS internally) ──────────────────

    case ApiPaths.TTS_SYNTHESIZE: {
      const req = body as TtsSynthesizeRequest
      if (req?.text?.trim()) {
        try {
          await ltPost('/human', {
            sessionid: activeSession?.sessionId || '0',
            type: 'echo',
            text: req.text,
            tts: req.voice_id ? { voice: req.voice_id } : undefined
          })
          if (activeSession) activeSession.ttsCount++
        } catch {
          // best-effort; TTS failure does not propagate as a hard error
        }
      }
      return ok<TtsSynthesizeResponse>({
        audio_url: `livetalking://tts/${generateId()}.wav`,
        duration_ms: 0,
        voice_id: req?.voice_id ?? 'default'
      }) as ApiResponse<T>
    }

    // ── Avatar start → POST /offer (WebRTC SDP) ─────────────────────────────

    case ApiPaths.AVATAR_START: {
      const req = body as AvatarStartRequest
      try {
        const pc = new RTCPeerConnection({
          iceServers: [{ urls: 'stun:stun.l.google.com:19302' }]
        })
        pc.addTransceiver('video', { direction: 'recvonly' })
        pc.addTransceiver('audio', { direction: 'recvonly' })

        const offer = await pc.createOffer()
        await pc.setLocalDescription(offer)

        const res = await fetch(`${LIVETALKING_BASE}/offer`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            sdp: offer.sdp,
            type: offer.type,
            sessionid: activeSession?.sessionId ?? generateId(),
            avatar: req?.model_id || undefined
          })
        })
        const answer = (await res.json()) as RTCSessionDescriptionInit & {
          sessionid?: string
        }

        if (answer.sdp) {
          await pc.setRemoteDescription(new RTCSessionDescription(answer))
        }

        if (activeSession) activeSession.peerConnection = pc

        const avatarSessionId = answer.sessionid ?? activeSession?.sessionId ?? generateId()
        return ok<AvatarStartResponse>({
          avatar_session_id: avatarSessionId,
          stream_url: `webrtc://${new URL(LIVETALKING_BASE).host}/session/${avatarSessionId}`,
          started_at: Date.now()
        }) as ApiResponse<T>
      } catch (e) {
        if (activeSession) activeSession.errorCount++
        return err<AvatarStartResponse>(ErrorCode.STREAM_FAILED, String(e)) as ApiResponse<T>
      }
    }

    // ── Stream start (RTMP transport managed via LT startup args) ───────────

    case ApiPaths.STREAM_START: {
      const req = body as StreamStartRequest
      return ok<StreamStartResponse>({
        stream_id: generateId(),
        rtmp_url: req?.rtmp_url ?? 'rtmp://localhost/live',
        started_at: Date.now()
      }) as ApiResponse<T>
    }

    // ── Metrics (local session counters) ────────────────────────────────────

    case ApiPaths.METRICS: {
      if (!activeSession) {
        return ok<MetricsResponse>({
          session_id: 'none',
          messages_processed: 0,
          tts_requests: 0,
          queue_depth: 0,
          uptime_ms: 0,
          error_count: 0
        }) as ApiResponse<T>
      }
      return ok<MetricsResponse>({
        session_id: activeSession.sessionId,
        messages_processed: activeSession.messageCount,
        tts_requests: activeSession.ttsCount,
        queue_depth: 0,
        uptime_ms: Date.now() - activeSession.startedAt,
        gpu_utilization: undefined,
        error_count: activeSession.errorCount
      }) as ApiResponse<T>
    }

    default:
      return err<T>(ErrorCode.NO_ACTIVE_TASK, `Unknown LiveTalking path: ${path}`)
  }
}
