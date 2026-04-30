import { BrowserWindow } from 'electron'
import { WebSocketServer, type RawData } from 'ws'
import { IpcChannels } from '../../src/shared/types/ipc-channels'

type JsonRecord = Record<string, unknown>

type DycastRelayEnvelope =
  | { kind: 'messages'; data: unknown[] }
  | { kind: 'live-info'; data: JsonRecord }
  | { kind: 'raw'; data: unknown }

export interface DycastRelayStatus {
  host: string
  port: number
  started: boolean
  clientCount: number
  lastMessageAt: number | null
}

const DEFAULT_DYCAST_RELAY_HOST = '127.0.0.1'
const DEFAULT_DYCAST_RELAY_PORT = 18765

let relayServer: WebSocketServer | null = null
let relayHost = DEFAULT_DYCAST_RELAY_HOST
let relayPort = DEFAULT_DYCAST_RELAY_PORT
let lastMessageAt: number | null = null

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === 'object' && value !== null
}

function parsePort(value: string | undefined): number {
  if (!value) return DEFAULT_DYCAST_RELAY_PORT
  const parsed = Number.parseInt(value, 10)
  if (!Number.isFinite(parsed) || parsed < 1 || parsed > 65535) {
    return DEFAULT_DYCAST_RELAY_PORT
  }
  return parsed
}

function toUtf8(data: RawData): string {
  if (typeof data === 'string') {
    return data
  }

  if (data instanceof ArrayBuffer) {
    return Buffer.from(data).toString('utf8')
  }

  if (Array.isArray(data)) {
    return Buffer.concat(data).toString('utf8')
  }

  return data.toString('utf8')
}

function normalizePayload(data: unknown): DycastRelayEnvelope {
  if (Array.isArray(data)) {
    return { kind: 'messages', data }
  }

  if (isRecord(data)) {
    const kind = data.kind
    if (kind === 'messages' && Array.isArray(data.data)) {
      return { kind: 'messages', data: data.data }
    }
    if (kind === 'live-info' && isRecord(data.data)) {
      return { kind: 'live-info', data: data.data }
    }

    if (Array.isArray(data.messages)) {
      return { kind: 'messages', data: data.messages }
    }
    if (isRecord(data.liveInfo)) {
      return { kind: 'live-info', data: data.liveInfo }
    }

    const method = data.method
    if (typeof method === 'string' && method.length > 0) {
      return { kind: 'messages', data: [data] }
    }

    if (
      typeof data.roomId === 'string' ||
      typeof data.roomNum === 'string' ||
      typeof data.uniqueId === 'string' ||
      typeof data.title === 'string'
    ) {
      return { kind: 'live-info', data }
    }
  }

  return { kind: 'raw', data }
}

function parseRelayMessage(raw: string): DycastRelayEnvelope[] {
  const text = raw.trim()
  if (!text) {
    return []
  }

  const chunks = text
    .split(/\r?\n/)
    .map((item) => item.trim())
    .filter(Boolean)

  if (chunks.length === 0) {
    return []
  }

  const envelopes: DycastRelayEnvelope[] = []
  for (const chunk of chunks) {
    try {
      const parsed = JSON.parse(chunk) as unknown
      envelopes.push(normalizePayload(parsed))
    } catch {
      envelopes.push({ kind: 'raw', data: chunk })
    }
  }

  return envelopes
}

function broadcastLiveComment(payload: DycastRelayEnvelope): void {
  for (const window of BrowserWindow.getAllWindows()) {
    if (!window.isDestroyed()) {
      window.webContents.send(IpcChannels.LIVE_COMMENT, payload)
    }
  }
}

function broadcastRelayClient(payload: DycastRelayEnvelope): void {
  if (!relayServer) {
    return
  }

  const serialized = JSON.stringify(payload)
  for (const client of relayServer.clients) {
    if (client.readyState === 1) {
      client.send(serialized)
    }
  }
}

export function startDycastRelayServer(): DycastRelayStatus {
  if (relayServer) {
    return getDycastRelayStatus()
  }

  relayHost = process.env.DYCAST_RELAY_HOST?.trim() || DEFAULT_DYCAST_RELAY_HOST
  relayPort = parsePort(process.env.DYCAST_RELAY_PORT)

  try {
    relayServer = new WebSocketServer({ host: relayHost, port: relayPort })
  } catch (error) {
    console.error('[dycast-relay] Failed to start relay server:', error)
    relayServer = null
    return getDycastRelayStatus()
  }

  relayServer.on('connection', (socket, request) => {
    const path = request.url || '/'
    console.info(
      `[dycast-relay] Client connected (${path}), clients=${relayServer?.clients.size || 0}`
    )

    socket.on('message', (chunk) => {
      const text = toUtf8(chunk)
      const payloads = parseRelayMessage(text)
      if (payloads.length === 0) {
        return
      }

      lastMessageAt = Date.now()
      for (const payload of payloads) {
        broadcastLiveComment(payload)
        broadcastRelayClient(payload)
      }
    })

    socket.on('error', (error) => {
      console.error('[dycast-relay] Client error:', error)
    })

    socket.on('close', () => {
      console.info(`[dycast-relay] Client disconnected, clients=${relayServer?.clients.size || 0}`)
    })
  })

  relayServer.on('error', (error) => {
    console.error('[dycast-relay] Server error:', error)
  })

  console.info(`[dycast-relay] Listening on ws://${relayHost}:${relayPort}`)
  return getDycastRelayStatus()
}

export function getDycastRelayStatus(): DycastRelayStatus {
  return {
    host: relayHost,
    port: relayPort,
    started: relayServer !== null,
    clientCount: relayServer?.clients.size || 0,
    lastMessageAt
  }
}

export function stopDycastRelayServer(): void {
  if (!relayServer) {
    return
  }

  for (const client of relayServer.clients) {
    client.close(1001, 'relay server shutdown')
  }

  relayServer.close()
  relayServer = null
  lastMessageAt = null
}
