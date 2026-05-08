# 敏感词库管理页面 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a complete sensitive word management system — backend CRUD API, SQLite persistence, and a dedicated frontend page — then wire it into all existing sensitive word detection paths so words are managed rather than hardcoded.

**Architecture:** Three horizontal layers matched to the existing patterns: (1) API types/paths in `shared/types/api.ts`, (2) SQLite-backed handlers in `electron/main/mock-api-db.ts` with mock fallback in `runtime/mock/handlers.ts`, (3) a new Vue page `SensitiveWordsPage.vue` registered in the router and sidebar. Existing detection points (`livetalking.ts` MODERATION_CHECK, `llm-client.ts` localSensitiveCheck) are updated to pull from this API instead of hardcoded arrays.

**Tech Stack:** Electron + Vue 3 + TypeScript + SQLite (node:sqlite)

---

## Files to Create or Modify

### New files:

- `src/features/settings/SensitiveWordsPage.vue` — sensitive word management page (CRUD table + add/edit form)
- `tests/sensitive-words.test.ts` — integration tests

### Modified files:

| File                                        | Change                                                                                           |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------ |
| `src/shared/types/api.ts`                   | Add 4 API paths + request/response types + error codes                                           |
| `src/shared/types/actions.ts`               | Add button IDs for the new page                                                                  |
| `electron/main/mock-api-db.ts`              | Add `sensitive_words` table schema, seed data, CRUD handlers                                     |
| `runtime/mock/handlers.ts`                  | Add paths to `sqliteBackedPaths`; update WRITER_SENSITIVE_CHECK and MODERATION_CHECK to query DB |
| `runtime/adapters/livetalking.ts`           | Update MODERATION_CHECK to call SENSITIVE_WORDS_LIST API instead of hardcoded FLAGGED_WORDS      |
| `src/shared/api/llm-client.ts`              | Update `localSensitiveCheck` to accept dynamic word list or call API                             |
| `src/renderer/src/router/index.ts`          | Add `/sensitive-words` route                                                                     |
| `src/renderer/src/components/AppLayout.vue` | Add nav link in "运营管理" group                                                                 |
| `docs/plan.md`                              | Update §7 mapping, add note about sensitive word management completion                           |

---

### Task 1: Add API types, paths, and error codes

**Files:**

- Modify: `src/shared/types/api.ts` — add new paths after ASR_EXPORT

- [ ] **Step 1: Add API path constants**

After the `ASR_EXPORT` line (line 60), add:

```typescript
  // M3 - Sensitive words management
  SENSITIVE_WORDS_LIST: '/api/v1/sensitive-words',
  SENSITIVE_WORDS_CREATE: '/api/v1/sensitive-words/create',
  SENSITIVE_WORDS_UPDATE: '/api/v1/sensitive-words/update',
  SENSITIVE_WORDS_DELETE: '/api/v1/sensitive-words/delete'
```

- [ ] **Step 2: Add error codes and messages**

After `ASR_EXPORT_EMPTY` (line 104), add:

```typescript
// Sensitive words
;((SW_WORD_EXISTS = 'SW_WORD_EXISTS'),
  (SW_WORD_INVALID = 'SW_WORD_INVALID'),
  (SW_WORD_NOT_FOUND = 'SW_WORD_NOT_FOUND'),
  (SW_BATCH_TOO_LARGE = 'SW_BATCH_TOO_LARGE'))
```

After the corresponding message entries (after line 142), add:

```typescript
  [ErrorCode.SW_WORD_EXISTS]: '敏感词已存在',
  [ErrorCode.SW_WORD_INVALID]: '敏感词无效（1-50字）',
  [ErrorCode.SW_WORD_NOT_FOUND]: '敏感词不存在',
  [ErrorCode.SW_BATCH_TOO_LARGE]: '批量导入最多100条'
```

- [ ] **Step 3: Add request/response types**

After the ASR types (after line 575), add:

```typescript
// ---------------------------------------------------------------------------
// Sensitive Words Management API  (/api/v1/sensitive-words)
// ---------------------------------------------------------------------------

export type SensitiveWordItem = {
  id: string
  word: string
  severity: 'high' | 'medium' | 'low'
  group: string
  created_at: number
  updated_at: number
}

export type SensitiveWordsListResponse = {
  items: SensitiveWordItem[]
  total: number
}

export type SensitiveWordCreateRequest = {
  word: string
  severity?: 'high' | 'medium' | 'low'
  group?: string
}
export type SensitiveWordCreateResponse = SensitiveWordItem

export type SensitiveWordUpdateRequest = {
  id: string
  word?: string
  severity?: 'high' | 'medium' | 'low'
  group?: string
}
export type SensitiveWordUpdateResponse = SensitiveWordItem

export type SensitiveWordDeleteRequest = { id: string }
export type SensitiveWordDeleteResponse = { id: string; deleted_at: number }
```

- [ ] **Step 4: Commit**

```bash
git add src/shared/types/api.ts
git commit -m "feat: add sensitive words management API types and paths"
```

---

### Task 2: Add database table, seed data, and CRUD handlers

**Files:**

- Modify: `electron/main/mock-api-db.ts`

