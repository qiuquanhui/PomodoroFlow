<script setup lang="ts">
import { useTimerStore } from '../stores/timer'
import { PHASE_LABEL, type Phase } from '../lib/types'

const timer = useTimerStore()
const phases: Phase[] = ['focus', 'short', 'long']
</script>

<template>
  <div class="phase-pills" role="tablist" aria-label="阶段切换">
    <button
      v-for="p in phases"
      :key="p"
      role="tab"
      class="pill"
      :class="{ active: timer.phase === p }"
      :aria-selected="timer.phase === p"
      :disabled="timer.status === 'running'"
      :title="timer.status === 'running' ? '计时进行中，暂不能切换' : `切换到${PHASE_LABEL[p]}`"
      @click="timer.selectPhase(p)"
    >
      {{ PHASE_LABEL[p] }}
    </button>
  </div>
</template>

<style scoped>
.phase-pills {
  display: flex;
  gap: 4px;
  padding: 4px;
  background: var(--bg-inset);
  border-radius: 999px;
  width: 100%;
}

.pill {
  flex: 1;
  padding: 8px 0;
  border-radius: 999px;
  font-size: 13px;
  color: var(--text-2);
  transition: color 0.2s, background 0.2s, box-shadow 0.2s;
}

.pill:hover:not(:disabled):not(.active) {
  color: var(--text-1);
}

.pill.active {
  background: var(--bg-card);
  color: var(--phase-color);
  font-weight: 600;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.12);
}

.pill:disabled {
  opacity: 0.55;
  cursor: not-allowed;
}
</style>
