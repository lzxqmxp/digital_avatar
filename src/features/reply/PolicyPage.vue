<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { callApi } from '@shared/api/client'
import { useSessionStore } from '@shared/store/session'
import { writeAudit } from '@shared/api/audit'
import { ApiPaths } from '@shared/types/api'
import type { ButtonState } from '@shared/types/actions'
import type {
  PolicyItem,
  PolicyRiskMode,
  PolicyListResponse,
  PolicyCreateResponse,
  PolicySaveResponse,
  PolicyTestResponse,
  PolicyPublishResponse,
  PolicyRollbackResponse
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

const policies = ref<PolicyItem[]>([])
const selectedPolicy = ref<PolicyItem | null>(null)
const newPolicyName = ref('')
const editTemp = ref(0.8)
const editMaxLen = ref(80)
const editRiskMode = ref<PolicyRiskMode>('semi')
const sampleText = ref('')
const testReply = ref('')
const rollbackVersion = ref(1)

async function loadPolicies() {
  const res = await callApi<PolicyListResponse>(ApiPaths.POLICIES_LIST, 'GET')
  if (res.ok && res.data) {
    policies.value = res.data.items
    if (policies.value.length > 0 && !selectedPolicy.value) {
      selectPolicy(policies.value[0])
    }
  }
}

function selectPolicy(p: PolicyItem) {
  selectedPolicy.value = p
  editTemp.value = p.temperature
  editMaxLen.value = p.max_reply_len
  editRiskMode.value = p.risk_mode
  rollbackVersion.value = Math.max(1, p.version - 1)
  testReply.value = ''
}

onMounted(loadPolicies)

// --- btn_policy_new ---
async function onNew() {
  if (!newPolicyName.value.trim() || newPolicyName.value.trim().length > 40) {
    setBtn('btn_policy_new', 'error', '策略名称无效（1-40字）')
    return
  }
  setBtn('btn_policy_new', 'loading')
  const res = await callApi<PolicyCreateResponse>(ApiPaths.POLICIES_CREATE, 'POST', {
    name: newPolicyName.value.trim()
  })
  if (res.ok && res.data) {
    policies.value.push(res.data)
    selectPolicy(res.data)
    newPolicyName.value = ''
    setBtn('btn_policy_new', 'success', '新建成功')
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_policy_new',
      action: '新建策略',
      result: 'success'
    })
  } else {
    setBtn('btn_policy_new', 'error', res.message || '新建失败')
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_policy_new',
      action: '新建策略',
      result: 'failure',
      error_code: res.errorCode
    })
  }
}

// --- btn_policy_save ---
async function onSave() {
  if (!selectedPolicy.value) {
    setBtn('btn_policy_save', 'error', '请先选择或新建策略')
    return
  }
  if (editTemp.value < 0.2 || editTemp.value > 1.2) {
    setBtn('btn_policy_save', 'error', 'temperature 范围 0.2-1.2')
    return
  }
  if (editMaxLen.value < 20 || editMaxLen.value > 120) {
    setBtn('btn_policy_save', 'error', '最大回复长度 20-120')
    return
  }
  setBtn('btn_policy_save', 'loading')
  const res = await callApi<PolicySaveResponse>(ApiPaths.POLICIES_SAVE, 'POST', {
    id: selectedPolicy.value.id,
    temperature: editTemp.value,
    max_reply_len: editMaxLen.value,
    risk_mode: editRiskMode.value
  })
  if (res.ok && res.data) {
    const idx = policies.value.findIndex((p) => p.id === res.data!.id)
    if (idx !== -1) policies.value[idx] = res.data
    selectedPolicy.value = res.data
    setBtn('btn_policy_save', 'success', `策略已保存 (v${res.data.version})`)
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_policy_save',
      action: '保存策略',
      result: 'success'
    })
  } else {
    setBtn('btn_policy_save', 'error', res.message || '保存失败')
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_policy_save',
      action: '保存策略',
      result: 'failure',
      error_code: res.errorCode
    })
  }
}

