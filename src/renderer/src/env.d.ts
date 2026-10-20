import type { ReadabilityApi } from '../../preload/index'
import type { SettingsBridge } from '@bridle/settings-electron'

declare global {
  interface Window {
    rs: ReadabilityApi
    /** Only in the Settings window (preload/settings.ts). */
    bridleSettings: SettingsBridge
  }
}

declare module '*.css'

export {}