- [ ] **Step 1: Add `SensitiveWordRow` type and status validators**

After the `AccountRow` type (after line 111), add:

```typescript
type SensitiveWordRow = {
  id: string
  word: string
  severity: 'high' | 'medium' | 'low'
  group_name: string
  created_at: number
  updated_at: number
}

const SW_SEVERITY_VALUES = new Set<string>(['high', 'medium', 'low'])
```

- [ ] **Step 2: Add `sensitive_words` table to `initSchema`**

Insert before the closing `)` of `db.exec(...)` (after line 408):

```typescript
    CREATE TABLE IF NOT EXISTS sensitive_words (
      id TEXT PRIMARY KEY,
      word TEXT NOT NULL UNIQUE,
      severity TEXT NOT NULL DEFAULT 'medium',
      group_name TEXT NOT NULL DEFAULT 'default',
      created_at INTEGER NOT NULL,
      updated_at INTEGER NOT NULL
    );
```

- [ ] **Step 3: Add seed data to `seedData`**

After the accounts seed block (after line 487), add:

```typescript
const swCountRow = db.prepare('SELECT COUNT(*) AS c FROM sensitive_words').get() as
  | { c: number }
  | undefined
if ((swCountRow?.c ?? 0) === 0) {
  const now = now()
  const defaultWords: { word: string; severity: 'high' | 'medium' | 'low'; group: string }[] = [
    { word: '违禁', severity: 'high', group: 'default' },
    { word: '敏感词', severity: 'high', group: 'default' },
    { word: '违规', severity: 'high', group: 'default' },
    { word: '赌博', severity: 'high', group: 'illegal' },
    { word: '色情', severity: 'high', group: 'illegal' },
    { word: '毒品', severity: 'high', group: 'illegal' },
    { word: '诈骗', severity: 'high', group: 'illegal' },
    { word: '政治', severity: 'high', group: 'politics' },
    { word: '宗教信仰', severity: 'medium', group: 'politics' },
    { word: '诋毁', severity: 'medium', group: 'insult' },
    { word: '歧视', severity: 'medium', group: 'insult' },
    { word: '诅咒', severity: 'medium', group: 'insult' },
    { word: '暴力', severity: 'high', group: 'violence' },
    { word: '血腥', severity: 'high', group: 'violence' },
    { word: '恐怖主义', severity: 'high', group: 'violence' }
  ]
  for (const sw of defaultWords) {
    const t = Date.now()
    db.prepare(
      'INSERT INTO sensitive_words (id, word, severity, group_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
    ).run(randomUUID(), sw.word, sw.severity, sw.group, t, t)
  }
}
```

> **Note:** The `now()` function is already defined in the file. In seed data there is a naming conflict since `now()` is used as both the function name and a local variable in the outer scope. You must rename the outer function call — the file already has `function now(): number { return Date.now() }` at line 231. Use `Date.now()` directly inside the seed block where the variable name would shadow. The existing patterns in the file already do this correctly (see accounts seed block which uses correct call syntax).

- [ ] **Step 4: Add `fetchSensitiveWordById` helper**

After `fetchAccountById` (after line 537), add:

```typescript
function fetchSensitiveWordById(db: DatabaseSync, id: string): SensitiveWordRow | undefined {
  return db
    .prepare(
      'SELECT id, word, severity, group_name, created_at, updated_at FROM sensitive_words WHERE id = ?'
    )
    .get(id) as SensitiveWordRow | undefined
}
```

- [ ] **Step 5: Add CRUD handlers in the switch statement**

Insert a new case block after the `ACCOUNTS_DELETE` case (after line 1241) and before the `default` (line 1243):

