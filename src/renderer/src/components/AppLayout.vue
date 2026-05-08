<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { RouterLink, RouterView, useRoute } from 'vue-router'
import { storeToRefs } from 'pinia'
import { useSessionStore } from '@shared/store/session'

type NavItem = {
  to: string
  label: string
  short: string
}

type NavGroup = {
  label: string
  items: NavItem[]
}

const route = useRoute()
const sessionStore = useSessionStore()
const { sessionState } = storeToRefs(sessionStore)

const navGroups: NavGroup[] = [
  {
    label: '主控面板',
    items: [
      { to: '/live', label: 'AI直播', short: '直' },
      { to: '/dycast', label: 'DyCast', short: '抖' },
      { to: '/avatar', label: '数字人', short: '数' },
      { to: '/settings', label: '设置', short: '设' }
    ]
  },
  {
    label: '运营管理',
    items: [
      { to: '/scripts', label: '话术管理', short: '话' },
      { to: '/policy', label: 'AI回复', short: '策' },
      { to: '/writer', label: '写话术', short: '写' },
      { to: '/models', label: '模型管理', short: '模' },
      { to: '/accounts', label: '直播账号', short: '账' },
      { to: '/asr', label: '音转文字', short: '音' },
      { to: '/sensitive-words', label: '敏感词库', short: '敏' }
    ]
  }
]

const routeMeta: Record<string, { title: string; subtitle: string }> = {
  '/live': {
    title: 'AI直播主控台',
    subtitle: '连接直播、控制会话、管理播报队列。'
  },
  '/dycast': {
    title: 'DyCast 委托控制台',
    subtitle: '内嵌 dycast_1 页面，负责抖音连接与弹幕转发。'
  },
  '/avatar': {
    title: '数字人控制台',
    subtitle: '管理素材、推理引擎与实时预览。'
  },
  '/settings': {
    title: '系统设置中心',
    subtitle: '配置云服务、引擎参数与系统选项。'
  },
  '/scripts': {
    title: '话术管理中心',
    subtitle: '维护话术条目并执行批量操作。'
  },
  '/policy': {
    title: 'AI回复策略',
    subtitle: '配置回复策略、测试效果并发布版本。'
  },
  '/writer': {
    title: '写话术工作台',
    subtitle: '生成、改写并审核可发布文案。'
  },
  '/models': {
    title: '模型版本库',
    subtitle: '导入、校验、启用与回滚模型。'
  },
  '/accounts': {
    title: '直播账号管理',
    subtitle: '创建账号并执行授权与健康检查。'
  },
  '/asr': {
    title: 'ASR转写中心',
    subtitle: '实时识别、纠错并导出文本。'
  },
  '/sensitive-words': {
    title: '敏感词库管理',
    subtitle: '管理敏感词列表，支持分组分级和批量维护。'
  }
}

const stateLabel: Record<string, string> = {
  idle: '待机',
  running: '运行中',
  paused: '已暂停',
  stopped: '已停止',
  degraded: '降级中',
  error: '异常'
}

const isDesktop = ref(true)
const isNavOpen = ref(true)
const currentYear = new Date().getFullYear()

const currentRouteMeta = computed(
  () =>
    routeMeta[route.path] ?? {
      title: '数字人直播系统',
      subtitle: '实时数字人直播业务控制中心。'
    }
)

const currentStateLabel = computed(() => stateLabel[sessionState.value] ?? sessionState.value)

const stateClass = computed(() => `state--${sessionState.value ?? 'idle'}`)

function toggleNav() {
  if (isDesktop.value) return
  isNavOpen.value = !isNavOpen.value
}

function closeNav() {
  if (!isDesktop.value) {
    isNavOpen.value = false
  }
}

function handleResize() {
  const desktop = window.innerWidth >= 1024
  if (desktop) {
    isDesktop.value = true
    isNavOpen.value = true
    return
  }

  if (isDesktop.value) {
    isNavOpen.value = false
  }
  isDesktop.value = false
}

watch(
  () => route.path,
  () => {
    closeNav()
  }
)

onMounted(() => {
  handleResize()
  window.addEventListener('resize', handleResize)
})

onBeforeUnmount(() => {
  window.removeEventListener('resize', handleResize)
})
</script>

