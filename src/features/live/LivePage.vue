<script setup lang="ts">
import { ref, computed } from 'vue'
import { apiClient } from '@shared/api/client'
import { useLiveStore } from '@shared/store/live'
import { useSessionStore } from '@shared/store/session'
import { writeAudit } from '@shared/api/audit'
import type { ButtonState } from '@shared/types/actions'

const liveStore = useLiveStore()
const sessionStore = useSessionStore()

// --- Local state ---
const roomId = ref('')
const sendText = ref('')
const insertText = ref('')
const pipelineStatus = ref('')
const avSync = ref(false)

// Button states
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

// --- btn_live_fetch_start ---
async function onFetchStart() {
  if (!roomId.value.trim()) {
    setBtn('btn_live_fetch_start', 'error', '请输入直播间ID')
    return
  }
  setBtn('btn_live_fetch_start', 'loading')
  const res = await liveStore.connect(roomId.value.trim(), 'douyin', 'user-001')
  if (res.ok) {
    setBtn('btn_live_fetch_start', 'success', '已连接直播间')
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_live_fetch_start',
      action: '开始拉取直播消息',
      result: 'success'
    })
  } else {
    setBtn('btn_live_fetch_start', 'error', res.message || '连接失败')
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_live_fetch_start',
      action: '开始拉取直播消息',
      result: 'failure',
      error_code: res.errorCode
    })
  }
}

// --- btn_live_fetch_stop ---
async function onFetchStop() {
  setBtn('btn_live_fetch_stop', 'loading')
  const res = await liveStore.disconnect()
  if (res.ok) {
    setBtn('btn_live_fetch_stop', 'success', '已停止获取')
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_live_fetch_stop',
      action: '停止拉取直播消息',
      result: 'success'
    })
  } else {
    setBtn('btn_live_fetch_stop', 'error', res.message || '停止失败')
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_live_fetch_stop',
      action: '停止拉取直播消息',
      result: 'failure',
      error_code: res.errorCode
    })
  }
}

// --- sw_live_message_alert ---
function onToggleAlert() {
  liveStore.toggleMessageAlert()
  writeAudit({
    session_id: sessionStore.sessionId || '',
    button_id: 'sw_live_message_alert',
    action: '切换消息提醒',
    result: 'success'
  })
}

// --- btn_live_tts_preview ---
async function onTtsPreview() {
  setBtn('btn_live_tts_preview', 'loading')
  const res = await apiClient.ttsSynthesize({
    text: '这是一段测试语音，用于预览效果。',
    voice_id: 'default'
  })
  if (res.ok) {
    setBtn('btn_live_tts_preview', 'success', `试听就绪 (${res.data?.duration_ms}ms)`)
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_live_tts_preview',
      action: '预览TTS语音',
      result: 'success'
    })
  } else {
    setBtn('btn_live_tts_preview', 'error', res.message || 'TTS失败')
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_live_tts_preview',
      action: '预览TTS语音',
      result: 'failure',
      error_code: res.errorCode
    })
  }
}

// --- btn_live_runtime_toggle ---
const isRunning = computed(() => sessionStore.sessionState === 'running')
async function onRuntimeToggle() {
  setBtn('btn_live_runtime_toggle', 'loading')
  if (isRunning.value) {
    const res = await sessionStore.stopSession()
    setBtn(
      'btn_live_runtime_toggle',
      res?.ok ? 'success' : 'error',
      res?.ok ? '已切换为待机' : res?.message || '切换失败'
    )
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_live_runtime_toggle',
      action: '切换运行时状态',
      result: res?.ok ? 'success' : 'failure',
      error_code: res?.errorCode
    })
  } else {
    const res = await sessionStore.startSession(roomId.value || 'default', 'user-001')
    setBtn(
      'btn_live_runtime_toggle',
      res?.ok ? 'success' : 'error',
      res?.ok ? '已启动运行' : res?.message || '启动失败'
    )
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_live_runtime_toggle',
      action: '切换运行时状态',
      result: res?.ok ? 'success' : 'failure',
      error_code: res?.errorCode
    })
  }
}

