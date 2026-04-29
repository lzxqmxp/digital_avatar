import { app } from 'electron'
import { randomUUID } from 'node:crypto'
import { mkdirSync } from 'node:fs'
import { join } from 'node:path'
import { DatabaseSync } from 'node:sqlite'
import {
  ApiPaths,
  ErrorCode,
  type AccountCreateRequest,
  type AccountDeleteRequest,
  type AccountHealthRequest,
  type AccountItem,
  type AccountListResponse,
  type AccountStatus,
  type AccountStatusRequest,
  type ApiResponse,
  type ModelDeleteRequest,
  type ModelEngineType,
  type ModelEnableRequest,
  type ModelImportRequest,
  type ModelItem,
  type ModelListResponse,
  type ModelRollbackRequest,
  type ModelStatus,
  type ModelVerifyRequest,
  type PolicyCreateRequest,
  type PolicyItem,
  type PolicyListResponse,
  type PolicyRiskMode,
  type PolicyRollbackRequest,
  type PolicySaveRequest,
  type PolicyStatus,
  type PolicyTestRequest,
  type ScriptCreateRequest,
  type ScriptDeleteRequest,
  type ScriptItem,
  type ScriptListResponse,
  type ScriptStatus,
  type ScriptStatusRequest,
  type ScriptUpdateRequest,
  type WriterGenerateRequest,
  type WriterPublishRequest,
  type WriterRewriteRequest,
  type WriterSaveDraftRequest,
  type WriterScene,
  type WriterSensitiveCheckRequest,
  type WriterStyle,
  type AccountAuthRequest,
  type PolicyPublishRequest
} from '../../src/shared/types/api'

const SCRIPT_STATUS_VALUES = new Set<ScriptStatus>(['draft', 'enabled', 'disabled'])
const POLICY_RISK_MODE_VALUES = new Set<PolicyRiskMode>(['manual', 'semi', 'auto'])
const POLICY_STATUS_VALUES = new Set<PolicyStatus>(['draft', 'active', 'inactive'])
const MODEL_ENGINE_VALUES = new Set<ModelEngineType>(['wav2lip', 'musetalk'])
const MODEL_STATUS_VALUES = new Set<ModelStatus>(['imported', 'validated', 'active', 'deprecated'])
const ACCOUNT_STATUS_VALUES = new Set<AccountStatus>(['enabled', 'disabled', 'expired'])

type ScriptRow = {
  id: string
  title: string
  content: string
  tags_json: string
  status: ScriptStatus
  created_at: number
  updated_at: number
}