<template>
  <div class="app-shell">
    <div v-if="!isDesktop && isNavOpen" class="shell-overlay" @click="closeNav" />

    <aside class="sidebar" :class="{ 'sidebar--open': isNavOpen }">
      <div class="sidebar-brand">
        <div class="brand-mark">DA</div>
        <div class="brand-copy">
          <p class="brand-name">Digital Avatar</p>
          <p class="brand-sub">Live Console</p>
        </div>
      </div>

      <nav class="sidebar-nav" aria-label="主导航">
        <div v-for="group in navGroups" :key="group.label" class="nav-group">
          <p class="nav-group-title">{{ group.label }}</p>
          <RouterLink
            v-for="item in group.items"
            :key="item.to"
            :to="item.to"
            class="nav-link"
            active-class="nav-link--active"
          >
            <span class="nav-short">{{ item.short }}</span>
            <span>{{ item.label }}</span>
          </RouterLink>
        </div>
      </nav>

      <div class="sidebar-status">
        <span class="status-dot" :class="stateClass" />
        <div>
          <p class="status-label">会话状态</p>
          <p class="status-value">{{ currentStateLabel }}</p>
        </div>
      </div>
    </aside>

    <div class="workspace">
      <header class="workspace-top-status">
        <button class="menu-toggle" type="button" @click="toggleNav">导航</button>
        <div class="header-copy">
          <p class="header-kicker">顶部状态</p>
          <h1>{{ currentRouteMeta.title }}</h1>
          <p>{{ currentRouteMeta.subtitle }}</p>
        </div>
        <div class="header-state">
          <span class="pulse-dot" :class="stateClass" />
          <span>{{ currentStateLabel }}</span>
        </div>
      </header>

      <main class="main-content">
        <RouterView />
      </main>

      <footer class="workspace-bottom-status">
        <p class="footer-copy">© {{ currentYear }} Digital Avatar Live</p>
        <p class="footer-meta">会话状态：{{ currentStateLabel }}</p>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.app-shell {
  position: relative;
  display: grid;
  grid-template-columns: clamp(224px, 21vw, 288px) minmax(0, 1fr);
  height: 100dvh;
  min-height: 100dvh;
  max-height: 100dvh;
  overflow: hidden;
}

.sidebar {
  z-index: 20;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  gap: 14px;
  padding: 18px 14px 14px;
  background: linear-gradient(165deg, rgba(16, 35, 52, 0.9), rgba(8, 22, 35, 0.95));
  border-right: 1px solid rgba(166, 193, 214, 0.2);
  backdrop-filter: blur(12px);
  overflow: hidden;
}

.sidebar-brand {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px;
}

.brand-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  font-size: 13px;
  font-weight: 700;
  letter-spacing: 0.04em;
  color: #052a34;
  background: linear-gradient(145deg, #56d6c8, #ffbe84);
  box-shadow: 0 12px 24px rgba(13, 32, 46, 0.35);
}

.brand-copy {
  display: flex;
  flex-direction: column;
  gap: 1px;
}

.brand-name {
  font-size: 14px;
  font-weight: 700;
  letter-spacing: 0.03em;
  color: #f2f7fc;
}

.brand-sub {
  font-size: 11px;
  color: #9eb2c9;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}

.sidebar-nav {
  display: flex;
  flex-direction: column;
  gap: 14px;
  min-height: 0;
  overflow-y: auto;
  padding-right: 2px;
  scrollbar-width: none;
}

.sidebar-nav::-webkit-scrollbar {
  width: 0;
  height: 0;
}

.nav-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-group-title {
  padding: 0 10px;
  font-size: 11px;
  letter-spacing: 0.08em;
  color: #9eb2c9;
  text-transform: uppercase;
}

.nav-link {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 9px 10px;
  border-radius: 10px;
  color: #c7d6e7;
  text-decoration: none;
  font-size: 13px;
  transition: 0.2s ease;
}

.nav-link:hover {
  background: rgba(124, 173, 212, 0.16);
  color: #f4f9ff;
}

.nav-link--active {
  background: linear-gradient(140deg, rgba(86, 214, 200, 0.22), rgba(255, 190, 132, 0.2));
  color: #f8fcff;
  box-shadow: inset 0 0 0 1px rgba(182, 214, 238, 0.22);
}

.nav-short {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 7px;
  font-size: 11px;
  font-weight: 700;
  color: #d6e4f2;
  background: rgba(30, 56, 78, 0.88);
}

.sidebar-status {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 12px 10px;
  border-radius: 10px;
  background: rgba(14, 34, 51, 0.72);
  border: 1px solid rgba(167, 193, 214, 0.2);
}

.status-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  flex-shrink: 0;
}