// --- btn_live_tts_stop ---
async function onTtsStop() {
  setBtn('btn_live_tts_stop', 'loading')
  const res = await apiClient.sessionStop({ session_id: sessionStore.sessionId || '' })
  if (res.ok) {
    setBtn('btn_live_tts_stop', 'success', '已停止AI语音')
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_live_tts_stop',
      action: '停止TTS播放',
      result: 'success'
    })
  } else {
    setBtn('btn_live_tts_stop', 'error', res.message || '停止失败')
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_live_tts_stop',
      action: '停止TTS播放',
      result: 'failure',
      error_code: res.errorCode
    })
  }
}

// --- btn_live_pause ---
async function onPause() {
  setBtn('btn_live_pause', 'loading')
  const res = await apiClient.sessionStop({ session_id: sessionStore.sessionId || '' })
  if (res.ok) {
    sessionStore.sessionState = 'paused'
    setBtn('btn_live_pause', 'success', '已暂停')
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_live_pause',
      action: '暂停直播推送',
      result: 'success'
    })
  } else {
    setBtn('btn_live_pause', 'error', res.message || '暂停失败')
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_live_pause',
      action: '暂停直播推送',
      result: 'failure',
      error_code: res.errorCode
    })
  }
}

// --- btn_live_stop ---
async function onStop() {
  setBtn('btn_live_stop', 'loading')
  const res = await sessionStore.stopSession()
  if (res?.ok) {
    setBtn('btn_live_stop', 'success', '会话已停止')
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_live_stop',
      action: '停止直播会话',
      result: 'success'
    })
  } else {
    setBtn('btn_live_stop', 'error', res?.message || '停止失败')
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_live_stop',
      action: '停止直播会话',
      result: 'failure',
      error_code: res?.errorCode
    })
  }
}

// --- btn_live_model_rotate ---
async function onModelRotate() {
  setBtn('btn_live_model_rotate', 'loading')
  const res = await apiClient.sessionStart({
    room_id: roomId.value || 'default',
    account_id: 'user-001'
  })
  if (res.ok) {
    setBtn('btn_live_model_rotate', 'success', '模型已轮换')
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_live_model_rotate',
      action: '轮换AI模型',
      result: 'success'
    })
  } else {
    setBtn('btn_live_model_rotate', 'error', res.message || '轮换失败')
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_live_model_rotate',
      action: '轮换AI模型',
      result: 'failure',
      error_code: res.errorCode
    })
  }
}

// --- btn_live_insert ---
async function onInsert() {
  if (!insertText.value.trim()) {
    setBtn('btn_live_insert', 'error', '请输入插播内容')
    return
  }
  setBtn('btn_live_insert', 'loading')
  const res = await apiClient.queueInsert({
    session_id: sessionStore.sessionId || '',
    item: { text: insertText.value, priority: 10, source: 'manual' },
    position: 0
  })
  if (res.ok) {
    setBtn('btn_live_insert', 'success', `已插播 (position: ${res.data?.position})`)
    insertText.value = ''
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_live_insert',
      action: '插入优先队列',
      result: 'success'
    })
  } else {
    setBtn('btn_live_insert', 'error', res.message || '插播失败')
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_live_insert',
      action: '插入优先队列',
      result: 'failure',
      error_code: res.errorCode
    })
  }
}

