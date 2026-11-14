import { ref } from 'vue'

/**
 * 轻量 i18n：手写字典 + 响应式 locale，t() 在渲染期读取 locale，
 * 切换语言后所有模板自动重渲染，无需引第三方库。
 */
export type Locale = 'zh-CN' | 'en'

export const locale = ref<Locale>('zh-CN')

const zh: Record<string, string> = {
  // 阶段与通用
  'phase.focus': '专注',
  'phase.short': '短休息',
  'phase.long': '长休息',
  'common.settings': '设置',
  'fmt.minutes': '{n} 分钟',
  'fmt.hours': '{n} 小时',
  'fmt.hoursMinutes': '{h} 小时 {m} 分',

  // 导航
  'tab.timer': '计时',
  'tab.tasks': '任务',
  'tab.stats': '统计',

  // 计时页
  'picker.task': '任务',
  'picker.none': '未选择任务',
  'picker.unlink': '不关联任务',
  'picker.empty': '暂无进行中的任务',
  'picker.title': '选择当前任务',
  'pills.aria': '阶段切换',
  'pills.locked': '计时进行中，暂不能切换',
  'pills.switchTo': '切换到{phase}',
  'ring.focusHint': '保持专注…',
  'ring.relax': '放松一下',
  'ring.paused': '已暂停',
  'ring.ready': '准备开始',
  'ctrl.resetTitle': '重置当前阶段',
  'ctrl.reset': '重置',
  'ctrl.toggleAria': '开始或暂停',
  'ctrl.start': '开始',
  'ctrl.pause': '暂停',
  'ctrl.resume': '继续',
  'ctrl.skipTitle': '跳到下一阶段',
  'ctrl.skip': '跳过',
  'cycle.title': '本轮 {done}/{total} 个番茄，完成后进入长休息',
  'today.tomatoes': '今日番茄',
  'today.focus': '今日专注',
  'today.skipped': '未完成',

  // 任务页
  'tasks.placeholder': '新任务名称，如：复习线性代数',
  'tasks.add': '添加',
  'tasks.activeCount': '进行中 · {n}',
  'tasks.emptyActive': '还没有进行中的任务，先添加一个吧',
  'tasks.currentTip': '当前任务',
  'tasks.setCurrentTip': '设为当前任务',
  'tasks.invested': '已投 {stat}',
  'tasks.markDone': '标记完成',
  'tasks.delete': '删除',
  'tasks.doneCount': '已完成 · {n}',
  'tasks.restore': '恢复为进行中',

  // 统计页
  'stats.totalTomatoes': '累计番茄',
  'stats.totalFocus': '累计专注',
  'stats.streak': '连续天数',
  'stats.daily': '每日专注',
  'stats.range7': '近7天',
  'stats.range30': '近30天',
  'stats.today': '今天',
  'stats.noFocus': '无专注',
  'stats.shareTitle': '任务时间占比',
  'stats.shareToday': '今日',
  'stats.shareAll': '全部',
  'stats.shareEmptyAll': '完成几个番茄后，这里会展示各任务的时间投入',
  'stats.shareEmptyToday': '今天还没有专注记录',

  // 设置
  'settings.close': '关闭设置',
  'settings.durations': '时长',
  'settings.focusMin': '专注（分钟）',
  'settings.shortMin': '短休息（分钟）',
  'settings.longMin': '长休息（分钟）',
  'settings.interval': '长休息间隔（番茄数）',
  'settings.flow': '流转',
  'settings.autoBreaks': '专注结束后自动开始休息',
  'settings.autoFocus': '休息结束后自动开始专注',
  'settings.notify': '提醒',
  'settings.sound': '阶段结束时播放提示音',
  'settings.sysNotify': '阶段结束时弹出系统通知（右下角）',
  'settings.volume': '音量',
  'settings.test': '试听',
  'settings.appearance': '外观',
  'theme.system': '跟随系统',
  'theme.light': '浅色',
  'theme.dark': '深色',
  'settings.general': '通用',
  'settings.language': '语言',
  'settings.autostart': '开机自启',
  'settings.autostartHint': '登录 Windows 后自动启动',
  'settings.hotkey': '全局热键',
  'settings.hotkeyHint': 'Ctrl+Alt+Space 开始/暂停（全局可用）',
  'settings.data': '数据',
  'settings.exportJson': '导出 JSON',
  'settings.exportCsv': '导出 CSV',
  'settings.import': '导入数据',
  'settings.importHint': '恢复任务与专注记录，已有记录不会被覆盖',
  'settings.footnote': '关闭窗口将最小化到系统托盘，从托盘菜单可退出 · 数据仅保存在本机',
  'msg.exported': '已导出 {count} 条记录',
  'msg.exportFail': '导出失败：{err}',
  'msg.imported': '导入 {sessions} 条专注、{tasks} 个任务，跳过 {skipped} 条重复',
  'msg.importFail': '导入失败：{err}',
  'msg.invalidFile': '不是有效的备份文件',

  // 通知与托盘（store 内使用）
  'session.noTask': '未关联任务',
  'notify.focusTitle': '专注结束 🍅',
  'notify.focusBody': '「{task}」完成一个番茄，休息一下吧',
  'notify.focusBodyNoTask': '完成一个番茄，休息一下吧',
  'notify.breakTitle': '休息结束 ⏰',
  'notify.breakBody': '准备好开始下一个专注了吗？',
  'tray.show': '显示 PomodoroFlow',
  'tray.skipPhase': '跳过当前阶段',
  'tray.quit': '退出',

  // 导出 CSV 表头
  'csv.date': '日期',
  'csv.start': '开始',
  'csv.end': '结束',
  'csv.durationMin': '时长(分钟)',
  'csv.task': '任务',
  'csv.completed': '是否完成',
}

