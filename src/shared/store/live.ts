import { defineStore } from 'pinia'
import { apiClient } from '@shared/api/client'

export interface LiveMessage {
  id: string
  text: string
  user: string
  ts: number
}

export type LiveRoomEventType =
  | 'chat'
  | 'gift'
  | 'like'
  | 'member'
  | 'social'
  | 'room_stats'
  | 'control'
  | 'system'

export interface LiveRoomStats {
  roomId: string
  audienceCount: number
  followCount: number
  totalUserCount: number
  likeCount: number
}

export interface LiveRoomEvent {
  id: string
  type: LiveRoomEventType
  user: string
  content: string
  ts: number
}

type LiveRoomStatsDelta = Partial<
  Pick<LiveRoomStats, 'audienceCount' | 'followCount' | 'totalUserCount' | 'likeCount'>
>

const ROOM_EVENT_LIMIT = 240
const LIVE_MESSAGE_LIMIT = 240
const DYCAST_DEDUPE_LIMIT = 6000
const AUTO_QUEUE_MAX_PENDING = 32

type DycastRelayEnvelopeKind = 'messages' | 'live-info' | 'raw'

interface DycastRelayEnvelope {
  kind: DycastRelayEnvelopeKind
  data: unknown
}

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

interface AutoQueueState {
  enabled: boolean
  sessionId: string | null
  pending: number
  success: number
  failed: number
  dropped: number
  lastQueuedAt: number | null
  lastError: string | null
}

type DycastMethod =
  | 'WebcastChatMessage'
  | 'WebcastGiftMessage'
  | 'WebcastLikeMessage'
  | 'WebcastMemberMessage'
  | 'WebcastSocialMessage'
  | 'WebcastRoomUserSeqMessage'
  | 'WebcastRoomStatsMessage'
  | 'WebcastControlMessage'
  | 'WebcastEmojiChatMessage'
  | 'CustomMessage'

type JsonRecord = Record<string, unknown>

const mockUsers = ['小鹿', '阿豪', '星辰', '柚子', 'Mika', '小陈', '小熊']
const mockChatTexts = [
  '这个讲解很清楚，点赞了！',
  '现在有优惠吗？',
  '请问这个型号支持多久发货？',
  '主播声音很好听。',
  '想看一下细节特写。'
]
const mockGiftNames = ['小心心', '荧光棒', '玫瑰', '掌声']

let roomStreamTimer: ReturnType<typeof setInterval> | null = null
let stopLiveCommentListener: (() => void) | null = null
let roomEventSeq = 0
let liveMessageSeq = 0
let seenDycastMessageIds = new Set<string>()
let autoQueueChain: Promise<void> = Promise.resolve()

function nextRoomEventId(): string {
  roomEventSeq += 1
  return `${Date.now()}-${roomEventSeq}`
}

function nextLiveMessageId(): string {
  liveMessageSeq += 1
  return `m-${Date.now()}-${liveMessageSeq}`
}

function pick<T>(list: T[]): T {
  return list[Math.floor(Math.random() * list.length)]
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const text = value.trim()
  return text.length > 0 ? text : null
}

function asNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value
  }
  if (typeof value === 'string') {
    const normalized = value.replace(/,/g, '').trim()
    if (!normalized) {
      return null
    }
    const parsed = Number.parseFloat(normalized)
    return Number.isFinite(parsed) ? parsed : null
  }
  return null
}

function asDycastEnvelope(payload: unknown): DycastRelayEnvelope | null {
  if (!isRecord(payload)) {
    return null
  }
  const kind = payload.kind
  if (kind !== 'messages' && kind !== 'live-info' && kind !== 'raw') {
    return null
  }
  return {
    kind,
    data: payload.data
  }
}

function normalizeTimestamp(value: unknown): number {
  const parsed = asNumber(value)
  if (parsed === null) {
    return Date.now()
  }

  if (parsed < 10_000_000_000) {
    return Math.floor(parsed * 1000)
  }

  return Math.floor(parsed)
}

function createDefaultDirectStatus(): DouyinDirectStatus {
  return {
    started: false,
    connecting: false,
    connected: false,
    roomId: null,
    endpoint: null,
    reconnectCount: 0,
    lastMessageAt: null,
    error: null
  }
}

