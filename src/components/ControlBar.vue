<script setup lang="ts">
import { useTimerStore } from '../stores/timer'
import { t } from '../lib/i18n'

const timer = useTimerStore()

function onToggle(): void {
  timer.toggle()
}
</script>

<template>
  <div class="controls">
    <button
      class="ctrl secondary"
      :title="t('ctrl.resetTitle')"
      :disabled="timer.status === 'idle'"
      :aria-label="t('ctrl.reset')"
      @click="timer.reset()"
    >
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
        <polyline points="1 4 1 10 7 10" />
        <path d="M3.51 15a9 9 0 1 0 2.13-9.36L1 10" />
      </svg>
    </button>

    <button class="ctrl primary" :aria-label="t('ctrl.toggleAria')" @click="onToggle">
      <svg v-if="timer.status === 'running'" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <rect x="6" y="4" width="4" height="16" rx="1" />
        <rect x="14" y="4" width="4" height="16" rx="1" />
      </svg>
      <svg v-else viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <polygon points="7 4 20 12 7 20" />
      </svg>
      <span>{{ timer.status === 'running' ? t('ctrl.pause') : timer.status === 'paused' ? t('ctrl.resume') : t('ctrl.start') }}</span>
    </button>

    <button class="ctrl secondary" :title="t('ctrl.skipTitle')" :aria-label="t('ctrl.skip')" @click="timer.skip()">
      <svg viewBox="0 0 24 24" fill="none" aria-hidden="true">
        <polygon points="5 4 15 12 5 20" fill="currentColor" />
        <line x1="19" y1="5" x2="19" y2="19" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" />
      </svg>
    </button>
  </div>
</template>

<style scoped>
.controls {
  display: flex;
  align-items: center;
  gap: 18px;
}

.ctrl {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  cursor: pointer;
  color: var(--text-2);
  transition: transform 0.15s, background 0.2s, color 0.2s, box-shadow 0.2s;
}

.ctrl:active {
  transform: scale(0.95);
}

.ctrl.secondary {
  width: 46px;
  height: 46px;
  border-radius: 50%;
  background: var(--bg-inset);
}

.ctrl.secondary svg {
  width: 20px;
  height: 20px;
}

.ctrl.secondary:hover:not(:disabled) {
  color: var(--text-1);
  background: var(--border);
}

.ctrl.secondary:disabled {
  opacity: 0.4;
  cursor: not-allowed;
}

.ctrl.primary {
  min-width: 148px;
  height: 52px;
  padding: 0 28px;
  border-radius: 999px;
  background: var(--phase-color);
  color: #fff;
  font-size: 16px;
  font-weight: 600;
  letter-spacing: 2px;
  box-shadow: 0 6px 18px var(--phase-soft-strong);
}

.ctrl.primary svg {
  width: 18px;
  height: 18px;
}

.ctrl.primary:hover {
  filter: brightness(1.06);
  box-shadow: 0 8px 22px var(--phase-soft-strong);
}
</style>
