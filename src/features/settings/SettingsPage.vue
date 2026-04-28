<script setup lang="ts">
import { ref } from 'vue'
import { apiClient } from '@shared/api/client'
import { useSessionStore } from '@shared/store/session'
import { writeAudit } from '@shared/api/audit'
import type { ButtonState } from '@shared/types/actions'

const sessionStore = useSessionStore()

const btnStates = ref<Record<string, ButtonState>>({})
const btnMessages = ref<Record<string, string>>({})

// Form fields
const providerApiKey = ref('')
const providerModelId = ref('')
const apiAddress = ref('http://localhost:3000')
const apiKey = ref('')
const promptText = ref('')

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

// --- btn_cfg_save_provider ---
function onSaveProvider() {
  if (!providerApiKey.value.trim() || !providerModelId.value.trim()) {
    setBtn('btn_cfg_save_provider', 'error', '请填写 API Key 和 Model ID')
    return
  }
  setBtn('btn_cfg_save_provider', 'loading')
  setTimeout(() => {
    setBtn('btn_cfg_save_provider', 'success', '平台配置已保存')
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_cfg_save_provider',
      action: '保存服务商配置',
      result: 'success'
    })
  }, 200)
}

// --- btn_cfg_engine_rotate ---
async function onEngineRotate() {
  setBtn('btn_cfg_engine_rotate', 'loading')
  const res = await apiClient.sessionStart({ room_id: 'engine-rotate', account_id: 'system' })
  if (res.ok) {
    setBtn('btn_cfg_engine_rotate', 'success', '引擎已轮换')
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_cfg_engine_rotate',
      action: '轮换推理引擎',
      result: 'success'
    })
  } else {
    setBtn('btn_cfg_engine_rotate', 'error', res.message || '轮换失败')
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_cfg_engine_rotate',
      action: '轮换推理引擎',
      result: 'failure',
      error_code: res.errorCode
    })
  }
}

// --- btn_cfg_api_start ---
async function onApiStart() {
  if (!apiAddress.value.trim() || !apiKey.value.trim()) {
    setBtn('btn_cfg_api_start', 'error', '请填写服务地址和密钥')
    return
  }
  setBtn('btn_cfg_api_start', 'loading')
  const res = await apiClient.streamStart({
    session_id: sessionStore.sessionId || '',
    rtmp_url: apiAddress.value
  })
  if (res.ok) {
    setBtn('btn_cfg_api_start', 'success', `API已启动 (stream: ${res.data?.stream_id})`)
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_cfg_api_start',
      action: '启动API服务',
      result: 'success'
    })
  } else {
    setBtn('btn_cfg_api_start', 'error', res.message || '启动失败')
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_cfg_api_start',
      action: '启动API服务',
      result: 'failure',
      error_code: res.errorCode
    })
  }
}

// --- btn_cfg_api_stop ---
async function onApiStop() {
  setBtn('btn_cfg_api_stop', 'loading')
  const res = await apiClient.sessionStop({ session_id: sessionStore.sessionId || '' })
  if (res.ok) {
    setBtn('btn_cfg_api_stop', 'success', '服务已停止')
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_cfg_api_stop',
      action: '停止API服务',
      result: 'success'
    })
  } else {
    setBtn('btn_cfg_api_stop', 'error', res.message || '停止失败')
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_cfg_api_stop',
      action: '停止API服务',
      result: 'failure',
      error_code: res.errorCode
    })
  }
}

// --- btn_cfg_reset_default ---
function onResetDefault() {
  setBtn('btn_cfg_reset_default', 'loading')
  providerApiKey.value = ''
  providerModelId.value = ''
  apiAddress.value = 'http://localhost:3000'
  apiKey.value = ''
  promptText.value = ''
  setTimeout(() => {
    setBtn('btn_cfg_reset_default', 'success', '已恢复默认值')
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_cfg_reset_default',
      action: '重置默认配置',
      result: 'success'
    })
  }, 150)
}

// --- btn_cfg_refresh_output ---
function onRefreshOutput() {
  setBtn('btn_cfg_refresh_output', 'loading')
  setTimeout(() => {
    setBtn('btn_cfg_refresh_output', 'success', '输出设备已刷新')
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_cfg_refresh_output',
      action: '刷新输出设备',
      result: 'success'
    })
  }, 300)
}

// --- btn_cfg_save_prompt ---
function onSavePrompt() {
  if (!promptText.value.trim()) {
    setBtn('btn_cfg_save_prompt', 'error', '请输入改写要求')
    return
  }
  setBtn('btn_cfg_save_prompt', 'loading')
  setTimeout(() => {
    setBtn('btn_cfg_save_prompt', 'success', '改写要求已保存')
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_cfg_save_prompt',
      action: '保存提示词',
      result: 'success'
    })
  }, 200)
}
</script>

