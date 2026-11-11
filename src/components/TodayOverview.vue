<script setup lang="ts">
import { useStatsStore } from '../stores/stats'
import { formatFocusTotal } from '../lib/format'

const stats = useStatsStore()
</script>

<template>
  <div class="today card">
    <div class="stat">
      <div class="stat-value">{{ stats.today.completed }}</div>
      <div class="stat-label">今日番茄</div>
    </div>
    <div class="divider" />
    <div class="stat">
      <div class="stat-value">{{ formatFocusTotal(stats.today.focusMs) }}</div>
      <div class="stat-label">今日专注</div>
    </div>
    <div class="divider" />
    <div class="stat">
      <div class="stat-value muted">{{ stats.today.skipped }}</div>
      <div class="stat-label">未完成</div>
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
