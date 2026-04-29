<script setup lang="ts">
import { ref } from 'vue'
import { callApi } from '@shared/api/client'
import { useSessionStore } from '@shared/store/session'
import { writeAudit } from '@shared/api/audit'
import { ApiPaths } from '@shared/types/api'
import type { ButtonState } from '@shared/types/actions'
import type {
  WriterScene,
  WriterStyle,
  WriterGenerateResponse,
  WriterRewriteResponse,
  WriterSensitiveCheckResponse,
  WriterSaveDraftResponse,
  WriterPublishResponse
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
const scene = ref<WriterScene>('product')
const style = ref<WriterStyle>('friendly')
const inputText = ref('')
const candidates = ref<string[]>([])
const selectedCandidate = ref('')
const rewrittenText = ref('')
const sensitiveHits = ref<string[]>([])
const savedDraftId = ref<string | null>(null)
const publishedScriptId = ref<string | null>(null)

const sceneOptions: { value: WriterScene; label: string }[] = [
  { value: 'product', label: '产品介绍' },
  { value: 'interaction', label: '互动话术' },
  { value: 'notice', label: '公告通知' }
]
const styleOptions: { value: WriterStyle; label: string }[] = [
  { value: 'friendly', label: '亲切' },
  { value: 'professional', label: '专业' },
  { value: 'fast', label: '快节奏' }
]

// --- btn_writer_generate ---
async function onGenerate() {
  if (!inputText.value.trim() || inputText.value.length > 500) {
    setBtn('btn_writer_generate', 'error', '输入文本无效（1-500字）')
    return
  }
  setBtn('btn_writer_generate', 'loading')
  candidates.value = []
  selectedCandidate.value = ''
  const res = await callApi<WriterGenerateResponse>(ApiPaths.WRITER_GENERATE, 'POST', {
    scene: scene.value,
    style: style.value,
    input_text: inputText.value.trim()
  })
  if (res.ok && res.data) {
    candidates.value = res.data.candidates
    if (candidates.value.length > 0) selectedCandidate.value = candidates.value[0]
    setBtn('btn_writer_generate', 'success', `生成 ${candidates.value.length} 条候选`)
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_writer_generate',
      action: '生成话术',
      result: 'success'
    })
  } else {
    setBtn('btn_writer_generate', 'error', res.message || '生成失败')
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_writer_generate',
      action: '生成话术',
      result: 'failure',
      error_code: res.errorCode
    })
  }
}

// --- btn_writer_rewrite ---
async function onRewrite() {
  if (!selectedCandidate.value.trim()) {
    setBtn('btn_writer_rewrite', 'error', '请先选择候选文案')
    return
  }
  setBtn('btn_writer_rewrite', 'loading')
  const res = await callApi<WriterRewriteResponse>(ApiPaths.WRITER_REWRITE, 'POST', {
    text: selectedCandidate.value
  })
  if (res.ok && res.data) {
    rewrittenText.value = res.data.rewritten
    selectedCandidate.value = res.data.rewritten
    setBtn('btn_writer_rewrite', 'success', '改写完成')
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_writer_rewrite',
      action: '改写话术',
      result: 'success'
    })
  } else {
    setBtn('btn_writer_rewrite', 'error', res.message || '改写失败')
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_writer_rewrite',
      action: '改写话术',
      result: 'failure',
      error_code: res.errorCode
    })
  }
}

// --- btn_writer_sensitive_check ---
async function onSensitiveCheck() {
  if (!selectedCandidate.value.trim()) {
    setBtn('btn_writer_sensitive_check', 'error', '请先选择或输入文案')
    return
  }
  setBtn('btn_writer_sensitive_check', 'loading')
  sensitiveHits.value = []
  const res = await callApi<WriterSensitiveCheckResponse>(ApiPaths.WRITER_SENSITIVE_CHECK, 'POST', {
    text: selectedCandidate.value
  })
  if (res.ok && res.data) {
    sensitiveHits.value = res.data.hit_words
    if (res.data.safe) {
      setBtn('btn_writer_sensitive_check', 'success', '无敏感词')
    } else {
      setBtn('btn_writer_sensitive_check', 'error', `命中敏感词: ${res.data.hit_words.join(', ')}`)
    }
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_writer_sensitive_check',
      action: '敏感词检测',
      result: res.data.safe ? 'success' : 'failure'
    })
  } else {
    setBtn('btn_writer_sensitive_check', 'error', res.message || '检测失败')
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_writer_sensitive_check',
      action: '敏感词检测',
      result: 'failure',
      error_code: res.errorCode
    })
  }
}