const en: Record<string, string> = {
  'phase.focus': 'Focus',
  'phase.short': 'Short break',
  'phase.long': 'Long break',
  'common.settings': 'Settings',
  'fmt.minutes': '{n} min',
  'fmt.hours': '{n} h',
  'fmt.hoursMinutes': '{h} h {m} min',

  'tab.timer': 'Timer',
  'tab.tasks': 'Tasks',
  'tab.stats': 'Stats',

  'picker.task': 'Task',
  'picker.none': 'No task selected',
  'picker.unlink': 'No task',
  'picker.empty': 'No active tasks yet',
  'picker.title': 'Choose current task',
  'pills.aria': 'Phase switch',
  'pills.locked': 'Running — cannot switch now',
  'pills.switchTo': 'Switch to {phase}',
  'ring.focusHint': 'Stay focused…',
  'ring.relax': 'Take it easy',
  'ring.paused': 'Paused',
  'ring.ready': 'Ready',
  'ctrl.resetTitle': 'Reset current phase',
  'ctrl.reset': 'Reset',
  'ctrl.toggleAria': 'Start or pause',
  'ctrl.start': 'Start',
  'ctrl.pause': 'Pause',
  'ctrl.resume': 'Resume',
  'ctrl.skipTitle': 'Skip to next phase',
  'ctrl.skip': 'Skip',
  'cycle.title': '{done}/{total} pomodoros this cycle, then a long break',
  'today.tomatoes': 'Pomodoros',
  'today.focus': 'Focus today',
  'today.skipped': 'Incomplete',

  'tasks.placeholder': 'New task name, e.g. Review linear algebra',
  'tasks.add': 'Add',
  'tasks.activeCount': 'Active · {n}',
  'tasks.emptyActive': 'No active tasks yet — add one',
  'tasks.currentTip': 'Current task',
  'tasks.setCurrentTip': 'Set as current',
  'tasks.invested': 'Invested {stat}',
  'tasks.markDone': 'Mark done',
  'tasks.delete': 'Delete',
  'tasks.doneCount': 'Done · {n}',
  'tasks.restore': 'Restore to active',

  'stats.totalTomatoes': 'Pomodoros',
  'stats.totalFocus': 'Total focus',
  'stats.streak': 'Day streak',
  'stats.daily': 'Daily focus',
  'stats.range7': '7 days',
  'stats.range30': '30 days',
  'stats.today': 'Today',
  'stats.noFocus': 'No focus',
  'stats.shareTitle': 'Task share',
  'stats.shareToday': 'Today',
  'stats.shareAll': 'All',
  'stats.shareEmptyAll': 'Task time breakdown appears after your first pomodoros',
  'stats.shareEmptyToday': 'No focus records today',

  'settings.close': 'Close settings',
  'settings.durations': 'Durations',
  'settings.focusMin': 'Focus (min)',
  'settings.shortMin': 'Short break (min)',
  'settings.longMin': 'Long break (min)',
  'settings.interval': 'Long-break interval (pomodoros)',
  'settings.flow': 'Auto-flow',
  'settings.autoBreaks': 'Auto-start break after focus',
  'settings.autoFocus': 'Auto-start focus after break',
  'settings.notify': 'Alerts',
  'settings.sound': 'Play sound at phase end',
  'settings.sysNotify': 'System notification at phase end',
  'settings.volume': 'Volume',
  'settings.test': 'Test',
  'settings.appearance': 'Appearance',
  'theme.system': 'System',
  'theme.light': 'Light',
  'theme.dark': 'Dark',
  'settings.general': 'General',
  'settings.language': 'Language',
  'settings.autostart': 'Launch at startup',
  'settings.autostartHint': 'Start automatically after Windows login',
  'settings.hotkey': 'Global hotkey',
  'settings.hotkeyHint': 'Ctrl+Alt+Space start/pause (works anywhere)',
  'settings.data': 'Data',
  'settings.exportJson': 'Export JSON',
  'settings.exportCsv': 'Export CSV',
  'settings.import': 'Import data',
  'settings.importHint': 'Restore tasks & focus records; existing records are kept',
  'settings.footnote':
    'Closing minimizes to tray; quit from the tray menu · Data stays on this device',
  'msg.exported': 'Exported {count} records',
  'msg.exportFail': 'Export failed: {err}',
  'msg.imported': 'Imported {sessions} focus records, {tasks} tasks ({skipped} duplicates skipped)',
  'msg.importFail': 'Import failed: {err}',
  'msg.invalidFile': 'Not a valid backup file',

  'session.noTask': 'No task',
  'notify.focusTitle': 'Focus done 🍅',
  'notify.focusBody': 'You finished a pomodoro on "{task}" — take a break',
  'notify.focusBodyNoTask': 'You finished a pomodoro — take a break',
  'notify.breakTitle': 'Break over ⏰',
  'notify.breakBody': 'Ready for the next focus session?',
  'tray.show': 'Show PomodoroFlow',
  'tray.skipPhase': 'Skip current phase',
  'tray.quit': 'Quit',

  'csv.date': 'Date',
  'csv.start': 'Start',
  'csv.end': 'End',
  'csv.durationMin': 'Duration (min)',
  'csv.task': 'Task',
  'csv.completed': 'Completed',
}

const dicts: Record<Locale, Record<string, string>> = { 'zh-CN': zh, en }

export function setLocale(l: Locale): void {
  if (dicts[l]) locale.value = l
}

/** 取词：当前语言 → 中文回退 → key 本身；{x} 占位符替换 */
export function t(key: string, params?: Record<string, string | number>): string {
  let s = dicts[locale.value][key] ?? dicts['zh-CN'][key] ?? key
  if (params) {
    for (const [k, v] of Object.entries(params)) s = s.replaceAll(`{${k}}`, String(v))
  }
  return s
}

export type PhaseKey = 'focus' | 'short' | 'long'

export function phaseLabel(p: PhaseKey): string {
  return t(`phase.${p}`)
}
