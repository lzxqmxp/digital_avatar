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
  type MetricsResponse,
  // M3 types
  type ScriptItem,
  type ScriptListResponse,
  type ScriptCreateRequest,
  type ScriptUpdateRequest,
  type ScriptDeleteRequest,
  type ScriptStatusRequest,
  type PolicyItem,
  type PolicyListResponse,
  type PolicyCreateRequest,
  type PolicySaveRequest,
  type PolicyTestRequest,
  type PolicyPublishRequest,
  type PolicyRollbackRequest,
  type WriterGenerateRequest,
  type WriterRewriteRequest,
  type WriterSensitiveCheckRequest,
  type WriterSaveDraftRequest,
  type WriterPublishRequest,
  type ModelItem,
  type ModelListResponse,
  type ModelImportRequest,
  type ModelVerifyRequest,
  type ModelEnableRequest,
  type ModelRollbackRequest,
  type ModelDeleteRequest,
  type AccountItem,
  type AccountListResponse,
  type AccountCreateRequest,
  type AccountAuthRequest,
  type AccountStatusRequest,
  type AccountHealthRequest,
  type AccountDeleteRequest,
  type AsrStartRequest,
  type AsrPauseRequest,
  type AsrStopRequest,
  type AsrCorrectionRequest,
  type AsrExportRequest
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

