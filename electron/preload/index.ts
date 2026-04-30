import { contextBridge } from 'electron'
import { electronAPI } from '@electron-toolkit/preload'
import { IpcChannels } from '../../src/shared/types/ipc-channels'

// Custom APIs for renderer
const api = {
  mockApiCall: (path: string, method: string, body?: unknown) => {
    return electronAPI.ipcRenderer.invoke('mock-api:call', { path, method, body })
  },
  onLiveComment: (listener: (payload: unknown) => void) => {
    return electronAPI.ipcRenderer.on(IpcChannels.LIVE_COMMENT, (_event, payload) => {
      listener(payload)
    })
  },
  startDouyinDirect: (roomId: string) => {
    return electronAPI.ipcRenderer.invoke(IpcChannels.DOUYIN_DIRECT_START, roomId)
  },
  stopDouyinDirect: () => {
    return electronAPI.ipcRenderer.invoke(IpcChannels.DOUYIN_DIRECT_STOP)
  },
  getDouyinDirectStatus: () => {
    return electronAPI.ipcRenderer.invoke(IpcChannels.DOUYIN_DIRECT_STATUS)
  },
  getDycastRelayStatus: () => {
    return electronAPI.ipcRenderer.invoke(IpcChannels.DYCAST_RELAY_STATUS)
  }
}

// Use `contextBridge` APIs to expose Electron APIs to
// renderer only if context isolation is enabled, otherwise
// just add to the DOM global.
if (process.contextIsolated) {
  try {
    contextBridge.exposeInMainWorld('electron', electronAPI)
    contextBridge.exposeInMainWorld('api', api)
  } catch (error) {
    console.error(error)
  }
} else {
  // @ts-ignore (define in dts)
  window.electron = electronAPI
  // @ts-ignore (define in dts)
  window.api = api
}
