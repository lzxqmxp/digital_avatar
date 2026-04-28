<script setup lang="ts">
import { ref } from 'vue'
import { useAvatarStore, type AvatarEngine } from '@shared/store/avatar'
import { useSessionStore } from '@shared/store/session'
import { writeAudit } from '@shared/api/audit'
import type { ButtonState } from '@shared/types/actions'

const avatarStore = useAvatarStore()
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

// --- btn_avatar_pick_asset ---
const fileInput = ref<HTMLInputElement | null>(null)

function onPickAsset() {
  fileInput.value?.click()
}

function onFileChange(e: Event) {
  const target = e.target as HTMLInputElement
  const file = target.files?.[0]
  if (!file) return
  const ext = file.name.split('.').pop()?.toLowerCase()
  if (!['mp4', 'avi', 'mov', 'mkv'].includes(ext || '')) {
    setBtn('btn_avatar_pick_asset', 'error', '格式不支持，请选择视频文件')
    writeAudit({ session_id: sessionStore.sessionId || '', button_id: 'btn_avatar_pick_asset', action: '选择形象资产', result: 'failure', error_code: 'FORMAT_NOT_SUPPORTED' })
    return
  }
  avatarStore.pickAsset(file.name)
  setBtn('btn_avatar_pick_asset', 'success', `已选择: ${file.name}`)
  writeAudit({ session_id: sessionStore.sessionId || '', button_id: 'btn_avatar_pick_asset', action: '选择形象资产', result: 'success' })
}

// --- sel_avatar_engine ---
function onEngineChange(e: Event) {
  const target = e.target as HTMLSelectElement
  avatarStore.setEngine(target.value as AvatarEngine)
  writeAudit({ session_id: sessionStore.sessionId || '', button_id: 'sel_avatar_engine', action: '选择渲染引擎', result: 'success' })
}

// --- chk_avatar_camera_mode ---
function onCameraMode(e: Event) {
  const target = e.target as HTMLInputElement
  avatarStore.cameraMode = target.checked
  writeAudit({ session_id: sessionStore.sessionId || '', button_id: 'chk_avatar_camera_mode', action: '切换摄像头模式', result: 'success' })
}

// --- btn_avatar_refresh_audio ---
async function onRefreshAudio() {
  setBtn('btn_avatar_refresh_audio', 'loading')
  const res = await avatarStore.refreshAudio()
  if (res.ok) {
    setBtn('btn_avatar_refresh_audio', 'success', '音频设备已刷新')
    writeAudit({ session_id: sessionStore.sessionId || '', button_id: 'btn_avatar_refresh_audio', action: '刷新音频设备列表', result: 'success' })
  } else {
    setBtn('btn_avatar_refresh_audio', 'error', '刷新失败')
    writeAudit({ session_id: sessionStore.sessionId || '', button_id: 'btn_avatar_refresh_audio', action: '刷新音频设备列表', result: 'failure' })
  }
}

// --- btn_avatar_show_preview ---
async function onShowPreview() {
  setBtn('btn_avatar_show_preview', 'loading')
  const res = await avatarStore.showPreview()
  if (res.ok) {
    setBtn('btn_avatar_show_preview', 'success', `预览地址: ${res.data?.stream_url || 'N/A'}`)
    writeAudit({ session_id: sessionStore.sessionId || '', button_id: 'btn_avatar_show_preview', action: '显示数字人预览', result: 'success' })
  } else {
    setBtn('btn_avatar_show_preview', 'error', '预览失败')
    writeAudit({ session_id: sessionStore.sessionId || '', button_id: 'btn_avatar_show_preview', action: '显示数字人预览', result: 'failure' })
  }
}