.status-label {
  font-size: 11px;
  color: #9eb2c9;
}

.status-value {
  font-size: 13px;
  font-weight: 600;
  color: #f3f9ff;
}

.workspace {
  height: 100%;
  min-width: 0;
  display: grid;
  grid-template-rows: auto minmax(0, 1fr) auto;
  overflow: hidden;
}

.workspace-top-status {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: clamp(14px, 1.8vw, 20px) clamp(14px, 2vw, 28px);
  border-bottom: 1px solid rgba(166, 193, 214, 0.2);
  background: linear-gradient(180deg, rgba(11, 30, 46, 0.86), rgba(9, 24, 38, 0.72));
  backdrop-filter: blur(12px);
}

.menu-toggle {
  display: none;
  border: 1px solid rgba(166, 193, 214, 0.28);
  border-radius: 10px;
  padding: 7px 11px;
  font-size: 12px;
  font-weight: 600;
  color: #d6e4f2;
  background: rgba(24, 47, 67, 0.68);
  cursor: pointer;
}

.header-copy {
  min-width: 0;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 3px;
}

.header-kicker {
  font-size: 11px;
  letter-spacing: 0.1em;
  color: #89d3cb;
  text-transform: uppercase;
}

.header-copy h1 {
  font-size: clamp(18px, 1.8vw, 24px);
  line-height: 1.2;
  font-weight: 700;
  color: #f6fbff;
}

.header-copy p {
  font-size: 13px;
  color: #a8bed5;
}

.header-state {
  flex-shrink: 0;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  border-radius: 999px;
  border: 1px solid rgba(166, 193, 214, 0.26);
  font-size: 12px;
  color: #d9e7f4;
  background: rgba(17, 38, 56, 0.75);
}

.pulse-dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  box-shadow: 0 0 0 0 rgba(86, 214, 200, 0.55);
  animation: pulse 1.8s infinite;
}

.main-content {
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
}

.workspace-bottom-status {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  min-height: 42px;
  padding: 8px clamp(12px, 1.6vw, 22px);
  border-top: 1px solid rgba(166, 193, 214, 0.2);
  background: linear-gradient(180deg, rgba(8, 22, 35, 0.72), rgba(7, 19, 31, 0.86));
}

.footer-copy,
.footer-meta {
  font-size: 12px;
  color: #9eb2c9;
}

.state--idle,
.state--stopped {
  background: #8ca0b5;
}

.state--running {
  background: #34d399;
}

.state--paused {
  background: #f5c96d;
}

.state--degraded {
  background: #ffad63;
}

.state--error {
  background: #f87171;
}

.shell-overlay {
  position: fixed;
  inset: 0;
  z-index: 15;
  background: rgba(4, 13, 22, 0.5);
  backdrop-filter: blur(1px);
}

@keyframes pulse {
  70% {
    box-shadow: 0 0 0 8px rgba(86, 214, 200, 0);
  }
  100% {
    box-shadow: 0 0 0 0 rgba(86, 214, 200, 0);
  }
}

@media (max-width: 1023px) {
  .app-shell {
    grid-template-columns: minmax(0, 1fr);
  }

  .sidebar {
    position: fixed;
    inset: 0 auto 0 0;
    width: min(82vw, 320px);
    transform: translateX(-104%);
    transition: transform 0.22s ease;
    box-shadow: 20px 0 42px rgba(5, 15, 25, 0.45);
  }

  .sidebar--open {
    transform: translateX(0);
  }

  .workspace-top-status {
    padding-inline: 12px;
  }

  .menu-toggle {
    display: inline-flex;
  }

  .header-copy p {
    font-size: 12px;
  }

  .header-state {
    display: none;
  }

  .workspace-bottom-status {
    padding-inline: 12px;
    min-height: 38px;
  }

  .footer-meta {
    display: none;
  }
}
</style>