// --- btn_live_send_text (main pipeline) ---
async function onSendText() {
  if (!sendText.value.trim()) {
    setBtn('btn_live_send_text', 'error', '请输入发送内容')
    return
  }
  setBtn('btn_live_send_text', 'loading')
  pipelineStatus.value = '改写中...'

  try {
    // Step 1: SCRIPT_REWRITE
    const rewriteRes = await apiClient.scriptRewrite({ original_text: sendText.value })
    if (!rewriteRes.ok || !rewriteRes.data) {
      setBtn('btn_live_send_text', 'error', rewriteRes.message || '改写失败')
      pipelineStatus.value = '改写失败'
      writeAudit({
        session_id: sessionStore.sessionId || '',
        button_id: 'btn_live_send_text',
        action: '发送文本',
        result: 'failure',
        error_code: rewriteRes.errorCode
      })
      return
    }
    const rewrittenText = rewriteRes.data.rewritten_text
    pipelineStatus.value = '审核中...'

    // Step 2: MODERATION_CHECK
    const moderationRes = await apiClient.moderationCheck({ text: rewrittenText })
    if (!moderationRes.ok || !moderationRes.data) {
      setBtn('btn_live_send_text', 'error', moderationRes.message || '审核失败')
      pipelineStatus.value = '审核失败'
      writeAudit({
        session_id: sessionStore.sessionId || '',
        button_id: 'btn_live_send_text',
        action: '发送文本',
        result: 'failure',
        error_code: moderationRes.errorCode
      })
      return
    }

    // Step 3: Check risk level
    if (moderationRes.data.risk_level === 'high') {
      setBtn('btn_live_send_text', 'error', '内容风险过高，待人工审核')
      pipelineStatus.value = '待审'
      writeAudit({
        session_id: sessionStore.sessionId || '',
        button_id: 'btn_live_send_text',
        action: '发送文本',
        result: 'failure',
        error_code: 'HIGH_RISK'
      })
      return
    }

    pipelineStatus.value = '合成语音...'

    // Step 4: TTS_SYNTHESIZE
    const ttsRes = await apiClient.ttsSynthesize({ text: rewrittenText })
    if (!ttsRes.ok || !ttsRes.data) {
      setBtn('btn_live_send_text', 'error', ttsRes.message || 'TTS失败')
      pipelineStatus.value = 'TTS失败'
      writeAudit({
        session_id: sessionStore.sessionId || '',
        button_id: 'btn_live_send_text',
        action: '发送文本',
        result: 'failure',
        error_code: ttsRes.errorCode
      })
      return
    }

    // Step 5: Success
    pipelineStatus.value = '播报中'
    setBtn('btn_live_send_text', 'success', `播报中 (${ttsRes.data.duration_ms}ms)`)
    liveStore.addMessage(rewrittenText, '系统播报')
    sendText.value = ''
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_live_send_text',
      action: '发送文本',
      result: 'success'
    })

    setTimeout(() => {
      if (pipelineStatus.value === '播报中') pipelineStatus.value = ''
    }, ttsRes.data.duration_ms + 500)
  } catch (e) {
    const msg = e instanceof Error ? e.message : '未知错误'
    setBtn('btn_live_send_text', 'error', msg)
    pipelineStatus.value = '错误'
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_live_send_text',
      action: '发送文本',
      result: 'failure'
    })
  }
}

// --- btn_live_account_close ---
async function onAccountClose() {
  setBtn('btn_live_account_close', 'loading')
  const res = await liveStore.disconnect()
  if (res.ok) {
    setBtn('btn_live_account_close', 'success', '账号接入已关闭')
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_live_account_close',
      action: '关闭直播账号连接',
      result: 'success'
    })
  } else {
    setBtn('btn_live_account_close', 'error', res.message || '关闭失败')
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_live_account_close',
      action: '关闭直播账号连接',
      result: 'failure',
      error_code: res.errorCode
    })
  }
}

// --- btn_live_init_messages ---
async function onInitMessages() {
  setBtn('btn_live_init_messages', 'loading')
  const res = await sessionStore.fetchStatus()
  if (res.ok) {
    liveStore.initMessages()
    setBtn('btn_live_init_messages', 'success', '消息已初始化')
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_live_init_messages',
      action: '初始化消息列表',
      result: 'success'
    })
  } else {
    setBtn('btn_live_init_messages', 'error', res.message || '初始化失败')
    writeAudit({
      session_id: sessionStore.sessionId || '',
      button_id: 'btn_live_init_messages',
      action: '初始化消息列表',
      result: 'failure',
      error_code: res.errorCode
    })
  }
}
</script>

