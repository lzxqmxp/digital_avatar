import { defineStore } from 'pinia'
import { apiClient, getAvatarRemoteStream } from '@shared/api/client'

export type AvatarEngine = 'Wav2Lip' | 'SadTalker' | 'DiffTalk'

export const useAvatarStore = defineStore('avatar', {
  state: () => ({
    avatarSessionId: null as string | null,
    streamUrl: null as string | null,
    isRunning: false,
    engine: 'Wav2Lip' as AvatarEngine,
    selectedAsset: null as string | null,
    cameraMode: false,
    remoteStream: null as MediaStream | null
  }),

  actions: {
    async start() {
      const res = await apiClient.avatarStart({
        model_id: this.selectedAsset || 'default',
        engine: this.engine,
        camera_mode: this.cameraMode ? 'camera' : 'file'
      })
      if (res.ok && res.data) {
        this.avatarSessionId = res.data.avatar_session_id
        this.streamUrl = res.data.stream_url
        this.isRunning = true
        // 异步获取 WebRTC 远程流（可能稍后才到达）
        getAvatarRemoteStream().then((stream) => {
          this.remoteStream = stream
        })
      }
      return res
    },

    async stop() {
      const res = await apiClient.sessionStop({ session_id: this.avatarSessionId || '' })
      if (res.ok) {
        this.stopRemoteStream()
        this.isRunning = false
        this.avatarSessionId = null
        this.streamUrl = null
      }
      return res
    },

    pickAsset(filename: string) {
      this.selectedAsset = filename
    },

    setEngine(engine: AvatarEngine) {
      this.engine = engine
    },

    async refreshAudio() {
      await new Promise((resolve) => setTimeout(resolve, 300))
      return { ok: true, data: { devices: ['默认设备', '麦克风 (默认)', '扬声器'] } }
    },

    async showPreview() {
      if (!this.avatarSessionId) {
        await this.start()
      }
      return { ok: true, data: { stream_url: this.streamUrl } }
    },

    /** 清理远程流，停止所有轨道 */
    stopRemoteStream() {
      if (this.remoteStream) {
        this.remoteStream.getTracks().forEach((t) => t.stop())
        this.remoteStream = null
      }
    }
  }
})