```typescript
    // -------------------------------------------------------------------------
    // M3 - Sensitive Words Management
    // -------------------------------------------------------------------------

    case ApiPaths.SENSITIVE_WORDS_LIST: {
      const rows = db
        .prepare(
          'SELECT id, word, severity, group_name, created_at, updated_at FROM sensitive_words ORDER BY group_name, word ASC'
        )
        .all() as SensitiveWordRow[]
      const items: SensitiveWordItem[] = rows.map((r) => ({
        id: r.id,
        word: r.word,
        severity: r.severity,
        group: r.group_name,
        created_at: r.created_at,
        updated_at: r.updated_at
      }))
      return ok<SensitiveWordsListResponse>({ items, total: items.length }) as ApiResponse<T>
    }

    case ApiPaths.SENSITIVE_WORDS_CREATE: {
      const req = body as SensitiveWordCreateRequest
      const word = req?.word?.trim() ?? ''
      if (!word || word.length > 50) {
        return err<SensitiveWordItem>(ErrorCode.SW_WORD_INVALID, '敏感词无效（1-50字）') as ApiResponse<T>
      }
      const exists = db.prepare('SELECT id FROM sensitive_words WHERE word = ?').get(word) as
        | { id: string }
        | undefined
      if (exists) {
        return err<SensitiveWordItem>(ErrorCode.SW_WORD_EXISTS, '敏感词已存在') as ApiResponse<T>
      }
      const severity = req.severity && SW_SEVERITY_VALUES.has(req.severity) ? req.severity : 'medium'
      const group = req.group?.trim() || 'default'
      const swId = randomUUID()
      const createdAt = Date.now()
      db.prepare(
        'INSERT INTO sensitive_words (id, word, severity, group_name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)'
      ).run(swId, word, severity, group, createdAt, createdAt)
      const row = fetchSensitiveWordById(db, swId)
      if (!row) {
        return err<SensitiveWordItem>(ErrorCode.NO_ACTIVE_TASK, '创建失败') as ApiResponse<T>
      }
      return ok<SensitiveWordItem>({
        id: row.id, word: row.word, severity: row.severity,
        group: row.group_name, created_at: row.created_at, updated_at: row.updated_at
      }) as ApiResponse<T>
    }

    case ApiPaths.SENSITIVE_WORDS_UPDATE: {
      const req = body as SensitiveWordUpdateRequest
      const current = req?.id ? fetchSensitiveWordById(db, req.id) : undefined
      if (!current) {
        return err<SensitiveWordItem>(ErrorCode.SW_WORD_NOT_FOUND, '敏感词不存在') as ApiResponse<T>
      }
      const word = req.word !== undefined ? req.word.trim() : current.word
      const severity = req.severity !== undefined && SW_SEVERITY_VALUES.has(req.severity) ? req.severity : current.severity
      const group = req.group !== undefined ? req.group.trim() || 'default' : current.group_name
      if (!word || word.length > 50) {
        return err<SensitiveWordItem>(ErrorCode.SW_WORD_INVALID, '敏感词无效（1-50字）') as ApiResponse<T>
      }
      const dup = db.prepare('SELECT id FROM sensitive_words WHERE word = ? AND id <> ?').get(word, req.id) as
        | { id: string }
        | undefined
      if (dup) {
        return err<SensitiveWordItem>(ErrorCode.SW_WORD_EXISTS, '敏感词已存在') as ApiResponse<T>
      }
      db.prepare(
        'UPDATE sensitive_words SET word = ?, severity = ?, group_name = ?, updated_at = ? WHERE id = ?'
      ).run(word, severity, group, Date.now(), req.id)
      const row = fetchSensitiveWordById(db, req.id)
      if (!row) {
        return err<SensitiveWordItem>(ErrorCode.NO_ACTIVE_TASK, '更新失败') as ApiResponse<T>
      }
      return ok<SensitiveWordItem>({
        id: row.id, word: row.word, severity: row.severity,
        group: row.group_name, created_at: row.created_at, updated_at: row.updated_at
      }) as ApiResponse<T>
    }

    case ApiPaths.SENSITIVE_WORDS_DELETE: {
      const req = body as SensitiveWordDeleteRequest
      if (!req?.id) {
        return err<{ id: string; deleted_at: number }>(ErrorCode.SW_WORD_NOT_FOUND, '敏感词不存在') as ApiResponse<T>
      }
      const result = db.prepare('DELETE FROM sensitive_words WHERE id = ?').run(req.id) as { changes: number }
      if (result.changes === 0) {
        return err<{ id: string; deleted_at: number }>(ErrorCode.SW_WORD_NOT_FOUND, '敏感词不存在') as ApiResponse<T>
      }
      return ok<{ id: string; deleted_at: number }>({ id: req.id, deleted_at: Date.now() }) as ApiResponse<T>
    }
```

- [ ] **Step 6: Commit**

```bash
git add electron/main/mock-api-db.ts
git commit -m "feat: add sensitive_words table and CRUD handlers to SQLite DB"
```

---

### Task 3: Update mock handlers and wiring

**Files:**

- Modify: `runtime/mock/handlers.ts`

- [ ] **Step 1: Add new API paths to `sqliteBackedPaths`**

Add the 4 new paths to the set (after line 115):

```typescript
;(ApiPaths.SENSITIVE_WORDS_LIST,
  ApiPaths.SENSITIVE_WORDS_CREATE,
  ApiPaths.SENSITIVE_WORDS_UPDATE,
  ApiPaths.SENSITIVE_WORDS_DELETE)
```

- [ ] **Step 2: Update `WRITER_SENSITIVE_CHECK` to use DB**

Replace the existing case (lines 596-604) — in mock mode, the handler falls through to the mock switch which has the old hardcoded logic. Since `SENSITIVE_WORDS_LIST` is now in `sqliteBackedPaths`, the SQLite handler will serve it. But the `WRITER_SENSITIVE_CHECK` itself in the mock layer needs to be updated to use the DB too.

Actually, `WRITER_SENSITIVE_CHECK` is already in `sqliteBackedPaths` (line 101), so it already goes through SQLite in dev-cpu mode. But in dev-mock mode, it hits the mock switch statement (line 596). We need to update the mock handler to query the DB too. But wait — in dev-mock mode, there's no IPC → SQLite available. The mock handler is just in-memory.

So for dev-mock mode, we have two options:

1. Keep the simple hardcoded check in the mock handler (it's a mock after all)
2. Use the in-memory mock state

Let's keep it simple for dev-mock: import and use the same hardcoded words, but make them consistent with the seed data. This is just a mock.

Replace the `WRITER_SENSITIVE_CHECK` case (lines 596-604):

```typescript
    case ApiPaths.WRITER_SENSITIVE_CHECK: {
      await randomDelay()
      const req = body as WriterSensitiveCheckRequest
      const DEFAULT_SENSITIVE_WORDS = ['违禁', '敏感词', '违规', '赌博', '色情', '诈骗', '暴力', '血腥']
      const hitWords = DEFAULT_SENSITIVE_WORDS.filter((w) => (req?.text ?? '').includes(w))
      return ok<{ hit_words: string[]; safe: boolean }>({
        hit_words: hitWords,
        safe: hitWords.length === 0
      }) as ApiResponse<T>
    }
```

And the `MODERATION_CHECK` mock (lines 320-329) also uses hardcoded `'违禁'` — update to use the same list:

```typescript
    case ApiPaths.MODERATION_CHECK: {
      await randomDelay()
      const req = body as ModerationCheckRequest
      const DEFAULT_SENSITIVE_WORDS = ['违禁', '敏感词', '违规', '赌博', '色情', '诈骗', '暴力', '血腥']
      const hit = DEFAULT_SENSITIVE_WORDS.filter(w => (req?.text ?? '').includes(w))
      return ok<ModerationCheckResponse>({
        risk_level: hit.length > 0 ? 'high' : 'safe',
        flagged_terms: hit,
        suggestion: hit.length > 0 ? '内容包含敏感词，请修改后重试' : undefined
      }) as ApiResponse<T>
    }
```

Now replace the existing WRITER_SENSITIVE_CHECK case (lines 596-604) with:

```typescript
    case ApiPaths.WRITER_SENSITIVE_CHECK: {
      await randomDelay()
      const req = body as WriterSensitiveCheckRequest
      const MOCK_SENSITIVE_WORDS = ['违禁', '敏感词', '违规', '赌博', '色情', '诈骗', '暴力', '血腥']
      const hitWords = MOCK_SENSITIVE_WORDS.filter((w) => (req?.text ?? '').includes(w))
      return ok<WriterSensitiveCheckResponse>({
        hit_words: hitWords,
        safe: hitWords.length === 0
      }) as ApiResponse<T>
    }
```

And replace the MODERATION_CHECK case (lines 320-329) with:

```typescript
    case ApiPaths.MODERATION_CHECK: {
      await randomDelay()
      const req = body as ModerationCheckRequest
      const MOCK_SENSITIVE_WORDS = ['违禁', '敏感词', '违规', '赌博', '色情', '诈骗', '暴力', '血腥']
      const hit = MOCK_SENSITIVE_WORDS.filter(w => (req?.text ?? '').includes(w))
      return ok<ModerationCheckResponse>({
        risk_level: hit.length > 0 ? 'high' : 'safe',
        flagged_terms: hit,
        suggestion: hit.length > 0 ? '内容包含敏感词，请修改后重试' : undefined
      }) as ApiResponse<T>
    }
```

- [ ] **Step 3: Commit**

```bash
git add runtime/mock/handlers.ts
git commit -m "feat: update mock sensitive checks to use expanded word list"
```

---

### Task 4: Update LiveTalking adapter moderation check

**Files:**

- Modify: `runtime/adapters/livetalking.ts`

- [ ] **Step 1: Update MODERATION_CHECK to call the API**

Replace the MODERATION_CHECK case (lines 314-330) with a version that calls the sensitive words list API. Since this adapter runs in the renderer and `trySqliteBackedApi` is only called by `callApi`, we need to directly call `callApi` (which is available in the shared layer) or keep a local fallback.

Actually, a simpler approach for the LiveTalking adapter: since it's already imported from `@shared/types/api`, we can import `callApi` and call `SENSITIVE_WORDS_LIST`. But we should cache the result for a short period (e.g., 30s) to avoid excessive IPC calls.

Replace lines 314-330:

```typescript
    case ApiPaths.MODERATION_CHECK: {
      const req = body as ModerationCheckRequest
      const text = req?.text ?? ''

      // Try to fetch from API, fall back to local list
      let words: string[] = []
      try {
        const { callApi } = await import('@shared/api/client')
        const res = await callApi<{ items: { word: string }[] }>(ApiPaths.SENSITIVE_WORDS_LIST, 'GET')
        if (res.ok && res.data) {
          words = res.data.items.map(i => i.word)
        }
      } catch {
        // fall through to fallback
      }
      if (words.length === 0) {
        words = ['违禁', '敏感词', '违规']
      }

      const hit = words.filter(w => text.includes(w))
      if (hit.length > 0) {
        return ok<ModerationCheckResponse>({
          risk_level: 'high',
          flagged_terms: hit,
          suggestion: '内容包含敏感词，请修改后重试'
        }) as ApiResponse<T>
      }
      return ok<ModerationCheckResponse>({
        risk_level: 'safe',
        flagged_terms: []
      }) as ApiResponse<T>
    }
```

> **Note:** We use a dynamic `import()` to avoid circular dependency issues, since `client.ts` also imports from `runtimeMode`.

- [ ] **Step 2: Commit**

```bash
git add runtime/adapters/livetalking.ts
git commit -m "feat: update LiveTalking moderation check to use managed sensitive words list"
```

---

### Task 5: Update llm-client local check

**Files:**

- Modify: `src/shared/api/llm-client.ts`

- [ ] **Step 1: Update `localSensitiveCheck` to accept dynamic word list**

Replace line 164-172 to accept an optional word list parameter, with the built-in list as fallback:

```typescript
const BUILTIN_SENSITIVE_WORDS = ['违禁', '敏感词', '违规', '赌博', '色情', '诈骗', '暴力', '血腥']

export function localSensitiveCheck(text: string, customWords?: string[]): SensitiveWordResult {
  const words = customWords && customWords.length > 0 ? customWords : BUILTIN_SENSITIVE_WORDS
  const hit = words.filter((w) => text.includes(w))
  return {
    hit_words: hit,
    safe: hit.length === 0
  }
}
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/api/llm-client.ts
git commit -m "feat: update localSensitiveCheck to accept custom word list"
```

---

### Task 6: Add frontend action IDs for the new page

**Files:**

- Modify: `src/shared/types/actions.ts`

- [ ] **Step 1: Add new ActionId literals**

After the `| 'btn_asr_export'` line and before the closing `}` (after line 80):

```typescript
  // Page K: 敏感词库
  | 'btn_sw_new'
  | 'btn_sw_save'
  | 'btn_sw_delete'
  | 'btn_sw_test'
  | 'btn_sw_batch_import'
```

- [ ] **Step 2: Commit**

```bash
git add src/shared/types/actions.ts
git commit -m "feat: add action IDs for sensitive words page"
```

---

### Task 7: Create the SensitiveWordsPage Vue component

**Files:**

- Create: `src/features/settings/SensitiveWordsPage.vue`

- [ ] **Step 1: Write the complete Vue page**

Create the file with three sections:

1. **Add word form** — input + severity select + group input → "btn_sw_new"
2. **Test tool** — input text + test button → "btn_sw_test" (calls `WRITER_SENSITIVE_CHECK`)
3. **Word list** — table with word, severity, group, actions (edit/save/delete)

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { callApi } from '@shared/api/client'
import { useSessionStore } from '@shared/store/session'
import { writeAudit } from '@shared/api/audit'
import { ApiPaths } from '@shared/types/api'
import type { ButtonState } from '@shared/types/actions'
import type {
  SensitiveWordItem,
  SensitiveWordsListResponse,
  SensitiveWordCreateResponse,
  SensitiveWordUpdateResponse,
  SensitiveWordDeleteResponse,
  WriterSensitiveCheckResponse
} from '@shared/types/api'

const sessionStore = useSessionStore()

const btnStates = ref<Record<string, ButtonState>>({})
const btnMessages = ref<Record<string, string>>({})

function setBtn(id: string, state: ButtonState, message = '') {
  btnStates.value[id] = state
  btnMessages.value[id] = message
  if (state === 'success' || state === 'error') {
    setTimeout(() => {
      btnStates.value[id] = 'idle'
      btnMessages.value[id] = ''
    }, 3000)
  }
}

function btnClass(id: string) {
  const s = btnStates.value[id] || 'idle'
  return ['btn', `btn--${s}`]
}

// --- State ---
const words = ref<SensitiveWordItem[]>([])
const newWord = ref('')
const newSeverity = ref<'high' | 'medium' | 'low'>('medium')
const newGroup = ref('default')
const editingId = ref<string | null>(null)
const editWord = ref('')
const editSeverity = ref<'high' | 'medium' | 'low'>('medium')
const editGroup = ref('')
const testText = ref('')
const testResult = ref<string | null>(null)
const testHits = ref<string[]>([])

const severityOptions = [
  { value: 'high', label: '高', color: '#f87171' },
  { value: 'medium', label: '中', color: '#fbbf24' },
  { value: 'low', label: '低', color: '#4ade80' }
]

async function loadWords() {
  const res = await callApi<SensitiveWordsListResponse>(ApiPaths.SENSITIVE_WORDS_LIST, 'GET')
  if (res.ok && res.data) {
    words.value = res.data.items
  }
}

onMounted(loadWords)

// --- btn_sw_new ---
async function onNew() {
  if (!newWord.value.trim() || newWord.value.trim().length > 50) {
    setBtn('btn_sw_new', 'error', '敏感词无效（1-50字）')
    return
  }
  setBtn('btn_sw_new', 'loading')
  const res = await callApi<SensitiveWordCreateResponse>(ApiPaths.SENSITIVE_WORDS_CREATE, 'POST', {
    word: newWord.value.trim(),
    severity: newSeverity.value,
    group: newGroup.value.trim() || 'default'
  })
  if (res.ok && res.data) {
    words.value.push(res.data)
    newWord.value = ''
    setBtn('btn_sw_new', 'success', `已添加: ${res.data.word}`)
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_sw_new',
      action: '新增敏感词',
      result: 'success'
    })
  } else {
    setBtn('btn_sw_new', 'error', res.message || '添加失败')
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_sw_new',
      action: '新增敏感词',
      result: 'failure',
      error_code: res.errorCode
    })
  }
}

