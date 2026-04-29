<script setup lang="ts">
import { ref, computed, onUnmounted } from 'vue'
import { callApi } from '@shared/api/client'
import { useSessionStore } from '@shared/store/session'
import { writeAudit } from '@shared/api/audit'
import { ApiPaths } from '@shared/types/api'
import type { ButtonState } from '@shared/types/actions'
import type {
  AsrState,
  AsrExportFormat,
  AsrStartResponse,
  AsrPauseResponse,
  AsrStopResponse,
  AsrCorrectionResponse,
  AsrExportResponse
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
const asrSessionId = ref<string | null>(null)
const asrState = ref<AsrState>('idle')
const segments = ref<
  { id: string; text: string; ts: number; editing: boolean; editText: string }[]
>([])
const exportFormat = ref<AsrExportFormat>('txt')

const isListening = computed(() => asrState.value === 'listening')
const isActive = computed(() => asrState.value === 'listening' || asrState.value === 'paused')

// Simulate incoming segments while listening
let simTimer: ReturnType<typeof setInterval> | null = null
const mockTexts = [
  '大家好，欢迎来到今天的直播',
  '今天我们要介绍一款全新产品',
  '这款产品的主要特点是',
  '价格非常实惠，性价比超高',
  '感谢大家的支持，我们继续'
]
let mockIdx = 0

function startSimulation() {
  simTimer = setInterval(() => {
    if (asrState.value !== 'listening') return
    const text = mockTexts[mockIdx % mockTexts.length]
    mockIdx++
    segments.value.push({
      id: `seg-${Date.now()}`,
      text,
      ts: Date.now(),
      editing: false,
      editText: text
    })
    if (segments.value.length > 50) segments.value.shift()
  }, 2000)
}

function stopSimulation() {
  if (simTimer !== null) {
    clearInterval(simTimer)
    simTimer = null
  }
}

onUnmounted(stopSimulation)

// --- btn_asr_start ---
async function onStart() {
  setBtn('btn_asr_start', 'loading')
  const res = await callApi<AsrStartResponse>(ApiPaths.ASR_START, 'POST', {
    language: 'zh-CN',
    sample_rate: 48000
  })
  if (res.ok && res.data) {
    asrSessionId.value = res.data.session_id
    asrState.value = 'listening'
    segments.value = []
    startSimulation()
    setBtn('btn_asr_start', 'success', '识别已启动')
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_asr_start',
      action: '开始ASR识别',
      result: 'success'
    })
  } else {
    setBtn('btn_asr_start', 'error', res.message || '启动失败')
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_asr_start',
      action: '开始ASR识别',
      result: 'failure',
      error_code: res.errorCode
    })
  }
}

// --- btn_asr_pause ---
async function onPause() {
  if (!asrSessionId.value) return
  setBtn('btn_asr_pause', 'loading')
  const res = await callApi<AsrPauseResponse>(ApiPaths.ASR_PAUSE, 'POST', {
    session_id: asrSessionId.value
  })
  if (res.ok && res.data) {
    asrState.value = 'paused'
    setBtn('btn_asr_pause', 'success', '已暂停')
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_asr_pause',
      action: '暂停ASR识别',
      result: 'success'
    })
  } else {
    setBtn('btn_asr_pause', 'error', res.message || '暂停失败')
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_asr_pause',
      action: '暂停ASR识别',
      result: 'failure',
      error_code: res.errorCode
    })
  }
}

// --- btn_asr_stop ---
async function onStop() {
  if (!asrSessionId.value) return
  setBtn('btn_asr_stop', 'loading')
  stopSimulation()
  const res = await callApi<AsrStopResponse>(ApiPaths.ASR_STOP, 'POST', {
    session_id: asrSessionId.value
  })
  if (res.ok && res.data) {
    asrState.value = 'stopped'
    setBtn('btn_asr_stop', 'success', '已停止')
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_asr_stop',
      action: '停止ASR识别',
      result: 'success'
    })
  } else {
    asrState.value = 'stopped'
    setBtn('btn_asr_stop', 'error', res.message || '停止失败')
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_asr_stop',
      action: '停止ASR识别',
      result: 'failure',
      error_code: res.errorCode
    })
  }
}

// --- btn_asr_correction_submit ---
async function onCorrectionSubmit(seg: {
  id: string
  text: string
  ts: number
  editing: boolean
  editText: string
}) {
  if (seg.editText === seg.text) {
    seg.editing = false
    return
  }
  setBtn(`btn_asr_correction_submit_${seg.id}`, 'loading')
  const res = await callApi<AsrCorrectionResponse>(ApiPaths.ASR_CORRECTION, 'POST', {
    session_id: asrSessionId.value || '',
    segment_id: seg.id,
    corrected_text: seg.editText
  })
  if (res.ok) {
    seg.text = seg.editText
    seg.editing = false
    setBtn(`btn_asr_correction_submit_${seg.id}`, 'success', '已纠正')
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_asr_correction_submit',
      action: '纠错提交',
      result: 'success'
    })
  } else {
    setBtn(`btn_asr_correction_submit_${seg.id}`, 'error', res.message || '提交失败')
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_asr_correction_submit',
      action: '纠错提交',
      result: 'failure',
      error_code: res.errorCode
    })
  }
}

// --- btn_asr_export ---
async function onExport() {
  setBtn('btn_asr_export', 'loading')
  const res = await callApi<AsrExportResponse>(ApiPaths.ASR_EXPORT, 'POST', {
    session_id: asrSessionId.value || '',
    format: exportFormat.value
  })
  if (res.ok && res.data) {
    setBtn('btn_asr_export', 'success', `导出成功: ${res.data.download_url.slice(-20)}`)
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_asr_export',
      action: '导出ASR文本',
      result: 'success'
    })
  } else {
    setBtn('btn_asr_export', 'error', res.message || '导出失败')
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_asr_export',
      action: '导出ASR文本',
      result: 'failure',
      error_code: res.errorCode
    })
  }
}