function createDefaultAutoQueueState(): AutoQueueState {
  return {
    enabled: false,
    sessionId: null,
    pending: 0,
    success: 0,
    failed: 0,
    dropped: 0,
    lastQueuedAt: null,
    lastError: null
  }
}

export const useLiveStore = defineStore('live', {
  state: () => ({
    connectionId: null as string | null,
    isConnected: false,
    messages: [] as LiveMessage[],
    messageAlert: false,
    roomStats: {
      roomId: '',
      audienceCount: 0,
      followCount: 0,
      totalUserCount: 0,
      likeCount: 0
    } as LiveRoomStats,
    roomEvents: [] as LiveRoomEvent[],
    relayStatus: createDefaultDirectStatus() as DouyinDirectStatus,
    streamSource: 'idle' as 'idle' | 'dycast' | 'mock',
    autoQueue: createDefaultAutoQueueState() as AutoQueueState
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
        this.roomStats.roomId = roomId
        this.streamSource = 'idle'
        this.relayStatus.lastMessageAt = null
        this.relayStatus.error = null
        this.pushRoomEvent('system', '系统', `已连接直播间 ${roomId}`)
        this.startRoomStream()
      }
      return res
    },

    async disconnect() {
      const res = await apiClient.liveDisconnect({
        connection_id: this.connectionId || ''
      })
      if (res.ok) {
        await this.stopDouyinDirect()
        this.stopRoomStream()
        this.connectionId = null
        this.isConnected = false
        this.streamSource = 'idle'
        this.autoQueue.sessionId = null
        this.pushRoomEvent('control', '系统', '已停止接收直播间实时信息')
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

      this.pushRoomEvent('system', '系统', '消息列表已初始化')
      for (const item of this.messages) {
        this.pushRoomEvent('chat', item.user, item.text, item.ts)
      }
    },

    toggleMessageAlert() {
      this.messageAlert = !this.messageAlert
    },

    setAutoQueueEnabled(enabled: boolean) {
      this.autoQueue.enabled = enabled
      if (!enabled) {
        this.autoQueue.pending = 0
      }
      this.pushRoomEvent('system', '系统', enabled ? '已开启弹幕自动入队' : '已关闭弹幕自动入队')
    },

    setAutoQueueSession(sessionId: string | null) {
      this.autoQueue.sessionId = sessionId
      if (!sessionId) {
        this.autoQueue.pending = 0
      }
    },

    resetAutoQueueMetrics() {
      this.autoQueue.pending = 0
      this.autoQueue.success = 0
      this.autoQueue.failed = 0
      this.autoQueue.dropped = 0
      this.autoQueue.lastQueuedAt = null
      this.autoQueue.lastError = null
    },

    addMessage(text: string, user: string) {
      const ts = Date.now()
      this.messages.push({
        id: ts.toString(),
        text,
        user,
        ts
      })
      this.pushRoomEvent('chat', user, text, ts)
    },

    pushRoomEvent(type: LiveRoomEventType, user: string, content: string, ts = Date.now()) {
      this.roomEvents.push({
        id: nextRoomEventId(),
        type,
        user,
        content,
        ts
      })

      if (this.roomEvents.length > ROOM_EVENT_LIMIT) {
        this.roomEvents.splice(0, this.roomEvents.length - ROOM_EVENT_LIMIT)
      }
    },

    applyRoomStatsDelta(delta: LiveRoomStatsDelta) {
      if (typeof delta.audienceCount === 'number') {
        this.roomStats.audienceCount = Math.max(
          0,
          this.roomStats.audienceCount + delta.audienceCount
        )
      }
      if (typeof delta.followCount === 'number') {
        this.roomStats.followCount = Math.max(0, this.roomStats.followCount + delta.followCount)
      }
      if (typeof delta.totalUserCount === 'number') {
        this.roomStats.totalUserCount = Math.max(
          0,
          this.roomStats.totalUserCount + delta.totalUserCount
        )
      }
      if (typeof delta.likeCount === 'number') {
        this.roomStats.likeCount = Math.max(0, this.roomStats.likeCount + delta.likeCount)
      }
    },

    applyRoomStatsSnapshot(rawRoom: unknown) {
      if (!isRecord(rawRoom)) {
        return
      }

      const audienceCount = asNumber(rawRoom.audienceCount)
      const followCount = asNumber(rawRoom.followCount)
      const totalUserCount = asNumber(rawRoom.totalUserCount)
      const likeCount = asNumber(rawRoom.likeCount)

      if (audienceCount !== null) {
        this.roomStats.audienceCount = Math.max(0, Math.floor(audienceCount))
      }
      if (followCount !== null) {
        this.roomStats.followCount = Math.max(0, Math.floor(followCount))
      }
      if (totalUserCount !== null) {
        this.roomStats.totalUserCount = Math.max(0, Math.floor(totalUserCount))
      }
      if (likeCount !== null) {
        this.roomStats.likeCount = Math.max(0, Math.floor(likeCount))
      }
    },

    appendLiveMessageFromRoom(text: string, user: string, ts: number) {
      this.messages.push({
        id: nextLiveMessageId(),
        text,
        user,
        ts
      })

      if (this.messages.length > LIVE_MESSAGE_LIMIT) {
        this.messages.splice(0, this.messages.length - LIVE_MESSAGE_LIMIT)
      }
    },

    scheduleAutoQueueFromChat(text: string) {
      if (!this.autoQueue.enabled || !this.autoQueue.sessionId) {
        return
      }

      if (this.autoQueue.pending >= AUTO_QUEUE_MAX_PENDING) {
        this.autoQueue.dropped += 1
        if (this.autoQueue.dropped % 10 === 1) {
          this.pushRoomEvent('control', '系统', `弹幕入队拥塞，已丢弃 ${this.autoQueue.dropped} 条`)
        }
        return
      }

      const sessionId = this.autoQueue.sessionId
      this.autoQueue.pending += 1

      autoQueueChain = autoQueueChain
        .catch(() => {
          return
        })
        .then(async () => {
          const queueRes = await apiClient.queueEnqueue({
            session_id: sessionId,
            item: {
              text,
              priority: 2,
              source: 'dycast-chat'
            }
          })

          if (queueRes.ok) {
            this.autoQueue.success += 1
            this.autoQueue.lastQueuedAt = Date.now()
            this.autoQueue.lastError = null
            return
          }

          this.autoQueue.failed += 1
          this.autoQueue.lastError = queueRes.message || '弹幕入队失败'
        })
        .catch((error) => {
          this.autoQueue.failed += 1
          this.autoQueue.lastError = error instanceof Error ? error.message : '弹幕入队异常'
        })
        .finally(() => {
          this.autoQueue.pending = Math.max(0, this.autoQueue.pending - 1)
        })
    },

    describeRoomStatus(status: number): string {
      switch (status) {
        case 1:
          return '主播准备中'
        case 2:
          return '主播直播中'
        case 3:
          return '主播暂时离开'
        case 4:
          return '主播已下播'
        default:
          return `房间状态变更(${status})`
      }
    },

    mapDycastMethodToRoomEventType(method: string): LiveRoomEventType {
      switch (method as DycastMethod) {
        case 'WebcastChatMessage':
        case 'WebcastEmojiChatMessage':
          return 'chat'
        case 'WebcastGiftMessage':
          return 'gift'
        case 'WebcastLikeMessage':
          return 'like'
        case 'WebcastMemberMessage':
          return 'member'
        case 'WebcastSocialMessage':
          return 'social'
        case 'WebcastRoomUserSeqMessage':
        case 'WebcastRoomStatsMessage':
          return 'room_stats'
        case 'WebcastControlMessage':
        case 'CustomMessage':
          return 'control'
        default:
          return 'system'
      }
    },

    formatDycastContent(type: LiveRoomEventType, rawMessage: JsonRecord): string {
      const rawContent = asString(rawMessage.content)

      if (type === 'gift') {
        const gift = isRecord(rawMessage.gift) ? rawMessage.gift : null
        const giftName = gift ? asString(gift.name) : null
        const giftCount = gift ? asNumber(gift.count) : null
        if (rawContent) {
          return rawContent
        }
        if (giftName) {
          return giftCount && giftCount > 1
            ? `送出了 ${giftName} x${Math.floor(giftCount)}`
            : `送出了 ${giftName}`
        }
        return '送出了礼物'
      }

      if (type === 'control') {
        const room = isRecord(rawMessage.room) ? rawMessage.room : null
        const roomStatus = room ? asNumber(room.status) : null
        if (roomStatus !== null) {
          return this.describeRoomStatus(roomStatus)
        }
      }

      if (rawContent) {
        return rawContent
      }

      if (type === 'like') {
        return '为主播点赞了'
      }
      if (type === 'member') {
        return '进入直播间'
      }
      if (type === 'social') {
        return '关注了主播'
      }
      if (type === 'room_stats') {
        return `在线 ${this.roomStats.audienceCount} | 粉丝 ${this.roomStats.followCount} | 累计 ${this.roomStats.totalUserCount} | 点赞 ${this.roomStats.likeCount}`
      }
      if (type === 'control') {
        return '房间状态变更'
      }
      return '收到一条直播消息'
    },

    consumeDycastMessage(rawMessage: unknown, index: number) {
      if (!isRecord(rawMessage)) {
        return
      }

      const method = asString(rawMessage.method) || 'CustomMessage'
      const messageIdPart =
        asString(rawMessage.id) || String(rawMessage.id || `${Date.now()}-${index}`)
      const dedupeId = `${method}-${messageIdPart}`
      if (seenDycastMessageIds.has(dedupeId)) {
        return
      }
      seenDycastMessageIds.add(dedupeId)

      if (seenDycastMessageIds.size > DYCAST_DEDUPE_LIMIT) {
        seenDycastMessageIds = new Set<string>()
      }

      this.applyRoomStatsSnapshot(rawMessage.room)

      const userData = isRecord(rawMessage.user) ? rawMessage.user : null
      const userName = userData ? asString(userData.name) || '游客' : '游客'
      const type = this.mapDycastMethodToRoomEventType(method)

      const gift = isRecord(rawMessage.gift) ? rawMessage.gift : null
      const giftRepeatEnd = gift ? asNumber(gift.repeatEnd) : null
      if (type === 'gift' && giftRepeatEnd !== null && giftRepeatEnd > 0) {
        return
      }

      const content = this.formatDycastContent(type, rawMessage)
      const ts = normalizeTimestamp(rawMessage.ts)

      this.pushRoomEvent(type, userName, content, ts)

      if (type === 'chat') {
        this.appendLiveMessageFromRoom(content, userName, ts)
        this.scheduleAutoQueueFromChat(content)
      }
    },

    consumeDycastMessages(payload: unknown) {
      if (!Array.isArray(payload)) {
        return
      }

      payload.forEach((item, index) => {
        this.consumeDycastMessage(item, index)
      })
    },

    consumeDycastLiveInfo(payload: unknown) {
      if (!isRecord(payload)) {
        return
      }

      const roomNum = asString(payload.roomNum)
      const roomId = asString(payload.roomId)
      const roomTitle = asString(payload.title)
      const mappedRoomId = roomNum || roomId

      if (mappedRoomId) {
        this.roomStats.roomId = mappedRoomId
      }

      if (mappedRoomId || roomTitle) {
        const titlePart = roomTitle ? ` (${roomTitle})` : ''
        this.pushRoomEvent(
          'system',
          '系统',
          `DyCast 已接入房间 ${mappedRoomId || '--'}${titlePart}`
        )
      }
    },

    consumeDycastEnvelope(payload: unknown) {
      const envelope = asDycastEnvelope(payload)
      if (!envelope) {
        return
      }

      this.relayStatus.lastMessageAt = Date.now()

      if (envelope.kind === 'messages') {
        this.consumeDycastMessages(envelope.data)
        return
      }

      if (envelope.kind === 'live-info') {
        this.consumeDycastLiveInfo(envelope.data)
      }
    },

    async refreshDouyinDirectStatus(): Promise<DouyinDirectStatus | null> {
      if (typeof window === 'undefined' || !window.api) {
        return null
      }
      if (typeof window.api.getDouyinDirectStatus !== 'function') {
        return null
      }

      try {
        const status = await window.api.getDouyinDirectStatus()
        this.relayStatus = { ...status }
        return this.relayStatus
      } catch {
        return null
      }
    },

    async stopDouyinDirect(): Promise<void> {
      if (typeof window === 'undefined' || !window.api) {
        return
      }
      if (typeof window.api.stopDouyinDirect !== 'function') {
        return
      }

      try {
        const status = await window.api.stopDouyinDirect()
        this.relayStatus = { ...status }
      } catch {
        // ignore stop errors during teardown
      }
    },

    startDouyinDirectStream(): boolean {
      if (typeof window === 'undefined' || !window.api) {
        return false
      }

      if (typeof window.api.onLiveComment !== 'function') {
        return false
      }

      if (typeof window.api.startDouyinDirect !== 'function') {
        return false
      }

      if (typeof window.api.getDouyinDirectStatus !== 'function') {
        return false
      }

      stopLiveCommentListener = window.api.onLiveComment((payload: unknown) => {
        this.streamSource = 'dycast'
        this.consumeDycastEnvelope(payload)
      })

      this.pushRoomEvent('system', '系统', '已订阅内置抖音直连通道，正在建立连接...')

      void window.api
        .startDouyinDirect(this.roomStats.roomId)
        .then((status) => {
          this.relayStatus = { ...status }

          if (!status || !status.started) {
            this.pushRoomEvent('control', '系统', '抖音直连启动失败，已回退到模拟流')
            this.startMockRoomStream()
            return
          }

          if (status.connected || status.connecting) {
            this.streamSource = 'dycast'
          }

          const endpointText = status.endpoint || '待连接'
          this.pushRoomEvent(
            'system',
            '系统',
            status.connected
              ? `抖音直连已接入，地址 ${endpointText}`
              : `抖音直连已启动，正在连接 ${endpointText}`
          )

          void this.refreshDouyinDirectStatus()
        })
        .catch(() => {
          this.pushRoomEvent('control', '系统', '抖音直连状态读取失败，已回退到模拟流')
          this.startMockRoomStream()
        })

      return true
    },

    startMockRoomStream() {
      if (roomStreamTimer) {
        clearInterval(roomStreamTimer)
      }

      this.streamSource = 'mock'

      roomStreamTimer = setInterval(() => {
        if (!this.isConnected) {
          return
        }

        const roll = Math.random()

        if (roll < 0.34) {
          const user = pick(mockUsers)
          const content = pick(mockChatTexts)
          this.pushRoomEvent('chat', user, content)
          this.appendLiveMessageFromRoom(content, user, Date.now())
          this.scheduleAutoQueueFromChat(content)
          return
        }

        if (roll < 0.52) {
          const user = pick(mockUsers)
          const likeCount = Math.floor(Math.random() * 6) + 1
          this.applyRoomStatsDelta({ likeCount })
          this.pushRoomEvent('like', user, `为主播点赞了 (${likeCount})`)
          return
        }

        if (roll < 0.66) {
          const user = pick(mockUsers)
          this.applyRoomStatsDelta({ audienceCount: 1, totalUserCount: 1 })
          this.pushRoomEvent('member', user, '进入直播间')
          return
        }

        if (roll < 0.78) {
          const user = pick(mockUsers)
          this.applyRoomStatsDelta({ followCount: 1 })
          this.pushRoomEvent('social', user, '关注了主播')
          return
        }

        if (roll < 0.9) {
          const user = pick(mockUsers)
          const giftName = pick(mockGiftNames)
          const giftCount = Math.floor(Math.random() * 3) + 1
          this.pushRoomEvent('gift', user, `送出了 ${giftName} x${giftCount}`)
          return
        }

        const fluctuation = Math.floor(Math.random() * 3) - 1
        this.applyRoomStatsDelta({ audienceCount: fluctuation })
        this.pushRoomEvent(
          'room_stats',
          '系统',
          `在线 ${this.roomStats.audienceCount} | 粉丝 ${this.roomStats.followCount} | 累计 ${this.roomStats.totalUserCount} | 点赞 ${this.roomStats.likeCount}`
        )
      }, 1300)
    },

    startRoomStream() {
      this.stopRoomStream()
      seenDycastMessageIds = new Set<string>()
      this.resetAutoQueueMetrics()

      const usingDirectClient = this.startDouyinDirectStream()
      if (!usingDirectClient) {
        this.pushRoomEvent('system', '系统', '未检测到主进程抖音直连能力，已回退到模拟流')
        this.startMockRoomStream()
      }
    },

    stopRoomStream() {
      if (stopLiveCommentListener) {
        stopLiveCommentListener()
        stopLiveCommentListener = null
      }

      if (roomStreamTimer) {
        clearInterval(roomStreamTimer)
        roomStreamTimer = null
      }

      void this.stopDouyinDirect()

      seenDycastMessageIds = new Set<string>()
      this.autoQueue.pending = 0
    }
  }
})
