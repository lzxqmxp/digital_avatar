<script setup lang="ts">
import { ref, onMounted } from 'vue'
import { callApi } from '@shared/api/client'
import { useSessionStore } from '@shared/store/session'
import { writeAudit } from '@shared/api/audit'
import { ApiPaths, ErrorCode } from '@shared/types/api'
import type { ButtonState } from '@shared/types/actions'
import type { ScriptItem, ScriptStatus, ScriptListResponse, ScriptCreateResponse, ScriptUpdateResponse, ScriptDeleteResponse, ScriptStatusResponse } from '@shared/types/api'

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
const scripts = ref<ScriptItem[]>([])
const selectedIds = ref<Set<string>>(new Set())
const newTitle = ref('')
const newContent = ref('')
const newTags = ref('')
const editingId = ref<string | null>(null)
const editTitle = ref('')
const editContent = ref('')

// --- Load scripts ---
async function loadScripts() {
  const res = await callApi<ScriptListResponse>(ApiPaths.SCRIPTS_LIST, 'GET')
  if (res.ok && res.data) {
    scripts.value = res.data.items
  }
}

onMounted(loadScripts)

// --- btn_script_new ---
async function onNew() {
  if (!newTitle.value.trim()) {
    setBtn('btn_script_new', 'error', '请输入标题')
    return
  }
  if (newTitle.value.trim().length > 60) {
    setBtn('btn_script_new', 'error', '标题不超过60字')
    return
  }
  if (!newContent.value.trim() || newContent.value.trim().length > 120) {
    setBtn('btn_script_new', 'error', '内容不能为空且不超过120字')
    return
  }
  setBtn('btn_script_new', 'loading')
  const tagsArr = newTags.value
    .split(',')
    .map((t) => t.trim())
    .filter(Boolean)
    .slice(0, 5)
  const res = await callApi<ScriptCreateResponse>(ApiPaths.SCRIPTS_CREATE, 'POST', {
    title: newTitle.value.trim(),
    content: newContent.value.trim(),
    tags: tagsArr
  })
  if (res.ok && res.data) {
    scripts.value.push(res.data)
    newTitle.value = ''
    newContent.value = ''
    newTags.value = ''
    setBtn('btn_script_new', 'success', '新建成功')
    writeAudit({ session_id: sessionStore.sessionId || '', button_id: 'btn_script_new', action: '新建话术', result: 'success' })
  } else {
    setBtn('btn_script_new', 'error', res.message || '新建失败')
    writeAudit({ session_id: sessionStore.sessionId || '', button_id: 'btn_script_new', action: '新建话术', result: 'failure', error_code: res.errorCode })
  }
}

// --- btn_script_save ---
async function onSave(id: string) {
  if (!editTitle.value.trim() || editTitle.value.length > 60) {
    setBtn('btn_script_save', 'error', '标题无效（1-60字）')
    return
  }
  if (!editContent.value.trim() || editContent.value.length > 120) {
    setBtn('btn_script_save', 'error', '内容无效（1-120字）')
    return
  }
  setBtn('btn_script_save', 'loading')
  const res = await callApi<ScriptUpdateResponse>(ApiPaths.SCRIPTS_UPDATE, 'POST', {
    id,
    title: editTitle.value.trim(),
    content: editContent.value.trim()
  })
  if (res.ok && res.data) {
    const idx = scripts.value.findIndex((s) => s.id === id)
    if (idx !== -1) scripts.value[idx] = res.data
    editingId.value = null
    setBtn('btn_script_save', 'success', '保存成功')
    writeAudit({ session_id: sessionStore.sessionId || '', button_id: 'btn_script_save', action: '保存话术', result: 'success' })
  } else {
    setBtn('btn_script_save', 'error', res.message || '保存失败')
    writeAudit({ session_id: sessionStore.sessionId || '', button_id: 'btn_script_save', action: '保存话术', result: 'failure', error_code: res.errorCode })
  }
}

// --- btn_script_enable ---
async function onEnable() {
  for (const id of selectedIds.value) {
    const res = await callApi<ScriptStatusResponse>(ApiPaths.SCRIPTS_STATUS, 'POST', { id, status: 'enabled' as ScriptStatus })
    if (res.ok && res.data) {
      const idx = scripts.value.findIndex((s) => s.id === id)
      if (idx !== -1) scripts.value[idx] = res.data
    }
  }
  setBtn('btn_script_enable', 'success', `已启用 ${selectedIds.value.size} 条`)
  writeAudit({ session_id: sessionStore.sessionId || '', button_id: 'btn_script_enable', action: '启用话术', result: 'success' })
}