// M3 mock state
const mockScripts: ScriptItem[] = [
  { id: 'sc-1', title: '欢迎话术', content: '欢迎大家来到直播间！', tags: ['欢迎'], status: 'enabled', created_at: Date.now() - 86400000, updated_at: Date.now() - 3600000 },
  { id: 'sc-2', title: '产品介绍', content: '今天为大家带来最新款商品', tags: ['产品'], status: 'draft', created_at: Date.now() - 43200000, updated_at: Date.now() - 1800000 }
]
const mockPolicies: PolicyItem[] = [
  { id: 'pol-1', name: '默认策略', temperature: 0.8, max_reply_len: 80, risk_mode: 'semi', version: 1, status: 'active', created_at: Date.now() - 86400000, updated_at: Date.now() - 3600000 }
]
const mockModels: ModelItem[] = [
  { id: 'mdl-1', name: 'Wav2Lip-Default', engine_type: 'wav2lip', version: '1.0.0', status: 'active', file_path: '/models/wav2lip.pth', created_at: Date.now() - 86400000 }
]
const mockAccounts: AccountItem[] = [
  { id: 'acc-1', name: '主播账号A', platform: 'douyin', status: 'enabled', created_at: Date.now() - 86400000 }
]
let mockAsrSessionId: string | null = null
let mockAsrState: 'idle' | 'listening' | 'paused' | 'stopped' = 'idle'
const mockAsrSegments: { id: string; text: string; ts: number }[] = []

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

    // -------------------------------------------------------------------------
    // M3 - Script Management
    // -------------------------------------------------------------------------

    case ApiPaths.SCRIPTS_LIST: {
      await randomDelay()
      return ok<ScriptListResponse>({ items: [...mockScripts], total: mockScripts.length }) as ApiResponse<T>
    }

    case ApiPaths.SCRIPTS_CREATE: {
      await randomDelay()
      const req = body as ScriptCreateRequest
      if (!req?.title?.trim() || req.title.length > 60) {
        return err<ScriptItem>(ErrorCode.SCRIPT_TITLE_INVALID, '标题无效（1-60字）') as ApiResponse<T>
      }
      if (!req?.content?.trim() || req.content.length > 120) {
        return err<ScriptItem>(ErrorCode.SCRIPT_CONTENT_INVALID, '内容无效（1-120字）') as ApiResponse<T>
      }
      const item: ScriptItem = { id: uuid(), title: req.title, content: req.content, tags: req.tags || [], status: 'draft', created_at: Date.now(), updated_at: Date.now() }
      mockScripts.push(item)
      return ok<ScriptItem>(item) as ApiResponse<T>
    }

    case ApiPaths.SCRIPTS_UPDATE: {
      await randomDelay()
      const req = body as ScriptUpdateRequest
      const idx = mockScripts.findIndex((s) => s.id === req?.id)
      if (idx === -1) return err<ScriptItem>(ErrorCode.NO_ACTIVE_TASK, '话术不存在') as ApiResponse<T>
      mockScripts[idx] = { ...mockScripts[idx], ...req, updated_at: Date.now() }
      return ok<ScriptItem>(mockScripts[idx]) as ApiResponse<T>
    }

    case ApiPaths.SCRIPTS_DELETE: {
      await randomDelay()
      const req = body as ScriptDeleteRequest
      const idx = mockScripts.findIndex((s) => s.id === req?.id)
      if (idx === -1) return err<{ id: string; deleted_at: number }>(ErrorCode.NO_ACTIVE_TASK, '话术不存在') as ApiResponse<T>
      mockScripts.splice(idx, 1)
      return ok<{ id: string; deleted_at: number }>({ id: req.id, deleted_at: Date.now() }) as ApiResponse<T>
    }

    case ApiPaths.SCRIPTS_STATUS: {
      await randomDelay()
      const req = body as ScriptStatusRequest
      const idx = mockScripts.findIndex((s) => s.id === req?.id)
      if (idx === -1) return err<ScriptItem>(ErrorCode.SCRIPT_STATUS_INVALID, '话术不存在') as ApiResponse<T>
      mockScripts[idx] = { ...mockScripts[idx], status: req.status, updated_at: Date.now() }
      return ok<ScriptItem>(mockScripts[idx]) as ApiResponse<T>
    }

    // -------------------------------------------------------------------------
    // M3 - Policy (AI回复)
    // -------------------------------------------------------------------------

    case ApiPaths.POLICIES_LIST: {
      await randomDelay()
      return ok<PolicyListResponse>({ items: [...mockPolicies], total: mockPolicies.length }) as ApiResponse<T>
    }

    case ApiPaths.POLICIES_CREATE: {
      await randomDelay()
      const req = body as PolicyCreateRequest
      if (!req?.name?.trim() || req.name.length > 40) {
        return err<PolicyItem>(ErrorCode.POLICY_NAME_INVALID, '策略名称无效（1-40字）') as ApiResponse<T>
      }
      const item: PolicyItem = { id: uuid(), name: req.name, temperature: 0.8, max_reply_len: 80, risk_mode: 'semi', version: 1, status: 'draft', created_at: Date.now(), updated_at: Date.now() }
      mockPolicies.push(item)
      return ok<PolicyItem>(item) as ApiResponse<T>
    }

    case ApiPaths.POLICIES_SAVE: {
      await randomDelay()
      const req = body as PolicySaveRequest
      const idx = mockPolicies.findIndex((p) => p.id === req?.id)
      if (idx === -1) return err<PolicyItem>(ErrorCode.NO_ACTIVE_TASK, '策略不存在') as ApiResponse<T>
      mockPolicies[idx] = { ...mockPolicies[idx], ...req, version: mockPolicies[idx].version + 1, updated_at: Date.now() }
      return ok<PolicyItem>(mockPolicies[idx]) as ApiResponse<T>
    }

    case ApiPaths.POLICIES_TEST: {
      await randomDelay()
      const req = body as PolicyTestRequest
      if (!req?.sample_text?.trim()) {
        return err<{ reply: string; tokens_used: number }>(ErrorCode.POLICY_TEST_FAILED, '样本文本不能为空') as ApiResponse<T>
      }
      return ok<{ reply: string; tokens_used: number }>({ reply: `[AI回复] 感谢您的提问，关于"${req.sample_text.slice(0, 20)}"...`, tokens_used: 32 }) as ApiResponse<T>
    }

    case ApiPaths.POLICIES_PUBLISH: {
      await randomDelay()
      const req = body as PolicyPublishRequest
      const idx = mockPolicies.findIndex((p) => p.id === req?.id)
      if (idx === -1) return err<{ id: string; version: number; status: string }>(ErrorCode.NO_ACTIVE_TASK, '策略不存在') as ApiResponse<T>
      mockPolicies.forEach((p, i) => { if (i !== idx) p.status = 'inactive' })
      mockPolicies[idx] = { ...mockPolicies[idx], status: 'active', updated_at: Date.now() }
      return ok<{ id: string; version: number; status: string }>({ id: req.id, version: mockPolicies[idx].version, status: 'active' }) as ApiResponse<T>
    }

    case ApiPaths.POLICIES_ROLLBACK: {
      await randomDelay()
      const req = body as PolicyRollbackRequest
      const idx = mockPolicies.findIndex((p) => p.id === req?.id)
      if (idx === -1) return err<{ id: string; version: number }>(ErrorCode.NO_ACTIVE_TASK, '策略不存在') as ApiResponse<T>
      mockPolicies[idx] = { ...mockPolicies[idx], version: req.target_version, updated_at: Date.now() }
      return ok<{ id: string; version: number }>({ id: req.id, version: req.target_version }) as ApiResponse<T>
    }

    // -------------------------------------------------------------------------
    // M3 - Writer (写话术)
    // -------------------------------------------------------------------------

    case ApiPaths.WRITER_GENERATE: {
      await randomDelay()
      const req = body as WriterGenerateRequest
      if (!req?.input_text?.trim()) {
        return err<{ candidates: string[] }>(ErrorCode.WRITER_INPUT_INVALID, '输入文本不能为空') as ApiResponse<T>
      }
      return ok<{ candidates: string[] }>({ candidates: [`[${req.scene}/${req.style}] ${req.input_text} — 版本A`, `[${req.scene}/${req.style}] ${req.input_text} — 版本B`, `[${req.scene}/${req.style}] ${req.input_text} — 版本C`] }) as ApiResponse<T>
    }

    case ApiPaths.WRITER_REWRITE: {
      await randomDelay()
      const req = body as WriterRewriteRequest
      return ok<{ original: string; rewritten: string }>({ original: req?.text || '', rewritten: `[改写后] ${req?.text || ''}` }) as ApiResponse<T>
    }

    case ApiPaths.WRITER_SENSITIVE_CHECK: {
      await randomDelay()
      const req = body as WriterSensitiveCheckRequest
      const hitWords = (req?.text || '').includes('违禁') ? ['违禁'] : []
      return ok<{ hit_words: string[]; safe: boolean }>({ hit_words: hitWords, safe: hitWords.length === 0 }) as ApiResponse<T>
    }

    case ApiPaths.WRITER_SAVE_DRAFT: {
      await randomDelay()
      const req = body as WriterSaveDraftRequest
      if (!req?.text?.trim()) {
        return err<{ draft_id: string; saved_at: number }>(ErrorCode.WRITER_INPUT_INVALID, '草稿内容不能为空') as ApiResponse<T>
      }
      return ok<{ draft_id: string; saved_at: number }>({ draft_id: uuid(), saved_at: Date.now() }) as ApiResponse<T>
    }

    case ApiPaths.WRITER_PUBLISH: {
      await randomDelay()
      const req = body as WriterPublishRequest
      if (!req?.draft_id) {
        return err<{ script_id: string; published_at: number }>(ErrorCode.WRITER_OUTPUT_INVALID, '草稿ID无效') as ApiResponse<T>
      }
      return ok<{ script_id: string; published_at: number }>({ script_id: uuid(), published_at: Date.now() }) as ApiResponse<T>
    }

    // -------------------------------------------------------------------------
    // M3 - Model Management
    // -------------------------------------------------------------------------

    case ApiPaths.MODELS_LIST: {
      await randomDelay()
      return ok<ModelListResponse>({ items: [...mockModels], total: mockModels.length }) as ApiResponse<T>
    }

    case ApiPaths.MODELS_IMPORT: {
      await randomDelay()
      const req = body as ModelImportRequest
      if (!req?.name?.trim()) return err<ModelItem>(ErrorCode.MODEL_FILE_INVALID, '模型名称无效') as ApiResponse<T>
      const validExts = ['.pth', '.onnx', '.engine']
      if (req.file_path && !validExts.some((e) => req.file_path.endsWith(e))) {
        return err<ModelItem>(ErrorCode.MODEL_FILE_INVALID, '文件格式不支持') as ApiResponse<T>
      }
      const item: ModelItem = { id: uuid(), name: req.name, engine_type: req.engine_type, version: req.version, status: 'imported', file_path: req.file_path, created_at: Date.now() }
      mockModels.push(item)
      return ok<ModelItem>(item) as ApiResponse<T>
    }

    case ApiPaths.MODELS_VERIFY: {
      await randomDelay()
      const req = body as ModelVerifyRequest
      const model = mockModels.find((m) => m.id === req?.id)
      if (!model) return err<{ id: string; passed: boolean }>(ErrorCode.MODEL_NOT_AVAILABLE, '模型不存在') as ApiResponse<T>
      const idx = mockModels.findIndex((m) => m.id === req.id)
      mockModels[idx] = { ...mockModels[idx], status: 'validated' }
      return ok<{ id: string; passed: boolean; report?: string }>({ id: req.id, passed: true, report: '权重与依赖校验通过' }) as ApiResponse<T>
    }

    case ApiPaths.MODELS_ENABLE: {
      await randomDelay()
      const req = body as ModelEnableRequest
      const idx = mockModels.findIndex((m) => m.id === req?.id)
      if (idx === -1) return err<{ id: string; status: string }>(ErrorCode.MODEL_NOT_AVAILABLE, '模型不存在') as ApiResponse<T>
      if (mockModels[idx].status !== 'validated') {
        return err<{ id: string; status: string }>(ErrorCode.MODEL_VERIFY_FAILED, '需先完成校验') as ApiResponse<T>
      }
      mockModels.forEach((m, i) => { if (i !== idx && m.status === 'active') mockModels[i] = { ...m, status: 'validated' } })
      mockModels[idx] = { ...mockModels[idx], status: 'active' }
      return ok<{ id: string; status: string }>({ id: req.id, status: 'active' }) as ApiResponse<T>
    }

    case ApiPaths.MODELS_ROLLBACK: {
      await randomDelay()
      const req = body as ModelRollbackRequest
      const idx = mockModels.findIndex((m) => m.id === req?.id)
      if (idx === -1) return err<{ id: string; status: string }>(ErrorCode.MODEL_NOT_AVAILABLE, '模型不存在') as ApiResponse<T>
      mockModels[idx] = { ...mockModels[idx], status: 'validated' }
      return ok<{ id: string; status: string }>({ id: req.id, status: 'validated' }) as ApiResponse<T>
    }

    case ApiPaths.MODELS_DELETE: {
      await randomDelay()
      const req = body as ModelDeleteRequest
      const idx = mockModels.findIndex((m) => m.id === req?.id)
      if (idx === -1) return err<{ id: string; deleted_at: number }>(ErrorCode.MODEL_NOT_AVAILABLE, '模型不存在') as ApiResponse<T>
      if (mockModels[idx].status === 'active') {
        return err<{ id: string; deleted_at: number }>(ErrorCode.MODEL_IN_USE, '正在使用的模型不可删除') as ApiResponse<T>
      }
      mockModels.splice(idx, 1)
      return ok<{ id: string; deleted_at: number }>({ id: req.id, deleted_at: Date.now() }) as ApiResponse<T>
    }

    // -------------------------------------------------------------------------
    // M3 - Account Management
    // -------------------------------------------------------------------------

    case ApiPaths.ACCOUNTS_LIST: {
      await randomDelay()
      return ok<AccountListResponse>({ items: [...mockAccounts], total: mockAccounts.length }) as ApiResponse<T>
    }

    case ApiPaths.ACCOUNTS_CREATE: {
      await randomDelay()
      const req = body as AccountCreateRequest
      if (!req?.name?.trim() || req.name.length > 30) {
        return err<AccountItem>(ErrorCode.ACCOUNT_NAME_INVALID, '账号名称无效（1-30字）') as ApiResponse<T>
      }
      const item: AccountItem = { id: uuid(), name: req.name, platform: req.platform || 'douyin', status: 'disabled', created_at: Date.now() }
      mockAccounts.push(item)
      return ok<AccountItem>(item) as ApiResponse<T>
    }

    case ApiPaths.ACCOUNTS_AUTH: {
      await randomDelay()
      const req = body as AccountAuthRequest
      const idx = mockAccounts.findIndex((a) => a.id === req?.id)
      if (idx === -1) return err<{ id: string; auth_url: string; expires_at: number }>(ErrorCode.AUTH_FAILED, '账号不存在') as ApiResponse<T>
      mockAccounts[idx] = { ...mockAccounts[idx], auth_token: `token-${uuid()}`, status: 'enabled' }
      return ok<{ id: string; auth_url: string; expires_at: number }>({ id: req.id, auth_url: 'https://open.douyin.com/mock/oauth', expires_at: Date.now() + 60000 }) as ApiResponse<T>
    }

    case ApiPaths.ACCOUNTS_STATUS: {
      await randomDelay()
      const req = body as AccountStatusRequest
      const idx = mockAccounts.findIndex((a) => a.id === req?.id)
      if (idx === -1) return err<AccountItem>(ErrorCode.ACCOUNT_STATUS_INVALID, '账号不存在') as ApiResponse<T>
      mockAccounts[idx] = { ...mockAccounts[idx], status: req.status }
      return ok<AccountItem>(mockAccounts[idx]) as ApiResponse<T>
    }

    case ApiPaths.ACCOUNTS_HEALTH: {
      await randomDelay()
      const req = body as AccountHealthRequest
      const account = mockAccounts.find((a) => a.id === req?.id)
      if (!account) return err<{ id: string; latency_ms: number; ok: boolean }>(ErrorCode.AUTH_FAILED, '账号不存在') as ApiResponse<T>
      return ok<{ id: string; latency_ms: number; ok: boolean }>({ id: req.id, latency_ms: 80 + Math.floor(Math.random() * 120), ok: true }) as ApiResponse<T>
    }

    case ApiPaths.ACCOUNTS_DELETE: {
      await randomDelay()
      const req = body as AccountDeleteRequest
      const idx = mockAccounts.findIndex((a) => a.id === req?.id)
      if (idx === -1) return err<{ id: string; deleted_at: number }>(ErrorCode.AUTH_FAILED, '账号不存在') as ApiResponse<T>
      if (mockAccounts[idx].status === 'enabled') {
        return err<{ id: string; deleted_at: number }>(ErrorCode.ACCOUNT_IN_USE, '活跃账号不可删除') as ApiResponse<T>
      }
      mockAccounts.splice(idx, 1)
      return ok<{ id: string; deleted_at: number }>({ id: req.id, deleted_at: Date.now() }) as ApiResponse<T>
    }

    // -------------------------------------------------------------------------
    // M3 - ASR (音转文字)
    // -------------------------------------------------------------------------

    case ApiPaths.ASR_START: {
      await randomDelay()
      if (mockAsrState === 'listening') {
        return err<{ session_id: string; state: string; started_at: number }>(ErrorCode.ASR_DEVICE_BUSY, '识别服务已在运行') as ApiResponse<T>
      }
      mockAsrSessionId = uuid()
      mockAsrState = 'listening'
      mockAsrSegments.push({ id: uuid(), text: '（识别启动）', ts: Date.now() })
      return ok<{ session_id: string; state: string; started_at: number }>({ session_id: mockAsrSessionId, state: 'listening', started_at: Date.now() }) as ApiResponse<T>
    }

    case ApiPaths.ASR_PAUSE: {
      await randomDelay()
      if (mockAsrState !== 'listening') {
        return err<{ session_id: string; state: string }>(ErrorCode.ASR_NOT_RUNNING, '识别服务未运行') as ApiResponse<T>
      }
      mockAsrState = 'paused'
      return ok<{ session_id: string; state: string }>({ session_id: mockAsrSessionId || '', state: 'paused' }) as ApiResponse<T>
    }

    case ApiPaths.ASR_STOP: {
      await randomDelay()
      if (mockAsrState === 'idle' || mockAsrState === 'stopped') {
        return err<{ session_id: string; state: string; stopped_at: number }>(ErrorCode.ASR_NOT_RUNNING, '识别服务未运行') as ApiResponse<T>
      }
      mockAsrState = 'stopped'
      return ok<{ session_id: string; state: string; stopped_at: number }>({ session_id: mockAsrSessionId || '', state: 'stopped', stopped_at: Date.now() }) as ApiResponse<T>
    }

    case ApiPaths.ASR_CORRECTION: {
      await randomDelay()
      const req = body as AsrCorrectionRequest
      const idx = mockAsrSegments.findIndex((s) => s.id === req?.segment_id)
      if (idx !== -1) mockAsrSegments[idx] = { ...mockAsrSegments[idx], text: req.corrected_text }
      return ok<{ segment_id: string; updated_at: number }>({ segment_id: req?.segment_id || '', updated_at: Date.now() }) as ApiResponse<T>
    }

    case ApiPaths.ASR_EXPORT: {
      await randomDelay()
      const req = body as AsrExportRequest
      if (mockAsrSegments.length === 0) {
        return err<{ download_url: string; format: string }>(ErrorCode.ASR_EXPORT_EMPTY, '暂无可导出的文本') as ApiResponse<T>
      }
      return ok<{ download_url: string; format: string }>({ download_url: `mock://asr-export/${uuid()}.${req?.format || 'txt'}`, format: req?.format || 'txt' }) as ApiResponse<T>
    }

    default:
      return { ok: false, data: null, message: `Unknown mock path: ${path}` }
  }
}
