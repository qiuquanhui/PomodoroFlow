import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import * as backend from '../lib/backend'
import type { DayStats, SessionRecord } from '../lib/types'

const EMPTY: DayStats = { focusMs: 0, completed: 0, skipped: 0 }

/** 本地时区的某天的 YYYY-MM-DD。 */
function dayKey(ts: number): string {
  const d = new Date(ts)
  const p = (n: number) => String(n).padStart(2, '0')
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`
}

export function todayStr(): string {
  return dayKey(Date.now())
}

export const useStatsStore = defineStore('stats', () => {
  /** 全部专注会话记录（长期） */
  const sessions = ref<SessionRecord[]>([])
  const loaded = ref(false)

  async function load(): Promise<void> {
    sessions.value = await backend.getSessions()
    loaded.value = true
  }

  /**
   * 追加一条专注记录：自然完成计入番茄数；被跳过的只记时长并标注未完成
   * （需求文档 Q-03）。过短的未完成片段直接忽略。
   */
  async function recordSession(
    taskId: string | null,
    taskName: string,
    start: number,
    durationMs: number,
    completed: boolean,
  ): Promise<void> {
    if (!completed && durationMs < 30_000) return
    const s: SessionRecord = {
      id: `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`,
      taskId,
      taskName,
      start: Math.round(start),
      durationMs: Math.round(durationMs),
      completed,
    }
    sessions.value.push(s)
    try {
      await backend.appendSession(s)
    } catch (e) {
      console.error('appendSession failed:', e)
    }
  }

  /** 今日概览（FR-502），从会话记录实时计算 */
  const today = computed<DayStats>(() => {
    const key = todayStr()
    const agg = { ...EMPTY }
    for (const s of sessions.value) {
      if (dayKey(s.start) !== key) continue
      agg.focusMs += s.durationMs
      if (s.completed) agg.completed += 1
      else agg.skipped += 1
    }
    return agg
  })

  /** 指定天数内每日专注分钟数（含今天），用于柱状图 */
  const dailyMinutes = (days: number) => {
    const keys: string[] = []
    const now = new Date()
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i)
      keys.push(dayKey(d.getTime()))
    }
    const map = new Map<string, number>(keys.map((k) => [k, 0]))
    for (const s of sessions.value) {
      const k = dayKey(s.start)
      const v = map.get(k)
      if (v !== undefined) map.set(k, v + s.durationMs / 60000)
    }
    return keys.map((k) => ({ key: k, minutes: Math.round(map.get(k) ?? 0) }))
  }

  /** 任务维度的专注分钟数（可按需限定范围，M3 支持今日占比） */
  function taskMinutesOf(list: SessionRecord[]): Array<{ name: string; minutes: number }> {
    const map = new Map<string, number>()
    for (const s of list) {
      map.set(s.taskName, (map.get(s.taskName) ?? 0) + s.durationMs / 60000)
    }
    return [...map.entries()]
      .map(([name, minutes]) => ({ name, minutes }))
      .sort((a, b) => b.minutes - a.minutes)
  }

  /** 全部历史的任务时间占比 */
  const taskMinutes = computed(() => taskMinutesOf(sessions.value))

  /** 今日的任务时间占比（M3 新需求） */
  const todayTaskMinutes = computed(() => {
    const key = todayStr()
    return taskMinutesOf(sessions.value.filter((s) => dayKey(s.start) === key))
  })

  /** 累计与连续天数（FR-502 streak） */
  const totals = computed(() => {
    let focusMs = 0
    let completed = 0
    const daysWith = new Set<string>()
    for (const s of sessions.value) {
      focusMs += s.durationMs
      if (s.completed) {
        completed += 1
        daysWith.add(dayKey(s.start))
      }
    }
    // streak：从今天往前数连续有完成番茄的天数（今天还没完成则从昨天起算）
    let streak = 0
    const cursor = new Date()
    if (!daysWith.has(dayKey(cursor.getTime()))) cursor.setDate(cursor.getDate() - 1)
    while (daysWith.has(dayKey(cursor.getTime()))) {
      streak += 1
      cursor.setDate(cursor.getDate() - 1)
    }
    return { focusMs, completed, streak, days: daysWith.size }
  })

  return {
    sessions,
    loaded,
    today,
    taskMinutes,
    todayTaskMinutes,
    totals,
    load,
    recordSession,
    dailyMinutes,
  }
})
