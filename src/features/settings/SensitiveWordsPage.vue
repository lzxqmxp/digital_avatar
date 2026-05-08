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
  const res = await callApi<SensitiveWordDeleteResponse>(ApiPaths.SENSITIVE_WORDS_DELETE, 'POST', { id })
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
        >{{ btnMessages['btn_sw_new'] }}</span>
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
      <div v-if="testResult !== null" class="test-result" :class="testHits.length > 0 ? 'test-result--hit' : 'test-result--safe'">
        {{ testResult }}
        <span v-for="w in testHits" :key="w" class="sensitive-word">{{ w }}</span>
      </div>
      <div class="msg-row">
        <span
          v-if="btnMessages['btn_sw_test']"
          :class="btnStates['btn_sw_test'] === 'error' ? 'msg--error' : 'msg--success'"
        >{{ btnMessages['btn_sw_test'] }}</span>
      </div>
    </section>

    <!-- Word List -->
    <section class="section">
      <h2 class="section-title">敏感词列表 ({{ words.length }})</h2>
      <div v-if="words.length === 0" class="empty">暂无敏感词</div>
      <div v-for="item in words" :key="item.id" class="word-item">
        <div v-if="editingId !== item.id" class="word-view">
          <span class="word-text">{{ item.word }}</span>
          <span class="severity-badge" :style="{ backgroundColor: severityColor(item.severity), color: '#0f172a' }">
            {{ severityLabel(item.severity) }}
          </span>
          <span class="word-group">{{ item.group }}</span>
        </div>
        <div v-else class="word-edit">
          <input v-model="editWord" class="input" maxlength="50" />
          <select v-model="editSeverity" class="input input--sm">
            <option v-for="opt in severityOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
          <input v-model="editGroup" class="input input--sm" maxlength="20" />
          <button
            :id="`btn_sw_save_${item.id}`"
            :class="btnClass(`btn_sw_save_${item.id}`)"
            :disabled="!editWord.trim() || btnStates[`btn_sw_save_${item.id}`] === 'loading'"
            @click="onSave(item.id)"
          >保存</button>
          <button class="btn" @click="editingId = null">取消</button>
        </div>
        <div class="word-actions" v-if="editingId !== item.id">
          <button class="btn btn--sm" @click="startEdit(item)">编辑</button>
          <button
            :id="`btn_sw_delete_${item.id}`"
            :class="[...btnClass(`btn_sw_delete_${item.id}`), 'btn--danger']"
            :disabled="btnStates[`btn_sw_delete_${item.id}`] === 'loading'"
            @click="onDelete(item.id)"
          >删除</button>
        </div>
        <div class="msg-row">
          <span
            v-for="suffix in ['save', 'delete']" :key="suffix"
          >
            <span
              v-if="btnMessages[`btn_sw_${suffix}_${item.id}`]"
              :class="btnStates[`btn_sw_${suffix}_${item.id}`] === 'error' ? 'msg--error' : 'msg--success'"
            >{{ btnMessages[`btn_sw_${suffix}_${item.id}`] }}</span>
          </span>
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.page { max-width: 900px; }
.page-title { font-size: 20px; font-weight: 700; margin-bottom: 20px; color: #e2e8f0; }
.section { background: #1e293b; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
.section-title { font-size: 13px; font-weight: 600; color: #94a3b8; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
.form-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.msg-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; min-height: 20px; margin-top: 6px; }
.input { background: #0f172a; border: 1px solid #334155; color: #e2e8f0; padding: 6px 10px; border-radius: 6px; font-size: 13px; min-width: 100px; }
.input--wide { flex: 1; min-width: 200px; }
.input--sm { width: 100px; min-width: 80px; }
.input:focus { outline: none; border-color: #38bdf8; }
.btn { padding: 6px 14px; border-radius: 6px; border: none; font-size: 13px; cursor: pointer; transition: all 0.15s; background: #334155; color: #e2e8f0; }
.btn--sm { padding: 4px 10px; font-size: 12px; }
.btn:hover:not(:disabled) { background: #475569; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn--loading { background: #1d4ed8; color: #bfdbfe; }
.btn--success { background: #166534; color: #bbf7d0; }
.btn--error { background: #7f1d1d; color: #fecaca; }
.btn--danger { background: #450a0a; color: #fca5a5; }
.btn--danger:hover:not(:disabled) { background: #7f1d1d; }
.msg--success { color: #4ade80; font-size: 12px; }
.msg--error { color: #f87171; font-size: 12px; }
.empty { color: #64748b; font-size: 13px; text-align: center; padding: 24px 0; }
.word-item { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; padding: 10px 12px; background: #0f172a; border-radius: 6px; margin-bottom: 8px; border: 1px solid #334155; }
.word-view { flex: 1; display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.word-text { font-size: 14px; font-weight: 600; color: #e2e8f0; }
.severity-badge { font-size: 11px; font-weight: 600; padding: 1px 8px; border-radius: 99px; }
.word-group { font-size: 11px; color: #94a3b8; background: #1e293b; padding: 1px 6px; border-radius: 4px; }
.word-edit { flex: 1; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.word-actions { display: flex; gap: 6px; }
.test-result { padding: 8px 12px; border-radius: 6px; font-size: 13px; margin-top: 8px; display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.test-result--safe { background: #052e16; color: #4ade80; border: 1px solid #166534; }
.test-result--hit { background: #450a0a; color: #fca5a5; border: 1px solid #b91c1c; }
.sensitive-word { background: #b91c1c; color: #fecaca; padding: 1px 6px; border-radius: 4px; font-size: 12px; }
</style>
