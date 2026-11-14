import { isTauri, saveExport } from './backend'
import { t } from './i18n'
import type { SessionRecord, Task } from './types'

/**
 * 导出内容在 TS 侧组装：本地时区的时间格式化在 JS 更可靠，
 * Rust 只负责原生保存对话框与落盘。CSV 带 BOM，Excel 打开中文不乱码。
 */

function pad(n: number): string {
  return String(n).padStart(2, '0')
}

/** 本地时区的 YYYY-MM-DD HH:MM */
function fmtDateTime(ts: number): string {
  const d = new Date(ts)
  return (
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}` +
    ` ${pad(d.getHours())}:${pad(d.getMinutes())}`
  )
}

function csvEscape(v: string): string {
  return /[",\r\n]/.test(v) ? `"${v.replaceAll('"', '""')}"` : v
}

export function buildCsv(sessions: SessionRecord[]): string {
  const header = [
    t('csv.date'),
    t('csv.start'),
    t('csv.end'),
    t('csv.durationMin'),
    t('csv.task'),
    t('csv.completed'),
  ]
  const rows = sessions.map((s) => [
    fmtDateTime(s.start).slice(0, 10),
    fmtDateTime(s.start),
    fmtDateTime(s.start + s.durationMs),
    (s.durationMs / 60000).toFixed(1),
    s.taskName,
    s.completed ? 'true' : 'false',
  ])
  return (
    '\uFEFF' + [header, ...rows].map((r) => r.map(csvEscape).join(',')).join('\r\n') + '\r\n'
  )
}

export function buildJson(tasks: Task[], sessions: SessionRecord[]): string {
  return JSON.stringify(
    { version: 1, exportedAt: new Date().toISOString(), tasks, sessions },
    null,
    2,
  )
}

function dateStamp(): string {
  const d = new Date()
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

/** 浏览器开发环境：直接触发下载（无对话框） */
function downloadInBrowser(filename: string, content: string, mime: string): null {
  const blob = new Blob([content], { type: mime })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
  return null
}

export async function exportCsv(sessions: SessionRecord[]): Promise<string | null> {
  const name = `pomodoroflow-${dateStamp()}.csv`
  const content = buildCsv(sessions)
  if (!isTauri) return downloadInBrowser(name, content, 'text/csv')
  return saveExport(name, 'CSV', 'csv', content)
}

export async function exportJson(
  tasks: Task[],
  sessions: SessionRecord[],
): Promise<string | null> {
  const name = `pomodoroflow-${dateStamp()}.json`
  const content = buildJson(tasks, sessions)
  if (!isTauri) return downloadInBrowser(name, content, 'application/json')
  return saveExport(name, 'JSON', 'json', content)
}

/* ---------- 导入解析：字段清洗，坏记录直接丢弃 ---------- */

export interface BackupData {
  tasks: Task[]
  sessions: SessionRecord[]
}

function sanitizeTask(raw: unknown): Task | null {
  if (typeof raw !== 'object' || raw === null) return null
  const o = raw as Record<string, unknown>
  if (typeof o.id !== 'string' || typeof o.name !== 'string' || o.name.trim() === '') return null
  return {
    id: o.id,
    name: o.name,
    createdAt: Math.round(Number(o.createdAt)) || 0,
    doneAt: o.doneAt == null ? null : Math.round(Number(o.doneAt)) || null,
  }
}

function sanitizeSession(raw: unknown): SessionRecord | null {
  if (typeof raw !== 'object' || raw === null) return null
  const o = raw as Record<string, unknown>
  if (typeof o.id !== 'string' || typeof o.taskName !== 'string') return null
  const start = Math.round(Number(o.start))
  const duration = Math.round(Number(o.durationMs))
  if (!Number.isFinite(start) || start <= 0 || !Number.isFinite(duration) || duration <= 0) {
    return null
  }
  return {
    id: o.id,
    taskId: typeof o.taskId === 'string' ? o.taskId : null,
    taskName: o.taskName,
    start,
    durationMs: duration,
    completed: o.completed === true,
  }
}

export function parseBackup(text: string): BackupData | null {
  try {
    const v = JSON.parse(text) as Record<string, unknown>
    if (!Array.isArray(v.tasks) || !Array.isArray(v.sessions)) return null
    const tasks = v.tasks.map(sanitizeTask).filter((x): x is Task => x !== null)
    const sessions = v.sessions.map(sanitizeSession).filter((x): x is SessionRecord => x !== null)
    if (tasks.length === 0 && sessions.length === 0) return null
    return { tasks, sessions }
  } catch {
    return null
  }
}
