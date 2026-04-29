import { ElectronAPI } from '@electron-toolkit/preload'

interface DouyinDirectStatus {
  started: boolean
  connecting: boolean
  connected: boolean
  roomId: string | null
  endpoint: string | null
  reconnectCount: number
  lastMessageAt: number | null
  error: string | null
}

interface RendererBridgeApi {
  mockApiCall: (path: string, method: string, body?: unknown) => Promise<unknown>
  onLiveComment: (listener: (payload: unknown) => void) => () => void
  startDouyinDirect: (roomId: string) => Promise<DouyinDirectStatus>
  stopDouyinDirect: () => Promise<DouyinDirectStatus>
  getDouyinDirectStatus: () => Promise<DouyinDirectStatus>
}

declare global {
  interface Window {
    electron: ElectronAPI
    api: RendererBridgeApi
  }
}