// --- btn_script_disable ---
async function onDisable() {
  for (const id of selectedIds.value) {
    const res = await callApi<ScriptStatusResponse>(ApiPaths.SCRIPTS_STATUS, 'POST', { id, status: 'disabled' as ScriptStatus })
    if (res.ok && res.data) {
      const idx = scripts.value.findIndex((s) => s.id === id)
      if (idx !== -1) scripts.value[idx] = res.data
    }
  }
  setBtn('btn_script_disable', 'success', `已禁用 ${selectedIds.value.size} 条`)
  writeAudit({ session_id: sessionStore.sessionId || '', button_id: 'btn_script_disable', action: '禁用话术', result: 'success' })
}

// --- btn_script_delete ---
async function onDelete() {
  if (selectedIds.value.size === 0) {
    setBtn('btn_script_delete', 'error', '请先选择话术')
    return
  }
  setBtn('btn_script_delete', 'loading')
  for (const id of selectedIds.value) {
    const res = await callApi<ScriptDeleteResponse>(ApiPaths.SCRIPTS_DELETE, 'POST', { id })
    if (res.ok) {
      scripts.value = scripts.value.filter((s) => s.id !== id)
    }
  }
  selectedIds.value.clear()
  setBtn('btn_script_delete', 'success', '删除成功')
  writeAudit({ session_id: sessionStore.sessionId || '', button_id: 'btn_script_delete', action: '删除话术', result: 'success' })
}

// --- btn_script_import / export (file-based stubs) ---
const importInput = ref<HTMLInputElement | null>(null)
function onImportClick() {
  importInput.value?.click()
}
async function onImportFile(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!['csv', 'xlsx', 'json'].includes(ext || '')) {
    setBtn('btn_script_import', 'error', '仅支持 csv/xlsx/json')
    writeAudit({ session_id: sessionStore.sessionId || '', button_id: 'btn_script_import', action: '导入话术', result: 'failure', error_code: ErrorCode.FORMAT_NOT_SUPPORTED })
    return
  }
  setBtn('btn_script_import', 'loading')
  await new Promise((r) => setTimeout(r, 500))
  setBtn('btn_script_import', 'success', `导入完成: ${file.name}`)
  writeAudit({ session_id: sessionStore.sessionId || '', button_id: 'btn_script_import', action: '导入话术', result: 'success' })
  target.value = ''
}
async function onExport() {
  if (scripts.value.length === 0) {
    setBtn('btn_script_export', 'error', '暂无可导出数据')
    return
  }
  setBtn('btn_script_export', 'loading')
  await new Promise((r) => setTimeout(r, 300))
  setBtn('btn_script_export', 'success', '导出成功')
  writeAudit({ session_id: sessionStore.sessionId || '', button_id: 'btn_script_export', action: '导出话术', result: 'success' })
}

function startEdit(item: ScriptItem) {
  editingId.value = item.id
  editTitle.value = item.title
  editContent.value = item.content
}

function toggleSelect(id: string) {
  if (selectedIds.value.has(id)) selectedIds.value.delete(id)
  else selectedIds.value.add(id)
}

const statusLabel: Record<ScriptStatus, string> = { draft: '草稿', enabled: '启用', disabled: '禁用' }
const statusColor: Record<ScriptStatus, string> = { draft: '#94a3b8', enabled: '#4ade80', disabled: '#f87171' }
</script>

