<script setup lang="ts">
import { useSettingsStore } from '../stores/settings'
import { useTimerStore } from '../stores/timer'

const settings = useSettingsStore()
const timer = useTimerStore()
</script>

<template>
  <div
    class="cycle-dots"
    :title="`本轮 ${timer.completedInCycle}/${settings.settings.longBreakInterval} 个番茄，完成后进入长休息`"
  >
    <span
      v-for="i in settings.settings.longBreakInterval"
      :key="i"
      class="dot"
      :class="{ done: i - 1 < timer.completedInCycle }"
    />
  </div>
</template>

<style scoped>
.cycle-dots {
  display: flex;
  align-items: center;
  gap: 10px;
}

.dot {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: var(--ring-track);
  transition: background 0.3s, transform 0.3s;
}

.dot.done {
  background: var(--phase-color);
  transform: scale(1.05);
}
</style>
