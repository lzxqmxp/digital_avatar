<script setup lang="ts">
import { ref, computed } from 'vue'

const defaultUrl = 'http://127.0.0.1:5174/'
const dycastUrlInput = ref(defaultUrl)
const currentUrl = ref(defaultUrl)

const normalizedUrl = computed(() => {
  const raw = dycastUrlInput.value.trim()
  if (!raw) {
    return defaultUrl
  }
  if (/^https?:\/\//i.test(raw)) {
    return raw
  }
  return `http://${raw}`
})

function openDycast() {
  currentUrl.value = normalizedUrl.value
}
</script>

<template>
  <section class="dycast-page">
    <header class="dycast-header">
      <h2>DyCast 控制台（委托模式）</h2>
      <p>当前项目不再直接连接抖音，直播流完全委托给 dycast_1。请在该页面完成房间连接与转发。</p>
    </header>

    <div class="dycast-toolbar">
      <input v-model="dycastUrlInput" class="url-input" placeholder="输入 dycast_1 页面地址" />
      <button class="open-btn" type="button" @click="openDycast">加载 DyCast</button>
    </div>

    <ul class="dycast-hint">
      <li>1. 在 dycast_1 页面输入直播间并点击连接。</li>
      <li>2. 在 dycast_1 转发地址填写 ws://127.0.0.1:18765。</li>
      <li>3. 点击转发后，回到 AI 直播页面即可消费真实弹幕流。</li>
    </ul>

    <div class="dycast-frame-wrap">
      <iframe :src="currentUrl" title="dycast_1" class="dycast-frame" />
    </div>
  </section>
</template>

<style scoped>
.dycast-page {
  display: grid;
  grid-template-rows: auto auto auto minmax(0, 1fr);
  gap: 12px;
  height: 100%;
}

.dycast-header h2 {
  margin: 0;
  font-size: 20px;
}

.dycast-header p {
  margin: 4px 0 0;
  color: #627088;
}

.dycast-toolbar {
  display: flex;
  gap: 8px;
}

.url-input {
  flex: 1;
  min-width: 280px;
  height: 36px;
  padding: 0 10px;
  border: 1px solid #cfd7e6;
  border-radius: 8px;
}

.open-btn {
  height: 36px;
  padding: 0 14px;
  border: 0;
  border-radius: 8px;
  background: #0e7c86;
  color: #fff;
  cursor: pointer;
}

.dycast-hint {
  margin: 0;
  padding-left: 18px;
  color: #41506a;
}

.dycast-frame-wrap {
  min-height: 0;
  border: 1px solid #dbe2ef;
  border-radius: 10px;
  overflow: hidden;
  background: #fff;
}

.dycast-frame {
  width: 100%;
  height: 100%;
  min-height: 540px;
  border: 0;
}
</style>
