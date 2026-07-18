import type { ReadabilityApi } from '../../preload/index'

declare global {
  interface Window {
    rs: ReadabilityApi
  }
}

export {}
