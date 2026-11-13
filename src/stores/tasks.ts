import { defineStore } from 'pinia'
import { computed, ref } from 'vue'
import * as backend from '../lib/backend'
import type { Task } from '../lib/types'

const LS_CURRENT = 'pf.currentTaskId'

function genId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
}

export const useTasksStore = defineStore('tasks', () => {
  const tasks = ref<Task[]>([])
  const loaded = ref(false)
  /** 当前关联的任务 id（不持久化到磁盘文件，仅 localStorage 快存） */
  const currentTaskId = ref<string | null>(null)

  const active = computed(() => tasks.value.filter((t) => t.doneAt === null))
  const done = computed(() => tasks.value.filter((t) => t.doneAt !== null))
  const currentTask = computed(() => tasks.value.find((t) => t.id === currentTaskId.value) ?? null)

  async function load(): Promise<void> {
    tasks.value = await backend.getTasks()
    currentTaskId.value = localStorage.getItem(LS_CURRENT)
    // 当前任务已完成或已被删除时自动解除关联
    if (currentTaskId.value && !currentTask.value) {
      currentTaskId.value = null
      localStorage.removeItem(LS_CURRENT)
    }
    loaded.value = true
  }

  function setCurrent(id: string | null): void {
    currentTaskId.value = id
    if (id) localStorage.setItem(LS_CURRENT, id)
    else localStorage.removeItem(LS_CURRENT)
  }

  async function add(name: string): Promise<void> {
    const task: Task = {
      id: genId(),
      name: name.trim(),
      createdAt: Date.now(),
      doneAt: null,
    }
    if (!task.name) return
    tasks.value.push(task)
    await backend.upsertTask(task)
    if (!currentTaskId.value) setCurrent(task.id)
  }

  async function rename(id: string, name: string): Promise<void> {
    const t = tasks.value.find((x) => x.id === id)
    if (!t || !name.trim()) return
    t.name = name.trim()
    await backend.upsertTask(t)
  }

  async function toggleDone(id: string): Promise<void> {
    const t = tasks.value.find((x) => x.id === id)
    if (!t) return
    t.doneAt = t.doneAt === null ? Date.now() : null
    await backend.upsertTask(t)
    if (t.doneAt !== null && currentTaskId.value === id) setCurrent(null)
  }

  async function remove(id: string): Promise<void> {
    tasks.value = tasks.value.filter((t) => t.id !== id)
    if (currentTaskId.value === id) setCurrent(null)
    await backend.deleteTask(id)
  }

  return {
    tasks,
    loaded,
    currentTaskId,
    active,
    done,
    currentTask,
    load,
    setCurrent,
    add,
    rename,
    toggleDone,
    remove,
  }
})