// --- btn_policy_test ---
async function onTest() {
  if (!selectedPolicy.value) {
    setBtn('btn_policy_test', 'error', '请先选择策略')
    return
  }
  if (!sampleText.value.trim()) {
    setBtn('btn_policy_test', 'error', '请输入样本文本')
    return
  }
  setBtn('btn_policy_test', 'loading')
  testReply.value = ''
  const res = await callApi<PolicyTestResponse>(ApiPaths.POLICIES_TEST, 'POST', {
    id: selectedPolicy.value.id,
    sample_text: sampleText.value.trim()
  })
  if (res.ok && res.data) {
    testReply.value = res.data.reply
    setBtn('btn_policy_test', 'success', `测试成功 (${res.data.tokens_used} tokens)`)
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_policy_test',
      action: '策略测试',
      result: 'success'
    })
  } else {
    setBtn('btn_policy_test', 'error', res.message || '测试失败')
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_policy_test',
      action: '策略测试',
      result: 'failure',
      error_code: res.errorCode
    })
  }
}

// --- btn_policy_publish ---
async function onPublish() {
  if (!selectedPolicy.value) {
    setBtn('btn_policy_publish', 'error', '请先选择策略')
    return
  }
  setBtn('btn_policy_publish', 'loading')
  const res = await callApi<PolicyPublishResponse>(ApiPaths.POLICIES_PUBLISH, 'POST', {
    id: selectedPolicy.value.id
  })
  if (res.ok && res.data) {
    await loadPolicies()
    setBtn('btn_policy_publish', 'success', '策略已生效')
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_policy_publish',
      action: '发布策略',
      result: 'success'
    })
  } else {
    setBtn('btn_policy_publish', 'error', res.message || '发布失败')
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_policy_publish',
      action: '发布策略',
      result: 'failure',
      error_code: res.errorCode
    })
  }
}

// --- btn_policy_rollback ---
async function onRollback() {
  if (!selectedPolicy.value) {
    setBtn('btn_policy_rollback', 'error', '请先选择策略')
    return
  }
  if (selectedPolicy.value.version <= 1) {
    setBtn('btn_policy_rollback', 'error', '无历史版本可回滚')
    return
  }
  setBtn('btn_policy_rollback', 'loading')
  const res = await callApi<PolicyRollbackResponse>(ApiPaths.POLICIES_ROLLBACK, 'POST', {
    id: selectedPolicy.value.id,
    target_version: rollbackVersion.value
  })
  if (res.ok && res.data) {
    await loadPolicies()
    setBtn('btn_policy_rollback', 'success', `已回滚到 v${res.data.version}`)
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_policy_rollback',
      action: '回滚策略',
      result: 'success'
    })
  } else {
    setBtn('btn_policy_rollback', 'error', res.message || '回滚失败')
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_policy_rollback',
      action: '回滚策略',
      result: 'failure',
      error_code: res.errorCode
    })
  }
}

const statusColor: Record<string, string> = {
  active: '#4ade80',
  inactive: '#94a3b8',
  draft: '#fbbf24'
}
const riskModeOptions: { value: PolicyRiskMode; label: string }[] = [
  { value: 'manual', label: '纯人工' },
  { value: 'semi', label: '半自动' },
  { value: 'auto', label: '全自动' }
]
</script>

