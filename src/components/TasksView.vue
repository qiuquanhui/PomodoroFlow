<script setup lang="ts">
import { computed, ref } from 'vue'
import { useTasksStore } from '../stores/tasks'
import { useStatsStore } from '../stores/stats'
import { formatFocusTotal } from '../lib/format'
import { t } from '../lib/i18n'

const tasks = useTasksStore()
const stats = useStatsStore()

const newName = ref('')
const showDone = ref(false)
/** 正在编辑名称的任务 id */
const editingId = ref<string | null>(null)
const editName = ref('')

/** 每个任务的实际投入（番茄数 / 分钟数），从会话记录统计（FR-203） */
const investedMap = computed(() => {
  const map = new Map<string, { count: number; ms: number }>()
  for (const s of stats.sessions) {
    if (!s.taskId) continue
    const e = map.get(s.taskId) ?? { count: 0, ms: 0 }
    e.ms += s.durationMs
    if (s.completed) e.count += 1
    map.set(s.taskId, e)
  }
  return map
})

function addTask(): void {
  if (!newName.value.trim()) return
  void tasks.add(newName.value)
  newName.value = ''
}

function startEdit(id: string, name: string): void {
  editingId.value = id
  editName.value = name
}

function commitEdit(): void {
  if (editingId.value) void tasks.rename(editingId.value, editName.value)
  editingId.value = null
}

function fmt(id: string): string {
  const e = investedMap.value.get(id)
  if (!e || e.ms === 0) return '—'
  return `${e.count} 🍅 · ${formatFocusTotal(e.ms)}`
}
</script>

<template>
  <div class="tasks-view">
    <!-- 新建任务 -->
    <div class="add-row card">
      <input
        v-model="newName"
        class="name-input"
        type="text"
        maxlength="60"
        :placeholder="t('tasks.placeholder')"
        @keyup.enter="addTask"
      />
      <button class="add-btn" :disabled="!newName.trim()" @click="addTask">{{ t('tasks.add') }}</button>
    </div>

    <!-- 进行中 -->
    <div v-if="tasks.active.length" class="group-title">{{ t('tasks.activeCount', { n: tasks.active.length }) }}</div>
    <div v-else class="empty card">{{ t('tasks.emptyActive') }}</div>

    <TransitionGroup name="task" tag="div" class="list">
      <div
        v-for="task in tasks.active"
        :key="task.id"
        class="task card"
        :class="{ current: tasks.currentTaskId === task.id }"
      >
        <button
          class="pick"
          :title="tasks.currentTaskId === task.id ? t('tasks.currentTip') : t('tasks.setCurrentTip')"
          @click="tasks.setCurrent(tasks.currentTaskId === task.id ? null : task.id)"
        >
          <span class="pick-dot" :class="{ on: tasks.currentTaskId === task.id }" />
        </button>

        <div class="body" @dblclick="startEdit(task.id, task.name)">
          <input
            v-if="editingId === task.id"
            v-model="editName"
            class="edit-input"
            type="text"
            maxlength="60"
            autofocus
            @keyup.enter="commitEdit"
            @keyup.esc="editingId = null"
            @blur="commitEdit"
          />
          <template v-else>
            <div class="name">{{ task.name }}</div>
            <div class="meta">
              <span>{{ t('tasks.invested', { stat: fmt(task.id) }) }}</span>
            </div>
          </template>
        </div>

        <button class="op done" :title="t('tasks.markDone')" @click="tasks.toggleDone(task.id)">✓</button>
        <button class="op del" :title="t('tasks.delete')" @click="tasks.remove(task.id)">✕</button>
      </div>
    </TransitionGroup>

    <!-- 已完成 -->
    <template v-if="tasks.done.length">
      <button class="group-title done-toggle" @click="showDone = !showDone">
        {{ t('tasks.doneCount', { n: tasks.done.length }) }} {{ showDone ? '▾' : '▸' }}
      </button>
      <div v-if="showDone" class="list">
        <div v-for="task in tasks.done" :key="task.id" class="task card done">
          <div class="body">
            <div class="name">{{ task.name }}</div>
            <div class="meta">{{ t('tasks.invested', { stat: fmt(task.id) }) }}</div>
          </div>
          <button class="op" :title="t('tasks.restore')" @click="tasks.toggleDone(task.id)">↩</button>
          <button class="op del" :title="t('tasks.delete')" @click="tasks.remove(task.id)">✕</button>
        </div>
      </div>
    </template>
  </div>
</template>

<style scoped>
.tasks-view {
  width: 100%;
  display: flex;
  flex-direction: column;
  gap: 8px;
  overflow-y: auto;
  flex: 1;
  min-height: 0;
  padding-bottom: 4px;
}

.add-row {
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 10px;
}

.name-input {
  flex: 1;
  height: 34px;
  padding: 0 10px;
  border: none;
  background: transparent;
  color: var(--text-1);
  font-size: 13px;
}

.name-input::placeholder {
  color: var(--text-3);
}

.name-input:focus {
  outline: none;
}

.add-btn {
  height: 32px;
  padding: 0 14px;
  border-radius: 999px;
  background: var(--focus-color);
  color: #fff;
  font-size: 13px;
  font-weight: 600;
}

.add-btn:disabled {
  opacity: 0.45;
}

.group-title {
  font-size: 11px;
  color: var(--text-3);
  letter-spacing: 2px;
  padding: 6px 4px 0;
  text-align: left;
  background: none;
}

.done-toggle {
  cursor: pointer;
}

.empty {
  padding: 26px 0;
  text-align: center;
  font-size: 12px;
  color: var(--text-3);
}

.list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.task {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 10px 8px 10px 4px;
  transition: border-color 0.2s;
}

.task.current {
  border-color: var(--phase-color);
}

.pick {
  width: 30px;
  height: 30px;
  display: flex;
  align-items: center;
  justify-content: center;
  border-radius: 50%;
}

.pick-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  border: 2px solid var(--text-3);
  transition: all 0.2s;
}

.pick-dot.on {
  border-color: var(--focus-color);
  background: var(--focus-color);
  box-shadow: 0 0 0 3px var(--focus-soft);
}

.body {
  flex: 1;
  min-width: 0;
  cursor: default;
}

.name {
  font-size: 13px;
  color: var(--text-1);
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.meta {
  font-size: 11px;
  color: var(--text-3);
  margin-top: 3px;
}

.edit-input {
  width: 100%;
  height: 28px;
  border: 1px solid var(--phase-color);
  border-radius: 6px;
  background: var(--bg-inset);
  color: var(--text-1);
  font-size: 13px;
  padding: 0 8px;
}

.op {
  width: 28px;
  height: 28px;
  border-radius: 8px;
  color: var(--text-3);
  font-size: 14px;
  flex-shrink: 0;
}

.op:hover {
  background: var(--bg-inset);
  color: var(--text-1);
}

.op.done:hover {
  color: var(--short-color);
}

.op.del:hover {
  color: var(--focus-color);
}

.task.done .name {
  text-decoration: line-through;
  color: var(--text-3);
}

.task-enter-active,
.task-leave-active {
  transition: all 0.25s ease;
}

.task-enter-from,
.task-leave-to {
  opacity: 0;
  transform: translateX(12px);
}
</style>
