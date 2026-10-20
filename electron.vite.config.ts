import { resolve } from 'path'
import { defineConfig, externalizeDepsPlugin } from 'electron-vite'
import react from '@vitejs/plugin-react'

const BUNDLED = ['@bridle/commands', '@bridle/settings', '@bridle/settings-electron', '@bridle/settings-react']

export default defineConfig({
  main: {
    // @bridle/* are bundled (not left as node_modules files): they are linked by file: path, and
    // electron-builder copies those as plain files with whatever transitive versions it finds.
    plugins: [externalizeDepsPlugin({ exclude: BUNDLED })],
    build: {
      rollupOptions: {
        input: { index: resolve(__dirname, 'src/main/index.ts') }
      }
    }
  },
  preload: {
    // The Settings window is sandboxed: its preload cannot require packages, so they are bundled in.
    plugins: [externalizeDepsPlugin({ exclude: BUNDLED })],
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/preload/index.ts'),
          settings: resolve(__dirname, 'src/preload/settings.ts')
        }
      }
    }
  },
  renderer: {
    root: resolve(__dirname, 'src/renderer'),
    build: {
      rollupOptions: {
        input: {
          index: resolve(__dirname, 'src/renderer/index.html'),
          settings: resolve(__dirname, 'src/renderer/settings.html')
        }
      }
    },
    plugins: [react()]
  }
})