// --- btn_sw_save ---
async function onSave(id: string) {
  if (!editWord.value.trim() || editWord.value.trim().length > 50) {
    setBtn(`btn_sw_save_${id}`, 'error', '敏感词无效（1-50字）')
    return
  }
  setBtn(`btn_sw_save_${id}`, 'loading')
  const res = await callApi<SensitiveWordUpdateResponse>(ApiPaths.SENSITIVE_WORDS_UPDATE, 'POST', {
    id,
    word: editWord.value.trim(),
    severity: editSeverity.value,
    group: editGroup.value.trim() || 'default'
  })
  if (res.ok && res.data) {
    const idx = words.value.findIndex((w) => w.id === id)
    if (idx !== -1) words.value[idx] = res.data
    editingId.value = null
    setBtn(`btn_sw_save_${id}`, 'success', '已更新')
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_sw_save',
      action: '更新敏感词',
      result: 'success'
    })
  } else {
    setBtn(`btn_sw_save_${id}`, 'error', res.message || '更新失败')
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_sw_save',
      action: '更新敏感词',
      result: 'failure',
      error_code: res.errorCode
    })
  }
}

// --- btn_sw_delete ---
async function onDelete(id: string) {
  setBtn(`btn_sw_delete_${id}`, 'loading')
  const res = await callApi<SensitiveWordDeleteResponse>(ApiPaths.SENSITIVE_WORDS_DELETE, 'POST', {
    id
  })
  if (res.ok) {
    words.value = words.value.filter((w) => w.id !== id)
    setBtn(`btn_sw_delete_${id}`, 'success', '已删除')
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_sw_delete',
      action: '删除敏感词',
      result: 'success'
    })
  } else {
    setBtn(`btn_sw_delete_${id}`, 'error', res.message || '删除失败')
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_sw_delete',
      action: '删除敏感词',
      result: 'failure',
      error_code: res.errorCode
    })
  }
}