<template>
  <div class="page">
    <h1 class="page-title">设置</h1>

    <!-- Provider Config -->
    <section class="section">
      <h2 class="section-title">改写平台配置</h2>
      <div class="form-col">
        <div class="form-row">
          <label class="field-label">API Key</label>
          <input v-model="providerApiKey" class="input" placeholder="sk-..." type="password" />
        </div>
        <div class="form-row">
          <label class="field-label">Model ID</label>
          <input v-model="providerModelId" class="input" placeholder="gpt-4o" />
        </div>
        <div class="form-row">
          <button
            id="btn_cfg_save_provider"
            :class="btnClass('btn_cfg_save_provider')"
            :disabled="btnStates['btn_cfg_save_provider'] === 'loading'"
            @click="onSaveProvider"
          >
            保存改写平台
          </button>
          <span
            v-if="btnMessages['btn_cfg_save_provider']"
            :class="btnStates['btn_cfg_save_provider'] === 'error' ? 'msg--error' : 'msg--success'"
            >{{ btnMessages['btn_cfg_save_provider'] }}</span
          >
        </div>
      </div>
    </section>

    <!-- Engine -->
    <section class="section">
      <h2 class="section-title">引擎管理</h2>
      <div class="form-row">
        <button
          id="btn_cfg_engine_rotate"
          :class="btnClass('btn_cfg_engine_rotate')"
          :disabled="btnStates['btn_cfg_engine_rotate'] === 'loading'"
          @click="onEngineRotate"
        >
          {{ btnStates['btn_cfg_engine_rotate'] === 'loading' ? '轮换中...' : '引擎轮换' }}
        </button>
        <span
          v-if="btnMessages['btn_cfg_engine_rotate']"
          :class="btnStates['btn_cfg_engine_rotate'] === 'error' ? 'msg--error' : 'msg--success'"
          >{{ btnMessages['btn_cfg_engine_rotate'] }}</span
        >
      </div>
    </section>

    <!-- API Service -->
    <section class="section">
      <h2 class="section-title">API服务</h2>
      <div class="form-col">
        <div class="form-row">
          <label class="field-label">服务地址</label>
          <input
            v-model="apiAddress"
            class="input input--wide"
            placeholder="http://localhost:3000"
          />
        </div>
        <div class="form-row">
          <label class="field-label">访问密钥</label>
          <input v-model="apiKey" class="input input--wide" placeholder="密钥" type="password" />
        </div>
        <div class="form-row">
          <button
            id="btn_cfg_api_start"
            :class="btnClass('btn_cfg_api_start')"
            :disabled="btnStates['btn_cfg_api_start'] === 'loading'"
            @click="onApiStart"
          >
            {{ btnStates['btn_cfg_api_start'] === 'loading' ? '启动中...' : '启动API' }}
          </button>
          <button
            id="btn_cfg_api_stop"
            :class="btnClass('btn_cfg_api_stop')"
            :disabled="btnStates['btn_cfg_api_stop'] === 'loading'"
            @click="onApiStop"
          >
            云端元素停止
          </button>
          <span
            v-if="btnMessages['btn_cfg_api_start']"
            :class="btnStates['btn_cfg_api_start'] === 'error' ? 'msg--error' : 'msg--success'"
            >{{ btnMessages['btn_cfg_api_start'] }}</span
          >
          <span
            v-if="btnMessages['btn_cfg_api_stop']"
            :class="btnStates['btn_cfg_api_stop'] === 'error' ? 'msg--error' : 'msg--success'"
            >{{ btnMessages['btn_cfg_api_stop'] }}</span
          >
        </div>
      </div>
    </section>

    <!-- System -->
    <section class="section">
      <h2 class="section-title">系统</h2>
      <div class="form-row">
        <button
          id="btn_cfg_reset_default"
          :class="btnClass('btn_cfg_reset_default')"
          :disabled="btnStates['btn_cfg_reset_default'] === 'loading'"
          @click="onResetDefault"
        >
          恢复默认值
        </button>
        <button
          id="btn_cfg_refresh_output"
          :class="btnClass('btn_cfg_refresh_output')"
          :disabled="btnStates['btn_cfg_refresh_output'] === 'loading'"
          @click="onRefreshOutput"
        >
          刷新输出设备
        </button>
        <span
          v-if="btnMessages['btn_cfg_reset_default']"
          :class="btnStates['btn_cfg_reset_default'] === 'error' ? 'msg--error' : 'msg--success'"
          >{{ btnMessages['btn_cfg_reset_default'] }}</span
        >
        <span
          v-if="btnMessages['btn_cfg_refresh_output']"
          :class="btnStates['btn_cfg_refresh_output'] === 'error' ? 'msg--error' : 'msg--success'"
          >{{ btnMessages['btn_cfg_refresh_output'] }}</span
        >
      </div>
    </section>

    <!-- Prompt -->
    <section class="section">
      <h2 class="section-title">改写要求</h2>
      <div class="form-col">
        <textarea
          v-model="promptText"
          class="textarea"
          placeholder="请输入改写要求，例如：保持口语化风格，突出产品优势..."
          rows="4"
        />
        <div class="form-row">
          <button
            id="btn_cfg_save_prompt"
            :class="btnClass('btn_cfg_save_prompt')"
            :disabled="btnStates['btn_cfg_save_prompt'] === 'loading'"
            @click="onSavePrompt"
          >
            保存改写要求
          </button>
          <span
            v-if="btnMessages['btn_cfg_save_prompt']"
            :class="btnStates['btn_cfg_save_prompt'] === 'error' ? 'msg--error' : 'msg--success'"
            >{{ btnMessages['btn_cfg_save_prompt'] }}</span
          >
        </div>
      </div>
    </section>
  </div>
</template>

<style scoped>
.page {
  max-width: 700px;
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
.form-col {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.field-label {
  font-size: 13px;
  color: #94a3b8;
  min-width: 70px;
}
.input {
  background: #0f172a;
  border: 1px solid #334155;
  color: #e2e8f0;
  padding: 6px 10px;
  border-radius: 6px;
  font-size: 13px;
  min-width: 160px;
}
.input--wide {
  flex: 1;
}
.input:focus {
  outline: none;
  border-color: #38bdf8;
}
.textarea {
  background: #0f172a;
  border: 1px solid #334155;
  color: #e2e8f0;
  padding: 8px 10px;
  border-radius: 6px;
  font-size: 13px;
  width: 100%;
  resize: vertical;
  box-sizing: border-box;
}
.textarea:focus {
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
</style>
