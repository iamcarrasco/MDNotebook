'use client'

import {
  isPermissionGranted,
  requestPermission,
  sendNotification,
} from '@tauri-apps/plugin-notification'

let permissionChecked = false
let hasPermission = false

async function ensurePermission(): Promise<boolean> {
  if (permissionChecked) return hasPermission
  hasPermission = await isPermissionGranted()
  if (!hasPermission) {
    const result = await requestPermission()
    hasPermission = result === 'granted'
  }
  permissionChecked = true
  return hasPermission
}

export async function notify(title: string, body?: string): Promise<void> {
  const allowed = await ensurePermission()
  if (!allowed) return
  sendNotification({ title, body })
}
