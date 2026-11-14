<script setup lang="ts">
import { computed, ref } from 'vue'
import { useStatsStore } from '../stores/stats'
import { formatFocusTotal } from '../lib/format'
import { t } from '../lib/i18n'

const stats = useStatsStore()
const rangeDays = ref<7 | 30>(7)
/** 任务占比范围：默认今日（M3 新需求），可切全部历史 */
const shareRange = ref<'today' | 'all'>('today')

const daily = computed(() => stats.dailyMinutes(rangeDays.value))

/** Y 轴刻度：以数据最大值向上取整到 15/30/60… 分钟的倍数 */
const yMax = computed(() => {
  const peak = Math.max(0, ...daily.value.map((d) => d.minutes))
  const step = peak > 120 ? 60 : peak > 30 ? 30 : 15
  return Math.max(step, Math.ceil(peak / step) * step)
})

function fmtMinutes(m: number): string {
  if (m >= 60) {
    const h = m / 60
    return `${Number.isInteger(h) ? h : h.toFixed(1)}h`
  }
  return `${m}m`
}

/** 柱状图几何：SVG 视口 320×148，底部 16 留给 x 轴标签 */
const bars = computed(() => {
  const n = daily.value.length
  const W = 320
  const H = 148
  const topPad = 16
  const bottomPad = 16
  const gap = n > 10 ? 1.5 : 6
  const bw = Math.max(5, (W - gap * (n - 1)) / n)
  const plotH = H - topPad - bottomPad
  return daily.value.map((d, i) => ({
    x: i * (bw + gap),
    w: bw,
    h: d.minutes > 0 ? Math.max(3, Math.round((d.minutes / yMax.value) * plotH)) : 0,
    base: topPad + plotH,
    H,
    W,
    ...d,
  }))
})

/** 网格线：满刻度 + 半刻度 */
const gridlines = computed(() => {
  const first = bars.value[0]
  if (!first) return []
  return [yMax.value, yMax.value / 2].map((m, idx) => ({
    y: first.base - Math.round((m / yMax.value) * (first.base - 16)),
    label: fmtMinutes(m),
    half: idx === 1,
  }))
})

/** x 轴标签：从今天起每 step 天标一个，保证最右侧是"今天" */
function labelFor(i: number): string {
  const n = daily.value.length
  const step = n > 10 ? 5 : 1
  const fromEnd = n - 1 - i
  if (fromEnd % step !== 0) return ''
  if (fromEnd === 0) return t('stats.today')
  const d = daily.value[i]
  return `${Number(d.key.slice(5, 7))}/${Number(d.key.slice(8))}`
}

const taskShare = computed(() => {
  const src = shareRange.value === 'today' ? stats.todayTaskMinutes : stats.taskMinutes
  const total = src.reduce((a, b) => a + b.minutes, 0)
  return src.slice(0, 8).map((task) => ({
    ...task,
    pct: total > 0 ? Math.round((task.minutes / total) * 100) : 0,
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
        <div class="t-label">{{ t('stats.totalTomatoes') }}</div>
      </div>
      <div class="t-div" />
      <div class="t-item">
        <div class="t-num">{{ formatFocusTotal(totalLabel.focusMs) }}</div>
        <div class="t-label">{{ t('stats.totalFocus') }}</div>
      </div>
      <div class="t-div" />
      <div class="t-item">
        <div class="t-num">{{ totalLabel.streak }}</div>
        <div class="t-label">{{ t('stats.streak') }}</div>
      </div>
    </div>

    <!-- 每日专注柱状图 -->
    <div class="card block">
      <div class="block-head">
        <span class="block-title">{{ t('stats.daily') }}</span>
        <div class="range">
          <button :class="{ on: rangeDays === 7 }" @click="rangeDays = 7">{{ t('stats.range7') }}</button>
          <button :class="{ on: rangeDays === 30 }" @click="rangeDays = 30">{{ t('stats.range30') }}</button>
        </div>
      </div>
      <svg :viewBox="`0 0 ${bars[0]?.W ?? 320} ${bars[0]?.H ?? 148}`" class="chart" preserveAspectRatio="none">
        <!-- 网格线与刻度 -->
        <g v-for="g in gridlines" :key="g.label">
          <line x1="0" :x2="bars[0]?.W ?? 320" :y1="g.y" :y2="g.y" class="gridline" :class="{ half: g.half }" />
          <text :x="(bars[0]?.W ?? 320) - 2" :y="g.y - 2" class="grid-label" text-anchor="end">{{ g.label }}</text>
        </g>
        <!-- 基线 -->
        <line v-if="bars[0]" x1="0" :x2="bars[0].W" :y1="bars[0].base" :y2="bars[0].base" class="baseline" />
        <!-- 柱子（零值日画基线小点保持时间轴连续感） -->
        <g v-for="(b, i) in bars" :key="b.key">
          <rect
            v-if="b.minutes > 0"
            :x="b.x"
            :y="b.base - b.h"
            :width="b.w"
            :height="b.h"
            rx="2"
            :class="['bar', { today: i === bars.length - 1 }]"
          >
            <title>{{ b.key }} · {{ t('fmt.minutes', { n: b.minutes }) }}</title>
          </rect>
          <circle v-else :cx="b.x + b.w / 2" :cy="b.base" r="1.8" class="empty-dot">
            <title>{{ b.key }} · {{ t('stats.noFocus') }}</title>
          </circle>
          <text v-if="labelFor(i)" :x="b.x + b.w / 2" :y="b.H - 3" class="bar-label" text-anchor="middle">
            {{ labelFor(i) }}
          </text>
        </g>
      </svg>
    </div>

    <!-- 任务时间占比（今日 / 全部历史） -->
    <div class="card block">
      <div class="block-head">
        <span class="block-title">{{ t('stats.shareTitle') }}</span>
        <div class="range">
          <button :class="{ on: shareRange === 'today' }" @click="shareRange = 'today'">{{ t('stats.shareToday') }}</button>
          <button :class="{ on: shareRange === 'all' }" @click="shareRange = 'all'">{{ t('stats.shareAll') }}</button>
        </div>
      </div>
      <div v-if="taskShare.length" class="share">
        <div v-for="task in taskShare" :key="task.name" class="share-row">
          <div class="share-name" :title="task.name">{{ task.name }}</div>
          <div class="share-bar">
            <div class="share-fill" :style="{ width: Math.max(2, task.pct) + '%' }" />
          </div>
          <div class="share-val">{{ formatFocusTotal(task.minutes * 60000) }}</div>
        </div>
      </div>
      <div v-else class="empty">
        {{ shareRange === 'today' ? t('stats.shareEmptyToday') : t('stats.shareEmptyAll') }}
      </div>
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
  height: 150px;
}

.gridline {
  stroke: var(--text-3);
  stroke-width: 0.6;
  stroke-dasharray: 3 3;
  opacity: 0.45;
}

.gridline.half {
  stroke-dasharray: 2 4;
  opacity: 0.3;
}

.grid-label {
  font-size: 8px;
  fill: var(--text-2);
}

.baseline {
  stroke: var(--border);
  stroke-width: 1;
}

.empty-dot {
  fill: var(--text-3);
  opacity: 0.55;
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
