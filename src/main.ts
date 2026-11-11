import { createApp } from 'vue'
import { createPinia } from 'pinia'
import App from './App.vue'
import { useSettingsStore } from './stores/settings'
import { useStatsStore } from './stores/stats'
import { useTasksStore } from './stores/tasks'
import './assets/main.css'

async function boot(): Promise<void> {
  const app = createApp(App)
  const pinia = createPinia()
  app.use(pinia)

  // 先装载持久化数据，再挂载界面，避免设置闪烁
  await useSettingsStore().load()
  await Promise.all([useStatsStore().load(), useTasksStore().load()])

  app.mount('#app')
}

void boot()