// --- btn_avatar_start ---
async function onStart() {
  setBtn('btn_avatar_start', 'loading')
  const res = await avatarStore.start()
  if (res.ok) {
    setBtn('btn_avatar_start', 'success', `数字人已启动 (${res.data?.stream_url})`)
    writeAudit({ session_id: sessionStore.sessionId || '', button_id: 'btn_avatar_start', action: '启动数字人渲染', result: 'success' })
  } else {
    setBtn('btn_avatar_start', 'error', res.message || '启动失败')
    writeAudit({ session_id: sessionStore.sessionId || '', button_id: 'btn_avatar_start', action: '启动数字人渲染', result: 'failure', error_code: res.errorCode })
  }
}

// --- btn_avatar_stop ---
async function onStop() {
  setBtn('btn_avatar_stop', 'loading')
  const res = await avatarStore.stop()
  if (res.ok) {
    setBtn('btn_avatar_stop', 'success', '数字人已停止')
    writeAudit({ session_id: sessionStore.sessionId || '', button_id: 'btn_avatar_stop', action: '停止数字人渲染', result: 'success' })
  } else {
    setBtn('btn_avatar_stop', 'error', res.message || '停止失败')
    writeAudit({ session_id: sessionStore.sessionId || '', button_id: 'btn_avatar_stop', action: '停止数字人渲染', result: 'failure', error_code: res.errorCode })
  }
}
</script>

<template>
  <div class="page">
    <h1 class="page-title">数字人</h1>

    <!-- Asset & Engine -->
    <section class="section">
      <h2 class="section-title">素材与引擎配置</h2>
      <div class="form-row">
        <input ref="fileInput" type="file" accept=".mp4,.avi,.mov,.mkv" style="display:none" @change="onFileChange" />
        <button
          id="btn_avatar_pick_asset"
          :class="btnClass('btn_avatar_pick_asset')"
          @click="onPickAsset"
        >
          选择视频素材
        </button>
        <span class="asset-name">{{ avatarStore.selectedAsset || '未选择素材' }}</span>
      </div>
      <div class="msg-row">
        <span v-if="btnMessages['btn_avatar_pick_asset']" :class="btnStates['btn_avatar_pick_asset'] === 'error' ? 'msg--error' : 'msg--success'">{{ btnMessages['btn_avatar_pick_asset'] }}</span>
      </div>

      <div class="form-row" style="margin-top: 12px;">
        <label class="field-label">渲染引擎</label>
        <select
          id="sel_avatar_engine"
          class="select"
          :value="avatarStore.engine"
          @change="onEngineChange"
        >
          <option value="Wav2Lip">Wav2Lip</option>
          <option value="SadTalker">SadTalker</option>
          <option value="DiffTalk">DiffTalk</option>
        </select>

        <label class="toggle-label" id="chk_avatar_camera_mode">
          <input type="checkbox" :checked="avatarStore.cameraMode" @change="onCameraMode" />
          <span>摄像头模式</span>
        </label>
      </div>
    </section>

    <!-- Audio & Preview -->
    <section class="section">
      <h2 class="section-title">音频与预览</h2>
      <div class="form-row">
        <button
          id="btn_avatar_refresh_audio"
          :class="btnClass('btn_avatar_refresh_audio')"
          :disabled="btnStates['btn_avatar_refresh_audio'] === 'loading'"
          @click="onRefreshAudio"
        >
          {{ btnStates['btn_avatar_refresh_audio'] === 'loading' ? '刷新中...' : '刷新音频设备' }}
        </button>
        <button
          id="btn_avatar_show_preview"
          :class="btnClass('btn_avatar_show_preview')"
          :disabled="btnStates['btn_avatar_show_preview'] === 'loading'"
          @click="onShowPreview"
        >
          显示播放窗口
        </button>
      </div>
      <div class="msg-row">
        <span v-if="btnMessages['btn_avatar_refresh_audio']" :class="btnStates['btn_avatar_refresh_audio'] === 'error' ? 'msg--error' : 'msg--success'">{{ btnMessages['btn_avatar_refresh_audio'] }}</span>
        <span v-if="btnMessages['btn_avatar_show_preview']" :class="btnStates['btn_avatar_show_preview'] === 'error' ? 'msg--error' : 'msg--success'">{{ btnMessages['btn_avatar_show_preview'] }}</span>
      </div>
    </section>

    <!-- Start / Stop -->
    <section class="section">
      <h2 class="section-title">渲染控制</h2>
      <div class="form-row">
        <button
          id="btn_avatar_start"
          :class="btnClass('btn_avatar_start')"
          :disabled="btnStates['btn_avatar_start'] === 'loading' || !avatarStore.selectedAsset || avatarStore.isRunning"
          @click="onStart"
        >
          {{ btnStates['btn_avatar_start'] === 'loading' ? '启动中...' : '开启' }}
        </button>
        <button
          id="btn_avatar_stop"
          :class="btnClass('btn_avatar_stop')"
          :disabled="btnStates['btn_avatar_stop'] === 'loading' || !avatarStore.isRunning"
          @click="onStop"
        >
          停止
        </button>
        <span class="status-chip" :class="avatarStore.isRunning ? 'chip--green' : 'chip--gray'">
          {{ avatarStore.isRunning ? `运行中 (${avatarStore.engine})` : '已停止' }}
        </span>
      </div>
      <div class="msg-row">
        <span v-if="btnMessages['btn_avatar_start']" :class="btnStates['btn_avatar_start'] === 'error' ? 'msg--error' : 'msg--success'">{{ btnMessages['btn_avatar_start'] }}</span>
        <span v-if="btnMessages['btn_avatar_stop']" :class="btnStates['btn_avatar_stop'] === 'error' ? 'msg--error' : 'msg--success'">{{ btnMessages['btn_avatar_stop'] }}</span>
      </div>
      <div v-if="avatarStore.streamUrl" class="stream-url">
        流地址: <code>{{ avatarStore.streamUrl }}</code>
      </div>
    </section>
  </div>
