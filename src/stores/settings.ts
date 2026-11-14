import { defineStore } from 'pinia'
import { ref, watch } from 'vue'
import { defaultSettings, type AppSettings } from '../lib/types'
import * as backend from '../lib/backend'
import { setLocale, type Locale } from '../lib/i18n'

function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = Math.floor(Number(v))
  if (!Number.isFinite(n)) return fallback
  return Math.min(max, Math.max(min, n))
}

/** 任何来源（磁盘、表单）的设置都先清洗，保证落盘数据合法。 */
export function sanitize(raw: Partial<AppSettings>): AppSettings {
  return {
    focusMin: clampInt(raw.focusMin, 1, 120, defaultSettings.focusMin),
    shortBreakMin: clampInt(raw.shortBreakMin, 1, 60, defaultSettings.shortBreakMin),
    longBreakMin: clampInt(raw.longBreakMin, 1, 60, defaultSettings.longBreakMin),
    longBreakInterval: clampInt(raw.longBreakInterval, 2, 8, defaultSettings.longBreakInterval),
    autoStartBreaks: raw.autoStartBreaks ?? defaultSettings.autoStartBreaks,
    autoStartFocus: raw.autoStartFocus ?? defaultSettings.autoStartFocus,
    soundEnabled: raw.soundEnabled ?? defaultSettings.soundEnabled,
    notifyEnabled: raw.notifyEnabled ?? defaultSettings.notifyEnabled,
    volume: clampInt(raw.volume, 0, 100, defaultSettings.volume),
    theme: raw.theme === 'light' || raw.theme === 'dark' ? raw.theme : 'system',
    locale: raw.locale === 'en' ? 'en' : 'zh-CN',
    hotkeyEnabled: raw.hotkeyEnabled ?? defaultSettings.hotkeyEnabled,
  }
}

export const useSettingsStore = defineStore('settings', () => {
  const settings = ref<AppSettings>({ ...defaultSettings })
  const loaded = ref(false)

  async function load(): Promise<void> {
    settings.value = sanitize(await backend.loadSettings())
    setLocale(settings.value.locale)
    loaded.value = true

    // 语言切换即时生效（托盘/标题由各自 watcher 响应 locale 变化）
    watch(
      () => settings.value.locale,
      (l: Locale) => setLocale(l),
    )

    let saveTimer: ReturnType<typeof setTimeout> | undefined
    watch(
      settings,
      (s) => {
        if (saveTimer) clearTimeout(saveTimer)
        saveTimer = setTimeout(() => void backend.saveSettings(s), 300)
      },
      { deep: true },
    )
  }

  function patch(p: Partial<AppSettings>): void {
    settings.value = sanitize({ ...settings.value, ...p })
  }

  return { settings, loaded, load, patch }
})