const stateLabel: Record<AsrState, string> = {
  idle: '未启动',
  listening: '识别中',
  paused: '已暂停',
  stopped: '已停止'
}
const stateColor: Record<AsrState, string> = {
  idle: '#6b7280',
  listening: '#22c55e',
  paused: '#f59e0b',
  stopped: '#ef4444'
}
</script>

<template>
  <div class="page">
    <h1 class="page-title">音转文字</h1>

    <!-- Controls -->
    <section class="section">
      <h2 class="section-title">识别控制</h2>
      <div class="form-row">
        <div class="state-indicator">
          <span class="state-dot" :style="{ backgroundColor: stateColor[asrState] }" />
          <span class="state-text">{{ stateLabel[asrState] }}</span>
        </div>
        <button
          id="btn_asr_start"
          :class="btnClass('btn_asr_start')"
          :disabled="isListening || btnStates['btn_asr_start'] === 'loading'"
          @click="onStart"
        >
          开始监听
        </button>
        <button
          id="btn_asr_pause"
          :class="btnClass('btn_asr_pause')"
          :disabled="!isListening || btnStates['btn_asr_pause'] === 'loading'"
          @click="onPause"
        >
          暂停监听
        </button>
        <button
          id="btn_asr_stop"
          :class="btnClass('btn_asr_stop')"
          :disabled="!isActive || btnStates['btn_asr_stop'] === 'loading'"
          @click="onStop"
        >
          停止监听
        </button>
      </div>
      <div class="msg-row">
        <span v-for="id in ['btn_asr_start', 'btn_asr_pause', 'btn_asr_stop']" :key="id">
          <span
            v-if="btnMessages[id]"
            :class="btnStates[id] === 'error' ? 'msg--error' : 'msg--success'"
            >{{ btnMessages[id] }}</span
          >
        </span>
      </div>
    </section>

    <!-- Export -->
    <section class="section">
      <h2 class="section-title">导出</h2>
      <div class="form-row">
        <label class="field-label">格式</label>
        <select v-model="exportFormat" class="input input--sm">
          <option value="txt">TXT</option>
          <option value="srt">SRT</option>
        </select>
        <button
          id="btn_asr_export"
          :class="btnClass('btn_asr_export')"
          :disabled="segments.length === 0 || btnStates['btn_asr_export'] === 'loading'"
          @click="onExport"
        >
          导出文本
        </button>
      </div>
      <div class="msg-row">
        <span
          v-if="btnMessages['btn_asr_export']"
          :class="btnStates['btn_asr_export'] === 'error' ? 'msg--error' : 'msg--success'"
          >{{ btnMessages['btn_asr_export'] }}</span
        >
      </div>
    </section>

    <!-- Transcript -->
    <section class="section">
      <h2 class="section-title">识别结果 ({{ segments.length }})</h2>
      <div v-if="segments.length === 0" class="empty">
        {{ isListening ? '识别中，等待文字...' : '暂无识别结果' }}
      </div>
      <div class="transcript-list">
        <div v-for="seg in segments.slice().reverse()" :key="seg.id" class="segment-item">
          <span class="seg-ts">{{ new Date(seg.ts).toLocaleTimeString() }}</span>
          <div class="seg-body" v-if="!seg.editing">
            <span class="seg-text">{{ seg.text }}</span>
            <button
              class="btn btn--sm"
              @click="
                seg.editing = true
                seg.editText = seg.text
              "
            >
              纠错
            </button>
          </div>
          <div class="seg-edit" v-else>
            <input
              v-model="seg.editText"
              class="input input--wide"
              @keyup.enter="onCorrectionSubmit(seg)"
            />
            <button
              :id="`btn_asr_correction_submit_${seg.id}`"
              :class="btnClass(`btn_asr_correction_submit_${seg.id}`)"
              :disabled="btnStates[`btn_asr_correction_submit_${seg.id}`] === 'loading'"
              @click="onCorrectionSubmit(seg)"
            >
              提交
            </button>
            <button class="btn btn--sm" @click="seg.editing = false">取消</button>
            <span
              v-if="btnMessages[`btn_asr_correction_submit_${seg.id}`]"
              :class="
                btnStates[`btn_asr_correction_submit_${seg.id}`] === 'error'
                  ? 'msg--error'
                  : 'msg--success'
              "
              >{{ btnMessages[`btn_asr_correction_submit_${seg.id}`] }}</span
            >
          </div>
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
  min-width: 80px;
}
.input--wide {
  flex: 1;
  min-width: 200px;
}
.input--sm {
  width: 80px;
  min-width: 60px;
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
.empty {
  color: #64748b;
  font-size: 13px;
  text-align: center;
  padding: 24px 0;
}
.state-indicator {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  background: #0f172a;
  border-radius: 99px;
}
.state-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.state-text {
  font-size: 12px;
  color: #94a3b8;
}
.transcript-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 300px;
  overflow-y: auto;
}
.segment-item {
  display: flex;
  align-items: flex-start;
  gap: 10px;
  padding: 8px 10px;
  background: #0f172a;
  border-radius: 6px;
  border: 1px solid #1e293b;
}
.seg-ts {
  font-size: 11px;
  color: #475569;
  white-space: nowrap;
  padding-top: 2px;
}
.seg-body {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 8px;
}
.seg-edit {
  display: flex;
  flex: 1;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.seg-text {
  flex: 1;
  font-size: 13px;
  color: #e2e8f0;
}
</style>
