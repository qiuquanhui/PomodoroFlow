import { isPermissionGranted, requestPermission, sendNotification } from '@tauri-apps/plugin-notification'
import { isTauri } from './backend'

let permissionReady = false

/** 首次调用时申请通知权限（Windows 一般默认允许）。 */
async function ensurePermission(): Promise<boolean> {
  if (!isTauri) return false
  try {
    if (!permissionReady) {
      let granted = await isPermissionGranted()
      if (!granted) granted = (await requestPermission()) === 'granted'
      permissionReady = granted
    }
    return permissionReady
  } catch (e) {
    console.error('notification permission failed:', e)
    return false
  }
}

/** 发送系统 Toast 通知（FR-301/302：区分阶段场景）。 */
export async function notify(title: string, body: string): Promise<void> {
  if (!(await ensurePermission())) return
  try {
    sendNotification({ title, body })
  } catch (e) {
    console.error('sendNotification failed:', e)
  }
}
