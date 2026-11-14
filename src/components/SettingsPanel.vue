<script setup lang="ts">
import { onMounted, reactive, ref, watch } from 'vue'
import { useSettingsStore } from '../stores/settings'
import { useTasksStore } from '../stores/tasks'
import { useStatsStore } from '../stores/stats'
import { playChime, warmAudio } from '../lib/audio'
import { t, type Locale } from '../lib/i18n'
import {
  getAutostart,
  setAutostart,
  setHotkeyEnabled,
  pickImportFile,
  mergeSessions,
  upsertTask,
} from '../lib/backend'
import { exportCsv, exportJson, parseBackup } from '../lib/exporter'
import type { AppSettings, Theme } from '../lib/types'

const emit = defineEmits<{ close: [] }>()
const store = useSettingsStore()
const tasksStore = useTasksStore()
const statsStore = useStatsStore()

// 本地表单副本；变更即应用（清洗与持久化由 settings store 完成）
const form = reactive<AppSettings>({ ...store.settings })

// store 清洗（如越界值被夹回）后同步回表单
watch(
  () => store.settings,
  (s) => Object.assign(form, s),
  { deep: true },
)

function apply<K extends keyof AppSettings>(key: K, value: AppSettings[K]): void {
  form[key] = value
  store.patch({ ...form })
}

function numFromEvent(e: Event): number {
  const input = e.target as HTMLInputElement
  const v = input.valueAsNumber
  return Number.isFinite(v) ? v : Number.NaN
}

function checkedFromEvent(e: Event): boolean {
  return (e.target as HTMLInputElement).checked
}

const themes: Array<{ value: Theme; key: string }> = [
  { value: 'system', key: 'theme.system' },
  { value: 'light', key: 'theme.light' },
  { value: 'dark', key: 'theme.dark' },
]

const languages: Array<{ value: Locale; label: string }> = [
  { value: 'zh-CN', label: '中文' },
  { value: 'en', label: 'English' },
]

function testSound(): void {
  warmAudio()
  playChime('focusEnd', form.volume)
}

/* ---- 开机自启（M3）：状态以系统为准，失败时回显实际值 ---- */
const autostartOn = ref(false)
onMounted(async () => {
  autostartOn.value = await getAutostart()
})

async function onToggleAutostart(e: Event): Promise<void> {
  const target = e.target as HTMLInputElement
  const want = target.checked
  target.checked = autostartOn.value // 先还原，成功后再翻转，失败时 UI 不说谎
  try {
    await setAutostart(want)
    autostartOn.value = want
    target.checked = want
  } catch (err) {
    console.error('setAutostart failed:', err)
  }
}

/* ---- 全局热键（M3）：设置持久化 + 即时注册/注销 ---- */
async function onToggleHotkey(e: Event): Promise<void> {
  const want = checkedFromEvent(e)
  try {
    await setHotkeyEnabled(want)
    apply('hotkeyEnabled', want)
  } catch (err) {
    console.error('setHotkeyEnabled failed:', err)
    showMsg(t('msg.exportFail', { err: String(err) }))
  }
}

/* ---- 导出 / 导入（M3） ---- */
const busy = ref(false)
const message = ref('')
let msgTimer: ReturnType<typeof setTimeout> | undefined

function showMsg(text: string): void {
  message.value = text
  if (msgTimer) clearTimeout(msgTimer)
  msgTimer = setTimeout(() => (message.value = ''), 6000)
}

async function onExport(fmt: 'json' | 'csv'): Promise<void> {
  if (busy.value) return
  busy.value = true
  try {
    const path =
      fmt === 'json'
        ? await exportJson(tasksStore.tasks, statsStore.sessions)
        : await exportCsv(statsStore.sessions)
    if (path) showMsg(`${t('msg.exported', { count: statsStore.sessions.length })} · ${path}`)
  } catch (err) {
    showMsg(t('msg.exportFail', { err: String(err) }))
  } finally {
    busy.value = false
  }
}

