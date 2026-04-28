import { defineStore } from 'pinia'
import { apiClient } from '@shared/api/client'

export interface LiveMessage {
  id: string
  text: string
  user: string
  ts: number
}

export const useLiveStore = defineStore('live', {
  state: () => ({
    connectionId: null as string | null,
    isConnected: false,
    messages: [] as LiveMessage[],
    messageAlert: false
  }),

  actions: {
    async connect(roomId: string, platform: string, accountId: string) {
      const res = await apiClient.liveConnect({
        room_id: roomId,
        platform,
        account_id: accountId
      })
      if (res.ok && res.data) {
        this.connectionId = res.data.connection_id
        this.isConnected = true
      }
      return res
    },

    async disconnect() {
      const res = await apiClient.liveDisconnect({
        connection_id: this.connectionId || ''
      })
      if (res.ok) {
        this.connectionId = null
        this.isConnected = false
      }
      return res
    },

    initMessages() {
      const now = Date.now()
      this.messages = [
        { id: '1', text: '欢迎来到直播间！', user: '系统', ts: now - 3000 },
        { id: '2', text: '今天有什么优惠吗？', user: '用户A', ts: now - 2000 },
        { id: '3', text: '产品质量怎么样？', user: '用户B', ts: now - 1000 }
      ]
    },

    toggleMessageAlert() {
      this.messageAlert = !this.messageAlert
    },

    addMessage(text: string, user: string) {
      this.messages.push({
        id: Date.now().toString(),
        text,
        user,
        ts: Date.now()
      })
    }
  }
})
