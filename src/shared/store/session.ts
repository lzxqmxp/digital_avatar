import { defineStore } from 'pinia'
import { apiClient } from '@shared/api/client'
import type { SessionState, MetricsResponse } from '@shared/types/api'

export const useSessionStore = defineStore('session', {
  state: () => ({
    sessionId: null as string | null,
    sessionState: 'idle' as SessionState,
    metrics: null as MetricsResponse | null,
    isLoading: false
  }),

  actions: {
    async startSession(roomId: string, accountId: string) {
      this.isLoading = true
      try {
        const res = await apiClient.sessionStart({ room_id: roomId, account_id: accountId })
        if (res.ok && res.data) {
          this.sessionId = res.data.session_id
          this.sessionState = res.data.state
        }
        return res
      } finally {
        this.isLoading = false
      }
    },

    async stopSession() {
      this.isLoading = true
      try {
        const res = await apiClient.sessionStop({ session_id: this.sessionId || '' })
        if (res.ok && res.data) {
          this.sessionState = res.data.state
        }
        return res
      } finally {
        this.isLoading = false
      }
    },

    async fetchStatus() {
      const res = await apiClient.sessionStatus()
      if (res.ok && res.data) {
        this.sessionState = res.data.state
        if (res.data.session_id) {
          this.sessionId = res.data.session_id
        }
      }
      return res
    },

    async fetchMetrics() {
      const res = await apiClient.metrics()
      if (res.ok && res.data) {
        this.metrics = res.data
      }
      return res
    }
  }
})
