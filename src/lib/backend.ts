import { invoke } from '@tauri-apps/api/core'
import type { AppSettings, DayStats, SessionRecord, Task } from './types'

/**
 * 后端访问层：在 Tauri 中走 Rust 命令，纯浏览器开发时退化为 localStorage，
 * 方便 `npm run dev` 直接调试界面。
 */
export const isTauri = typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

const LS_SETTINGS = 'pf.settings'
const LS_STATS = 'pf.stats'

export async function loadSettings(): Promise<Partial<AppSettings>> {
  if (isTauri) {
    try {
      return await invoke<AppSettings>('get_settings')
    } catch (e) {
      console.error('loadSettings failed:', e)
      return {}
    }
  }
  try {
    return JSON.parse(localStorage.getItem(LS_SETTINGS) ?? '{}') as Partial<AppSettings>
  } catch {
    return {}
  }
}

export async function saveSettings(s: AppSettings): Promise<void> {
  if (isTauri) {
    await invoke('save_settings', { settings: s })
    return
  }
  localStorage.setItem(LS_SETTINGS, JSON.stringify(s))
}

export async function getStats(): Promise<Record<string, DayStats>> {
  if (isTauri) {
    try {
      return await invoke<Record<string, DayStats>>('get_stats')
    } catch (e) {
      console.error('getStats failed:', e)
      return {}
    }
  }
  try {
    return JSON.parse(localStorage.getItem(LS_STATS) ?? '{}') as Record<string, DayStats>
  } catch {
    return {}
  }
}

export async function recordFocus(date: string, focusMs: number, completed: boolean): Promise<void> {
  if (isTauri) {
    await invoke('record_focus', { date, focusMs, completed })
    return
  }
  const all = await getStats()
  const day = all[date] ?? { focusMs: 0, completed: 0, skipped: 0 }
  day.focusMs += Math.round(focusMs)
  if (completed) day.completed += 1
  else day.skipped += 1
  all[date] = day
  localStorage.setItem(LS_STATS, JSON.stringify(all))
}

/* ---------- 任务（M2） ---------- */

const LS_TASKS = 'pf.tasks'

export async function getTasks(): Promise<Task[]> {
  if (isTauri) {
    try {
      return await invoke<Task[]>('get_tasks')
    } catch (e) {
      console.error('getTasks failed:', e)
      return []
    }
  }
  try {
    return JSON.parse(localStorage.getItem(LS_TASKS) ?? '[]') as Task[]
  } catch {
    return []
  }
}

export async function upsertTask(task: Task): Promise<void> {
  if (isTauri) {
    await invoke('upsert_task', { task })
    return
  }
  const all = await getTasks()
  const idx = all.findIndex((t) => t.id === task.id)
  if (idx >= 0) all[idx] = task
  else all.push(task)
  localStorage.setItem(LS_TASKS, JSON.stringify(all))
}

export async function deleteTask(id: string): Promise<void> {
  if (isTauri) {
    await invoke('delete_task', { id })
    return
  }
  const all = (await getTasks()).filter((t) => t.id !== id)
  localStorage.setItem(LS_TASKS, JSON.stringify(all))
}

/* ---------- 专注会话记录（M2，长期统计的数据源） ---------- */

const LS_SESSIONS = 'pf.sessions'

export async function getSessions(): Promise<SessionRecord[]> {
  if (isTauri) {
    try {
      return await invoke<SessionRecord[]>('get_sessions')
    } catch (e) {
      console.error('getSessions failed:', e)
      return []
    }
  }
  try {
    return JSON.parse(localStorage.getItem(LS_SESSIONS) ?? '[]') as SessionRecord[]
  } catch {
    return []
  }
}

export async function appendSession(s: SessionRecord): Promise<void> {
  if (isTauri) {
    await invoke('append_session', { session: s })
    return
  }
  const all = await getSessions()
  all.push(s)
  localStorage.setItem(LS_SESSIONS, JSON.stringify(all))
}

/* ---------- 托盘状态同步（M2 + M3 菜单文案国际化） ---------- */

export async function setTrayState(
  tooltip: string,
  toggleLabel: string,
  showLabel: string,
  skipLabel: string,
  quitLabel: string,
): Promise<void> {
  if (!isTauri) return
  try {
    await invoke('set_tray_state', { tooltip, toggleLabel, showLabel, skipLabel, quitLabel })
  } catch (e) {
    console.error('setTrayState failed:', e)
  }
}

/* ---------- 导出 / 导入（M3） ---------- */

/** 调起系统保存对话框并写入内容；用户取消返回 null */
export async function saveExport(
  defaultName: string,
  filterName: string,
  filterExt: string,
  content: string,
): Promise<string | null> {
  return invoke<string | null>('save_export', { defaultName, filterName, filterExt, content })
}

/** 选择并读取 JSON 备份文件；用户取消返回 null */
export async function pickImportFile(): Promise<string | null> {
  return invoke<string | null>('pick_import_file')
}

export interface MergeCounts {
  imported: number
  skipped: number
}

/** 按 id 去重合并会话记录（M3 导入） */
export async function mergeSessions(incoming: SessionRecord[]): Promise<MergeCounts> {
  return invoke<MergeCounts>('merge_sessions', { incoming })
}

/* ---------- 开机自启 / 全局热键（M3） ---------- */

export async function getAutostart(): Promise<boolean> {
  if (!isTauri) return false
  try {
    return await invoke<boolean>('get_autostart')
  } catch (e) {
    console.error('getAutostart failed:', e)
    return false
  }
}

export async function setAutostart(enabled: boolean): Promise<void> {
  await invoke('set_autostart', { enabled })
}

export async function setHotkeyEnabled(enabled: boolean): Promise<void> {
  await invoke('set_hotkey_enabled', { enabled })
}