// --- btn_writer_save_draft ---
async function onSaveDraft() {
  if (!selectedCandidate.value.trim()) {
    setBtn('btn_writer_save_draft', 'error', '请先输入文案内容')
    return
  }
  setBtn('btn_writer_save_draft', 'loading')
  const res = await callApi<WriterSaveDraftResponse>(ApiPaths.WRITER_SAVE_DRAFT, 'POST', {
    text: selectedCandidate.value,
    scene: scene.value,
    style: style.value
  })
  if (res.ok && res.data) {
    savedDraftId.value = res.data.draft_id
    setBtn('btn_writer_save_draft', 'success', `草稿已保存 (${res.data.draft_id.slice(0, 8)})`)
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_writer_save_draft',
      action: '保存草稿',
      result: 'success'
    })
  } else {
    setBtn('btn_writer_save_draft', 'error', res.message || '保存失败')
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_writer_save_draft',
      action: '保存草稿',
      result: 'failure',
      error_code: res.errorCode
    })
  }
}

// --- btn_writer_publish ---
async function onPublish() {
  if (!savedDraftId.value) {
    setBtn('btn_writer_publish', 'error', '请先保存草稿')
    return
  }
  setBtn('btn_writer_publish', 'loading')
  const res = await callApi<WriterPublishResponse>(ApiPaths.WRITER_PUBLISH, 'POST', {
    draft_id: savedDraftId.value
  })
  if (res.ok && res.data) {
    publishedScriptId.value = res.data.script_id
    savedDraftId.value = null
    setBtn('btn_writer_publish', 'success', `已发布到话术库 (${res.data.script_id.slice(0, 8)})`)
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_writer_publish',
      action: '发布到话术库',
      result: 'success'
    })
  } else {
    setBtn('btn_writer_publish', 'error', res.message || '发布失败')
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_writer_publish',
      action: '发布到话术库',
      result: 'failure',
      error_code: res.errorCode
    })
  }
}
</script>

