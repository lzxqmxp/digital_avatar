const room = process.argv[2] || '399090817555'

const USER_AGENT =
  'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/134.0.0.0 Safari/537.36'

async function main() {
  const url = `https://live.douyin.com/${room}`
  const res = await fetch(url, {
    headers: {
      'user-agent': USER_AGENT,
      'accept-language': 'zh-CN,zh;q=0.9'
    }
  })
  const html = await res.text()
  console.log(`status=${res.status}`)
  console.log(`length=${html.length}`)

  const patterns = [
    /\"pushServer\"\s*:\s*\"([^\"]+)\"/gi,
    /\"push_server\"\s*:\s*\"([^\"]+)\"/gi,
    /wss?:\/\/[^"'\s]+webcast\/im\/push\/v\d+\/?/gi,
    /webcast\d+-ws-[a-z0-9-]+\.douyin\.com/gi,
    /wss_push_[a-z_]*[:=]([a-z0-9.-]+)/gi,
    /\"roomId\":\"([0-9]{6,22})\"/g,
    /\"user_unique_id\":\"([0-9]{6,22})\"/g
  ]

  for (const pattern of patterns) {
    const matches = [...html.matchAll(pattern)].slice(0, 10).map((m) => m[1] || m[0])
    const unique = [...new Set(matches)]
    if (unique.length > 0) {
      console.log(`\npattern=${pattern}`)
      for (const value of unique) {
        console.log(`  ${value}`)
      }
    }
  }

  const keywords = [
    'webcast/im/push',
    'pushServer',
    'push_server',
    'wss_push',
    'im/fetch',
    'roomId',
    'user_unique_id'
  ]

  for (const keyword of keywords) {
    const index = html.indexOf(keyword)
    if (index >= 0) {
      const start = Math.max(0, index - 120)
      const end = Math.min(html.length, index + 220)
      console.log(`\nkeyword=${keyword} index=${index}`)
      console.log(html.slice(start, end).replace(/\s+/g, ' '))
    }
  }
}

main().catch((error) => {
  console.error(error)
  process.exit(1)
})