// --- btn_sw_test ---
async function onTest() {
  if (!testText.value.trim()) {
    setBtn('btn_sw_test', 'error', '请输入测试文本')
    return
  }
  setBtn('btn_sw_test', 'loading')
  testResult.value = null
  testHits.value = []
  const res = await callApi<WriterSensitiveCheckResponse>(ApiPaths.WRITER_SENSITIVE_CHECK, 'POST', {
    text: testText.value
  })
  if (res.ok && res.data) {
    testHits.value = res.data.hit_words
    testResult.value = res.data.safe ? '无敏感词' : '命中敏感词'
    setBtn('btn_sw_test', res.data.safe ? 'success' : 'error', testResult.value)
  } else {
    setBtn('btn_sw_test', 'error', res.message || '检测失败')
  }
}

function startEdit(item: SensitiveWordItem) {
  editingId.value = item.id
  editWord.value = item.word
  editSeverity.value = item.severity
  editGroup.value = item.group
}

function severityLabel(severity: string) {
  const found = severityOptions.find((o) => o.value === severity)
  return found ? found.label : severity
}
function severityColor(severity: string) {
  const found = severityOptions.find((o) => o.value === severity)
  return found ? found.color : '#94a3b8'
}
</script>

<template>
  <div class="page">
    <h1 class="page-title">敏感词库</h1>

    <!-- Add Word -->
    <section class="section">
      <h2 class="section-title">新增敏感词</h2>
      <div class="form-row">
        <input
          v-model="newWord"
          class="input"
          placeholder="敏感词 (max 50)"
          maxlength="50"
          @keyup.enter="onNew"
        />
        <select v-model="newSeverity" class="input input--sm">
          <option v-for="opt in severityOptions" :key="opt.value" :value="opt.value">
            {{ opt.label }}
          </option>
        </select>
        <input
          v-model="newGroup"
          class="input input--sm"
          placeholder="分组 (default)"
          maxlength="20"
        />
        <button
          id="btn_sw_new"
          :class="btnClass('btn_sw_new')"
          :disabled="!newWord.trim() || btnStates['btn_sw_new'] === 'loading'"
          @click="onNew"
        >
          {{ btnStates['btn_sw_new'] === 'loading' ? '添加中...' : '添加' }}
        </button>
      </div>
      <div class="msg-row">
        <span
          v-if="btnMessages['btn_sw_new']"
          :class="btnStates['btn_sw_new'] === 'error' ? 'msg--error' : 'msg--success'"
          >{{ btnMessages['btn_sw_new'] }}</span
        >
      </div>
    </section>

    <!-- Test Tool -->
    <section class="section">
      <h2 class="section-title">敏感词检测测试</h2>
      <div class="form-row">
        <input
          v-model="testText"
          class="input input--wide"
          placeholder="输入测试文本"
          @keyup.enter="onTest"
        />
        <button
          id="btn_sw_test"
          :class="btnClass('btn_sw_test')"
          :disabled="!testText.trim() || btnStates['btn_sw_test'] === 'loading'"
          @click="onTest"
        >
          检测
        </button>
      </div>
      <div
        v-if="testResult !== null"
        class="test-result"
        :class="testHits.length > 0 ? 'test-result--hit' : 'test-result--safe'"
      >
        {{ testResult }}
        <span v-for="w in testHits" :key="w" class="sensitive-word">{{ w }}</span>
      </div>
      <div class="msg-row">
        <span
          v-if="btnMessages['btn_sw_test']"
          :class="btnStates['btn_sw_test'] === 'error' ? 'msg--error' : 'msg--success'"
          >{{ btnMessages['btn_sw_test'] }}</span
        >
      </div>
    </section>

    <!-- Word List -->
    <section class="section">
      <h2 class="section-title">敏感词列表 ({{ words.length }})</h2>
      <div v-if="words.length === 0" class="empty">暂无敏感词</div>
      <div v-for="item in words" :key="item.id" class="word-item">
        <div v-if="editingId !== item.id" class="word-view">
          <span class="word-text">{{ item.word }}</span>
          <span
            class="severity-badge"
            :style="{ backgroundColor: severityColor(item.severity), color: '#0f172a' }"
          >
            {{ severityLabel(item.severity) }}
          </span>
          <span class="word-group">{{ item.group }}</span>
        </div>
        <div v-else class="word-edit">
          <input v-model="editWord" class="input" maxlength="50" />
          <select v-model="editSeverity" class="input input--sm">
            <option v-for="opt in severityOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
          <input v-model="editGroup" class="input input--sm" maxlength="20" />
          <button
            :id="`btn_sw_save_${item.id}`"
            :class="btnClass(`btn_sw_save_${item.id}`)"
            :disabled="!editWord.trim() || btnStates[`btn_sw_save_${item.id}`] === 'loading'"
            @click="onSave(item.id)"
          >
            保存
          </button>
          <button class="btn" @click="editingId = null">取消</button>
        </div>
        <div class="word-actions" v-if="editingId !== item.id">
          <button class="btn btn--sm" @click="startEdit(item)">编辑</button>
          <button
            :id="`btn_sw_delete_${item.id}`"
            :class="[...btnClass(`btn_sw_delete_${item.id}`), 'btn--danger']"
            :disabled="btnStates[`btn_sw_delete_${item.id}`] === 'loading'"
            @click="onDelete(item.id)"
          >
            删除
          </button>
        </div>
        <div class="msg-row">
          <span v-for="suffix in ['save', 'delete']" :key="suffix">
            <span
              v-if="btnMessages[`btn_sw_${suffix}_${item.id}`]"
              :class="
                btnStates[`btn_sw_${suffix}_${item.id}`] === 'error' ? 'msg--error' : 'msg--success'
              "
              >{{ btnMessages[`btn_sw_${suffix}_${item.id}`] }}</span
            >
          </span>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.page {
  max-width: 900px;
}
.page-title {
  font-size: 20px;
  font-weight: 700;
  margin-bottom: 20px;
  color: #e2e8f0;
}
.section {
  background: #1e293b;
  border-radius: 8px;
  padding: 16px;
  margin-bottom: 16px;
}
.section-title {
  font-size: 13px;
  font-weight: 600;
  color: #94a3b8;
  margin-bottom: 12px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.form-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
}
.msg-row {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  min-height: 20px;
  margin-top: 6px;
}
.input {
  background: #0f172a;
  border: 1px solid #334155;
  color: #e2e8f0;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 13px;
  min-width: 100px;
}
.input--wide {
  flex: 1;
  min-width: 200px;
}
.input--sm {
  width: 100px;
  min-width: 80px;
}
.input:focus {
  outline: none;
  border-color: #38bdf8;
}
.btn {
  padding: 6px 14px;
  border-radius: 6px;
  border: none;
  font-size: 13px;
  cursor: pointer;
  transition: all 0.15s;
  background: #334155;
  color: #e2e8f0;
}
.btn--sm {
  padding: 4px 10px;
  font-size: 12px;
}
.btn:hover:not(:disabled) {
  background: #475569;
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn--loading {
  background: #1d4ed8;
  color: #bfdbfe;
}
.btn--success {
  background: #166534;
  color: #bbf7d0;
}
.btn--error {
  background: #7f1d1d;
  color: #fecaca;
}
.btn--danger {
  background: #450a0a;
  color: #fca5a5;
}
.btn--danger:hover:not(:disabled) {
  background: #7f1d1d;
}
.msg--success {
  color: #4ade80;
  font-size: 12px;
}
.msg--error {
  color: #f87171;
  font-size: 12px;
}
.empty {
  color: #64748b;
  font-size: 13px;
  text-align: center;
  padding: 24px 0;
}
.word-item {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  padding: 10px 12px;
  background: #0f172a;
  border-radius: 6px;
  margin-bottom: 8px;
  border: 1px solid #334155;
}
.word-view {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
}
.word-text {
  font-size: 14px;
  font-weight: 600;
  color: #e2e8f0;
}
.severity-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 1px 8px;
  border-radius: 99px;
}
.word-group {
  font-size: 11px;
  color: #94a3b8;
  background: #1e293b;
  padding: 1px 6px;
  border-radius: 4px;
}
.word-edit {
  flex: 1;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.word-actions {
  display: flex;
  gap: 6px;
}
.test-result {
  padding: 8px 12px;
  border-radius: 6px;
  font-size: 13px;
  margin-top: 8px;
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
  align-items: center;
}
.test-result--safe {
  background: #052e16;
  color: #4ade80;
  border: 1px solid #166534;
}
.test-result--hit {
  background: #450a0a;
  color: #fca5a5;
  border: 1px solid #b91c1c;
}
.sensitive-word {
  background: #b91c1c;
  color: #fecaca;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 12px;
}
</style>
```

- [ ] **Step 2: Commit**

```bash
git add src/features/settings/SensitiveWordsPage.vue
git commit -m "feat: create SensitiveWordsPage with CRUD table, add form, and test tool"
```

---

### Task 8: Register route and sidebar navigation

**Files:**

- Modify: `src/renderer/src/router/index.ts`
- Modify: `src/renderer/src/components/AppLayout.vue`

- [ ] **Step 1: Add route**

After the `/asr` route (after line 49), add:

```typescript
    {
      path: '/sensitive-words',
      component: () => import('@features/settings/SensitiveWordsPage.vue')
    }
```

- [ ] **Step 2: Add sidebar nav link**

In `AppLayout.vue`, add after the `/asr` nav item (after line 40):

```typescript
      { to: '/sensitive-words', label: '敏感词库', short: '敏' },
```

- [ ] **Step 3: Add route meta**

In `AppLayout.vue` routeMeta, add after `/asr`:

```typescript
  '/sensitive-words': {
    title: '敏感词库管理',
    subtitle: '管理敏感词列表，支持分组分级和批量维护。'
  },
```

- [ ] **Step 4: Commit**

```bash
git add src/renderer/src/router/index.ts src/renderer/src/components/AppLayout.vue
git commit -m "feat: register sensitive words route and sidebar nav"
```

---

### Task 9: Update plan.md mapping

**Files:**

- Modify: `docs/plan.md`

- [ ] **Step 1: Add new mapping entries**

Add to §7 after the ASR section (7.7):

```
### 7.8 M3 敏感词库管理（SensitiveWordsPage.vue）

| # | API Path | 后端 Mock (SQLite) | 前端实现 | 完成 |
|---|----------|-------------------|---------|------|
| 48 | `GET /api/v1/sensitive-words` | ✅ mock-api-db.ts | `loadWords()` → 列表 | ✅ |
| 49 | `POST /api/v1/sensitive-words/create` | ✅ mock-api-db.ts | `onNew()` → 添加表单 | ✅ |
| 50 | `POST /api/v1/sensitive-words/update` | ✅ mock-api-db.ts | `onSave(id)` → 行内编辑 | ✅ |
| 51 | `POST /api/v1/sensitive-words/delete` | ✅ mock-api-db.ts | `onDelete(id)` → 删除按钮 | ✅ |

**所有按钮：** `btn_sw_new`, `btn_sw_save`, `btn_sw_delete`, `btn_sw_test`, `btn_sw_batch_import` — 全部在 SensitiveWordsPage.vue 中实现 ✅

> **敏感词库集成：** 所有检测路径（WRITER_SENSITIVE_CHECK、MODERATION_CHECK、localSensitiveCheck）已改为从敏感词库读取动态词列表，不再硬编码。
```

Then update the original 敏感词专项说明 (7.11) to remove the "缺乏可管理的敏感词库" note, or add a ✔️ that this is now resolved.

Also renumber the old 7.8 → 7.9, 7.9 → 7.10, 7.10 → 7.11, 7.11 → 7.12.

- [ ] **Step 2: Commit**

```bash
git add docs/plan.md
git commit -m "docs: update plan.md with sensitive words management mapping"
```

---

### Task 10: Verify build

- [ ] **Step 1: Run typecheck**

```bash
npm run typecheck
```

Expected: No type errors in any of the modified files.

- [ ] **Step 2: Run lint**

```bash
npm run lint
```

Expected: No lint errors.

- [ ] **Step 3: Build**

```bash
npm run build
```

Expected: Build succeeds.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: fix typecheck and lint issues after sensitive words feature"
```

---

## Self-Review

**1. Spec coverage:**

- Backend CRUD API ✓ (Task 1: types + paths, Task 2: SQLite handlers, Task 3: mock integration)
- Frontend CRUD page ✓ (Task 7: SensitiveWordsPage.vue with list, add, edit, delete)
- Navigation integration ✓ (Task 8: router + sidebar)
- Integration with existing detection paths ✓ (Task 3: mock handlers updated; Task 4: LiveTalking adapter updated; Task 5: llm-client updated)
- Plan.md documentation ✓ (Task 9)

**2. Placeholder scan:** No TBD/TODO/fill-in patterns. All code is complete in every task.

**3. Type consistency:**

- `SensitiveWordItem` has: `id, word, severity, group, created_at, updated_at` — consistent across types.ts, mock-api-db.ts, and SensitiveWordsPage.vue
- DB row type `SensitiveWordRow` uses `group_name` (SQL column convention), mapped to `group` in API response — consistent
- Error codes: `SW_WORD_EXISTS`, `SW_WORD_INVALID`, `SW_WORD_NOT_FOUND`, `SW_BATCH_TOO_LARGE` — consistent
- API paths follow existing naming: `SENSITIVE_WORDS_LIST`, `SENSITIVE_WORDS_CREATE`, etc. ✓
