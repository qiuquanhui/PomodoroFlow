<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStatsStore } from '../stores/stats'
import { formatFocusTotal } from '../lib/format'

const stats = useStatsStore()
const rangeDays = ref<7 | 30>(7)

const daily = computed(() => stats.dailyMinutes(rangeDays.value))
const maxMinutes = computed(() => Math.max(30, ...daily.value.map((d) => d.minutes)))

/** 柱状图：SVG 视口宽 320，按天数分列 */
const bars = computed(() => {
  const n = daily.value.length
  const W = 320
  const H = 110
  const gap = n > 10 ? 2 : 6
  const bw = (W - gap * (n - 1)) / n
  return daily.value.map((d, i) => {
    const h = Math.round((d.minutes / maxMinutes.value) * (H - 16))
    return {
      x: i * (bw + gap),
      w: bw,
      h: Math.max(d.minutes > 0 ? 3 : 0, h),
      H,
      W,
      ...d,
    }
  })
})

/** x 轴标签抽稀 */
function labelFor(i: number): string {
  const d = daily.value[i]
  const today = new Date().getDate().toString().padStart(2, '0')
  const yest = new Date(Date.now() - 86400_000).getDate().toString().padStart(2, '0')
  const day = d.key.slice(8)
  if (day === today) return '今天'
  if (day === yest) return '昨天'
  const step = rangeDays.value === 7 ? 1 : 5
  if (i % step === 0) return `${Number(d.key.slice(5, 7))}/${day}`
  return ''
}

const taskShare = computed(() => {
  const total = stats.taskMinutes.reduce((a, b) => a + b.minutes, 0)
  return stats.taskMinutes.slice(0, 8).map((t) => ({
    ...t,
    pct: total > 0 ? Math.round((t.minutes / total) * 100) : 0,
  }))
})

const totalLabel = computed(() => {
  const t = stats.totals
  return t
})
</script>

<template>
  <div class="stats-view">
    <!-- 累计概览 -->
    <div class="totals card">
      <div class="t-item">
        <div class="t-num">{{ totalLabel.completed }}</div>
        <div class="t-label">累计番茄</div>
      </div>
      <div class="t-div" />
      <div class="t-item">
        <div class="t-num">{{ formatFocusTotal(totalLabel.focusMs) }}</div>
        <div class="t-label">累计专注</div>
      </div>
      <div class="t-div" />
      <div class="t-item">
        <div class="t-num">{{ totalLabel.streak }}</div>
        <div class="t-label">连续天数</div>
      </div>
    </div>

    <!-- 每日专注柱状图 -->
    <div class="card block">
      <div class="block-head">
        <span class="block-title">每日专注</span>
        <div class="range">
          <button :class="{ on: rangeDays === 7 }" @click="rangeDays = 7">近7天</button>
          <button :class="{ on: rangeDays === 30 }" @click="rangeDays = 30">近30天</button>
        </div>
      </div>
      <svg :viewBox="`0 0 ${bars[0]?.W ?? 320} ${bars[0]?.H ?? 110}`" class="chart" preserveAspectRatio="none">
        <g v-for="(b, i) in bars" :key="b.key">
          <rect
            :x="b.x"
            :y="b.H - b.h"
            :width="b.w"
            :height="b.h"
            rx="2"
            :class="['bar', { today: i === bars.length - 1 }]"
          >
            <title>{{ b.key }} · {{ b.minutes }} 分钟</title>
          </rect>
          <text v-if="labelFor(i)" :x="b.x + b.w / 2" :y="b.H - 2" class="bar-label" text-anchor="middle">
            {{ labelFor(i) }}
          </text>
        </g>
      </svg>
    </div>

    <!-- 任务时间占比 -->
    <div class="card block">
      <div class="block-head">
        <span class="block-title">任务时间占比（全部历史）</span>
      </div>
      <div v-if="taskShare.length" class="share">
        <div v-for="t in taskShare" :key="t.name" class="share-row">
          <div class="share-name" :title="t.name">{{ t.name }}</div>
          <div class="share-bar">
            <div class="share-fill" :style="{ width: Math.max(2, t.pct) + '%' }" />
          </div>
          <div class="share-val">{{ formatFocusTotal(t.minutes * 60000) }}</div>
        </div>
      </div>
      <div v-else class="empty">完成几个番茄后，这里会展示各任务的时间投入</div>
    </div>
  </div>
</template>

<style scoped>
.stats-view {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 10px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  padding-bottom: 4px;
}

.totals {
  display: flex;
  align-items: center;
  padding: 14px 8px;
}

.t-item {
  flex: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 4px;
}

.t-num {
  font-size: 18px;
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}

.t-label {
  font-size: 11px;
  color: var(--text-3);
}

.t-div {
  width: 1px;
  height: 30px;
  background: var(--border);
}

.block {
  padding: 12px 14px;
}

.block-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 8px;
}

.block-title {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-2);
}

.range {
  display: flex;
  gap: 2px;
  background: var(--bg-inset);
  border-radius: 999px;
  padding: 2px;
}

.range button {
  font-size: 11px;
  padding: 3px 10px;
  border-radius: 999px;
  color: var(--text-3);
}

.range button.on {
  background: var(--bg-card);
  color: var(--text-1);
  font-weight: 600;
  box-shadow: 0 1px 4px rgba(0, 0, 0, 0.15);
}

.chart {
  width: 100%;
  height: 120px;
}

.bar {
  fill: var(--focus-color);
  opacity: 0.55;
}

.bar.today {
  opacity: 1;
}

.bar-label {
  font-size: 8px;
  fill: var(--text-3);
}

.share {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.share-row {
  display: flex;
  align-items: center;
  gap: 8px;
}

.share-name {
  width: 96px;
  font-size: 12px;
  color: var(--text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  flex-shrink: 0;
}

.share-bar {
  flex: 1;
  height: 8px;
  border-radius: 4px;
  background: var(--bg-inset);
  overflow: hidden;
}

.share-fill {
  height: 100%;
  border-radius: 4px;
  background: linear-gradient(90deg, var(--focus-color), var(--long-color));
}

.share-val {
  width: 64px;
  font-size: 11px;
  color: var(--text-3);
  text-align: right;
  flex-shrink: 0;
  font-variant-numeric: tabular-nums;
}

.empty {
  padding: 18px 0;
  text-align: center;
  font-size: 12px;
  color: var(--text-3);
}
</style>