<template>
  <div class="page">
    <h1 class="page-title">AI回复策略</h1>

    <!-- Policy List -->
    <section class="section">
      <h2 class="section-title">策略列表</h2>
      <div class="form-row">
        <input
          v-model="newPolicyName"
          class="input"
          placeholder="新策略名称 (max 40)"
          maxlength="40"
        />
        <button
          id="btn_policy_new"
          :class="btnClass('btn_policy_new')"
          :disabled="btnStates['btn_policy_new'] === 'loading'"
          @click="onNew"
        >
          新建策略
        </button>
      </div>
      <div class="msg-row">
        <span
          v-if="btnMessages['btn_policy_new']"
          :class="btnStates['btn_policy_new'] === 'error' ? 'msg--error' : 'msg--success'"
          >{{ btnMessages['btn_policy_new'] }}</span
        >
      </div>
      <div class="policy-list">
        <div
          v-for="p in policies"
          :key="p.id"
          class="policy-item"
          :class="{ 'policy-item--active': selectedPolicy?.id === p.id }"
          @click="selectPolicy(p)"
        >
          <span class="policy-name">{{ p.name }}</span>
          <span class="policy-version">v{{ p.version }}</span>
          <span
            class="status-dot"
            :style="{ backgroundColor: statusColor[p.status] || '#94a3b8' }"
          />
          <span class="policy-status">{{ p.status }}</span>
        </div>
        <div v-if="policies.length === 0" class="empty">暂无策略</div>
      </div>
    </section>

    <!-- Editor -->
    <section class="section" v-if="selectedPolicy">
      <h2 class="section-title">编辑策略：{{ selectedPolicy.name }}</h2>
      <div class="form-col">
        <div class="form-row">
          <label class="field-label">Temperature (0.2-1.2)</label>
          <input
            v-model.number="editTemp"
            class="input input--sm"
            type="number"
            step="0.1"
            min="0.2"
            max="1.2"
          />
          <label class="field-label">最大回复长度 (20-120)</label>
          <input
            v-model.number="editMaxLen"
            class="input input--sm"
            type="number"
            step="1"
            min="20"
            max="120"
          />
        </div>
        <div class="form-row">
          <label class="field-label">风控模式</label>
          <select v-model="editRiskMode" class="input">
            <option v-for="opt in riskModeOptions" :key="opt.value" :value="opt.value">
              {{ opt.label }}
            </option>
          </select>
          <button
            id="btn_policy_save"
            :class="btnClass('btn_policy_save')"
            :disabled="btnStates['btn_policy_save'] === 'loading'"
            @click="onSave"
          >
            保存策略
          </button>
          <button
            id="btn_policy_publish"
            :class="btnClass('btn_policy_publish')"
            :disabled="btnStates['btn_policy_publish'] === 'loading'"
            @click="onPublish"
          >
            发布策略
          </button>
        </div>
        <div class="msg-row">
          <span v-for="id in ['btn_policy_save', 'btn_policy_publish']" :key="id">
            <span
              v-if="btnMessages[id]"
              :class="btnStates[id] === 'error' ? 'msg--error' : 'msg--success'"
              >{{ btnMessages[id] }}</span
            >
          </span>
        </div>
        <div class="form-row">
          <label class="field-label">回滚到版本</label>
          <input
            v-model.number="rollbackVersion"
            class="input input--sm"
            type="number"
            step="1"
            min="1"
            :max="selectedPolicy.version - 1"
          />
          <button
            id="btn_policy_rollback"
            :class="btnClass('btn_policy_rollback')"
            :disabled="
              selectedPolicy.version <= 1 || btnStates['btn_policy_rollback'] === 'loading'
            "
            @click="onRollback"
          >
            回滚策略
          </button>
        </div>
        <div class="msg-row">
          <span
            v-if="btnMessages['btn_policy_rollback']"
            :class="btnStates['btn_policy_rollback'] === 'error' ? 'msg--error' : 'msg--success'"
            >{{ btnMessages['btn_policy_rollback'] }}</span
          >
        </div>
      </div>
    </section>

    <!-- Test -->
    <section class="section" v-if="selectedPolicy">
      <h2 class="section-title">策略测试</h2>
      <div class="form-col">
        <div class="form-row">
          <input v-model="sampleText" class="input input--wide" placeholder="输入测试文本" />
          <button
            id="btn_policy_test"
            :class="btnClass('btn_policy_test')"
            :disabled="btnStates['btn_policy_test'] === 'loading'"
            @click="onTest"
          >
            策略测试
          </button>
        </div>
        <div v-if="testReply" class="reply-box">{{ testReply }}</div>
        <div class="msg-row">
          <span
            v-if="btnMessages['btn_policy_test']"
            :class="btnStates['btn_policy_test'] === 'error' ? 'msg--error' : 'msg--success'"
            >{{ btnMessages['btn_policy_test'] }}</span
          >
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
  min-width: 100px;
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
  padding: 16px 0;
}
.policy-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  margin-top: 12px;
}
.policy-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  background: #0f172a;
  border-radius: 6px;
  cursor: pointer;
  border: 1px solid #334155;
  transition: border-color 0.15s;
}
.policy-item--active {
  border-color: #38bdf8;
}
.policy-item:hover {
  border-color: #475569;
}
.policy-name {
  flex: 1;
  font-size: 13px;
  font-weight: 600;
  color: #e2e8f0;
}
.policy-version {
  font-size: 11px;
  color: #94a3b8;
}
.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}
.policy-status {
  font-size: 11px;
  color: #94a3b8;
}
.reply-box {
  background: #0f172a;
  border: 1px solid #334155;
  border-radius: 6px;
  padding: 10px 12px;
  font-size: 13px;
  color: #94a3b8;
  min-height: 40px;
}
</style>