async function onImport(): Promise<void> {
  if (busy.value) return
  busy.value = true
  try {
    const text = await pickImportFile()
    if (!text) return
    const data = parseBackup(text)
    if (!data) {
      showMsg(t('msg.invalidFile'))
      return
    }
    const counts = await mergeSessions(data.sessions)
    let tasksImported = 0
    for (const task of data.tasks) {
      if (tasksStore.tasks.some((x) => x.id === task.id)) continue
      tasksStore.tasks.push(task)
      await upsertTask(task)
      tasksImported += 1
    }
    await Promise.all([statsStore.load(), tasksStore.load()])
    showMsg(t('msg.imported', { sessions: counts.imported, tasks: tasksImported, skipped: counts.skipped }))
  } catch (err) {
    showMsg(t('msg.importFail', { err: String(err) }))
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="overlay" @click.self="emit('close')">
    <div class="panel card" role="dialog" aria-modal="true" :aria-label="t('common.settings')">
      <header class="panel-header">
        <h2>{{ t('common.settings') }}</h2>
        <button class="icon-btn" :aria-label="t('settings.close')" @click="emit('close')">✕</button>
      </header>

      <div class="panel-body">
        <section>
          <h3>{{ t('settings.durations') }}</h3>
          <div class="grid2">
            <div class="field">
              <label for="set-focus">{{ t('settings.focusMin') }}</label>
              <input id="set-focus" type="number" min="1" max="120" step="1" :value="form.focusMin"
                @change="apply('focusMin', numFromEvent($event))" />
            </div>
            <div class="field">
              <label for="set-short">{{ t('settings.shortMin') }}</label>
              <input id="set-short" type="number" min="1" max="60" step="1" :value="form.shortBreakMin"
                @change="apply('shortBreakMin', numFromEvent($event))" />
            </div>
            <div class="field">
              <label for="set-long">{{ t('settings.longMin') }}</label>
              <input id="set-long" type="number" min="1" max="60" step="1" :value="form.longBreakMin"
                @change="apply('longBreakMin', numFromEvent($event))" />
            </div>
            <div class="field">
              <label for="set-interval">{{ t('settings.interval') }}</label>
              <input id="set-interval" type="number" min="2" max="8" step="1" :value="form.longBreakInterval"
                @change="apply('longBreakInterval', numFromEvent($event))" />
            </div>
          </div>
        </section>

        <section>
          <h3>{{ t('settings.flow') }}</h3>
          <label class="row">
            <span>{{ t('settings.autoBreaks') }}</span>
            <input type="checkbox" class="switch" :checked="form.autoStartBreaks"
              @change="apply('autoStartBreaks', checkedFromEvent($event))" />
          </label>
          <label class="row">
            <span>{{ t('settings.autoFocus') }}</span>
            <input type="checkbox" class="switch" :checked="form.autoStartFocus"
              @change="apply('autoStartFocus', checkedFromEvent($event))" />
          </label>
        </section>

        <section>
          <h3>{{ t('settings.notify') }}</h3>
          <label class="row">
            <span>{{ t('settings.sound') }}</span>
            <input type="checkbox" class="switch" :checked="form.soundEnabled"
              @change="apply('soundEnabled', checkedFromEvent($event))" />
          </label>
          <label class="row">
            <span>{{ t('settings.sysNotify') }}</span>
            <input type="checkbox" class="switch" :checked="form.notifyEnabled"
              @change="apply('notifyEnabled', checkedFromEvent($event))" />
          </label>
          <div class="row">
            <span>{{ t('settings.volume') }}</span>
            <div class="volume-row">
              <input type="range" min="0" max="100" step="1" :value="form.volume"
                @input="apply('volume', numFromEvent($event))" />
              <span class="volume-num">{{ form.volume }}%</span>
              <button class="mini-btn" @click="testSound">{{ t('settings.test') }}</button>
            </div>
          </div>
        </section>

        <section>
          <h3>{{ t('settings.general') }}</h3>
          <div class="row">
            <span>{{ t('settings.language') }}</span>
            <div class="lang-pills">
              <button
                v-for="l in languages"
                :key="l.value"
                class="lang-pill"
                :class="{ active: form.locale === l.value }"
                @click="apply('locale', l.value)"
              >
                {{ l.label }}
              </button>
            </div>
          </div>
          <label class="row">
            <span>{{ t('settings.autostart') }}</span>
            <input type="checkbox" class="switch" :checked="autostartOn" @change="onToggleAutostart" />
          </label>
          <label class="row">
            <span>{{ t('settings.hotkey') }}</span>
            <input type="checkbox" class="switch" :checked="form.hotkeyEnabled" @change="onToggleHotkey" />
          </label>
          <p class="hint">{{ t('settings.hotkeyHint') }}</p>
        </section>

        <section>
          <h3>{{ t('settings.appearance') }}</h3>
          <div class="theme-pills">
            <button
              v-for="opt in themes"
              :key="opt.value"
              class="theme-pill"
              :class="{ active: form.theme === opt.value }"
              @click="apply('theme', opt.value)"
            >
              {{ t(opt.key) }}
            </button>
          </div>
        </section>

        <section>
          <h3>{{ t('settings.data') }}</h3>
          <div class="data-actions">
            <button class="data-btn" :disabled="busy" @click="onExport('json')">{{ t('settings.exportJson') }}</button>
            <button class="data-btn" :disabled="busy" @click="onExport('csv')">{{ t('settings.exportCsv') }}</button>
            <button class="data-btn primary" :disabled="busy" @click="onImport">{{ t('settings.import') }}</button>
          </div>
          <p class="hint">{{ t('settings.importHint') }}</p>
          <p v-if="message" class="msg">{{ message }}</p>
        </section>

        <p class="footnote">{{ t('settings.footnote') }}</p>
      </div>
    </div>
  </div>
</template>

<style scoped>
.overlay {
  position: fixed;
  inset: 0;
  background: rgba(10, 12, 16, 0.45);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
  animation: fade-in 0.15s ease;
}

.panel {
  width: calc(100% - 32px);
  max-height: 86vh;
  overflow-y: auto;
  animation: slide-up 0.2s ease;
}

.panel-header {
  position: sticky;
  top: 0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 16px 20px 10px;
  background: var(--bg-card);
  border-bottom: 1px solid var(--border);
}

.panel-header h2 {
  font-size: 16px;
  font-weight: 700;
}

.panel-body {
  padding: 6px 20px 18px;
}

section {
  margin-top: 16px;
}

section h3 {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-3);
  letter-spacing: 2px;
  margin-bottom: 10px;
}

.grid2 {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 10px 14px;
}

.field {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.field label {
  font-size: 12px;
  color: var(--text-2);
}

.field input[type='number'] {
  width: 100%;
  height: 36px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 8px;
  background: var(--bg-inset);
  color: var(--text-1);
  font-size: 14px;
  font-variant-numeric: tabular-nums;
}

.field input[type='number']:focus {
  outline: none;
  border-color: var(--phase-color);
}

.row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  padding: 8px 0;
  font-size: 13px;
  color: var(--text-1);
}

.volume-row {
  display: flex;
  align-items: center;
  gap: 10px;
}

.volume-row input[type='range'] {
  width: 110px;
  accent-color: var(--phase-color);
}

.volume-num {
  font-size: 12px;
  color: var(--text-2);
  width: 38px;
  text-align: right;
  font-variant-numeric: tabular-nums;
}

.mini-btn {
  padding: 4px 12px;
  border-radius: 999px;
  border: 1px solid var(--border);
  color: var(--text-2);
  font-size: 12px;
}

.mini-btn:hover {
  color: var(--text-1);
  border-color: var(--phase-color);
}

.lang-pills {
  display: flex;
  gap: 6px;
}

.lang-pill {
  padding: 5px 14px;
  border-radius: 999px;
  border: 1px solid var(--border);
  color: var(--text-2);
  font-size: 12px;
  transition: all 0.2s;
}

.lang-pill.active {
  border-color: var(--phase-color);
  color: var(--phase-color);
  font-weight: 600;
  background: var(--phase-soft);
}

.data-actions {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.data-btn {
  flex: 1;
  min-width: 96px;
  height: 34px;
  border-radius: 8px;
  border: 1px solid var(--border);
  color: var(--text-2);
  font-size: 12px;
  transition: all 0.2s;
}

.data-btn:hover:not(:disabled) {
  color: var(--text-1);
  border-color: var(--phase-color);
}

.data-btn.primary {
  border-color: var(--phase-color);
  color: var(--phase-color);
  font-weight: 600;
}

.data-btn:disabled {
  opacity: 0.5;
}

.hint {
  margin-top: 6px;
  font-size: 11px;
  color: var(--text-3);
}

.msg {
  margin-top: 8px;
  padding: 8px 10px;
  border-radius: 8px;
  background: var(--phase-soft);
  color: var(--text-1);
  font-size: 12px;
  word-break: break-all;
}

.theme-pills {
  display: flex;
  gap: 8px;
}

.theme-pill {
  flex: 1;
  height: 34px;
  border-radius: 8px;
  border: 1px solid var(--border);
  color: var(--text-2);
  font-size: 13px;
  transition: all 0.2s;
}

.theme-pill.active {
  border-color: var(--phase-color);
  color: var(--phase-color);
  font-weight: 600;
  background: var(--phase-soft);
}

.footnote {
  margin-top: 18px;
  font-size: 11px;
  color: var(--text-3);
  text-align: center;
}

.switch {
  appearance: none;
  width: 40px;
  height: 22px;
  border-radius: 999px;
  background: var(--ring-track);
  position: relative;
  cursor: pointer;
  transition: background 0.2s;
  flex-shrink: 0;
}

.switch::after {
  content: '';
  position: absolute;
  top: 2px;
  left: 2px;
  width: 18px;
  height: 18px;
  border-radius: 50%;
  background: #fff;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.3);
  transition: transform 0.2s;
}

.switch:checked {
  background: var(--phase-color);
}

.switch:checked::after {
  transform: translateX(18px);
}

@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slide-up {
  from { opacity: 0; transform: translateY(14px); }
  to { opacity: 1; transform: translateY(0); }
}
</style>
