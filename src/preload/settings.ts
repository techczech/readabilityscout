// Preload of the shared Settings window. Bundled with the app (a sandboxed preload cannot load packages).
import { exposeSettingsBridge } from '@bridle/settings-electron/preload'

exposeSettingsBridge()
