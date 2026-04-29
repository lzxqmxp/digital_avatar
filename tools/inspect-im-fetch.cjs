const { decodeResponse } = require('./.tmp-dy-decode/model.js')
const { getAbogus } = require('./.tmp-dy-decode/abogus.js')

const DOUYIN_ORIGIN = 'https://live.douyin.com'
const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36'
const ACCEPT_LANGUAGE = 'zh-CN,zh;q=0.9'

const cookies = new Map()

function parseHeadersToMap(setCookie) {
  const cookieMap = new Map()
  for (const line of setCookie) {
    const part = line.split(';', 1)[0]
    if (!part) continue
    const eqIndex = part.indexOf('=')
    if (eqIndex <= 0) continue
    const name = part.slice(0, eqIndex).trim()
    const value = part.slice(eqIndex + 1).trim()
    if (!name) continue
    cookieMap.set(name, value)
  }
  return cookieMap
}

function splitSetCookieHeader(raw) {
  const result = []
  let cursor = 0
  for (let i = 0; i < raw.length; i += 1) {
    if (raw[i] !== ',') continue
    const rest = raw.slice(i + 1)
    if (!/^\s*[A-Za-z0-9_\-]+=/.test(rest)) continue
    const piece = raw.slice(cursor, i).trim()
    if (piece) result.push(piece)
    cursor = i + 1
  }
  const last = raw.slice(cursor).trim()
  if (last) result.push(last)
  return result
}

function getCookieHeader() {
  return Array.from(cookies.entries())
    .map(([name, value]) => `${name}=${value}`)
    .join('; ')
}

async function request(url, init) {
  const requestHeaders = new Headers((init && init.headers) || {})
  if (!requestHeaders.has('user-agent')) {
    requestHeaders.set('user-agent', USER_AGENT)
  }
  if (!requestHeaders.has('accept-language')) {
    requestHeaders.set('accept-language', ACCEPT_LANGUAGE)
  }
  const cookieHeader = getCookieHeader()
  if (cookieHeader) {
    requestHeaders.set('cookie', cookieHeader)
  }

  const response = await fetch(url, {
    ...(init || {}),
    headers: requestHeaders,
    redirect: 'follow'
  })

  const headersWithGetSetCookie = response.headers
  const setCookieList =
    typeof headersWithGetSetCookie.getSetCookie === 'function'
      ? headersWithGetSetCookie.getSetCookie()
      : splitSetCookieHeader(response.headers.get('set-cookie') || '')

  if (setCookieList.length > 0) {
    const parsed = parseHeadersToMap(setCookieList)
    for (const [name, value] of parsed.entries()) {
      cookies.set(name, value)
    }
  }

  return response
}

function makeUrlParams(params) {
  const searchParams = new URLSearchParams()
  for (const [key, value] of Object.entries(params)) {
    searchParams.append(key, value === undefined || value === null ? '' : String(value))
  }
  return searchParams.toString()
}

function getMsToken(length = 184) {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_='
  let out = ''
  for (let i = 0; i < length; i += 1) {
    out += chars.charAt(Math.floor(Math.random() * chars.length))
  }
  return out
}

function pickFirstMatch(texts, patterns) {
  for (const text of texts) {
    for (const pattern of patterns) {
      const matched = text.match(pattern)
      const value = matched && matched[1] && matched[1].trim()
      if (value) {
        return value
      }
    }
  }
  return ''
}

function buildFallbackUniqueId() {
  const prefix = `${Date.now()}${Math.floor(Math.random() * 1_000_000)
    .toString()
    .padStart(6, '0')}`
  const normalized = prefix.replace(/\D/g, '')
  return normalized.slice(0, 19).padEnd(19, '0')
}

function parseLiveHtml(html, roomNum) {
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

  const roomId =
    pickFirstMatch([normalized, compact], roomIdPatterns) ||
    (/^[0-9]{6,22}$/.test(roomNum) ? roomNum : '')
  const uniqueId =
    pickFirstMatch([normalized, compact], uniqueIdPatterns) || buildFallbackUniqueId()

  if (!roomId) {
    return null
  }

  return {
    roomId,
    uniqueId
  }
}

async function fetchLiveInfo(roomNum) {
  const fetchHtml = async () => {
    const response = await request(`${DOUYIN_ORIGIN}/${roomNum}`, {
      method: 'GET',
      headers: {
        referer: `${DOUYIN_ORIGIN}/`,
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

  const first = parseLiveHtml(await fetchHtml(), roomNum)
  if (first) return first

  const second = parseLiveHtml(await fetchHtml(), roomNum)
  if (second) return second

  throw new Error('failed to parse room metadata from live page')
}

async function fetchImInfo(roomId, uniqueId) {
  await request(`${DOUYIN_ORIGIN}/webcast/user/`, {
    method: 'HEAD',
    headers: {
      referer: `${DOUYIN_ORIGIN}/`,
      accept: '*/*',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'X-Secsdk-Csrf-Request': '1',
      'X-Secsdk-Csrf-Version': '1.2.22'
    }
  })

  const defaultParams = {
    aid: 6383,
    app_name: 'douyin_web',
    browser_language: 'zh-CN',
    browser_name: 'Mozilla',
    browser_online: true,
    browser_platform: 'Win32',
    browser_version:
      '5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36',
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

  const url = `${DOUYIN_ORIGIN}/webcast/im/fetch/?${makeUrlParams(params)}`
  const response = await request(url, {
    method: 'GET',
    headers: {
      referer: `${DOUYIN_ORIGIN}/`,
      accept: '*/*',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin'
    }
  })

  console.log(`imFetch.status=${response.status}`)
  console.log(`imFetch.contentType=${response.headers.get('content-type') || ''}`)
  console.log(`cookieNames=${Array.from(cookies.keys()).slice(0, 20).join(',')}`)

  const payload = new Uint8Array(await response.arrayBuffer())
  console.log(`imFetch.payloadSize=${payload.length}`)

  try {
    const decoded = decodeResponse(payload)
    const routeParams = decoded.routeParams || {}
    const routeEntries = Object.entries(routeParams)

    console.log('decoded.cursor=', decoded.cursor || '')
    console.log('decoded.internalExt.length=', (decoded.internalExt || '').length)
    console.log('decoded.internalExt.preview=', (decoded.internalExt || '').slice(0, 320))
    console.log('decoded.pushServer=', decoded.pushServer || '')
    console.log('decoded.proxyServer=', decoded.proxyServer || '')
    console.log('decoded.fetchInterval=', decoded.fetchInterval || '')
    console.log('decoded.liveCursor=', decoded.liveCursor || '')
    console.log(`decoded.routeParams.count=${routeEntries.length}`)
    for (const [k, v] of routeEntries.slice(0, 20)) {
      console.log(`routeParams.${k}=${v}`)
    }

    return
  } catch (error) {
    console.log('decodeResponse failed:', error && error.message ? error.message : String(error))
    const textPayload = Buffer.from(payload).toString('utf8').trim()
    console.log('payloadPreview=', textPayload.slice(0, 600))
  }
}

async function main() {
  const roomNum = process.argv[2] || '399090817555'
  const useBlankUnique = process.argv[3] === 'blank'
  const live = await fetchLiveInfo(roomNum)
  if (useBlankUnique) {
    live.uniqueId = ''
  }
  console.log(`roomNum=${roomNum}`)
  console.log(`roomId=${live.roomId}`)
  console.log(`uniqueId=${live.uniqueId}`)
  console.log(`cookieCount=${cookies.size}`)
  await fetchImInfo(live.roomId, live.uniqueId)
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