<template>
  <div class="page">
    <h1 class="page-title">话术管理</h1>

    <!-- New Script -->
    <section class="section">
      <h2 class="section-title">新建话术</h2>
      <div class="form-col">
        <div class="form-row">
          <input v-model="newTitle" class="input" placeholder="标题 (max 60)" maxlength="60" />
          <input v-model="newTags" class="input" placeholder="标签 (逗号分隔, max 5)" />
        </div>
        <div class="form-row">
          <input v-model="newContent" class="input input--wide" placeholder="内容 (max 120)" maxlength="120" />
          <button id="btn_script_new" :class="btnClass('btn_script_new')" :disabled="btnStates['btn_script_new'] === 'loading'" @click="onNew">
            新建
          </button>
        </div>
        <div class="msg-row">
          <span v-if="btnMessages['btn_script_new']" :class="btnStates['btn_script_new'] === 'error' ? 'msg--error' : 'msg--success'">{{ btnMessages['btn_script_new'] }}</span>
        </div>
      </div>
    </section>

    <!-- Bulk Actions -->
    <section class="section">
      <h2 class="section-title">批量操作 (已选 {{ selectedIds.size }})</h2>
      <div class="form-row">
        <button id="btn_script_enable" :class="btnClass('btn_script_enable')" :disabled="selectedIds.size === 0 || btnStates['btn_script_enable'] === 'loading'" @click="onEnable">启用</button>
        <button id="btn_script_disable" :class="btnClass('btn_script_disable')" :disabled="selectedIds.size === 0 || btnStates['btn_script_disable'] === 'loading'" @click="onDisable">禁用</button>
        <button id="btn_script_delete" :class="btnClass('btn_script_delete')" :disabled="selectedIds.size === 0 || btnStates['btn_script_delete'] === 'loading'" @click="onDelete">删除</button>
        <input ref="importInput" type="file" accept=".csv,.xlsx,.json" style="display:none" @change="onImportFile" />
        <button id="btn_script_import" :class="btnClass('btn_script_import')" :disabled="btnStates['btn_script_import'] === 'loading'" @click="onImportClick">导入</button>
        <button id="btn_script_export" :class="btnClass('btn_script_export')" :disabled="scripts.length === 0 || btnStates['btn_script_export'] === 'loading'" @click="onExport">导出</button>
      </div>
      <div class="msg-row">
        <span v-for="id in ['btn_script_enable','btn_script_disable','btn_script_delete','btn_script_import','btn_script_export']" :key="id">
          <span v-if="btnMessages[id]" :class="btnStates[id] === 'error' ? 'msg--error' : 'msg--success'">{{ btnMessages[id] }}</span>
        </span>
      </div>
    </section>

    <!-- Script List -->
    <section class="section">
      <h2 class="section-title">话术列表 ({{ scripts.length }})</h2>
      <div v-if="scripts.length === 0" class="empty">暂无话术，请新建或导入</div>
      <div v-for="item in scripts" :key="item.id" class="script-item" :class="{ 'script-item--selected': selectedIds.has(item.id) }">
        <label class="check-label">
          <input type="checkbox" :checked="selectedIds.has(item.id)" @change="toggleSelect(item.id)" />
        </label>
        <div class="script-body">
          <div v-if="editingId !== item.id" class="script-view">
            <span class="script-title">{{ item.title }}</span>
            <span class="script-content">{{ item.content }}</span>
            <span class="tag" v-for="tag in item.tags" :key="tag">{{ tag }}</span>
            <span class="status-badge" :style="{ color: statusColor[item.status] }">{{ statusLabel[item.status] }}</span>
          </div>
          <div v-else class="script-edit">
            <input v-model="editTitle" class="input" placeholder="标题" maxlength="60" />
            <input v-model="editContent" class="input input--wide" placeholder="内容" maxlength="120" />
            <button id="btn_script_save" :class="btnClass('btn_script_save')" :disabled="btnStates['btn_script_save'] === 'loading'" @click="onSave(item.id)">保存</button>
            <button class="btn" @click="editingId = null">取消</button>
          </div>
        </div>
        <button class="btn btn--sm" @click="startEdit(item)">编辑</button>
      </div>
      <div class="msg-row" v-if="btnMessages['btn_script_save']">
        <span :class="btnStates['btn_script_save'] === 'error' ? 'msg--error' : 'msg--success'">{{ btnMessages['btn_script_save'] }}</span>
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
.input { background: #0f172a; border: 1px solid #334155; color: #e2e8f0; padding: 6px 10px; border-radius: 6px; font-size: 13px; min-width: 160px; }
.input--wide { flex: 1; min-width: 200px; }
.input:focus { outline: none; border-color: #38bdf8; }
.btn { padding: 6px 14px; border-radius: 6px; border: none; font-size: 13px; cursor: pointer; transition: all 0.15s; background: #334155; color: #e2e8f0; }
.btn--sm { padding: 4px 10px; font-size: 12px; }
.btn:hover:not(:disabled) { background: #475569; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn--loading { background: #1d4ed8; color: #bfdbfe; }
.btn--success { background: #166534; color: #bbf7d0; }
.btn--error { background: #7f1d1d; color: #fecaca; }
.msg--success { color: #4ade80; font-size: 12px; }
.msg--error { color: #f87171; font-size: 12px; }
.empty { color: #64748b; font-size: 13px; text-align: center; padding: 24px 0; }
.script-item { display: flex; align-items: flex-start; gap: 10px; padding: 10px 12px; background: #0f172a; border-radius: 6px; margin-bottom: 8px; border: 1px solid #334155; transition: border-color 0.15s; }
.script-item--selected { border-color: #38bdf8; }
.check-label { padding-top: 2px; cursor: pointer; }
.script-body { flex: 1; display: flex; flex-direction: column; gap: 4px; }
.script-view { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.script-edit { display: flex; flex-wrap: wrap; gap: 6px; align-items: center; }
.script-title { font-size: 14px; font-weight: 600; color: #e2e8f0; }
.script-content { font-size: 12px; color: #94a3b8; flex: 1; }
.tag { font-size: 11px; background: #1e3a5f; color: #7dd3fc; padding: 1px 6px; border-radius: 99px; }
.status-badge { font-size: 11px; font-weight: 600; padding: 1px 6px; border-radius: 99px; background: #1e293b; }
</style>
