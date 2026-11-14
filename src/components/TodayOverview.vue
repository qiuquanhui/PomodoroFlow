<script setup lang="ts">
import { useStatsStore } from '../stores/stats'
import { formatFocusTotal } from '../lib/format'
import { t } from '../lib/i18n'

const stats = useStatsStore()
</script>

<template>
  <div class="today card">
    <div class="stat">
      <div class="stat-value">{{ stats.today.completed }}</div>
      <div class="stat-label">{{ t('today.tomatoes') }}</div>
    </div>
    <div class="divider" />
    <div class="stat">
      <div class="stat-value">{{ formatFocusTotal(stats.today.focusMs) }}</div>
      <div class="stat-label">{{ t('today.focus') }}</div>
    </div>
    <div class="divider" />
    <div class="stat">
      <div class="stat-value muted">{{ stats.today.skipped }}</div>
      <div class="stat-label">{{ t('today.skipped') }}</div>
    </div>
  </div>
</template>

<style scoped>
.today {
  display: flex;
  align-items: center;
  width: 100%;
  padding: 14px 10px;
}

.stat {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.stat-value {
  font-size: 18px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
  color: var(--text-1);
}

.stat-value.muted {
  color: var(--text-3);
}

.stat-label {
  font-size: 11px;
  color: var(--text-3);
  letter-spacing: 1px;
}

.divider {
  width: 1px;
  height: 30px;
  background: var(--border);
}
</style>
