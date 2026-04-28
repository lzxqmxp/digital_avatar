<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { callApi } from '@shared/api/client'
import { useSessionStore } from '@shared/store/session'
import { writeAudit } from '@shared/api/audit'
import { ApiPaths } from '@shared/types/api'
import type { ButtonState } from '@shared/types/actions'
import type {
  ModelItem,
  ModelEngineType,
  ModelListResponse,
  ModelImportResponse,
  ModelVerifyResponse,
  ModelEnableResponse,
  ModelRollbackResponse,
  ModelDeleteResponse
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

const models = ref<ModelItem[]>([])
const newModelName = ref('')
const newModelEngine = ref<ModelEngineType>('wav2lip')
const newModelVersion = ref('1.0.0')
const newModelPath = ref('')
const verifyReport = ref<Record<string, string>>({})

const engineOptions: { value: ModelEngineType; label: string }[] = [
  { value: 'wav2lip', label: 'Wav2Lip' },
  { value: 'musetalk', label: 'MuseTalk' }
]

const statusColor: Record<string, string> = {
  imported: '#94a3b8',
  validated: '#fbbf24',
  active: '#4ade80',
  deprecated: '#f87171'
}

async function loadModels() {
  const res = await callApi<ModelListResponse>(ApiPaths.MODELS_LIST, 'GET')
  if (res.ok && res.data) {
    models.value = res.data.items
  }
}

onMounted(loadModels)

// --- btn_model_import ---
const importInput = ref<HTMLInputElement | null>(null)
function onImportClick() {
  importInput.value?.click()
}
async function onImportFile(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  const ext = '.' + file.name.split('.').pop()?.toLowerCase()
  if (!['.pth', '.onnx', '.engine'].includes(ext)) {
    setBtn('btn_model_import', 'error', '仅支持 .pth/.onnx/.engine')
    writeAudit({ session_id: sessionStore.sessionId || '', button_id: 'btn_model_import', action: '导入模型', result: 'failure', error_code: 'MODEL_FILE_INVALID' })
    target.value = ''
    return
  }
  if (!newModelName.value.trim()) {
    setBtn('btn_model_import', 'error', '请填写模型名称')
    target.value = ''
    return
  }
  setBtn('btn_model_import', 'loading')
  const res = await callApi<ModelImportResponse>(ApiPaths.MODELS_IMPORT, 'POST', {
    name: newModelName.value.trim(),
    engine_type: newModelEngine.value,
    version: newModelVersion.value || '1.0.0',
    file_path: `/models/${file.name}`
  })
  if (res.ok && res.data) {
    models.value.push(res.data)
    newModelName.value = ''
    newModelVersion.value = '1.0.0'
    setBtn('btn_model_import', 'success', `模型已导入: ${res.data.name}`)
    writeAudit({ session_id: sessionStore.sessionId || '', button_id: 'btn_model_import', action: '导入模型', result: 'success' })
  } else {
    setBtn('btn_model_import', 'error', res.message || '导入失败')
    writeAudit({ session_id: sessionStore.sessionId || '', button_id: 'btn_model_import', action: '导入模型', result: 'failure', error_code: res.errorCode })
  }
  target.value = ''
}

// --- btn_model_verify ---
async function onVerify(id: string) {
  setBtn(`btn_model_verify_${id}`, 'loading')
  const res = await callApi<ModelVerifyResponse>(ApiPaths.MODELS_VERIFY, 'POST', { id })
  if (res.ok && res.data) {
    const idx = models.value.findIndex((m) => m.id === id)
    if (idx !== -1) models.value[idx] = { ...models.value[idx], status: 'validated' }
    if (res.data.report) verifyReport.value[id] = res.data.report
    setBtn(`btn_model_verify_${id}`, 'success', '校验通过')
    writeAudit({ session_id: sessionStore.sessionId || '', button_id: 'btn_model_verify', action: '校验模型', result: 'success' })
  } else {
    setBtn(`btn_model_verify_${id}`, 'error', res.message || '校验失败')
    writeAudit({ session_id: sessionStore.sessionId || '', button_id: 'btn_model_verify', action: '校验模型', result: 'failure', error_code: res.errorCode })
  }
}

// --- btn_model_enable ---
async function onEnable(id: string) {
  setBtn(`btn_model_enable_${id}`, 'loading')
  const res = await callApi<ModelEnableResponse>(ApiPaths.MODELS_ENABLE, 'POST', { id })
  if (res.ok && res.data) {
    await loadModels()
    setBtn(`btn_model_enable_${id}`, 'success', '模型已启用')
    writeAudit({ session_id: sessionStore.sessionId || '', button_id: 'btn_model_enable', action: '启用模型', result: 'success' })
  } else {
    setBtn(`btn_model_enable_${id}`, 'error', res.message || '启用失败')
    writeAudit({ session_id: sessionStore.sessionId || '', button_id: 'btn_model_enable', action: '启用模型', result: 'failure', error_code: res.errorCode })
  }
}

// --- btn_model_rollback ---
async function onRollback(id: string) {
  setBtn(`btn_model_rollback_${id}`, 'loading')
  const res = await callApi<ModelRollbackResponse>(ApiPaths.MODELS_ROLLBACK, 'POST', { id })
  if (res.ok && res.data) {
    const idx = models.value.findIndex((m) => m.id === id)
    if (idx !== -1) models.value[idx] = { ...models.value[idx], status: 'validated' }
    setBtn(`btn_model_rollback_${id}`, 'success', '已回滚')
    writeAudit({ session_id: sessionStore.sessionId || '', button_id: 'btn_model_rollback', action: '回滚模型', result: 'success' })
  } else {
    setBtn(`btn_model_rollback_${id}`, 'error', res.message || '回滚失败')
    writeAudit({ session_id: sessionStore.sessionId || '', button_id: 'btn_model_rollback', action: '回滚模型', result: 'failure', error_code: res.errorCode })
  }
}

// --- btn_model_delete ---
async function onDelete(id: string) {
  setBtn(`btn_model_delete_${id}`, 'loading')
  const res = await callApi<ModelDeleteResponse>(ApiPaths.MODELS_DELETE, 'POST', { id })
  if (res.ok) {
    models.value = models.value.filter((m) => m.id !== id)
    setBtn(`btn_model_delete_${id}`, 'success', '已删除')
    writeAudit({ session_id: sessionStore.sessionId || '', button_id: 'btn_model_delete', action: '删除模型', result: 'success' })
  } else {
    setBtn(`btn_model_delete_${id}`, 'error', res.message || '删除失败')
    writeAudit({ session_id: sessionStore.sessionId || '', button_id: 'btn_model_delete', action: '删除模型', result: 'failure', error_code: res.errorCode })
  }
}
</script>

<template>
  <div class="page">
    <h1 class="page-title">模型管理</h1>

    <!-- Import -->
    <section class="section">
      <h2 class="section-title">导入模型</h2>
      <div class="form-col">
        <div class="form-row">
          <input v-model="newModelName" class="input" placeholder="模型名称 (max 40)" maxlength="40" />
          <select v-model="newModelEngine" class="input">
            <option v-for="opt in engineOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
          </select>
          <input v-model="newModelVersion" class="input input--sm" placeholder="版本 (semver)" />
        </div>
        <div class="form-row">
          <input ref="importInput" type="file" accept=".pth,.onnx,.engine" style="display:none" @change="onImportFile" />
          <button id="btn_model_import" :class="btnClass('btn_model_import')" :disabled="!newModelName.trim() || btnStates['btn_model_import'] === 'loading'" @click="onImportClick">
            {{ btnStates['btn_model_import'] === 'loading' ? '导入中...' : '选择并导入模型' }}
          </button>
        </div>
        <div class="msg-row">
          <span v-if="btnMessages['btn_model_import']" :class="btnStates['btn_model_import'] === 'error' ? 'msg--error' : 'msg--success'">{{ btnMessages['btn_model_import'] }}</span>
        </div>
      </div>
    </section>

    <!-- Model List -->
    <section class="section">
      <h2 class="section-title">模型列表 ({{ models.length }})</h2>
      <div v-if="models.length === 0" class="empty">暂无模型，请导入</div>
      <div v-for="m in models" :key="m.id" class="model-item">
        <div class="model-info">
          <span class="model-name">{{ m.name }}</span>
          <span class="model-meta">{{ m.engine_type }} · v{{ m.version }}</span>
          <span class="model-path">{{ m.file_path }}</span>
          <span class="status-badge" :style="{ color: statusColor[m.status] || '#94a3b8' }">{{ m.status }}</span>
        </div>
        <div v-if="verifyReport[m.id]" class="verify-report">{{ verifyReport[m.id] }}</div>
        <div class="model-actions">
          <button :id="`btn_model_verify_${m.id}`" :class="btnClass(`btn_model_verify_${m.id}`)" :disabled="m.status === 'validated' || m.status === 'active' || btnStates[`btn_model_verify_${m.id}`] === 'loading'" @click="onVerify(m.id)">校验</button>
          <button :id="`btn_model_enable_${m.id}`" :class="btnClass(`btn_model_enable_${m.id}`)" :disabled="m.status !== 'validated' || btnStates[`btn_model_enable_${m.id}`] === 'loading'" @click="onEnable(m.id)">启用</button>
          <button :id="`btn_model_rollback_${m.id}`" :class="btnClass(`btn_model_rollback_${m.id}`)" :disabled="m.status !== 'active' || btnStates[`btn_model_rollback_${m.id}`] === 'loading'" @click="onRollback(m.id)">回滚</button>
          <button :id="`btn_model_delete_${m.id}`" :class="[...btnClass(`btn_model_delete_${m.id}`), 'btn--danger']" :disabled="m.status === 'active' || btnStates[`btn_model_delete_${m.id}`] === 'loading'" @click="onDelete(m.id)">删除</button>
        </div>
        <div class="msg-row">
          <span v-for="suffix in ['verify','enable','rollback','delete']" :key="suffix">
            <span v-if="btnMessages[`btn_model_${suffix}_${m.id}`]" :class="btnStates[`btn_model_${suffix}_${m.id}`] === 'error' ? 'msg--error' : 'msg--success'">{{ btnMessages[`btn_model_${suffix}_${m.id}`] }}</span>
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
.form-col { display: flex; flex-direction: column; gap: 10px; }
.msg-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; min-height: 20px; margin-top: 6px; }
.input { background: #0f172a; border: 1px solid #334155; color: #e2e8f0; padding: 6px 10px; border-radius: 6px; font-size: 13px; min-width: 100px; }
.input--sm { width: 100px; min-width: 80px; }
.input:focus { outline: none; border-color: #38bdf8; }
.btn { padding: 6px 14px; border-radius: 6px; border: none; font-size: 13px; cursor: pointer; transition: all 0.15s; background: #334155; color: #e2e8f0; }
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
.model-item { background: #0f172a; border: 1px solid #334155; border-radius: 6px; padding: 12px; margin-bottom: 8px; display: flex; flex-direction: column; gap: 8px; }
.model-info { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.model-name { font-size: 14px; font-weight: 600; color: #e2e8f0; }
.model-meta { font-size: 12px; color: #94a3b8; }
.model-path { font-size: 11px; color: #475569; font-family: monospace; flex: 1; }
.status-badge { font-size: 11px; font-weight: 600; padding: 1px 6px; border-radius: 99px; background: #1e293b; }
.verify-report { font-size: 12px; color: #4ade80; background: #052e16; padding: 6px 10px; border-radius: 4px; }
.model-actions { display: flex; flex-wrap: wrap; gap: 6px; }
</style>