</template>

<style scoped>
.page { max-width: 700px; }
.page-title { font-size: 20px; font-weight: 700; margin-bottom: 20px; color: #e2e8f0; }
.section { background: #1e293b; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
.section-title { font-size: 13px; font-weight: 600; color: #94a3b8; margin-bottom: 12px; text-transform: uppercase; letter-spacing: 0.05em; }
.form-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; }
.msg-row { display: flex; flex-wrap: wrap; gap: 8px; align-items: center; min-height: 20px; margin-top: 6px; }
.btn { padding: 6px 14px; border-radius: 6px; border: none; font-size: 13px; cursor: pointer; transition: all 0.15s; background: #334155; color: #e2e8f0; }
.btn:hover:not(:disabled) { background: #475569; }
.btn:disabled { opacity: 0.5; cursor: not-allowed; }
.btn--loading { background: #1d4ed8; color: #bfdbfe; }
.btn--success { background: #166534; color: #bbf7d0; }
.btn--error { background: #7f1d1d; color: #fecaca; }
.msg--success { color: #4ade80; font-size: 12px; }
.msg--error { color: #f87171; font-size: 12px; }
.asset-name { font-size: 13px; color: #94a3b8; font-style: italic; }
.select { background: #0f172a; border: 1px solid #334155; color: #e2e8f0; padding: 6px 10px; border-radius: 6px; font-size: 13px; cursor: pointer; }
.field-label { font-size: 13px; color: #94a3b8; }
.toggle-label { display: flex; align-items: center; gap: 6px; cursor: pointer; font-size: 13px; color: #cbd5e1; }
.status-chip { font-size: 11px; padding: 2px 8px; border-radius: 99px; }
.chip--green { background: #166534; color: #4ade80; }
.chip--gray { background: #1e293b; color: #94a3b8; border: 1px solid #334155; }
.stream-url { margin-top: 10px; font-size: 12px; color: #94a3b8; }
.stream-url code { color: #38bdf8; }
</style>
