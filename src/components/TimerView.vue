<script setup lang="ts">
import { computed, ref } from 'vue'
import { useTimerStore } from '../stores/timer'
import { useTasksStore } from '../stores/tasks'
import PhasePills from './PhasePills.vue'
import TimerRing from './TimerRing.vue'
import CycleDots from './CycleDots.vue'
import ControlBar from './ControlBar.vue'
import TodayOverview from './TodayOverview.vue'

const timer = useTimerStore()
const tasks = useTasksStore()
const pickerOpen = ref(false)

const currentName = computed(() => tasks.currentTask?.name ?? '未选择任务')
</script>

<template>
  <div class="timer-view">
    <PhasePills />
    <TimerRing />
    <CycleDots />

    <!-- 当前任务选择（FR-202）：专注记录自动关联 -->
    <div class="task-picker" :class="{ open: pickerOpen }">
      <button class="picker-btn" title="选择当前任务" @click="pickerOpen = !pickerOpen">
        <span class="picker-label">任务</span>
        <span class="picker-name" :class="{ none: !tasks.currentTask }">{{ currentName }}</span>
        <span class="picker-caret">{{ pickerOpen ? '▴' : '▾' }}</span>
      </button>
      <div v-if="pickerOpen" class="picker-menu card">
        <button class="picker-item" :class="{ sel: !tasks.currentTask }" @click="tasks.setCurrent(null); pickerOpen = false">
          不关联任务
        </button>
        <button
          v-for="t in tasks.active"
          :key="t.id"
          class="picker-item"
          :class="{ sel: tasks.currentTaskId === t.id }"
          @click="tasks.setCurrent(t.id); pickerOpen = false"
        >
          {{ t.name }}
        </button>
        <div v-if="!tasks.active.length" class="picker-empty">暂无进行中的任务</div>
      </div>
    </div>

    <ControlBar />
    <TodayOverview />
  </div>
</template>

<style scoped>
.timer-view {
  width: 100%;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 14px;
}

.task-picker {
  position: relative;
  width: 100%;
  max-width: 280px;
}

.picker-btn {
  width: 100%;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 7px 12px;
  border-radius: 999px;
  background: var(--bg-inset);
  transition: background 0.2s;
}

.task-picker.open .picker-btn,
.picker-btn:hover {
  background: var(--border);
}

.picker-label {
  font-size: 11px;
  color: var(--text-3);
  flex-shrink: 0;
}

.picker-name {
  flex: 1;
  text-align: left;
  font-size: 13px;
  color: var(--text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.picker-name.none {
  color: var(--text-3);
}

.picker-caret {
  font-size: 10px;
  color: var(--text-3);
}

.picker-menu {
  position: absolute;
  top: calc(100% + 6px);
  left: 0;
  right: 0;
  z-index: 5;
  max-height: 200px;
  overflow-y: auto;
  padding: 6px;
  border-radius: 12px;
}

.picker-item {
  display: block;
  width: 100%;
  text-align: left;
  padding: 8px 10px;
  border-radius: 8px;
  font-size: 13px;
  color: var(--text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.picker-item:hover {
  background: var(--bg-inset);
}

.picker-item.sel {
  color: var(--focus-color);
  font-weight: 600;
}

.picker-empty {
  padding: 10px;
  font-size: 12px;
  color: var(--text-3);
  text-align: center;
}
</style>
