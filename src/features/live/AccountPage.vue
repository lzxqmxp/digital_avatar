<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { callApi } from '@shared/api/client'
import { useSessionStore } from '@shared/store/session'
import { writeAudit } from '@shared/api/audit'
import { ApiPaths } from '@shared/types/api'
import type { ButtonState } from '@shared/types/actions'
import type {
  AccountItem,
  AccountStatus,
  AccountListResponse,
  AccountCreateResponse,
  AccountAuthResponse,
  AccountStatusResponse,
  AccountHealthResponse,
  AccountDeleteResponse
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

const accounts = ref<AccountItem[]>([])
const newName = ref('')
const healthResults = ref<Record<string, { latency_ms: number; ok: boolean }>>({})

const statusColor: Record<AccountStatus, string> = {
  enabled: '#4ade80',
  disabled: '#94a3b8',
  expired: '#f87171'
}

async function loadAccounts() {
  const res = await callApi<AccountListResponse>(ApiPaths.ACCOUNTS_LIST, 'GET')
  if (res.ok && res.data) {
    accounts.value = res.data.items
  }
}

onMounted(loadAccounts)

// --- btn_account_new ---
async function onNew() {
  if (!newName.value.trim() || newName.value.trim().length > 30) {
    setBtn('btn_account_new', 'error', '账号名称无效（1-30字）')
    return
  }
  setBtn('btn_account_new', 'loading')
  const res = await callApi<AccountCreateResponse>(ApiPaths.ACCOUNTS_CREATE, 'POST', {
    name: newName.value.trim(),
    platform: 'douyin'
  })
  if (res.ok && res.data) {
    accounts.value.push(res.data)
    newName.value = ''
    setBtn('btn_account_new', 'success', '账号已创建')
    writeAudit({ session_id: sessionStore.sessionId || '', button_id: 'btn_account_new', action: '新增账号', result: 'success' })
  } else {
    setBtn('btn_account_new', 'error', res.message || '创建失败')
    writeAudit({ session_id: sessionStore.sessionId || '', button_id: 'btn_account_new', action: '新增账号', result: 'failure', error_code: res.errorCode })
  }
}

// --- btn_account_auth ---
async function onAuth(id: string) {
  setBtn(`btn_account_auth_${id}`, 'loading')
  const res = await callApi<AccountAuthResponse>(ApiPaths.ACCOUNTS_AUTH, 'POST', { id })
  if (res.ok && res.data) {
    const idx = accounts.value.findIndex((a) => a.id === id)
    if (idx !== -1) accounts.value[idx] = { ...accounts.value[idx], status: 'enabled' }
    setBtn(`btn_account_auth_${id}`, 'success', '授权成功')
    writeAudit({ session_id: sessionStore.sessionId || '', button_id: 'btn_account_auth', action: '账号授权', result: 'success' })
  } else {
    setBtn(`btn_account_auth_${id}`, 'error', res.message || '授权失败')
    writeAudit({ session_id: sessionStore.sessionId || '', button_id: 'btn_account_auth', action: '账号授权', result: 'failure', error_code: res.errorCode })
  }
}

// --- btn_account_enable ---
async function onEnable(id: string) {
  setBtn(`btn_account_enable_${id}`, 'loading')
  const res = await callApi<AccountStatusResponse>(ApiPaths.ACCOUNTS_STATUS, 'POST', { id, status: 'enabled' as AccountStatus })
  if (res.ok && res.data) {
    const idx = accounts.value.findIndex((a) => a.id === id)
    if (idx !== -1) accounts.value[idx] = res.data
    setBtn(`btn_account_enable_${id}`, 'success', '已启用')
    writeAudit({ session_id: sessionStore.sessionId || '', button_id: 'btn_account_enable', action: '启用账号', result: 'success' })
  } else {
    setBtn(`btn_account_enable_${id}`, 'error', res.message || '启用失败')
    writeAudit({ session_id: sessionStore.sessionId || '', button_id: 'btn_account_enable', action: '启用账号', result: 'failure', error_code: res.errorCode })
  }
}

// --- btn_account_disable ---
async function onDisable(id: string) {
  setBtn(`btn_account_disable_${id}`, 'loading')
  const res = await callApi<AccountStatusResponse>(ApiPaths.ACCOUNTS_STATUS, 'POST', { id, status: 'disabled' as AccountStatus })
  if (res.ok && res.data) {
    const idx = accounts.value.findIndex((a) => a.id === id)
    if (idx !== -1) accounts.value[idx] = res.data
    setBtn(`btn_account_disable_${id}`, 'success', '已停用')
    writeAudit({ session_id: sessionStore.sessionId || '', button_id: 'btn_account_disable', action: '停用账号', result: 'success' })
  } else {
    setBtn(`btn_account_disable_${id}`, 'error', res.message || '停用失败')
    writeAudit({ session_id: sessionStore.sessionId || '', button_id: 'btn_account_disable', action: '停用账号', result: 'failure', error_code: res.errorCode })
  }
}

// --- btn_account_health_test ---
async function onHealthTest(id: string) {
  setBtn(`btn_account_health_test_${id}`, 'loading')
  const res = await callApi<AccountHealthResponse>(ApiPaths.ACCOUNTS_HEALTH, 'POST', { id })
  if (res.ok && res.data) {
    healthResults.value[id] = { latency_ms: res.data.latency_ms, ok: res.data.ok }
    setBtn(`btn_account_health_test_${id}`, 'success', `延迟 ${res.data.latency_ms}ms`)
    writeAudit({ session_id: sessionStore.sessionId || '', button_id: 'btn_account_health_test', action: '连通性测试', result: 'success' })
  } else {
    setBtn(`btn_account_health_test_${id}`, 'error', res.message || '测试失败')
    writeAudit({ session_id: sessionStore.sessionId || '', button_id: 'btn_account_health_test', action: '连通性测试', result: 'failure', error_code: res.errorCode })
  }
}

// --- btn_account_delete ---
async function onDelete(id: string) {
  setBtn(`btn_account_delete_${id}`, 'loading')
  const res = await callApi<AccountDeleteResponse>(ApiPaths.ACCOUNTS_DELETE, 'POST', { id })
  if (res.ok) {
    accounts.value = accounts.value.filter((a) => a.id !== id)
    setBtn(`btn_account_delete_${id}`, 'success', '已删除')
    writeAudit({ session_id: sessionStore.sessionId || '', button_id: 'btn_account_delete', action: '删除账号', result: 'success' })
  } else {
    setBtn(`btn_account_delete_${id}`, 'error', res.message || '删除失败')
    writeAudit({ session_id: sessionStore.sessionId || '', button_id: 'btn_account_delete', action: '删除账号', result: 'failure', error_code: res.errorCode })
  }
}
</script>

<template>
  <div class="page">
    <h1 class="page-title">直播账号</h1>

    <!-- New Account -->
    <section class="section">
      <h2 class="section-title">新增账号</h2>
      <div class="form-row">
        <input v-model="newName" class="input" placeholder="账号名称 (max 30)" maxlength="30" />
        <span class="platform-tag">抖音</span>
        <button id="btn_account_new" :class="btnClass('btn_account_new')" :disabled="!newName.trim() || btnStates['btn_account_new'] === 'loading'" @click="onNew">新增账号</button>
      </div>
      <div class="msg-row">
        <span v-if="btnMessages['btn_account_new']" :class="btnStates['btn_account_new'] === 'error' ? 'msg--error' : 'msg--success'">{{ btnMessages['btn_account_new'] }}</span>
      </div>
    </section>

    <!-- Account List -->
    <section class="section">
      <h2 class="section-title">账号列表 ({{ accounts.length }})</h2>
      <div v-if="accounts.length === 0" class="empty">暂无账号，请新增</div>
      <div v-for="acc in accounts" :key="acc.id" class="account-item">
        <div class="account-info">
          <span class="account-name">{{ acc.name }}</span>
          <span class="account-platform">{{ acc.platform }}</span>
          <span class="status-dot" :style="{ backgroundColor: statusColor[acc.status] }" />
          <span class="account-status" :style="{ color: statusColor[acc.status] }">{{ acc.status }}</span>
          <span v-if="healthResults[acc.id]" class="health-result" :class="healthResults[acc.id].ok ? 'health--ok' : 'health--fail'">
            {{ healthResults[acc.id].ok ? `✓ ${healthResults[acc.id].latency_ms}ms` : '✗ 不可用' }}
          </span>
        </div>
        <div class="account-actions">
          <button :id="`btn_account_auth_${acc.id}`" :class="btnClass(`btn_account_auth_${acc.id}`)" :disabled="btnStates[`btn_account_auth_${acc.id}`] === 'loading'" @click="onAuth(acc.id)">授权登录</button>
          <button :id="`btn_account_enable_${acc.id}`" :class="btnClass(`btn_account_enable_${acc.id}`)" :disabled="acc.status === 'enabled' || btnStates[`btn_account_enable_${acc.id}`] === 'loading'" @click="onEnable(acc.id)">启用</button>
          <button :id="`btn_account_disable_${acc.id}`" :class="btnClass(`btn_account_disable_${acc.id}`)" :disabled="acc.status !== 'enabled' || btnStates[`btn_account_disable_${acc.id}`] === 'loading'" @click="onDisable(acc.id)">停用</button>
          <button :id="`btn_account_health_test_${acc.id}`" :class="btnClass(`btn_account_health_test_${acc.id}`)" :disabled="acc.status !== 'enabled' || btnStates[`btn_account_health_test_${acc.id}`] === 'loading'" @click="onHealthTest(acc.id)">连通性测试</button>
          <button :id="`btn_account_delete_${acc.id}`" :class="[...btnClass(`btn_account_delete_${acc.id}`), 'btn--danger']" :disabled="acc.status === 'enabled' || btnStates[`btn_account_delete_${acc.id}`] === 'loading'" @click="onDelete(acc.id)">删除</button>
        </div>
        <div class="msg-row">
          <span v-for="suffix in ['auth','enable','disable','health_test','delete']" :key="suffix">
            <span v-if="btnMessages[`btn_account_${suffix}_${acc.id}`]" :class="btnStates[`btn_account_${suffix}_${acc.id}`] === 'error' ? 'msg--error' : 'msg--success'">{{ btnMessages[`btn_account_${suffix}_${acc.id}`] }}</span>
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
.input { background: #0f172a; border: 1px solid #334155; color: #e2e8f0; padding: 6px 10px; border-radius: 6px; font-size: 13px; min-width: 160px; }
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
.platform-tag { font-size: 11px; background: #1e3a5f; color: #7dd3fc; padding: 2px 8px; border-radius: 99px; }
.account-item { background: #0f172a; border: 1px solid #334155; border-radius: 6px; padding: 12px; margin-bottom: 8px; display: flex; flex-direction: column; gap: 8px; }
.account-info { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
.account-name { font-size: 14px; font-weight: 600; color: #e2e8f0; }
.account-platform { font-size: 11px; background: #1e3a5f; color: #7dd3fc; padding: 1px 6px; border-radius: 99px; }
.status-dot { width: 8px; height: 8px; border-radius: 50%; flex-shrink: 0; }
.account-status { font-size: 11px; font-weight: 600; }
.health-result { font-size: 11px; padding: 1px 6px; border-radius: 4px; }
.health--ok { color: #4ade80; background: #052e16; }
.health--fail { color: #f87171; background: #450a0a; }
.account-actions { display: flex; flex-wrap: wrap; gap: 6px; }
</style>