type PolicyRow = {
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

type WriterDraftRow = {
  id: string
  text: string
  scene: WriterScene
  style: WriterStyle
  published_script_id: string | null
  created_at: number
  updated_at: number
}

type ModelRow = {
  id: string
  name: string
  engine_type: ModelEngineType
  version: string
  status: ModelStatus
  file_path: string
  verify_report: string | null
  created_at: number
  updated_at: number
}

type AccountRow = {
  id: string
  name: string
  platform: string
  status: AccountStatus
  auth_token: string | null
  created_at: number
  updated_at: number
}

type ScriptSeedItem = {
  title: string
  content: string
  tags: string[]
  status: ScriptStatus
}

const SCRIPT_SEED_ITEMS: ScriptSeedItem[] = [
  {
    title: '欢迎话术',
    content: '欢迎大家来到直播间！喜欢主播记得点个关注。',
    tags: ['欢迎', '开场'],
    status: 'enabled'
  },
  {
    title: '产品介绍',
    content: '今天主推这款爆款单品，材质升级，性价比很高。',
    tags: ['产品', '主推'],
    status: 'draft'
  },
  {
    title: '点赞引导',
    content: '宝子们点点赞冲一冲，点赞破千马上加送福利。',
    tags: ['互动', '点赞'],
    status: 'enabled'
  },
  {
    title: '关注引导',
    content: '新来的朋友先点关注，不迷路，开播第一时间提醒你。',
    tags: ['互动', '关注'],
    status: 'enabled'
  },
  {
    title: '领券提醒',
    content: '下单前先领券更划算，页面左下角就能直接领取。',
    tags: ['优惠', '下单'],
    status: 'enabled'
  },
  {
    title: '限时倒计时',
    content: '限时活动倒计时开始，库存不多，喜欢可以先锁单。',
    tags: ['活动', '促单'],
    status: 'enabled'
  },
  {
    title: '下单催单',
    content: '链接已上车，想要的朋友抓紧拍，付款后优先发货。',
    tags: ['促单'],
    status: 'enabled'
  },
  {
    title: '售后承诺',
    content: '支持7天无理由，质量问题包退换，售后不用担心。',
    tags: ['售后', '保障'],
    status: 'enabled'
  },
  {
    title: '物流说明',
    content: '现货订单48小时内发出，偏远地区时效会略慢一点。',
    tags: ['物流', '说明'],
    status: 'draft'
  },
  {
    title: '尺码建议',
    content: '不确定尺码可参考详情页尺码表，客服也可一对一建议。',
    tags: ['尺码', '答疑'],
    status: 'draft'
  },
  {
    title: '使用场景推荐',
    content: '这款日常通勤和周末出游都能用，搭配起来很省心。',
    tags: ['场景', '推荐'],
    status: 'enabled'
  },
  {
    title: '抽奖预告',
    content: '稍后整点抽奖，先把想要的商品打在公屏，马上安排。',
    tags: ['活动', '抽奖'],
    status: 'draft'
  },
  {
    title: '新品预热',
    content: '今晚有新品首发，想看上新细节的朋友先留在直播间。',
    tags: ['新品', '预热'],
    status: 'draft'
  },
  {
    title: '老粉回馈',
    content: '老粉福利场已结束，后续返场时间请留意开播公告。',
    tags: ['老粉', '福利'],
    status: 'disabled'
  },
  {
    title: '结束收尾',
    content: '今天直播到这里，感谢陪伴，明天同一时间不见不散。',
    tags: ['收尾'],
    status: 'enabled'
  }
]

let database: DatabaseSync | null = null

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function randomDelay(): Promise<void> {
  return delay(80 + Math.random() * 120)
}

function ok<T>(data: T): ApiResponse<T> {
  return { ok: true, data }
}

function err<T>(errorCode: ErrorCode, message: string): ApiResponse<T> {
  return { ok: false, data: null, errorCode, message }
}

function now(): number {
  return Date.now()
}

function isScriptStatus(value: unknown): value is ScriptStatus {
  return typeof value === 'string' && SCRIPT_STATUS_VALUES.has(value as ScriptStatus)
}

function isPolicyRiskMode(value: unknown): value is PolicyRiskMode {
  return typeof value === 'string' && POLICY_RISK_MODE_VALUES.has(value as PolicyRiskMode)
}

function isPolicyStatus(value: unknown): value is PolicyStatus {
  return typeof value === 'string' && POLICY_STATUS_VALUES.has(value as PolicyStatus)
}

function isModelEngineType(value: unknown): value is ModelEngineType {
  return typeof value === 'string' && MODEL_ENGINE_VALUES.has(value as ModelEngineType)
}

function isModelStatus(value: unknown): value is ModelStatus {
  return typeof value === 'string' && MODEL_STATUS_VALUES.has(value as ModelStatus)
}

function isAccountStatus(value: unknown): value is AccountStatus {
  return typeof value === 'string' && ACCOUNT_STATUS_VALUES.has(value as AccountStatus)
}

function parseTags(tagsJson: string): string[] {
  try {
    const parsed = JSON.parse(tagsJson) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed
      .map((item) => (typeof item === 'string' ? item.trim() : ''))
      .filter(Boolean)
      .slice(0, 5)
  } catch {
    return []
  }
}

function sanitizeTags(tags: unknown): string[] {
  if (!Array.isArray(tags)) return []
  const unique = new Set<string>()
  for (const tag of tags) {
    if (typeof tag !== 'string') continue
    const trimmed = tag.trim()
    if (!trimmed) continue
    unique.add(trimmed)
    if (unique.size >= 5) break
  }
  return Array.from(unique)
}

function mapScriptRow(row: ScriptRow): ScriptItem {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    tags: parseTags(row.tags_json),
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

function mapPolicyRow(row: PolicyRow): PolicyItem {
  return {
    id: row.id,
    name: row.name,
    temperature: row.temperature,
    max_reply_len: row.max_reply_len,
    risk_mode: row.risk_mode,
    version: row.version,
    status: row.status,
    created_at: row.created_at,
    updated_at: row.updated_at
  }
}

function mapModelRow(row: ModelRow): ModelItem {
  return {
    id: row.id,
    name: row.name,
    engine_type: row.engine_type,
    version: row.version,
    status: row.status,
    file_path: row.file_path,
    created_at: row.created_at
  }
}

function mapAccountRow(row: AccountRow): AccountItem {
  return {
    id: row.id,
    name: row.name,
    platform: row.platform,
    status: row.status,
    auth_token: row.auth_token ?? undefined,
    created_at: row.created_at
  }
}

function buildWriterScriptTitle(text: string): string {
  const compact = text.replace(/\s+/g, ' ').trim()
  if (!compact) return '写话术发布'
  return compact.length > 20 ? `${compact.slice(0, 20)}...` : compact
}

function initSchema(db: DatabaseSync): void {
  db.exec(`
    CREATE TABLE IF NOT EXISTS scripts (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      tags_json TEXT NOT NULL DEFAULT '[]',
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS policies (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      temperature REAL NOT NULL,
      max_reply_len INTEGER NOT NULL,
      risk_mode TEXT NOT NULL,
      version INTEGER NOT NULL,
      status TEXT NOT NULL,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS ai_replies (
      id TEXT PRIMARY KEY,
      policy_id TEXT NOT NULL,
      sample_text TEXT NOT NULL,
      reply_text TEXT NOT NULL,
      tokens_used INTEGER NOT NULL,
      created_at INTEGER NOT NULL,
      FOREIGN KEY(policy_id) REFERENCES policies(id)
    );

    CREATE INDEX IF NOT EXISTS idx_ai_replies_policy_created
      ON ai_replies(policy_id, created_at DESC);

    CREATE TABLE IF NOT EXISTS writer_drafts (
      id TEXT PRIMARY KEY,
      text TEXT NOT NULL,
      scene TEXT NOT NULL,
      style TEXT NOT NULL,
      published_script_id TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL,
      FOREIGN KEY(published_script_id) REFERENCES scripts(id)
    );

    CREATE TABLE IF NOT EXISTS models (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      engine_type TEXT NOT NULL,
      version TEXT NOT NULL,
      status TEXT NOT NULL,
      file_path TEXT NOT NULL,
      verify_report TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );

    CREATE TABLE IF NOT EXISTS accounts (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL UNIQUE,
      platform TEXT NOT NULL,
      status TEXT NOT NULL,
      auth_token TEXT,
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
  `)
}

function seedScriptData(db: DatabaseSync): void {
  const existingRows = db.prepare('SELECT title FROM scripts').all() as Array<{ title: string }>
  const existingTitles = new Set(existingRows.map((row) => row.title))
  const insertScriptStatement = db.prepare(
    'INSERT INTO scripts (id, title, content, tags_json, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
  )

  let inserted = 0
  for (const item of SCRIPT_SEED_ITEMS) {
    if (existingTitles.has(item.title)) {
      continue
    }
    const createdAt = now() + inserted
    insertScriptStatement.run(
      randomUUID(),
      item.title,
      item.content,
      JSON.stringify(item.tags),
      item.status,
      createdAt,
      createdAt
    )
    inserted += 1
  }
}

function seedData(db: DatabaseSync): void {
  seedScriptData(db)

  const policiesCountRow = db.prepare('SELECT COUNT(*) AS c FROM policies').get() as
    | { c: number }
    | undefined
  if ((policiesCountRow?.c ?? 0) === 0) {
    const createdAt = now()
    db.prepare(
      'INSERT INTO policies (id, name, temperature, max_reply_len, risk_mode, version, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(randomUUID(), '默认策略', 0.8, 80, 'semi', 1, 'active', createdAt, createdAt)
  }

  const modelsCountRow = db.prepare('SELECT COUNT(*) AS c FROM models').get() as
    | { c: number }
    | undefined
  if ((modelsCountRow?.c ?? 0) === 0) {
    const createdAt = now()
    db.prepare(
      'INSERT INTO models (id, name, engine_type, version, status, file_path, verify_report, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
    ).run(
      randomUUID(),
      'Wav2Lip-Default',
      'wav2lip',
      '1.0.0',
      'active',
      '/models/wav2lip.pth',
      '预置模型',
      createdAt,
      createdAt
    )
  }

  const accountsCountRow = db.prepare('SELECT COUNT(*) AS c FROM accounts').get() as
    | { c: number }
    | undefined
  if ((accountsCountRow?.c ?? 0) === 0) {
    const createdAt = now()
    db.prepare(
      'INSERT INTO accounts (id, name, platform, status, auth_token, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    ).run(
      randomUUID(),
      '主播账号A',
      'douyin',
      'enabled',
      `token-${randomUUID()}`,
      createdAt,
      createdAt
    )
  }
}

function getDatabase(): DatabaseSync {
  if (database) return database

  const dataDir = join(app.getPath('userData'), 'data')
  mkdirSync(dataDir, { recursive: true })

  const dbPath = join(dataDir, 'digital-avatar.sqlite')
  const db = new DatabaseSync(dbPath)
  db.exec('PRAGMA journal_mode = WAL;')
  db.exec('PRAGMA foreign_keys = ON;')
  initSchema(db)
  seedData(db)

  database = db
  return db
}

function fetchScriptById(db: DatabaseSync, id: string): ScriptRow | undefined {
  return db
    .prepare(
      'SELECT id, title, content, tags_json, status, created_at, updated_at FROM scripts WHERE id = ?'
    )
    .get(id) as ScriptRow | undefined
}

function fetchPolicyById(db: DatabaseSync, id: string): PolicyRow | undefined {
  return db
    .prepare(
      'SELECT id, name, temperature, max_reply_len, risk_mode, version, status, created_at, updated_at FROM policies WHERE id = ?'
    )
    .get(id) as PolicyRow | undefined
}

function fetchModelById(db: DatabaseSync, id: string): ModelRow | undefined {
  return db
    .prepare(
      'SELECT id, name, engine_type, version, status, file_path, verify_report, created_at, updated_at FROM models WHERE id = ?'
    )
    .get(id) as ModelRow | undefined
}

function fetchAccountById(db: DatabaseSync, id: string): AccountRow | undefined {
  return db
    .prepare(
      'SELECT id, name, platform, status, auth_token, created_at, updated_at FROM accounts WHERE id = ?'
    )
    .get(id) as AccountRow | undefined
}

export async function handleMockApiCall<T>(
  path: string,
  _method: string,
  body?: unknown
): Promise<ApiResponse<T>> {
  await randomDelay()
  const db = getDatabase()

  switch (path) {
    case ApiPaths.SCRIPTS_LIST: {
      const rows = db
        .prepare(
          'SELECT id, title, content, tags_json, status, created_at, updated_at FROM scripts ORDER BY updated_at DESC'
        )
        .all() as ScriptRow[]
      const items = rows.map(mapScriptRow)
      return ok<ScriptListResponse>({ items, total: items.length }) as ApiResponse<T>
    }

    case ApiPaths.SCRIPTS_CREATE: {
      const req = body as ScriptCreateRequest
      const title = req?.title?.trim() ?? ''
      const content = req?.content?.trim() ?? ''
      if (!title || title.length > 60) {
        return err<ScriptItem>(
          ErrorCode.SCRIPT_TITLE_INVALID,
          '标题无效（1-60字）'
        ) as ApiResponse<T>
      }
      if (!content || content.length > 120) {
        return err<ScriptItem>(
          ErrorCode.SCRIPT_CONTENT_INVALID,
          '内容无效（1-120字）'
        ) as ApiResponse<T>
      }
      const itemId = randomUUID()
      const createdAt = now()
      db.prepare(
        'INSERT INTO scripts (id, title, content, tags_json, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(
        itemId,
        title,
        content,
        JSON.stringify(sanitizeTags(req.tags)),
        'draft',
        createdAt,
        createdAt
      )

      const row = fetchScriptById(db, itemId)
      if (!row) {
        return err<ScriptItem>(ErrorCode.NO_ACTIVE_TASK, '创建失败') as ApiResponse<T>
      }
      return ok<ScriptItem>(mapScriptRow(row)) as ApiResponse<T>
    }

    case ApiPaths.SCRIPTS_UPDATE: {
      const req = body as ScriptUpdateRequest
      const current = req?.id ? fetchScriptById(db, req.id) : undefined
      if (!current) {
        return err<ScriptItem>(ErrorCode.NO_ACTIVE_TASK, '话术不存在') as ApiResponse<T>
      }

      const title = req.title !== undefined ? req.title.trim() : current.title
      const content = req.content !== undefined ? req.content.trim() : current.content
      const tags = req.tags !== undefined ? sanitizeTags(req.tags) : parseTags(current.tags_json)
      const status = req.status !== undefined ? req.status : current.status

      if (!title || title.length > 60) {
        return err<ScriptItem>(
          ErrorCode.SCRIPT_TITLE_INVALID,
          '标题无效（1-60字）'
        ) as ApiResponse<T>
      }
      if (!content || content.length > 120) {
        return err<ScriptItem>(
          ErrorCode.SCRIPT_CONTENT_INVALID,
          '内容无效（1-120字）'
        ) as ApiResponse<T>
      }
      if (!isScriptStatus(status)) {
        return err<ScriptItem>(ErrorCode.SCRIPT_STATUS_INVALID, '状态无效') as ApiResponse<T>
      }

      db.prepare(
        'UPDATE scripts SET title = ?, content = ?, tags_json = ?, status = ?, updated_at = ? WHERE id = ?'
      ).run(title, content, JSON.stringify(tags), status, now(), req.id)

      const row = fetchScriptById(db, req.id)
      if (!row) {
        return err<ScriptItem>(ErrorCode.NO_ACTIVE_TASK, '保存失败') as ApiResponse<T>
      }
      return ok<ScriptItem>(mapScriptRow(row)) as ApiResponse<T>
    }

    case ApiPaths.SCRIPTS_DELETE: {
      const req = body as ScriptDeleteRequest
      if (!req?.id) {
        return err<{ id: string; deleted_at: number }>(
          ErrorCode.NO_ACTIVE_TASK,
          '话术不存在'
        ) as ApiResponse<T>
      }
      const result = db.prepare('DELETE FROM scripts WHERE id = ?').run(req.id) as {
        changes: number
      }
      if (result.changes === 0) {
        return err<{ id: string; deleted_at: number }>(
          ErrorCode.NO_ACTIVE_TASK,
          '话术不存在'
        ) as ApiResponse<T>
      }
      return ok<{ id: string; deleted_at: number }>({
        id: req.id,
        deleted_at: now()
      }) as ApiResponse<T>
    }

    case ApiPaths.SCRIPTS_STATUS: {
      const req = body as ScriptStatusRequest
      if (!req?.id || !isScriptStatus(req.status)) {
        return err<ScriptItem>(ErrorCode.SCRIPT_STATUS_INVALID, '状态无效') as ApiResponse<T>
      }
      const result = db
        .prepare('UPDATE scripts SET status = ?, updated_at = ? WHERE id = ?')
        .run(req.status, now(), req.id) as {
        changes: number
      }
      if (result.changes === 0) {
        return err<ScriptItem>(ErrorCode.SCRIPT_STATUS_INVALID, '话术不存在') as ApiResponse<T>
      }
      const row = fetchScriptById(db, req.id)
      if (!row) {
        return err<ScriptItem>(ErrorCode.NO_ACTIVE_TASK, '状态更新失败') as ApiResponse<T>
      }
      return ok<ScriptItem>(mapScriptRow(row)) as ApiResponse<T>
    }

    case ApiPaths.POLICIES_LIST: {
      const rows = db
        .prepare(
          'SELECT id, name, temperature, max_reply_len, risk_mode, version, status, created_at, updated_at FROM policies ORDER BY updated_at DESC'
        )
        .all() as PolicyRow[]
      const items = rows
        .filter((row) => isPolicyRiskMode(row.risk_mode) && isPolicyStatus(row.status))
        .map(mapPolicyRow)
      return ok<PolicyListResponse>({ items, total: items.length }) as ApiResponse<T>
    }

    case ApiPaths.POLICIES_CREATE: {
      const req = body as PolicyCreateRequest
      const name = req?.name?.trim() ?? ''
      if (!name || name.length > 40) {
        return err<PolicyItem>(
          ErrorCode.POLICY_NAME_INVALID,
          '策略名称无效（1-40字）'
        ) as ApiResponse<T>
      }

      const exists = db.prepare('SELECT id FROM policies WHERE name = ?').get(name) as
        | { id: string }
        | undefined
      if (exists) {
        return err<PolicyItem>(ErrorCode.POLICY_NAME_INVALID, '策略名称已存在') as ApiResponse<T>
      }

      const policyId = randomUUID()
      const createdAt = now()
      db.prepare(
        'INSERT INTO policies (id, name, temperature, max_reply_len, risk_mode, version, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(policyId, name, 0.8, 80, 'semi', 1, 'draft', createdAt, createdAt)

      const row = fetchPolicyById(db, policyId)
      if (!row) {
        return err<PolicyItem>(ErrorCode.NO_ACTIVE_TASK, '创建失败') as ApiResponse<T>
      }
      return ok<PolicyItem>(mapPolicyRow(row)) as ApiResponse<T>
    }

    case ApiPaths.POLICIES_SAVE: {
      const req = body as PolicySaveRequest
      const current = req?.id ? fetchPolicyById(db, req.id) : undefined
      if (!current) {
        return err<PolicyItem>(ErrorCode.NO_ACTIVE_TASK, '策略不存在') as ApiResponse<T>
      }

      const name = req.name !== undefined ? req.name.trim() : current.name
      const temperature = req.temperature ?? current.temperature
      const maxReplyLen = req.max_reply_len ?? current.max_reply_len
      const riskMode = req.risk_mode ?? current.risk_mode

      if (!name || name.length > 40) {
        return err<PolicyItem>(
          ErrorCode.POLICY_NAME_INVALID,
          '策略名称无效（1-40字）'
        ) as ApiResponse<T>
      }
      if (!isPolicyRiskMode(riskMode)) {
        return err<PolicyItem>(ErrorCode.POLICY_NAME_INVALID, '风控模式无效') as ApiResponse<T>
      }

      const duplicated = db
        .prepare('SELECT id FROM policies WHERE name = ? AND id <> ?')
        .get(name, req.id) as { id: string } | undefined
      if (duplicated) {
        return err<PolicyItem>(ErrorCode.POLICY_NAME_INVALID, '策略名称已存在') as ApiResponse<T>
      }

      db.prepare(
        'UPDATE policies SET name = ?, temperature = ?, max_reply_len = ?, risk_mode = ?, version = ?, updated_at = ? WHERE id = ?'
      ).run(name, temperature, maxReplyLen, riskMode, current.version + 1, now(), req.id)

      const row = fetchPolicyById(db, req.id)
      if (!row) {
        return err<PolicyItem>(ErrorCode.NO_ACTIVE_TASK, '保存失败') as ApiResponse<T>
      }
      return ok<PolicyItem>(mapPolicyRow(row)) as ApiResponse<T>
    }

    case ApiPaths.POLICIES_TEST: {
      const req = body as PolicyTestRequest
      const sampleText = req?.sample_text?.trim() ?? ''
      if (!req?.id || !sampleText) {
        return err<{ reply: string; tokens_used: number }>(
          ErrorCode.POLICY_TEST_FAILED,
          '样本文本不能为空'
        ) as ApiResponse<T>
      }

      const policy = fetchPolicyById(db, req.id)
      if (!policy) {
        return err<{ reply: string; tokens_used: number }>(
          ErrorCode.NO_ACTIVE_TASK,
          '策略不存在'
        ) as ApiResponse<T>
      }

      const replyText = `【${policy.name}】${sampleText.slice(0, Math.max(20, policy.max_reply_len))}`
      const tokensUsed = Math.max(12, Math.ceil(replyText.length / 2))
      db.prepare(
        'INSERT INTO ai_replies (id, policy_id, sample_text, reply_text, tokens_used, created_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(randomUUID(), policy.id, sampleText, replyText, tokensUsed, now())

      return ok<{ reply: string; tokens_used: number }>({
        reply: replyText,
        tokens_used: tokensUsed
      }) as ApiResponse<T>
    }

    case ApiPaths.POLICIES_PUBLISH: {
      const req = body as PolicyPublishRequest
      const target = req?.id ? fetchPolicyById(db, req.id) : undefined
      if (!target) {
        return err<{ id: string; version: number; status: PolicyStatus }>(
          ErrorCode.NO_ACTIVE_TASK,
          '策略不存在'
        ) as ApiResponse<T>
      }

      const updatedAt = now()
      db.prepare('UPDATE policies SET status = ?, updated_at = ? WHERE status = ?').run(
        'inactive',
        updatedAt,
        'active'
      )
      db.prepare('UPDATE policies SET status = ?, updated_at = ? WHERE id = ?').run(
        'active',
        updatedAt,
        req.id
      )

      const row = fetchPolicyById(db, req.id)
      if (!row) {
        return err<{ id: string; version: number; status: PolicyStatus }>(
          ErrorCode.NO_ACTIVE_TASK,
          '发布失败'
        ) as ApiResponse<T>
      }

      return ok<{ id: string; version: number; status: PolicyStatus }>({
        id: row.id,
        version: row.version,
        status: row.status
      }) as ApiResponse<T>
    }

    case ApiPaths.POLICIES_ROLLBACK: {
      const req = body as PolicyRollbackRequest
      if (!req?.id || typeof req.target_version !== 'number' || req.target_version < 1) {
        return err<{ id: string; version: number }>(
          ErrorCode.POLICY_VERSION_CONFLICT,
          '目标版本无效'
        ) as ApiResponse<T>
      }

      const current = fetchPolicyById(db, req.id)
      if (!current) {
        return err<{ id: string; version: number }>(
          ErrorCode.NO_ACTIVE_TASK,
          '策略不存在'
        ) as ApiResponse<T>
      }

      db.prepare('UPDATE policies SET version = ?, updated_at = ? WHERE id = ?').run(
        req.target_version,
        now(),
        req.id
      )
      return ok<{ id: string; version: number }>({
        id: req.id,
        version: req.target_version
      }) as ApiResponse<T>
    }

    case ApiPaths.WRITER_GENERATE: {
      const req = body as WriterGenerateRequest
      const inputText = req?.input_text?.trim() ?? ''
      if (!inputText || inputText.length > 500) {
        return err<{ candidates: string[] }>(
          ErrorCode.WRITER_INPUT_INVALID,
          '输入文本无效（1-500字）'
        ) as ApiResponse<T>
      }
      return ok<{ candidates: string[] }>({
        candidates: [
          `[${req.scene}/${req.style}] ${inputText} - 版本A`,
          `[${req.scene}/${req.style}] ${inputText} - 版本B`,
          `[${req.scene}/${req.style}] ${inputText} - 版本C`
        ]
      }) as ApiResponse<T>
    }

    case ApiPaths.WRITER_REWRITE: {
      const req = body as WriterRewriteRequest
      return ok<{ original: string; rewritten: string }>({
        original: req?.text ?? '',
        rewritten: `[改写后] ${req?.text ?? ''}`
      }) as ApiResponse<T>
    }

    case ApiPaths.WRITER_SENSITIVE_CHECK: {
      const req = body as WriterSensitiveCheckRequest
      const hitWords = (req?.text ?? '').includes('违禁') ? ['违禁'] : []
      return ok<{ hit_words: string[]; safe: boolean }>({
        hit_words: hitWords,
        safe: hitWords.length === 0
      }) as ApiResponse<T>
    }

    case ApiPaths.WRITER_SAVE_DRAFT: {
      const req = body as WriterSaveDraftRequest
      const text = req?.text?.trim() ?? ''
      if (!text || text.length > 500) {
        return err<{ draft_id: string; saved_at: number }>(
          ErrorCode.WRITER_INPUT_INVALID,
          '草稿内容无效（1-500字）'
        ) as ApiResponse<T>
      }

      const draftId = randomUUID()
      const createdAt = now()
      db.prepare(
        'INSERT INTO writer_drafts (id, text, scene, style, published_script_id, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(draftId, text, req.scene, req.style, null, createdAt, createdAt)

      return ok<{ draft_id: string; saved_at: number }>({
        draft_id: draftId,
        saved_at: createdAt
      }) as ApiResponse<T>
    }

    case ApiPaths.WRITER_PUBLISH: {
      const req = body as WriterPublishRequest
      if (!req?.draft_id) {
        return err<{ script_id: string; published_at: number }>(
          ErrorCode.WRITER_OUTPUT_INVALID,
          '草稿ID无效'
        ) as ApiResponse<T>
      }

      const draft = db
        .prepare(
          'SELECT id, text, scene, style, published_script_id, created_at, updated_at FROM writer_drafts WHERE id = ?'
        )
        .get(req.draft_id) as WriterDraftRow | undefined
      if (!draft) {
        return err<{ script_id: string; published_at: number }>(
          ErrorCode.WRITER_OUTPUT_INVALID,
          '草稿不存在'
        ) as ApiResponse<T>
      }

      if (draft.published_script_id) {
        return ok<{ script_id: string; published_at: number }>({
          script_id: draft.published_script_id,
          published_at: now()
        }) as ApiResponse<T>
      }

      const content = draft.text.trim()
      if (!content || content.length > 120) {
        return err<{ script_id: string; published_at: number }>(
          ErrorCode.WRITER_OUTPUT_INVALID,
          '发布失败：内容需在1-120字之间'
        ) as ApiResponse<T>
      }

      const scriptId = randomUUID()
      const publishedAt = now()
      const tags = sanitizeTags(req.tags)
      if (!tags.includes('写话术')) tags.unshift('写话术')
      if (tags.length > 5) tags.splice(5)

      db.prepare(
        'INSERT INTO scripts (id, title, content, tags_json, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(
        scriptId,
        buildWriterScriptTitle(content),
        content,
        JSON.stringify(tags),
        'draft',
        publishedAt,
        publishedAt
      )

      db.prepare(
        'UPDATE writer_drafts SET published_script_id = ?, updated_at = ? WHERE id = ?'
      ).run(scriptId, publishedAt, req.draft_id)

      return ok<{ script_id: string; published_at: number }>({
        script_id: scriptId,
        published_at: publishedAt
      }) as ApiResponse<T>
    }

    case ApiPaths.MODELS_LIST: {
      const rows = db
        .prepare(
          'SELECT id, name, engine_type, version, status, file_path, verify_report, created_at, updated_at FROM models ORDER BY created_at DESC'
        )
        .all() as ModelRow[]
      const items = rows
        .filter((row) => isModelEngineType(row.engine_type) && isModelStatus(row.status))
        .map(mapModelRow)
      return ok<ModelListResponse>({ items, total: items.length }) as ApiResponse<T>
    }

    case ApiPaths.MODELS_IMPORT: {
      const req = body as ModelImportRequest
      const name = req?.name?.trim() ?? ''
      if (!name || name.length > 40) {
        return err<ModelItem>(ErrorCode.MODEL_FILE_INVALID, '模型名称无效') as ApiResponse<T>
      }
      if (!isModelEngineType(req?.engine_type)) {
        return err<ModelItem>(ErrorCode.MODEL_ENGINE_MISMATCH, '模型引擎类型无效') as ApiResponse<T>
      }
      const validExts = ['.pth', '.onnx', '.engine']
      if (!req.file_path || !validExts.some((ext) => req.file_path.endsWith(ext))) {
        return err<ModelItem>(ErrorCode.MODEL_FILE_INVALID, '文件格式不支持') as ApiResponse<T>
      }

      const modelId = randomUUID()
      const createdAt = now()
      db.prepare(
        'INSERT INTO models (id, name, engine_type, version, status, file_path, verify_report, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)'
      ).run(
        modelId,
        name,
        req.engine_type,
        req.version || '1.0.0',
        'imported',
        req.file_path,
        null,
        createdAt,
        createdAt
      )

      const row = fetchModelById(db, modelId)
      if (!row) {
        return err<ModelItem>(ErrorCode.NO_ACTIVE_TASK, '导入失败') as ApiResponse<T>
      }
      return ok<ModelItem>(mapModelRow(row)) as ApiResponse<T>
    }

    case ApiPaths.MODELS_VERIFY: {
      const req = body as ModelVerifyRequest
      const model = req?.id ? fetchModelById(db, req.id) : undefined
      if (!model) {
        return err<{ id: string; passed: boolean; report?: string }>(
          ErrorCode.MODEL_NOT_AVAILABLE,
          '模型不存在'
        ) as ApiResponse<T>
      }

      const report = '权重与依赖校验通过'
      const nextStatus: ModelStatus = model.status === 'active' ? 'active' : 'validated'
      db.prepare(
        'UPDATE models SET status = ?, verify_report = ?, updated_at = ? WHERE id = ?'
      ).run(nextStatus, report, now(), req.id)

      return ok<{ id: string; passed: boolean; report?: string }>({
        id: req.id,
        passed: true,
        report
      }) as ApiResponse<T>
    }

    case ApiPaths.MODELS_ENABLE: {
      const req = body as ModelEnableRequest
      const model = req?.id ? fetchModelById(db, req.id) : undefined
      if (!model) {
        return err<{ id: string; status: ModelStatus }>(
          ErrorCode.MODEL_NOT_AVAILABLE,
          '模型不存在'
        ) as ApiResponse<T>
      }
      if (model.status !== 'validated' && model.status !== 'active') {
        return err<{ id: string; status: ModelStatus }>(
          ErrorCode.MODEL_VERIFY_FAILED,
          '需先完成校验'
        ) as ApiResponse<T>
      }

      db.prepare('UPDATE models SET status = ?, updated_at = ? WHERE status = ?').run(
        'validated',
        now(),
        'active'
      )
      db.prepare('UPDATE models SET status = ?, updated_at = ? WHERE id = ?').run(
        'active',
        now(),
        req.id
      )
      return ok<{ id: string; status: ModelStatus }>({
        id: req.id,
        status: 'active'
      }) as ApiResponse<T>
    }

    case ApiPaths.MODELS_ROLLBACK: {
      const req = body as ModelRollbackRequest
      const model = req?.id ? fetchModelById(db, req.id) : undefined
      if (!model) {
        return err<{ id: string; status: ModelStatus }>(
          ErrorCode.MODEL_NOT_AVAILABLE,
          '模型不存在'
        ) as ApiResponse<T>
      }
      db.prepare('UPDATE models SET status = ?, updated_at = ? WHERE id = ?').run(
        'validated',
        now(),
        req.id
      )
      return ok<{ id: string; status: ModelStatus }>({
        id: req.id,
        status: 'validated'
      }) as ApiResponse<T>
    }

    case ApiPaths.MODELS_DELETE: {
      const req = body as ModelDeleteRequest
      const model = req?.id ? fetchModelById(db, req.id) : undefined
      if (!model) {
        return err<{ id: string; deleted_at: number }>(
          ErrorCode.MODEL_NOT_AVAILABLE,
          '模型不存在'
        ) as ApiResponse<T>
      }
      if (model.status === 'active') {
        return err<{ id: string; deleted_at: number }>(
          ErrorCode.MODEL_IN_USE,
          '正在使用的模型不可删除'
        ) as ApiResponse<T>
      }
      db.prepare('DELETE FROM models WHERE id = ?').run(req.id)
      return ok<{ id: string; deleted_at: number }>({
        id: req.id,
        deleted_at: now()
      }) as ApiResponse<T>
    }

    case ApiPaths.ACCOUNTS_LIST: {
      const rows = db
        .prepare(
          'SELECT id, name, platform, status, auth_token, created_at, updated_at FROM accounts ORDER BY created_at DESC'
        )
        .all() as AccountRow[]
      const items = rows.filter((row) => isAccountStatus(row.status)).map(mapAccountRow)
      return ok<AccountListResponse>({ items, total: items.length }) as ApiResponse<T>
    }

    case ApiPaths.ACCOUNTS_CREATE: {
      const req = body as AccountCreateRequest
      const name = req?.name?.trim() ?? ''
      if (!name || name.length > 30) {
        return err<AccountItem>(
          ErrorCode.ACCOUNT_NAME_INVALID,
          '账号名称无效（1-30字）'
        ) as ApiResponse<T>
      }

      const duplicated = db.prepare('SELECT id FROM accounts WHERE name = ?').get(name) as
        | { id: string }
        | undefined
      if (duplicated) {
        return err<AccountItem>(ErrorCode.ACCOUNT_NAME_INVALID, '账号名称已存在') as ApiResponse<T>
      }

      const accountId = randomUUID()
      const createdAt = now()
      db.prepare(
        'INSERT INTO accounts (id, name, platform, status, auth_token, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
      ).run(accountId, name, req.platform || 'douyin', 'disabled', null, createdAt, createdAt)

      const row = fetchAccountById(db, accountId)
      if (!row) {
        return err<AccountItem>(ErrorCode.NO_ACTIVE_TASK, '创建失败') as ApiResponse<T>
      }
      return ok<AccountItem>(mapAccountRow(row)) as ApiResponse<T>
    }

    case ApiPaths.ACCOUNTS_AUTH: {
      const req = body as AccountAuthRequest
      const account = req?.id ? fetchAccountById(db, req.id) : undefined
      if (!account) {
        return err<{ id: string; auth_url: string; expires_at: number }>(
          ErrorCode.AUTH_FAILED,
          '账号不存在'
        ) as ApiResponse<T>
      }

      db.prepare('UPDATE accounts SET auth_token = ?, status = ?, updated_at = ? WHERE id = ?').run(
        `token-${randomUUID()}`,
        'enabled',
        now(),
        req.id
      )
      return ok<{ id: string; auth_url: string; expires_at: number }>({
        id: req.id,
        auth_url: 'https://open.douyin.com/mock/oauth',
        expires_at: now() + 60000
      }) as ApiResponse<T>
    }

    case ApiPaths.ACCOUNTS_STATUS: {
      const req = body as AccountStatusRequest
      if (!req?.id || !isAccountStatus(req.status)) {
        return err<AccountItem>(ErrorCode.ACCOUNT_STATUS_INVALID, '账号状态无效') as ApiResponse<T>
      }
      const result = db
        .prepare('UPDATE accounts SET status = ?, updated_at = ? WHERE id = ?')
        .run(req.status, now(), req.id) as {
        changes: number
      }
      if (result.changes === 0) {
        return err<AccountItem>(ErrorCode.ACCOUNT_STATUS_INVALID, '账号不存在') as ApiResponse<T>
      }
      const row = fetchAccountById(db, req.id)
      if (!row) {
        return err<AccountItem>(ErrorCode.NO_ACTIVE_TASK, '状态更新失败') as ApiResponse<T>
      }
      return ok<AccountItem>(mapAccountRow(row)) as ApiResponse<T>
    }

    case ApiPaths.ACCOUNTS_HEALTH: {
      const req = body as AccountHealthRequest
      const account = req?.id ? fetchAccountById(db, req.id) : undefined
      if (!account) {
        return err<{ id: string; latency_ms: number; ok: boolean }>(
          ErrorCode.AUTH_FAILED,
          '账号不存在'
        ) as ApiResponse<T>
      }
      const latency = 80 + Math.floor(Math.random() * 120)
      return ok<{ id: string; latency_ms: number; ok: boolean }>({
        id: req.id,
        latency_ms: latency,
        ok: true
      }) as ApiResponse<T>
    }

    case ApiPaths.ACCOUNTS_DELETE: {
      const req = body as AccountDeleteRequest
      const account = req?.id ? fetchAccountById(db, req.id) : undefined
      if (!account) {
        return err<{ id: string; deleted_at: number }>(
          ErrorCode.AUTH_FAILED,
          '账号不存在'
        ) as ApiResponse<T>
      }
      if (account.status === 'enabled') {
        return err<{ id: string; deleted_at: number }>(
          ErrorCode.ACCOUNT_IN_USE,
          '活跃账号不可删除'
        ) as ApiResponse<T>
      }
      db.prepare('DELETE FROM accounts WHERE id = ?').run(req.id)
      return ok<{ id: string; deleted_at: number }>({
        id: req.id,
        deleted_at: now()
      }) as ApiResponse<T>
    }

    default:
      return err<T>(ErrorCode.NO_ACTIVE_TASK, `Unsupported SQLite path: ${path}`)
  }
}

export function closeMockApiDatabase(): void {
  if (!database) return
  database.close()
  database = null
}
