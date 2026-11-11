<script setup lang="ts">
import { onBeforeUnmount, onMounted, ref, watch } from 'vue'
import { listen, type UnlistenFn } from '@tauri-apps/api/event'
import { useTimerStore } from './stores/timer'
import { useSettingsStore } from './stores/settings'
import { useTasksStore } from './stores/tasks'
import { isTauri } from './lib/backend'
import { formatDuration } from './lib/format'
import { PHASE_LABEL } from './lib/types'
import TimerView from './components/TimerView.vue'
import TasksView from './components/TasksView.vue'
import StatsView from './components/StatsView.vue'
import SettingsPanel from './components/SettingsPanel.vue'

type Tab = 'timer' | 'tasks' | 'stats'

const timer = useTimerStore()
const settingsStore = useSettingsStore()
const settingsOpen = ref(false)
const tab = ref<Tab>('timer')

const tabs: Array<{ id: Tab; label: string; icon: string }> = [
  { id: 'timer', label: '计时', icon: '⏱' },
  { id: 'tasks', label: '任务', icon: '☑' },
  { id: 'stats', label: '统计', icon: '📊' },
]

function switchTab(id: Tab): void {
  tab.value = id
}

/* ---- 主题应用（FR-601）---- */
const themeMedia = window.matchMedia('(prefers-color-scheme: dark)')

function applyTheme(): void {
  const t = settingsStore.settings.theme
  const effective = t === 'system' ? (themeMedia.matches ? 'dark' : 'light') : t
  document.documentElement.dataset.theme = effective
}

watch(() => settingsStore.settings.theme, applyTheme)

/* ---- 窗口标题实时显示剩余时间（FR-107）---- */
watch(
  () => [timer.status, timer.remainingMs, timer.phase] as const,
  () => {
    document.title =
      timer.status === 'running'
        ? `${formatDuration(timer.remainingMs)} · ${PHASE_LABEL[timer.phase]} - PomodoroFlow`
        : 'PomodoroFlow'
  },
)

/* ---- 托盘动作（FR-401）：托盘菜单控制计时 ---- */
let unlistenTray: UnlistenFn | null = null
onMounted(async () => {
  themeMedia.addEventListener('change', applyTheme)
  applyTheme()
  window.addEventListener('keydown', onKeydown)
  if (isTauri) {
    unlistenTray = await listen<string>('tray-action', (e) => {
      if (e.payload === 'toggle') timer.toggle()
      else if (e.payload === 'skip') timer.skip()
    })
  }
})

onBeforeUnmount(() => {
  themeMedia.removeEventListener('change', applyTheme)
  window.removeEventListener('keydown', onKeydown)
  unlistenTray?.()
})

/* ---- 键盘：空格 开始/暂停，Esc 关闭弹层，1/2/3 切换标签 ---- */
function onKeydown(e: KeyboardEvent): void {
  const el = e.target as HTMLElement | null
  if (el && /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName)) return
  if (e.code === 'Space') {
    e.preventDefault()
    timer.toggle()
  } else if (e.key === 'Escape') {
    settingsOpen.value = false
  } else if (e.key === '1') switchTab('timer')
  else if (e.key === '2') switchTab('tasks')
  else if (e.key === '3') switchTab('stats')
}

const tabHint = { timer: '1', tasks: '2', stats: '3' } as const
</script>

<template>
  <div class="app" :data-phase="timer.phase" :data-tab="tab">
    <header class="app-header">
      <div class="brand">
        <svg viewBox="0 0 24 24" class="logo" aria-hidden="true">
          <circle cx="12" cy="13.5" r="8" fill="#e8503a" />
          <path d="M12 5.5c1.2-1.6 3-2.3 4.8-2-.2 1.9-1.4 3.4-3.2 3.9Z" fill="#3e9b4f" />
          <path d="M12 5.5c-1.2-1.6-3-2.3-4.8-2 .2 1.9 1.4 3.4 3.2 3.9Z" fill="#4cb062" />
        </svg>
        <span class="brand-name">PomodoroFlow</span>
      </div>
      <button class="icon-btn" title="设置" aria-label="打开设置" @click="settingsOpen = true">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true">
          <line x1="4" y1="21" x2="4" y2="14" />
          <line x1="4" y1="10" x2="4" y2="3" />
          <line x1="12" y1="21" x2="12" y2="12" />
          <line x1="12" y1="8" x2="12" y2="3" />
          <line x1="20" y1="21" x2="20" y2="16" />
          <line x1="20" y1="12" x2="20" y2="3" />
          <line x1="1" y1="14" x2="7" y2="14" />
          <line x1="9" y1="8" x2="15" y2="8" />
          <line x1="17" y1="16" x2="23" y2="16" />
        </svg>
      </button>
    </header>

    <main class="app-main">
      <TimerView v-show="tab === 'timer'" />
      <TasksView v-show="tab === 'tasks'" />
      <StatsView v-show="tab === 'stats'" />
    </main>

    <nav class="tabbar">
      <button
        v-for="t in tabs"
        :key="t.id"
        class="tab"
        :class="{ on: tab === t.id }"
        :title="`${t.label}（${tabHint[t.id]}）`"
        @click="switchTab(t.id)"
      >
        <span class="tab-icon">{{ t.icon }}</span>
        <span class="tab-label">{{ t.label }}</span>
      </button>
    </nav>

    <SettingsPanel v-if="settingsOpen" @close="settingsOpen = false" />
  </div>
</template>

<style scoped>
.app {
  height: 100vh;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 12px 20px 8px;
  background:
    radial-gradient(circle at 50% -12%, var(--phase-soft), transparent 55%),
    var(--bg);
  transition: background 0.4s ease;
}

.app-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.brand {
  display: flex;
  align-items: center;
  gap: 8px;
}

.logo {
  width: 22px;
  height: 22px;
}

.brand-name {
  font-size: 15px;
  font-weight: 700;
  letter-spacing: 0.5px;
}

.icon-btn {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 34px;
  height: 34px;
  border-radius: 10px;
  color: var(--text-3);
  transition: color 0.2s, background 0.2s;
}

.icon-btn:hover {
  color: var(--text-1);
  background: var(--bg-inset);
}

.icon-btn svg {
  width: 18px;
  height: 18px;
}

.app-main {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

.tabbar {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: var(--bg-inset);
  border-radius: 14px;
}

.tab {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 0;
  border-radius: 10px;
  color: var(--text-3);
  transition: all 0.2s;
}

.tab.on {
  background: var(--bg-card);
  color: var(--text-1);
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}

.tab-icon {
  font-size: 14px;
  line-height: 1;
}

.tab-label {
  font-size: 12px;
}
</style>