<template>
  <div class="page">
    <h1 class="page-title">AI直播</h1>

    <!-- Connection Section -->
    <section class="section">
      <h2 class="section-title">直播间连接</h2>
      <div class="form-row">
        <input v-model="roomId" class="input" placeholder="直播间 room_id" maxlength="64" />
        <button
          id="btn_live_fetch_start"
          :class="btnClass('btn_live_fetch_start')"
          :disabled="btnStates['btn_live_fetch_start'] === 'loading'"
          @click="onFetchStart"
        >
          {{ btnStates['btn_live_fetch_start'] === 'loading' ? '连接中...' : '加载直播间数据' }}
        </button>
        <button
          id="btn_live_fetch_stop"
          :class="btnClass('btn_live_fetch_stop')"
          :disabled="btnStates['btn_live_fetch_stop'] === 'loading' || !liveStore.isConnected"
          @click="onFetchStop"
        >
          停止获取
        </button>
        <button
          id="btn_live_account_close"
          :class="btnClass('btn_live_account_close')"
          :disabled="btnStates['btn_live_account_close'] === 'loading'"
          @click="onAccountClose"
        >
          关闭账号接入
        </button>
      </div>
      <div class="msg-row">
        <span
          v-if="btnMessages['btn_live_fetch_start']"
          :class="btnStates['btn_live_fetch_start'] === 'error' ? 'msg--error' : 'msg--success'"
          >{{ btnMessages['btn_live_fetch_start'] }}</span
        >
        <span
          v-if="btnMessages['btn_live_fetch_stop']"
          :class="btnStates['btn_live_fetch_stop'] === 'error' ? 'msg--error' : 'msg--success'"
          >{{ btnMessages['btn_live_fetch_stop'] }}</span
        >
        <span
          v-if="btnMessages['btn_live_account_close']"
          :class="btnStates['btn_live_account_close'] === 'error' ? 'msg--error' : 'msg--success'"
          >{{ btnMessages['btn_live_account_close'] }}</span
        >
        <span class="status-chip" :class="liveStore.isConnected ? 'chip--green' : 'chip--gray'">
          {{ liveStore.isConnected ? `已连接 (${liveStore.connectionId?.slice(0, 8)})` : '未连接' }}
        </span>
      </div>
    </section>

    <!-- Session Controls -->
    <section class="section">
      <h2 class="section-title">会话控制</h2>
      <div class="form-row">
        <button
          id="btn_live_runtime_toggle"
          :class="btnClass('btn_live_runtime_toggle')"
          :disabled="btnStates['btn_live_runtime_toggle'] === 'loading'"
          @click="onRuntimeToggle"
        >
          {{ isRunning ? 'AI语音待机' : 'AI语音运行' }}
        </button>
        <button
          id="btn_live_tts_stop"
          :class="btnClass('btn_live_tts_stop')"
          :disabled="btnStates['btn_live_tts_stop'] === 'loading'"
          @click="onTtsStop"
        >
          停止AI语音
        </button>
        <button
          id="btn_live_pause"
          :class="btnClass('btn_live_pause')"
          :disabled="btnStates['btn_live_pause'] === 'loading'"
          @click="onPause"
        >
          暂停
        </button>
        <button
          id="btn_live_stop"
          :class="btnClass('btn_live_stop')"
          :disabled="btnStates['btn_live_stop'] === 'loading'"
          @click="onStop"
        >
          停止
        </button>
        <button
          id="btn_live_model_rotate"
          :class="btnClass('btn_live_model_rotate')"
          :disabled="btnStates['btn_live_model_rotate'] === 'loading'"
          @click="onModelRotate"
        >
          模型轮换
        </button>
      </div>
      <div class="msg-row">
        <span
          v-for="id in [
            'btn_live_runtime_toggle',
            'btn_live_tts_stop',
            'btn_live_pause',
            'btn_live_stop',
            'btn_live_model_rotate'
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
    </section>

    <!-- Settings Toggles -->
    <section class="section">
      <h2 class="section-title">功能开关</h2>
      <div class="form-row">
        <label class="toggle-label" id="sw_live_message_alert">
          <input type="checkbox" :checked="liveStore.messageAlert" @change="onToggleAlert" />
          <span>消息提醒</span>
          <span class="toggle-state">{{ liveStore.messageAlert ? '开' : '关' }}</span>
        </label>
        <label class="toggle-label" id="sw_live_av_sync">
          <input type="checkbox" v-model="avSync" />
          <span>开启音画同步</span>
          <span class="toggle-state">{{ avSync ? '开' : '关' }}</span>
        </label>
        <button
          id="btn_live_tts_preview"
          :class="btnClass('btn_live_tts_preview')"
          :disabled="btnStates['btn_live_tts_preview'] === 'loading'"
          @click="onTtsPreview"
        >
          试听
        </button>
        <button
          id="btn_live_init_messages"
          :class="btnClass('btn_live_init_messages')"
          :disabled="btnStates['btn_live_init_messages'] === 'loading'"
          @click="onInitMessages"
        >
          初始化消息
        </button>
      </div>
      <div class="msg-row">
        <span
          v-if="btnMessages['btn_live_tts_preview']"
          :class="btnStates['btn_live_tts_preview'] === 'error' ? 'msg--error' : 'msg--success'"
          >{{ btnMessages['btn_live_tts_preview'] }}</span
        >
        <span
          v-if="btnMessages['btn_live_init_messages']"
          :class="btnStates['btn_live_init_messages'] === 'error' ? 'msg--error' : 'msg--success'"
          >{{ btnMessages['btn_live_init_messages'] }}</span
        >
      </div>
    </section>

    <!-- Queue -->
    <section class="section">
      <h2 class="section-title">发送与插播</h2>
      <div class="form-col">
        <div class="form-row">
          <input
            v-model="sendText"
            class="input input--wide"
            placeholder="发送文字内容 (max 120)"
            maxlength="120"
          />
          <button
            id="btn_live_send_text"
            :class="btnClass('btn_live_send_text')"
            :disabled="btnStates['btn_live_send_text'] === 'loading'"
            @click="onSendText"
          >
            {{ btnStates['btn_live_send_text'] === 'loading' ? '处理中...' : '发送文字' }}
          </button>
        </div>
        <div class="msg-row">
          <span
            v-if="pipelineStatus"
            class="pipeline-status"
            :class="{
              'pipeline-status--warn': pipelineStatus === '待审',
              'pipeline-status--broadcast': pipelineStatus === '播报中'
            }"
          >
            {{ pipelineStatus }}
          </span>
          <span
            v-if="btnMessages['btn_live_send_text']"
            :class="btnStates['btn_live_send_text'] === 'error' ? 'msg--error' : 'msg--success'"
            >{{ btnMessages['btn_live_send_text'] }}</span
          >
        </div>
        <div class="form-row">
          <input
            v-model="insertText"
            class="input input--wide"
            placeholder="插播内容 (max 120)"
            maxlength="120"
          />
          <button
            id="btn_live_insert"
            :class="btnClass('btn_live_insert')"
            :disabled="btnStates['btn_live_insert'] === 'loading'"
            @click="onInsert"
          >
            插播
          </button>
        </div>
        <div class="msg-row">
          <span
            v-if="btnMessages['btn_live_insert']"
            :class="btnStates['btn_live_insert'] === 'error' ? 'msg--error' : 'msg--success'"
            >{{ btnMessages['btn_live_insert'] }}</span
          >
        </div>
      </div>
    </section>

    <!-- Message List -->
    <section class="section">
      <h2 class="section-title">消息列表 ({{ liveStore.messages.length }})</h2>
      <div class="message-list">
        <div v-for="msg in liveStore.messages.slice().reverse()" :key="msg.id" class="message-item">
          <span class="message-user">{{ msg.user }}</span>
          <span class="message-text">{{ msg.text }}</span>
          <span class="message-ts">{{ new Date(msg.ts).toLocaleTimeString() }}</span>
        </div>
        <div v-if="liveStore.messages.length === 0" class="message-empty">暂无消息</div>
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
  min-width: 160px;
}
.input--wide {
  flex: 1;
  min-width: 200px;
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
.toggle-label {
  display: flex;
  align-items: center;
  gap: 6px;
  cursor: pointer;
  font-size: 13px;
  color: #cbd5e1;
}
.toggle-label input[type='checkbox'] {
  cursor: pointer;
}
.toggle-state {
  font-size: 11px;
  color: #94a3b8;
}
.status-chip {
  font-size: 11px;
  padding: 2px 8px;
  border-radius: 99px;
}
.chip--green {
  background: #166534;
  color: #4ade80;
}
.chip--gray {
  background: #1e293b;
  color: #94a3b8;
  border: 1px solid #334155;
}
.pipeline-status {
  font-size: 12px;
  font-weight: 600;
  padding: 2px 10px;
  border-radius: 99px;
  background: #1d4ed8;
  color: #bfdbfe;
}
.pipeline-status--warn {
  background: #92400e;
  color: #fde68a;
}
.pipeline-status--broadcast {
  background: #166534;
  color: #4ade80;
}
.message-list {
  display: flex;
  flex-direction: column;
  gap: 6px;
  max-height: 200px;
  overflow-y: auto;
}
.message-item {
  display: flex;
  gap: 10px;
  align-items: baseline;
  font-size: 13px;
  padding: 4px 8px;
  background: #0f172a;
  border-radius: 4px;
}
.message-user {
  color: #38bdf8;
  font-weight: 600;
  min-width: 60px;
  font-size: 12px;
}
.message-text {
  color: #e2e8f0;
  flex: 1;
}
.message-ts {
  color: #64748b;
  font-size: 11px;
  white-space: nowrap;
}
.message-empty {
  color: #475569;
  font-size: 13px;
  text-align: center;
  padding: 16px;
}
</style>
