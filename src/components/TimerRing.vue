<script setup lang="ts">
import { computed } from 'vue'
import { useTimerStore } from '../stores/timer'
import { formatDuration } from '../lib/format'
import { PHASE_LABEL } from '../lib/types'

const timer = useTimerStore()

const R = 104
const CIRC = 2 * Math.PI * R
const dashOffset = computed(() => CIRC * (1 - timer.progress))

const timeText = computed(() => formatDuration(timer.remainingMs))

const statusHint = computed(() => {
  if (timer.status === 'running') return timer.phase === 'focus' ? '保持专注…' : '放松一下'
  if (timer.status === 'paused') return '已暂停'
  return '准备开始'
})
</script>

<template>
  <div class="timer-ring">
    <svg viewBox="0 0 240 240" aria-hidden="true">
      <circle class="track" cx="120" cy="120" :r="R" />
      <circle
        class="value"
        cx="120"
        cy="120"
        :r="R"
        :stroke-dasharray="CIRC.toFixed(2)"
        :stroke-dashoffset="dashOffset.toFixed(2)"
      />
      <line class="tick" x1="120" y1="6" x2="120" y2="14" />
      <line class="tick" x1="120" y1="226" x2="120" y2="234" />
      <line class="tick" x1="6" y1="120" x2="14" y2="120" />
      <line class="tick" x1="226" y1="120" x2="234" y2="120" />
    </svg>
    <div class="center">
      <div class="phase">{{ PHASE_LABEL[timer.phase] }}</div>
      <div class="time">{{ timeText }}</div>
      <div class="hint">{{ statusHint }}</div>
    </div>
  </div>
</template>

<style scoped>
.timer-ring {
  position: relative;
  width: 262px;
  height: 262px;
}

svg {
  width: 100%;
  height: 100%;
  transform: rotate(-90deg);
}

.track {
  fill: none;
  stroke: var(--ring-track);
  stroke-width: 12;
}

.value {
  fill: none;
  stroke: var(--phase-color);
  stroke-width: 12;
  stroke-linecap: round;
  transition: stroke-dashoffset 0.25s linear, stroke 0.3s ease;
}

.tick {
  stroke: var(--ring-track);
  stroke-width: 3;
  stroke-linecap: round;
}

.center {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
}

.phase {
  font-size: 14px;
  letter-spacing: 6px;
  text-indent: 6px;
  color: var(--phase-color);
  font-weight: 600;
}

.time {
  font-size: 58px;
  font-weight: 700;
  line-height: 1;
  font-variant-numeric: tabular-nums;
  color: var(--text-1);
  letter-spacing: 1px;
}

.hint {
  font-size: 12px;
  color: var(--text-3);
}
</style>
