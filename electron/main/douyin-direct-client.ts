import { BrowserWindow } from 'electron'
import { createHash } from 'node:crypto'
import { gunzipSync } from 'node:zlib'
import { WebSocket, type RawData } from 'ws'
import { IpcChannels } from '../../src/shared/types/ipc-channels'
import {
  decodeChatMessage,
  decodeControlMessage,
  decodeEmojiChatMessage,
  decodeGiftMessage,
  decodeLikeMessage,
  decodeMemberMessage,
  decodePushFrame,
  decodeResponse,
  decodeRoomStatsMessage,
  decodeRoomUserSeqMessage,
  decodeSocialMessage,
  encodePushFrame,
  type Message
} from './douyin/model'
import { getAbogus } from './douyin/abogus'

type JsonRecord = Record<string, unknown>

interface LiveInfo {
  roomNum: string
  roomId: string
  uniqueId: string
  avatar: string
  cover: string
  nickname: string
  title: string
  status: number
}

interface ImInfo {
  cursor?: string
  internalExt?: string
  pushServer?: string
  fetchInterval?: string
  now?: string
  fetchType?: number
  liveCursor?: string
}

interface CursorState {
  cursor: string
  firstCursor: string
  internalExt: string
}

export interface DouyinDirectStatus {
  started: boolean
  connecting: boolean
  connected: boolean
  roomId: string | null
  endpoint: string | null
  reconnectCount: number
  lastMessageAt: number | null
  error: string | null
}

interface RelayEnvelope {
  kind: 'messages' | 'live-info' | 'raw'
  data: unknown
}

const DOUYIN_ORIGIN = 'https://live.douyin.com'
const DEFAULT_WSS_ENDPOINT = 'wss://live.douyin.com/webcast/im/push/v2/'
const WEBCAST_SDK_VERSION = '1.0.15'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36'
const BROWSER_VERSION =
  '5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36'
const ACCEPT_LANGUAGE = 'zh-CN,zh;q=0.9'
const LIVE_PAGE_REFERER = `${DOUYIN_ORIGIN}/`

const MAX_RECONNECT_COUNT = 3
const PING_INTERVAL_MS = 10_000
const PING_DOWNGRADE_COUNT = 2

function nowMs(): number {
  return Date.now()
}

function toUtf8Bytes(text: string): Uint8Array {
  return new Uint8Array(Buffer.from(text, 'utf8'))
}

