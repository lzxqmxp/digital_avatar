<script setup lang="ts">
import { RouterView, RouterLink } from 'vue-router'
import { useSessionStore } from '@shared/store/session'
import { storeToRefs } from 'pinia'

const sessionStore = useSessionStore()
const { sessionState } = storeToRefs(sessionStore)

const stateColor: Record<string, string> = {
  idle: '#6b7280',
  running: '#22c55e',
  paused: '#f59e0b',
  stopped: '#ef4444',
  degraded: '#f97316',
  error: '#dc2626',
}
</script>

<template>
  <div class="app-layout">
    <aside class="sidebar">
      <div class="sidebar-brand">数字人直播</div>
      <nav class="sidebar-nav">
        <RouterLink to="/live" class="nav-link" active-class="nav-link--active">
          <span class="nav-icon">📡</span> AI直播
        </RouterLink>
        <RouterLink to="/avatar" class="nav-link" active-class="nav-link--active">
          <span class="nav-icon">🎭</span> 数字人
        </RouterLink>
        <RouterLink to="/settings" class="nav-link" active-class="nav-link--active">
          <span class="nav-icon">⚙️</span> 设置
        </RouterLink>
      </nav>
      <div class="sidebar-status">
        <span
          class="status-dot"
          :style="{ backgroundColor: stateColor[sessionState] ?? '#6b7280' }"
        />
        <span class="status-text">{{ sessionState }}</span>
      </div>
    </aside>
    <main class="main-content">
      <RouterView />
    </main>
  </div>
</template>

<style scoped>
.app-layout {
  display: flex;
  height: 100vh;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  background: #0f172a;
  color: #e2e8f0;
}

.sidebar {
  width: 180px;
  min-width: 180px;
  background: #1e293b;
  display: flex;
  flex-direction: column;
  padding: 16px 0;
  border-right: 1px solid #334155;
}

.sidebar-brand {
  font-size: 14px;
  font-weight: 700;
  color: #94a3b8;
  padding: 0 16px 16px;
  border-bottom: 1px solid #334155;
  margin-bottom: 8px;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  color: #94a3b8;
  text-decoration: none;
  font-size: 14px;
  transition: background 0.15s, color 0.15s;
}

.nav-link:hover {
  background: #334155;
  color: #e2e8f0;
}

.nav-link--active {
  background: #334155;
  color: #38bdf8;
  border-left: 3px solid #38bdf8;
}

.nav-icon {
  font-size: 16px;
}

.sidebar-status {
  margin-top: auto;
  padding: 12px 16px;
  border-top: 1px solid #334155;
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 12px;
  color: #94a3b8;
}

.status-dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  flex-shrink: 0;
}

.main-content {
  flex: 1;
  overflow-y: auto;
  padding: 20px;
}
</style>
