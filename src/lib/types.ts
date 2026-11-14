import type { Locale } from './i18n'

export type Phase = 'focus' | 'short' | 'long'
export type TimerStatus = 'idle' | 'running' | 'paused'
export type Theme = 'light' | 'dark' | 'system'

export interface AppSettings {
  focusMin: number
  shortBreakMin: number
  longBreakMin: number
  longBreakInterval: number
  autoStartBreaks: boolean
  autoStartFocus: boolean
  soundEnabled: boolean
  notifyEnabled: boolean
  volume: number
  theme: Theme
  /** 界面语言（M3） */
  locale: Locale
  /** 全局热键 Ctrl+Alt+Space（M3） */
  hotkeyEnabled: boolean
}

export const defaultSettings: AppSettings = {
  focusMin: 25,
  shortBreakMin: 5,
  longBreakMin: 15,
  longBreakInterval: 4,
  autoStartBreaks: false,
  autoStartFocus: false,
  soundEnabled: true,
  notifyEnabled: true,
  volume: 70,
  theme: 'system',
  locale: 'zh-CN',
  hotkeyEnabled: true,
}

export interface DayStats {
  focusMs: number
  completed: number
  skipped: number
}

/** 任务（FR-201/203） */
export interface Task {
  id: string
  name: string
  createdAt: number
  /** 完成时间，null 表示未完成 */
  doneAt: number | null
}

/** 一次专注记录（FR-501）：长期保存，支撑按日/按任务统计 */
export interface SessionRecord {
  id: string
  /** 关联任务 id，可能为空（未选择任务） */
  taskId: string | null
  /** 任务名快照：任务被删除后历史统计仍然可读 */
  taskName: string
  /** 开始时间（epoch ms） */
  start: number
  durationMs: number
  /** 自然完成 = true；被跳过 = false */
  completed: boolean
}