<template>
  <div class="page">
    <h1 class="page-title">写话术</h1>

    <!-- Generation Config -->
    <section class="section">
      <h2 class="section-title">生成配置</h2>
      <div class="form-col">
        <div class="form-row">
          <label class="field-label">场景</label>
          <select v-model="scene" class="input">
            <option v-for="opt in sceneOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
          <label class="field-label">风格</label>
          <select v-model="style" class="input">
            <option v-for="opt in styleOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
        </div>
        <div class="form-row">
          <textarea
            v-model="inputText"
            class="input textarea"
            placeholder="输入参考内容或关键词 (max 500)"
            maxlength="500"
            rows="3"
          />
        </div>
        <div class="form-row">
          <button
            id="btn_writer_generate"
            :class="btnClass('btn_writer_generate')"
            :disabled="btnStates['btn_writer_generate'] === 'loading'"
            @click="onGenerate"
          >
            {{ btnStates['btn_writer_generate'] === 'loading' ? '生成中...' : '生成' }}
          </button>
        </div>
        <div class="msg-row">
          <span
            v-if="btnMessages['btn_writer_generate']"
            :class="btnStates['btn_writer_generate'] === 'error' ? 'msg--error' : 'msg--success'"
            >{{ btnMessages['btn_writer_generate'] }}</span
          >
        </div>
      </div>
    </section>

    <!-- Candidates -->
    <section class="section" v-if="candidates.length > 0">
      <h2 class="section-title">候选文案 ({{ candidates.length }})</h2>
      <div class="candidate-list">
        <div
          v-for="(c, i) in candidates"
          :key="i"
          class="candidate-item"
          :class="{ 'candidate-item--selected': selectedCandidate === c }"
          @click="selectedCandidate = c"
        >
          {{ c }}
        </div>
      </div>
    </section>

    <!-- Editor -->
    <section class="section">
      <h2 class="section-title">当前文案</h2>
      <div class="form-col">
        <textarea
          v-model="selectedCandidate"
          class="input textarea"
          placeholder="在此输入或选择候选文案"
          rows="3"
        />
        <div v-if="sensitiveHits.length > 0" class="sensitive-box">
          命中敏感词：<span v-for="w in sensitiveHits" :key="w" class="sensitive-word">{{
            w
          }}</span>
        </div>
        <div class="form-row">
          <button
            id="btn_writer_rewrite"
            :class="btnClass('btn_writer_rewrite')"
            :disabled="!selectedCandidate.trim() || btnStates['btn_writer_rewrite'] === 'loading'"
            @click="onRewrite"
          >
            改写
          </button>
          <button
            id="btn_writer_sensitive_check"
            :class="btnClass('btn_writer_sensitive_check')"
            :disabled="
              !selectedCandidate.trim() || btnStates['btn_writer_sensitive_check'] === 'loading'
            "
            @click="onSensitiveCheck"
          >
            敏感词检测
          </button>
          <button
            id="btn_writer_save_draft"
            :class="btnClass('btn_writer_save_draft')"
            :disabled="
              !selectedCandidate.trim() || btnStates['btn_writer_save_draft'] === 'loading'
            "
            @click="onSaveDraft"
          >
            保存草稿
          </button>
          <button
            id="btn_writer_publish"
            :class="btnClass('btn_writer_publish')"
            :disabled="!savedDraftId || btnStates['btn_writer_publish'] === 'loading'"
            @click="onPublish"
          >
            发布到话术库
          </button>
        </div>
        <div class="msg-row">
          <span
            v-for="id in [
              'btn_writer_rewrite',
              'btn_writer_sensitive_check',
              'btn_writer_save_draft',
              'btn_writer_publish'
            ]"
            :key="id"
          >
            <span
              v-if="btnMessages[id]"
              :class="btnStates[id] === 'error' ? 'msg--error' : 'msg--success'"
              >{{ btnMessages[id] }}</span
            >
          </span>
        </div>
        <div v-if="savedDraftId" class="status-chip chip--blue">
          草稿已保存: {{ savedDraftId.slice(0, 8) }}
        </div>
        <div v-if="publishedScriptId" class="status-chip chip--green">
          已发布: {{ publishedScriptId.slice(0, 8) }}
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
  align-items: flex-start;
}
.form-col {
  display: flex;
  flex-direction: column;
  gap: 10px;
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
}
.textarea {
  width: 100%;
  resize: vertical;
  min-height: 60px;
  font-family: inherit;
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
.msg--success {
  color: #4ade80;
  font-size: 12px;
}
.msg--error {
  color: #f87171;
  font-size: 12px;
}
.field-label {
  font-size: 12px;
  color: #94a3b8;
  white-space: nowrap;
}
.candidate-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.candidate-item {
  padding: 8px 12px;
  background: #0f172a;
  border-radius: 6px;
  font-size: 13px;
  color: #e2e8f0;
  cursor: pointer;
  border: 1px solid #334155;
  transition: border-color 0.15s;
}
.candidate-item:hover {
  border-color: #475569;
}
.candidate-item--selected {
  border-color: #38bdf8;
}
.sensitive-box {
  background: #450a0a;
  border: 1px solid #b91c1c;
  border-radius: 6px;
  padding: 8px 12px;
  font-size: 12px;
  color: #fca5a5;
}
.sensitive-word {
  background: #b91c1c;
  color: #fecaca;
  padding: 1px 6px;
  border-radius: 4px;
  margin-left: 4px;
}
.status-chip {
  display: inline-block;
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 99px;
  margin-top: 4px;
}
.chip--blue {
  background: #1e3a5f;
  color: #7dd3fc;
}
.chip--green {
  background: #14532d;
  color: #4ade80;
}
</style>
