import { defineStore } from 'pinia'
import { computed, ref, watch } from 'vue'
import { useSettingsStore } from './settings'
import { useStatsStore } from './stats'
import { useTasksStore } from './tasks'
import { playChime } from '../lib/audio'
import { notify } from '../lib/notify'
import { setTrayState } from '../lib/backend'
import { formatDuration } from '../lib/format'
import { PHASE_LABEL, type Phase, type TimerStatus } from '../lib/types'

/**
 * 计时核心：剩余时间始终由「截止时刻 - performance.now()」推导，
 * performance.now() 是单调时钟，系统休眠/改时间不会让计时不准（FR-106）。
 */
export const useTimerStore = defineStore('timer', () => {
  const settingsStore = useSettingsStore()
  const stats = useStatsStore()
  const tasks = useTasksStore()

  const phase = ref<Phase>('focus')
  const status = ref<TimerStatus>('idle')
  const remainingMs = ref(settingsStore.settings.focusMin * 60_000)
  /** 运行时的单调截止时刻（performance.now() 基准），暂停/空闲时为 null */
  const endAt = ref<number | null>(null)
  /** 本轮已完成的番茄数，达到间隔后进入长休息 */
  const completedInCycle = ref(0)

  let ticker: ReturnType<typeof setInterval> | null = null

  const durationMs = computed(() => {
    const s = settingsStore.settings
    const minutes =
      phase.value === 'focus' ? s.focusMin : phase.value === 'short' ? s.shortBreakMin : s.longBreakMin
    return minutes * 60_000
  })

  const progress = computed(() => {
    if (status.value === 'idle') return 0
    const d = durationMs.value
    return d <= 0 ? 0 : Math.min(1, Math.max(0, (d - remainingMs.value) / d))
  })

  function ensureTicker(): void {
    if (ticker !== null) return
    ticker = setInterval(tick, 200)
  }

  function stopTicker(): void {
    if (ticker !== null) {
      clearInterval(ticker)
      ticker = null
    }
  }

  function tick(): void {
    if (status.value !== 'running' || endAt.value === null) return
    const rem = endAt.value - performance.now()
    if (rem <= 0) {
      remainingMs.value = 0
      onPhaseComplete()
    } else {
      remainingMs.value = rem
    }
  }

  function start(): void {
    if (status.value === 'running') return
    endAt.value = performance.now() + remainingMs.value
    status.value = 'running'
    ensureTicker()
  }

  function pause(): void {
    if (status.value !== 'running') return
    remainingMs.value = Math.max(0, (endAt.value ?? 0) - performance.now())
    status.value = 'paused'
    stopTicker()
  }

  function toggle(): void {
    if (status.value === 'running') pause()
    else start()
  }

  function reset(): void {
    status.value = 'idle'
    endAt.value = null
    remainingMs.value = durationMs.value
    stopTicker()
  }

  /** 待开始状态下手动切换阶段 */
  function selectPhase(p: Phase): void {
    if (status.value === 'running') return
    phase.value = p
    status.value = 'idle'
    endAt.value = null
    remainingMs.value = durationMs.value
  }

  function goNextPhase(autoStart: boolean): void {
    if (phase.value === 'focus') {
      phase.value = completedInCycle.value >= settingsStore.settings.longBreakInterval ? 'long' : 'short'
    } else {
      if (phase.value === 'long') completedInCycle.value = 0
      phase.value = 'focus'
    }
    remainingMs.value = durationMs.value
    endAt.value = null
    if (autoStart) {
      // 关键：完成瞬间 status 仍是 running，必须先复位，
      // 否则 start() 会因"已在运行"提前返回，休息阶段冻结不跳动
      status.value = 'idle'
      start()
    } else {
      status.value = 'idle'
      stopTicker()
    }
  }

  /** 记录一段专注（关联当前任务），并按场景发送系统通知 */
  function finishFocus(completed: boolean): void {
    const elapsed = completed ? durationMs.value : durationMs.value - remainingMs.value
    const task = tasks.currentTask
    void stats.recordSession(
      task?.id ?? null,
      task?.name ?? '未关联任务',
      Math.round(Date.now() - elapsed), // performance.now 带小数，取整避免 u64 反序列化失败
      Math.round(elapsed),
      completed,
    )
  }

  function notifyPhaseEnd(finishedFocus: boolean): void {
    const s = settingsStore.settings
    if (!s.notifyEnabled) return
    const task = tasks.currentTask
    if (finishedFocus) {
      void notify('专注结束 🍅', `${task ? `「${task.name}」` : ''}完成一个番茄，休息一下吧`)
    } else {
      void notify('休息结束 ⏰', '准备好开始下一个专注了吗？')
    }
  }

  function onPhaseComplete(): void {
    stopTicker()
    const finishedFocus = phase.value === 'focus'
    const s = settingsStore.settings
    if (finishedFocus) {
      completedInCycle.value += 1
      finishFocus(true)
      if (s.soundEnabled) playChime('focusEnd', s.volume)
    } else if (s.soundEnabled) {
      playChime('breakEnd', s.volume)
    }
    notifyPhaseEnd(finishedFocus)
    goNextPhase(finishedFocus ? s.autoStartBreaks : s.autoStartFocus)
  }

  /** 跳过当前阶段：专注阶段只记录已专注的时长、不计番茄数 */
  function skip(): void {
    if (phase.value === 'focus' && status.value !== 'idle') {
      finishFocus(false)
    }
    stopTicker()
    goNextPhase(false)
  }

  // 待开始状态下修改时长设置，剩余时间随之更新
  watch(durationMs, () => {
    if (status.value === 'idle') remainingMs.value = durationMs.value
  })

  // 托盘状态同步（FR-401）：标题与菜单文字，秒级节流
  let lastTrayText = ''
  watch(
    () => [status.value, phase.value, Math.ceil(remainingMs.value / 1000)] as const,
    () => {
      const running = status.value === 'running'
      const tooltip = running
        ? `${formatDuration(remainingMs.value)} · ${PHASE_LABEL[phase.value]} - PomodoroFlow`
        : 'PomodoroFlow'
      const toggleLabel = running ? '暂停' : status.value === 'paused' ? '继续' : '开始'
      const key = `${tooltip}|${toggleLabel}`
      if (key === lastTrayText) return
      lastTrayText = key
      void setTrayState(tooltip, toggleLabel)
    },
    { immediate: true },
  )

  return {
    phase,
    status,
    remainingMs,
    completedInCycle,
    durationMs,
    progress,
    start,
    pause,
    toggle,
    reset,
    skip,
    selectPhase,
  }
})
