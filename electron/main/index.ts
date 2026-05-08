import { app, shell, BrowserWindow, ipcMain } from 'electron'
import { join } from 'path'
import { electronApp, optimizer, is } from '@electron-toolkit/utils'
import icon from '../../resources/icon.png?asset'
import { IpcChannels } from '../../src/shared/types/ipc-channels'
import {
  disposeDouyinDirectClient,
  getDouyinDirectStatus,
  startDouyinDirectClient,
  stopDouyinDirectClient
} from './douyin-direct-client'
import {
  getDycastRelayStatus,
  startDycastRelayServer,
  stopDycastRelayServer
} from './dycast-relay-server'
import { closeMockApiDatabase, handleMockApiCall } from './mock-api-db'
import { startLiveTalking, stopLiveTalking } from './livetalking-process'

function createWindow(): void {
  // Create the browser window.
  const mainWindow = new BrowserWindow({
    width: 900,
    height: 670,
    show: false,
    autoHideMenuBar: true,
    ...(process.platform === 'linux' ? { icon } : {}),
    webPreferences: {
      preload: join(__dirname, '../preload/index.js'),
      sandbox: false
    }
  })

  mainWindow.on('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.webContents.setWindowOpenHandler((details) => {
    shell.openExternal(details.url)
    return { action: 'deny' }
  })

  // HMR for renderer base on electron-vite cli.
  // Load the remote URL for development or the local html file for production.
  if (is.dev && process.env['ELECTRON_RENDERER_URL']) {
    mainWindow.loadURL(process.env['ELECTRON_RENDERER_URL'])
  } else {
    mainWindow.loadFile(join(__dirname, '../renderer/index.html'))
  }
}

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.whenReady().then(() => {
  // Set app user model id for windows
  electronApp.setAppUserModelId('com.electron')

  // Default open or close DevTools by F12 in development
  // and ignore CommandOrControl + R in production.
  // see https://github.com/alex8088/electron-toolkit/tree/master/packages/utils
  app.on('browser-window-created', (_, window) => {
    optimizer.watchWindowShortcuts(window)
  })

  // IPC test
  ipcMain.on('ping', () => console.log('pong'))
  ipcMain.removeHandler('mock-api:call')
  ipcMain.handle(
    'mock-api:call',
    (_event, payload: { path: string; method: string; body?: unknown }) => {
      return handleMockApiCall(payload.path, payload.method, payload.body)
    }
  )

  ipcMain.removeHandler(IpcChannels.DOUYIN_DIRECT_START)
  ipcMain.handle(IpcChannels.DOUYIN_DIRECT_START, async (_event, roomId: string) => {
    try {
      return await startDouyinDirectClient(roomId)
    } catch (error) {
      const status = getDouyinDirectStatus()
      return {
        ...status,
        started: false,
        connecting: false,
        connected: false,
        error: error instanceof Error ? error.message : 'douyin direct start failed'
      }
    }
  })

  ipcMain.removeHandler(IpcChannels.DOUYIN_DIRECT_STOP)
  ipcMain.handle(IpcChannels.DOUYIN_DIRECT_STOP, () => {
    return stopDouyinDirectClient()
  })

  ipcMain.removeHandler(IpcChannels.DOUYIN_DIRECT_STATUS)
  ipcMain.handle(IpcChannels.DOUYIN_DIRECT_STATUS, () => getDouyinDirectStatus())

  startDycastRelayServer()
  ipcMain.removeHandler(IpcChannels.DYCAST_RELAY_STATUS)
  ipcMain.handle(IpcChannels.DYCAST_RELAY_STATUS, () => getDycastRelayStatus())

  const runtimeMode = process.env.VITE_APP_RUNTIME_MODE || 'dev-mock'
  if (runtimeMode === 'dev-cpu') {
    startLiveTalking().catch((err) => {
      console.error('[Main] Failed to start LiveTalking:', err)
    })
  }

  createWindow()

  app.on('activate', function () {
    // On macOS it's common to re-create a window in the app when the
    // dock icon is clicked and there are no other windows open.
    if (BrowserWindow.getAllWindows().length === 0) createWindow()
  })
})

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  void stopDouyinDirectClient()
  disposeDouyinDirectClient()
  stopDycastRelayServer()
  stopLiveTalking().catch(console.error)
  closeMockApiDatabase()
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and require them here.