function asString(value: unknown): string | null {
  if (typeof value !== 'string') {
    return null
  }
  const normalized = value.trim()
  return normalized.length > 0 ? normalized : null
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

function normalizeTimestamp(value: unknown): number {
  const parsed = asNumber(value)
  if (parsed === null) {
    return nowMs()
  }

  if (parsed < 10_000_000_000) {
    return Math.floor(parsed * 1000)
  }

  return Math.floor(parsed)
}

function parseHeadersToMap(setCookie: string[]): Map<string, string> {
  const cookieMap = new Map<string, string>()
  for (const line of setCookie) {
    const part = line.split(';', 1)[0]
    if (!part) {
      continue
    }
    const eqIndex = part.indexOf('=')
    if (eqIndex <= 0) {
      continue
    }
    const name = part.slice(0, eqIndex).trim()
    const value = part.slice(eqIndex + 1).trim()
    if (!name) {
      continue
    }
    cookieMap.set(name, value)
  }
  return cookieMap
}

function splitSetCookieHeader(raw: string): string[] {
  // RFC 6265 allows comma inside expires, so split on ",<token>=" pattern.
  const result: string[] = []
  let cursor = 0
  for (let i = 0; i < raw.length; i += 1) {
    const current = raw[i]
    if (current !== ',') {
      continue
    }

    const rest = raw.slice(i + 1)
    if (!/^\s*[A-Za-z0-9_\-]+=/.test(rest)) {
      continue
    }

    const piece = raw.slice(cursor, i).trim()
    if (piece) {
      result.push(piece)
    }
    cursor = i + 1
  }

  const last = raw.slice(cursor).trim()
  if (last) {
    result.push(last)
  }
  return result
}

function pickFirstMatch(texts: string[], patterns: RegExp[]): string {
  for (const text of texts) {
    for (const pattern of patterns) {
      const matched = text.match(pattern)
      const value = matched?.[1]?.trim()
      if (value) {
        return value
      }
    }
  }
  return ''
}

function buildFallbackUniqueId(): string {
  const prefix = `${Date.now()}${Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, '0')}`
  const normalized = prefix.replace(/\D/g, '')
  return normalized.slice(0, 19).padEnd(19, '0')
}

function parseLiveHtml(html: string, roomNum: string): LiveInfo | null {
  const roomIdPatterns = [
    /"roomId":"([0-9]{6,22})"/,
    /\\"roomId\\":\\"([0-9]{6,22})\\"/,
    /"room_id":"([0-9]{6,22})"/,
    /\\"room_id\\":\\"([0-9]{6,22})\\"/,
    /wss_push_room_id[:=]([0-9]{6,22})/,
    /room_id[:=]([0-9]{6,22})/,
    /"web_rid":"([0-9]{6,22})"/
  ]
  const uniqueIdPatterns = [
    /"user_unique_id":"([0-9]{6,22})"/,
    /\\"user_unique_id\\":\\"([0-9]{6,22})\\"/,
    /wss_push_did[:=]([0-9]{6,22})/,
    /user_unique_id[:=]([0-9]{6,22})/,
    /"device_id":"([0-9]{6,22})"/
  ]

  const compact = html.replace(/\s+/g, ' ')
  const normalized = compact
    .replace(/\\u0026/g, '&')
    .replace(/\\u003d/g, '=')
    .replace(/\\u003a/g, ':')
    .replace(/\\\//g, '/')
    .replace(/\\{1,7}"/g, '"')

  try {
    const matchRes = html.match(
      /<script\snonce="\S+?"\s>self\.__pace_f\.push\(\[1,"[a-z]?:\[\\"\$\\",\\"\$L\d+\\",null,([\s\S]+?state[\s\S]+?)\]\\n"\]\)<\/script>/
    )

    let json = matchRes?.[1] || ''
    if (!json) {
      const roomId =
        pickFirstMatch([normalized, compact], roomIdPatterns) ||
        (/^[0-9]{6,22}$/.test(roomNum) ? roomNum : '')
      const uniqueId =
        pickFirstMatch([normalized, compact], uniqueIdPatterns) || buildFallbackUniqueId()

      if (!roomId) {
        return null
      }
      return {
        roomNum,
        roomId,
        uniqueId,
        avatar: '',
        cover: '',
        nickname: '',
        title: '',
        status: 2
      }
    }

    const regMap: Record<string, RegExp> = {
      roomId: /{"state":{[\s\S]*?"roomStore":{[\s\S]*?"roomInfo":{[\s\S]*?"roomId":"([0-9]+?)"/,
      uniqueId:
        /{"state":{[\s\S]*?"userStore":{[\s\S]*?"odin":{[\s\S]*?"user_unique_id":"([0-9]+?)"/,
      avatar:
        /{"state":{[\s\S]*?"roomStore":{[\s\S]*?"roomInfo":{[\s\S]*?"anchor":{[\s\S]*?"avatar_thumb":{[\s\S]*?"url_list":\["([\S]+?)"/,
      cover:
        /{"state":{[\s\S]*?"roomStore":{[\s\S]*?"roomInfo":{[\s\S]*?"room":{[\s\S]*?"cover":{[\s\S]*?"url_list":\["([\S]+?)"/,
      nickname:
        /{"state":{[\s\S]*?"roomStore":{[\s\S]*?"roomInfo":{[\s\S]*?"anchor":{[\s\S]*?"nickname":"([\s\S]+?)"/,
      title:
        /{"state":{[\s\S]*?"roomStore":{[\s\S]*?"roomInfo":{[\s\S]*?"room":{[\s\S]*?"title":"([\s\S]+?)"/,
      status:
        /{"state":{[\s\S]*?"roomStore":{[\s\S]*?"roomInfo":{[\s\S]*?"room":{[\s\S]*?"status":([0-9]{1})/
    }

    const extractJsonField = (name: string, raw: string): string => {
      const reg = regMap[name]
      if (!reg) {
        return ''
      }
      const found = reg.exec(raw)
      return found?.[1] || ''
    }

    json = json.replace(/\\{1,7}"/g, '"')

    const roomId =
      extractJsonField('roomId', json) ||
      pickFirstMatch([json, normalized, compact], roomIdPatterns) ||
      (/^[0-9]{6,22}$/.test(roomNum) ? roomNum : '')
    const uniqueId =
      extractJsonField('uniqueId', json) ||
      pickFirstMatch([json, normalized, compact], uniqueIdPatterns) ||
      buildFallbackUniqueId()

    if (!roomId) {
      return null
    }

    const decodeUnicodeUrl = (url: string): string => {
      if (!url) {
        return ''
      }
      return url.replace(/\\u0026/g, '&').replace(/\\\//g, '/')
    }

    const statusText = extractJsonField('status', json) || '2'
    const parsedStatus = Number.parseInt(statusText, 10)

    return {
      roomNum,
      roomId,
      uniqueId,
      avatar: decodeUnicodeUrl(extractJsonField('avatar', json)),
      cover: decodeUnicodeUrl(extractJsonField('cover', json)),
      nickname: extractJsonField('nickname', json),
      title: extractJsonField('title', json),
      status: Number.isFinite(parsedStatus) ? parsedStatus : 2
    }
  } catch {
    return null
  }
}

function makeUrlParams(params: Record<string, unknown>): string {
  const searchParams = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    searchParams.append(key, value === undefined || value === null ? '' : String(value))
  }
  return searchParams.toString()
}

function getMsToken(length = 184): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_='
  let out = ''
  for (let i = 0; i < length; i += 1) {
    out += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return out
}

function resolveSocketEndpoint(pushServer: string | undefined): string {
  const ensureImPushPath = (endpoint: string): string => {
    if (/\/webcast\/im\/push\/v\d+\/?$/i.test(endpoint)) {
      return endpoint.endsWith('/') ? endpoint : `${endpoint}/`
    }
    return `${endpoint.replace(/\/+$/, '')}/webcast/im/push/v2/`
  }

  const normalized = pushServer?.trim()
  if (!normalized) {
    return DEFAULT_WSS_ENDPOINT
  }

  if (/^wss?:\/\//i.test(normalized)) {
    return ensureImPushPath(normalized)
  }

  if (/^https?:\/\//i.test(normalized)) {
    const wsHost = normalized.replace(/^http/i, 'ws')
    return ensureImPushPath(wsHost)
  }

  return ensureImPushPath(`wss://${normalized.replace(/^\/+|\/+$/g, '')}`)
}

function buildSignatureStub(roomId: string, uniqueId: string): string {
  const raw = `live_id=1,aid=6383,version_code=180800,webcast_sdk_version=${WEBCAST_SDK_VERSION},room_id=${roomId},sub_room_id=,sub_channel_id=,did_rule=3,user_unique_id=${uniqueId},device_platform=web,device_type=,ac=,identity=audience`
  return createHash('md5').update(raw).digest('hex')
}

function normalizeRawData(data: RawData): Uint8Array {
  if (typeof data === 'string') {
    return toUtf8Bytes(data)
  }

  if (data instanceof ArrayBuffer) {
    return new Uint8Array(data)
  }

  if (Array.isArray(data)) {
    return new Uint8Array(Buffer.concat(data.map((chunk) => Buffer.from(chunk))))
  }

  return new Uint8Array(Buffer.from(data))
}

function toGiftCount(raw: unknown, fallback: unknown): number | undefined {
  const value = asNumber(raw)
  if (value !== null) {
    return Math.max(1, Math.floor(value))
  }

  const alt = asNumber(fallback)
  if (alt !== null) {
    return Math.max(1, Math.floor(alt))
  }

  return undefined
}

function createDefaultStatus(): DouyinDirectStatus {
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

function broadcastLiveComment(payload: RelayEnvelope): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (window.isDestroyed()) {
      continue
    }
    window.webContents.send(IpcChannels.LIVE_COMMENT, payload)
  }
}

class SignatureProvider {
  private window: BrowserWindow | null = null

  private loadingPromise: Promise<void> | null = null

  private currentContextUrl: string | null = null

  async sign(roomId: string, uniqueId: string, roomNum: string): Promise<string> {
    await this.ensureLoaded(roomNum)
    if (!this.window || this.window.isDestroyed()) {
      throw new Error('signature window unavailable')
    }

    const stub = buildSignatureStub(roomId, uniqueId)
    const result = await this.window.webContents.executeJavaScript(
      `(() => {
        const signer = window.byted_acrawler && window.byted_acrawler.frontierSign
        if (!signer) {
          return ''
        }
        const payload = signer({ 'X-MS-STUB': ${JSON.stringify(stub)} })
        if (!payload || typeof payload !== 'object') {
          return ''
        }
        const candidate = payload['X-Bogus'] || payload['x-bogus'] || ''
        return typeof candidate === 'string' ? candidate : ''
      })()`,
      true
    )

    if (typeof result === 'string' && result.trim()) {
      return result.trim()
    }

    throw new Error('frontierSign returned empty signature')
  }

  async getCookies(url: string): Promise<Map<string, string>> {
    if (!this.window || this.window.isDestroyed()) {
      return new Map<string, string>()
    }

    try {
      const cookies = await this.window.webContents.session.cookies.get({ url })
      const result = new Map<string, string>()
      for (const cookie of cookies) {
        if (!cookie.name) {
          continue
        }
        result.set(cookie.name, cookie.value)
      }
      return result
    } catch {
      return new Map<string, string>()
    }
  }

  dispose(): void {
    this.loadingPromise = null
    this.currentContextUrl = null
    if (this.window && !this.window.isDestroyed()) {
      this.window.destroy()
    }
    this.window = null
  }

  private async ensureLoaded(roomNum: string): Promise<void> {
    const targetUrl = `${DOUYIN_ORIGIN}/${roomNum}`
    if (this.loadingPromise && this.currentContextUrl === targetUrl) {
      return this.loadingPromise
    }

    this.loadingPromise = this.createAndLoadWindow(roomNum)
    try {
      await this.loadingPromise
    } catch (error) {
      this.loadingPromise = null
      this.currentContextUrl = null
      this.dispose()
      throw error
    }
  }

  private async createAndLoadWindow(roomNum: string): Promise<void> {
    const targetUrl = `${DOUYIN_ORIGIN}/${roomNum}`

    if (!this.window || this.window.isDestroyed()) {
      this.window = new BrowserWindow({
        show: false,
        webPreferences: {
          sandbox: false,
          contextIsolation: false,
          nodeIntegration: false
        }
      })
    }

    if (this.window.webContents.getURL() !== targetUrl) {
      await this.window.loadURL(targetUrl, { userAgent: USER_AGENT })
      this.currentContextUrl = targetUrl
    }

    await this.window.webContents.executeJavaScript(
      `
      (async () => {
        const hasSigner = () => {
          return Boolean(window.byted_acrawler && typeof window.byted_acrawler.frontierSign === 'function')
        }

        if (hasSigner()) {
          return true
        }

        for (let i = 0; i < 80; i += 1) {
          await new Promise((resolve) => setTimeout(resolve, 100))
          if (hasSigner()) {
            return true
          }
        }

        throw new Error('frontierSign is not available in live page context')
      })()
      `,
      true
    )
  }
}

class DouyinDirectClient {
  private status: DouyinDirectStatus = createDefaultStatus()

  private ws: WebSocket | null = null

  private pingTimer: NodeJS.Timeout | null = null

  private reconnectTimer: NodeJS.Timeout | null = null

  private reconnectCount = 0

  private pingCount = 0

  private manualStop = false

  private roomNum: string | null = null

  private liveInfo: LiveInfo | null = null

  private imInfo: ImInfo | null = null

  private cursor: CursorState = {
    cursor: '',
    firstCursor: '',
    internalExt: ''
  }

  private readonly cookies = new Map<string, string>()

  private readonly signatureProvider = new SignatureProvider()

  getStatus(): DouyinDirectStatus {
    return { ...this.status }
  }

  async start(roomNum: string): Promise<DouyinDirectStatus> {
    const normalizedRoom = roomNum.trim()
    if (!normalizedRoom) {
      throw new Error('room id is required')
    }

    if (
      this.status.started &&
      this.status.roomId === normalizedRoom &&
      (this.status.connecting || this.status.connected)
    ) {
      return this.getStatus()
    }

    await this.stop()

    this.manualStop = false
    this.roomNum = normalizedRoom
    this.reconnectCount = 0
    this.cursor = {
      cursor: '',
      firstCursor: '',
      internalExt: ''
    }
    this.cookies.clear()
    this.updateStatus({
      started: true,
      connecting: true,
      connected: false,
      roomId: normalizedRoom,
      endpoint: null,
      reconnectCount: 0,
      lastMessageAt: null,
      error: null
    })

    try {
      await this.prepareAndConnect(false)
      return this.getStatus()
    } catch (error) {
      const message = error instanceof Error ? error.message : 'failed to start direct stream'
      this.updateStatus({
        started: false,
        connecting: false,
        connected: false,
        endpoint: null,
        error: message
      })
      throw error
    }
  }

  async stop(): Promise<DouyinDirectStatus> {
    this.manualStop = true

    this.clearTimers()

    if (this.ws) {
      try {
        this.ws.removeAllListeners()
        if (this.ws.readyState === WebSocket.OPEN || this.ws.readyState === WebSocket.CONNECTING) {
          this.ws.close(1000, 'manual stop')
        }
      } catch {
        // noop
      }
      this.ws = null
    }

    this.liveInfo = null
    this.imInfo = null
    this.roomNum = null
    this.cursor = {
      cursor: '',
      firstCursor: '',
      internalExt: ''
    }

    this.updateStatus({
      started: false,
      connecting: false,
      connected: false,
      roomId: null,
      endpoint: null,
      reconnectCount: 0,
      lastMessageAt: null,
      error: null
    })

    return this.getStatus()
  }

  dispose(): void {
    void this.stop()
    this.signatureProvider.dispose()
  }

  private async prepareAndConnect(isReconnect: boolean): Promise<void> {
    if (!this.roomNum) {
      throw new Error('room number is missing')
    }

    if (!this.liveInfo) {
      this.liveInfo = await this.fetchLiveInfo(this.roomNum)
      broadcastLiveComment({
        kind: 'live-info',
        data: {
          roomNum: this.liveInfo.roomNum,
          roomId: this.liveInfo.roomId,
          uniqueId: this.liveInfo.uniqueId,
          avatar: this.liveInfo.avatar,
          cover: this.liveInfo.cover,
          nickname: this.liveInfo.nickname,
          title: this.liveInfo.title,
          status: this.liveInfo.status
        }
      })
    }

    if (!this.imInfo || !isReconnect) {
      this.imInfo = await this.fetchImInfo(this.liveInfo.roomId, this.liveInfo.uniqueId)
    }

    if (!this.cursor.cursor) {
      this.cursor.cursor = this.imInfo.cursor || ''
      this.cursor.firstCursor = this.imInfo.cursor || ''
      this.cursor.internalExt = this.imInfo.internalExt || ''
    }

    const signature = await this.signatureProvider.sign(
      this.liveInfo.roomId,
      this.liveInfo.uniqueId,
      this.roomNum
    )
    await this.syncCookiesFromSignatureContext()
    const endpoint = this.buildSocketUrl(this.liveInfo, this.imInfo, signature)
    await this.connectSocket(endpoint)
  }

  private async connectSocket(endpoint: string): Promise<void> {
    if (!this.roomNum) {
      throw new Error('room number is missing')
    }

    const headers: Record<string, string> = {
      'user-agent': USER_AGENT,
      'accept-language': ACCEPT_LANGUAGE,
      'cache-control': 'no-cache',
      pragma: 'no-cache',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'websocket',
      'sec-fetch-site': 'same-site',
      referer: `${DOUYIN_ORIGIN}/${this.roomNum}`,
      origin: DOUYIN_ORIGIN
    }

    const cookieHeader = this.getCookieHeader()
    if (cookieHeader) {
      headers.cookie = cookieHeader
    }

    // Debug: Log the endpoint and headers for troubleshooting
    console.log('[DouyinDirect] Connecting to WebSocket endpoint:', endpoint)
    console.log('[DouyinDirect] Headers:', JSON.stringify(headers, null, 2))

    const ws = new WebSocket(endpoint, { 
      headers,
      // Add protocol version and other options
      handshakeTimeout: 10000,
      perMessageDeflate: false
    })

    this.ws = ws

    await new Promise<void>((resolve, reject) => {
      const onOpen = (): void => {
        cleanup()
        resolve()
      }
      const onError = (error: Error): void => {
        cleanup()
        reject(error)
      }
      const cleanup = (): void => {
        ws.off('open', onOpen)
        ws.off('error', onError)
      }
      ws.once('open', onOpen)
      ws.once('error', onError)
    })

    ws.on('message', (raw: RawData) => {
      void this.handleMessage(raw)
    })

    ws.on('close', (code: number, reason: Buffer) => {
      this.handleClose(code, reason.toString('utf8'))
    })

    ws.on('error', (error: Error) => {
      this.updateStatus({ error: error.message })
    })

    this.pingCount = 0
    this.updateStatus({
      started: true,
      connecting: false,
      connected: true,
      endpoint,
      reconnectCount: this.reconnectCount,
      error: null
    })

    this.schedulePing()
  }

  private async handleMessage(raw: RawData): Promise<void> {
    if (!this.ws) {
      return
    }

    this.pingCount = 0
    const now = nowMs()
    this.updateStatus({ lastMessageAt: now })

    const decoded = this.decodeFrame(normalizeRawData(raw))
    if (!decoded) {
      return
    }

    const { frame, response, cursor, internalExt, needAck } = decoded

    if (cursor) {
      this.cursor.cursor = cursor
      if (!this.cursor.firstCursor) {
        this.cursor.firstCursor = cursor
      }
    }
    if (internalExt) {
      this.cursor.internalExt = internalExt
    }

    if (needAck) {
      const ack = encodePushFrame({
        payloadType: 'ack',
        payload: toUtf8Bytes(internalExt),
        logId: frame.logId
      })
      if (this.ws.readyState === WebSocket.OPEN) {
        this.ws.send(ack)
      }
    }

    if (frame.payloadType === 'close') {
      this.handleClose(4000, 'server payload close')
      return
    }

    if (frame.payloadType !== 'msg' || !response.messages?.length) {
      return
    }

    const parsedMessages = response.messages
      .map((message, index) => this.parseIncomingMessage(message, index))
      .filter((item): item is JsonRecord => item !== null)

    if (parsedMessages.length > 0) {
      broadcastLiveComment({
        kind: 'messages',
        data: parsedMessages
      })
    }
  }

  private decodeFrame(data: Uint8Array): {
    frame: ReturnType<typeof decodePushFrame>
    response: ReturnType<typeof decodeResponse>
    cursor: string
    internalExt: string
    needAck: boolean
  } | null {
    try {
      const frame = decodePushFrame(data)
      let payload = frame.payload
      if (!payload) {
        return null
      }

      const headers = frame.headersList || {}
      const compressType = headers['compress_type']

      if (compressType === 'gzip') {
        payload = new Uint8Array(gunzipSync(Buffer.from(payload)))
      }

      const response = decodeResponse(payload)
      const cursor = headers['im-cursor'] || response.cursor || ''
      const internalExt = headers['im-internal_ext'] || response.internalExt || ''

      return {
        frame,
        response,
        cursor,
        internalExt,
        needAck: Boolean(response.needAck)
      }
    } catch {
      return null
    }
  }

  private parseIncomingMessage(raw: Message, index: number): JsonRecord | null {
    try {
      const payload = raw.payload
      if (!payload) {
        return null
      }

      const method = asString(raw.method) || 'CustomMessage'
      const msg: JsonRecord = {
        id: asString(raw.msgId) || `${nowMs()}-${index}`,
        method,
        ts: nowMs()
      }

      switch (method) {
        case 'WebcastChatMessage': {
          const decoded = decodeChatMessage(payload)
          msg.user = {
            id: decoded.user?.secUid,
            name: decoded.user?.nickname || '游客',
            avatar: decoded.user?.avatarThumb?.urlList?.[0],
            gender: decoded.user?.gender
          }
          msg.content = decoded.content || ''
          if (decoded.common?.createTime) {
            msg.ts = normalizeTimestamp(decoded.common.createTime)
          }
          return msg
        }

        case 'WebcastEmojiChatMessage': {
          const decoded = decodeEmojiChatMessage(payload)
          msg.user = {
            id: decoded.user?.secUid,
            name: decoded.user?.nickname || '游客',
            avatar: decoded.user?.avatarThumb?.urlList?.[0],
            gender: decoded.user?.gender
          }
          msg.content =
            decoded.emojiContent?.pieces?.[0]?.imageValue?.image?.content?.name || '发送了表情'
          if (decoded.common?.createTime) {
            msg.ts = normalizeTimestamp(decoded.common.createTime)
          }
          return msg
        }

        case 'WebcastGiftMessage': {
          const decoded = decodeGiftMessage(payload)
          msg.user = {
            id: decoded.user?.secUid,
            name: decoded.user?.nickname || '游客',
            avatar: decoded.user?.avatarThumb?.urlList?.[0],
            gender: decoded.user?.gender
          }
          const count = toGiftCount(decoded.repeatCount, decoded.comboCount)
          msg.gift = {
            id: decoded.gift?.id,
            name: decoded.gift?.name,
            price: decoded.gift?.diamondCount,
            type: decoded.gift?.type,
            icon: decoded.gift?.image?.urlList?.[0],
            count,
            repeatEnd: decoded.repeatEnd
          }
          msg.content = decoded.gift?.name ? `送出了 ${decoded.gift.name}` : '送出了礼物'
          if (decoded.common?.createTime) {
            msg.ts = normalizeTimestamp(decoded.common.createTime)
          }
          return msg
        }

        case 'WebcastLikeMessage': {
          const decoded = decodeLikeMessage(payload)
          msg.user = {
            id: decoded.user?.secUid,
            name: decoded.user?.nickname || '游客',
            avatar: decoded.user?.avatarThumb?.urlList?.[0],
            gender: decoded.user?.gender
          }
          msg.content = `为主播点赞了 (${decoded.count || 1})`
          msg.room = {
            likeCount: decoded.total
          }
          if (decoded.common?.createTime) {
            msg.ts = normalizeTimestamp(decoded.common.createTime)
          }
          return msg
        }

        case 'WebcastMemberMessage': {
          const decoded = decodeMemberMessage(payload)
          msg.user = {
            id: decoded.user?.secUid,
            name: decoded.user?.nickname || '游客',
            avatar: decoded.user?.avatarThumb?.urlList?.[0],
            gender: decoded.user?.gender
          }
          msg.content = '进入直播间'
          msg.room = {
            audienceCount: decoded.memberCount
          }
          if (decoded.common?.createTime) {
            msg.ts = normalizeTimestamp(decoded.common.createTime)
          }
          return msg
        }

        case 'WebcastSocialMessage': {
          const decoded = decodeSocialMessage(payload)
          msg.user = {
            id: decoded.user?.secUid,
            name: decoded.user?.nickname || '游客',
            avatar: decoded.user?.avatarThumb?.urlList?.[0],
            gender: decoded.user?.gender
          }
          msg.content = '关注了主播'
          msg.room = {
            followCount: decoded.followCount
          }
          if (decoded.common?.createTime) {
            msg.ts = normalizeTimestamp(decoded.common.createTime)
          }
          return msg
        }

        case 'WebcastRoomUserSeqMessage': {
          const decoded = decodeRoomUserSeqMessage(payload)
          msg.room = {
            audienceCount: decoded.total,
            totalUserCount: decoded.totalUser
          }
          msg.content = '房间统计更新'
          if (decoded.common?.createTime) {
            msg.ts = normalizeTimestamp(decoded.common.createTime)
          }
          return msg
        }

        case 'WebcastRoomStatsMessage': {
          const decoded = decodeRoomStatsMessage(payload)
          msg.room = {
            audienceCount: decoded.displayMiddle,
            totalUserCount: decoded.displayShort
          }
          msg.content = '房间统计更新'
          if (decoded.common?.createTime) {
            msg.ts = normalizeTimestamp(decoded.common.createTime)
          }
          return msg
        }

        case 'WebcastControlMessage': {
          const decoded = decodeControlMessage(payload)
          msg.content = decoded.common?.describe || '房间状态变更'
          msg.room = {
            status: Number.parseInt(decoded.action || '', 10) || undefined
          }
          if (decoded.common?.createTime) {
            msg.ts = normalizeTimestamp(decoded.common.createTime)
          }
          return msg
        }

        default:
          return null
      }
    } catch {
      return null
    }
  }

  private handleClose(code: number, reason: string): void {
    this.clearPingTimer()

    if (this.ws) {
      this.ws.removeAllListeners()
      this.ws = null
    }

    if (this.manualStop) {
      this.updateStatus({
        connecting: false,
        connected: false
      })
      return
    }

    this.updateStatus({
      connecting: false,
      connected: false,
      error: reason || `socket closed (${code})`
    })

    this.scheduleReconnect()
  }

  private scheduleReconnect(): void {
    this.clearReconnectTimer()

    if (!this.status.started) {
      return
    }

    if (this.reconnectCount >= MAX_RECONNECT_COUNT) {
      this.updateStatus({
        started: false,
        connecting: false,
        connected: false,
        error: `reconnect limit reached (${MAX_RECONNECT_COUNT})`
      })
      return
    }

    this.reconnectCount += 1
    this.updateStatus({
      connecting: true,
      connected: false,
      reconnectCount: this.reconnectCount
    })

    const delay = Math.min(6000, 1200 * this.reconnectCount)
    this.reconnectTimer = setTimeout(() => {
      void this.prepareAndConnect(true).catch((error) => {
        const message = error instanceof Error ? error.message : 'reconnect failed'
        this.updateStatus({
          connecting: false,
          connected: false,
          error: message
        })
        this.scheduleReconnect()
      })
    }, delay)
  }

  private schedulePing(): void {
    this.clearPingTimer()

    const loop = (): void => {
      if (!this.ws || this.ws.readyState !== WebSocket.OPEN) {
        return
      }

      try {
        this.ws.send(encodePushFrame({ payloadType: 'hb' }))
        this.pingCount += 1
      } catch {
        this.ws.terminate()
        return
      }

      if (this.pingCount >= PING_DOWNGRADE_COUNT) {
        this.ws.terminate()
        return
      }

      this.pingTimer = setTimeout(loop, PING_INTERVAL_MS)
    }

    this.pingTimer = setTimeout(loop, PING_INTERVAL_MS)
  }

  private clearPingTimer(): void {
    if (this.pingTimer) {
      clearTimeout(this.pingTimer)
      this.pingTimer = null
    }
  }

  private clearReconnectTimer(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
  }

  private clearTimers(): void {
    this.clearPingTimer()
    this.clearReconnectTimer()
  }

  private mergeCookieMap(source: Map<string, string>): void {
    for (const [name, value] of source.entries()) {
      this.cookies.set(name, value)
    }
  }

  private getCookieHeader(): string {
    return Array.from(this.cookies.entries())
      .map(([name, value]) => `${name}=${value}`)
      .join('; ')
  }

  private async syncCookiesFromSignatureContext(): Promise<void> {
    const browserCookies = await this.signatureProvider.getCookies(DOUYIN_ORIGIN)
    if (browserCookies.size > 0) {
      this.mergeCookieMap(browserCookies)
    }
  }

  private updateStatus(patch: Partial<DouyinDirectStatus>): void {
    this.status = {
      ...this.status,
      ...patch
    }
  }

  private buildSocketUrl(info: LiveInfo, imInfo: ImInfo, signature: string): string {
    const endpoint = resolveSocketEndpoint(imInfo.pushServer)

    const params: Record<string, unknown> = {
      aid: '6383',
      app_name: 'douyin_web',
      browser_language: 'zh-CN',
      browser_name: 'Mozilla',
      browser_online: true,
      browser_platform: 'Win32',
      browser_version: BROWSER_VERSION,
      compress: 'gzip',
      cookie_enabled: true,
      cursor: this.cursor.cursor || imInfo.cursor || '',
      device_platform: 'web',
      did_rule: 3,
      endpoint: 'live_pc',
      heartbeatDuration: '0',
      host: DOUYIN_ORIGIN,
      identity: 'audience',
      im_path: '/webcast/im/fetch/',
      insert_task_id: '',
      internal_ext: this.cursor.internalExt || imInfo.internalExt || '',
      live_id: 1,
      live_reason: '',
      need_persist_msg_count: '15',
      room_id: info.roomId,
      screen_height: 1080,
      screen_width: 1920,
      signature,
      support_wrds: 1,
      tz_name: 'Asia/Shanghai',
      update_version_code: WEBCAST_SDK_VERSION,
      user_unique_id: info.uniqueId,
      version_code: '180800',
      webcast_sdk_version: WEBCAST_SDK_VERSION
    }

    return `${endpoint}?${makeUrlParams(params)}`
  }

  private async request(url: string, init?: RequestInit): Promise<Response> {
    const requestHeaders = new Headers(init?.headers || {})

    if (!requestHeaders.has('user-agent')) {
      requestHeaders.set('user-agent', USER_AGENT)
    }
    if (!requestHeaders.has('accept-language')) {
      requestHeaders.set('accept-language', ACCEPT_LANGUAGE)
    }

    const cookieHeader = this.getCookieHeader()

    if (cookieHeader) {
      requestHeaders.set('cookie', cookieHeader)
    }

    const response = await fetch(url, {
      ...init,
      headers: requestHeaders,
      redirect: 'follow'
    })

    const headersWithGetSetCookie = response.headers as Headers & {
      getSetCookie?: () => string[]
    }

    const setCookieList =
      typeof headersWithGetSetCookie.getSetCookie === 'function'
        ? headersWithGetSetCookie.getSetCookie()
        : splitSetCookieHeader(response.headers.get('set-cookie') || '')

    if (setCookieList.length > 0) {
      const parsed = parseHeadersToMap(setCookieList)
      for (const [name, value] of parsed.entries()) {
        this.cookies.set(name, value)
      }
    }

    return response
  }

  private async fetchLiveInfo(roomNum: string): Promise<LiveInfo> {
    const fetchHtml = async (): Promise<string> => {
      const response = await this.request(`${DOUYIN_ORIGIN}/${roomNum}`, {
        method: 'GET',
        headers: {
          referer: LIVE_PAGE_REFERER,
          accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
          'cache-control': 'max-age=0',
          'upgrade-insecure-requests': '1',
          'sec-fetch-dest': 'document',
          'sec-fetch-mode': 'navigate',
          'sec-fetch-site': 'none',
          'sec-fetch-user': '?1'
        }
      })
      return response.text()
    }

    const firstHtml = await fetchHtml()
    const firstInfo = parseLiveHtml(firstHtml, roomNum)
    if (firstInfo) {
      return firstInfo
    }

    const secondHtml = await fetchHtml()
    const secondInfo = parseLiveHtml(secondHtml, roomNum)
    if (secondInfo) {
      return secondInfo
    }

    throw new Error('failed to parse room metadata from live page')
  }

  private async fetchImInfo(roomId: string, uniqueId: string): Promise<ImInfo> {
    await this.request(`${DOUYIN_ORIGIN}/webcast/user/`, {
      method: 'HEAD',
      headers: {
        referer: LIVE_PAGE_REFERER,
        accept: '*/*',
        'sec-fetch-dest': 'empty',
        'sec-fetch-mode': 'cors',
        'sec-fetch-site': 'same-origin',
        'X-Secsdk-Csrf-Request': '1',
        'X-Secsdk-Csrf-Version': '1.2.22'
      }
    })

    const defaultParams: Record<string, unknown> = {
      aid: 6383,
      app_name: 'douyin_web',
      browser_language: 'zh-CN',
      browser_name: 'Mozilla',
      browser_online: true,
      browser_platform: 'Win32',
      browser_version: BROWSER_VERSION,
      cookie_enabled: true,
      cursor: '',
      device_id: '',
      device_platform: 'web',
      did_rule: 3,
      endpoint: 'live_pc',
      fetch_rule: 1,
      identity: 'audience',
      insert_task_id: '',
      internal_ext: '',
      last_rtt: 0,
      live_id: 1,
      live_reason: '',
      need_persist_msg_count: 15,
      resp_content_type: 'protobuf',
      screen_height: 1080,
      screen_width: 1920,
      support_wrds: 1,
      tz_name: 'Asia/Shanghai',
      version_code: 180800
    }

    const signingQuery = makeUrlParams({
      ...defaultParams,
      room_id: roomId,
      user_unique_id: uniqueId,
      live_pc: roomId
    })

    const params = {
      ...defaultParams,
      msToken: getMsToken(184),
      room_id: roomId,
      user_unique_id: uniqueId,
      live_pc: roomId,
      a_bogus: getAbogus(signingQuery, USER_AGENT)
    }

    const response = await this.request(
      `${DOUYIN_ORIGIN}/webcast/im/fetch/?${makeUrlParams(params)}`,
      {
        method: 'GET',
        headers: {
          referer: LIVE_PAGE_REFERER,
          accept: '*/*',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-origin'
        }
      }
    )

    if (!response.ok) {
      throw new Error(`im/fetch request failed with status ${response.status}`)
    }

    const payload = new Uint8Array(await response.arrayBuffer())

    try {
      const decoded = decodeResponse(payload)
      return {
        cursor: decoded.cursor,
        internalExt: decoded.internalExt,
        now: decoded.now,
        pushServer: decoded.pushServer,
        fetchInterval: decoded.fetchInterval,
        fetchType: decoded.fetchType,
        liveCursor: decoded.liveCursor
      }
    } catch {
      const textPayload = Buffer.from(payload).toString('utf8').trim()
      if (textPayload.startsWith('{') || textPayload.startsWith('[')) {
        try {
          const parsed = JSON.parse(textPayload) as JsonRecord
          const dataCandidate =
            typeof parsed.data === 'object' && parsed.data !== null
              ? (parsed.data as JsonRecord)
              : parsed

          const cursor =
            asString(dataCandidate.cursor) ||
            asString(dataCandidate.im_cursor) ||
            asString(parsed.cursor) ||
            ''
          const internalExt =
            asString(dataCandidate.internalExt) ||
            asString(dataCandidate.internal_ext) ||
            asString(parsed.internalExt) ||
            asString(parsed.internal_ext) ||
            ''
          const pushServer =
            asString(dataCandidate.pushServer) ||
            asString(dataCandidate.push_server) ||
            asString(parsed.pushServer) ||
            asString(parsed.push_server) ||
            undefined

          if (cursor || internalExt || pushServer) {
            return {
              cursor,
              internalExt,
              pushServer
            }
          }
        } catch {
          // ignore JSON parse error and fall through to explicit failure
        }
      }

      throw new Error('failed to decode im/fetch response payload')
    }
  }
}

const douyinDirectClient = new DouyinDirectClient()

export async function startDouyinDirectClient(roomId: string): Promise<DouyinDirectStatus> {
  return douyinDirectClient.start(roomId)
}

export async function stopDouyinDirectClient(): Promise<DouyinDirectStatus> {
  return douyinDirectClient.stop()
}

export function getDouyinDirectStatus(): DouyinDirectStatus {
  return douyinDirectClient.getStatus()
}

export function disposeDouyinDirectClient(): void {
  douyinDirectClient.dispose()
}
