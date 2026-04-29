const { randomUUID } = require('node:crypto')
const { DatabaseSync } = require('node:sqlite')

const dbPath =
  process.argv[2] || `${process.env.APPDATA}\\digital-avatar\\data\\digital-avatar.sqlite`

const SCRIPT_SEEDS = [
  {
    title: '欢迎话术',
    content: '欢迎大家来到直播间！喜欢主播记得点个关注。',
    tags: ['欢迎', '开场'],
    status: 'enabled'
  },
  {
    title: '产品介绍',
    content: '今天主推这款爆款单品，材质升级，性价比很高。',
    tags: ['产品', '主推'],
    status: 'draft'
  },
  {
    title: '点赞引导',
    content: '宝子们点点赞冲一冲，点赞破千马上加送福利。',
    tags: ['互动', '点赞'],
    status: 'enabled'
  },
  {
    title: '关注引导',
    content: '新来的朋友先点关注，不迷路，开播第一时间提醒你。',
    tags: ['互动', '关注'],
    status: 'enabled'
  },
  {
    title: '领券提醒',
    content: '下单前先领券更划算，页面左下角就能直接领取。',
    tags: ['优惠', '下单'],
    status: 'enabled'
  },
  {
    title: '限时倒计时',
    content: '限时活动倒计时开始，库存不多，喜欢可以先锁单。',
    tags: ['活动', '促单'],
    status: 'enabled'
  },
  {
    title: '下单催单',
    content: '链接已上车，想要的朋友抓紧拍，付款后优先发货。',
    tags: ['促单'],
    status: 'enabled'
  },
  {
    title: '售后承诺',
    content: '支持7天无理由，质量问题包退换，售后不用担心。',
    tags: ['售后', '保障'],
    status: 'enabled'
  },
  {
    title: '物流说明',
    content: '现货订单48小时内发出，偏远地区时效会略慢一点。',
    tags: ['物流', '说明'],
    status: 'draft'
  },
  {
    title: '尺码建议',
    content: '不确定尺码可参考详情页尺码表，客服也可一对一建议。',
    tags: ['尺码', '答疑'],
    status: 'draft'
  },
  {
    title: '使用场景推荐',
    content: '这款日常通勤和周末出游都能用，搭配起来很省心。',
    tags: ['场景', '推荐'],
    status: 'enabled'
  },
  {
    title: '抽奖预告',
    content: '稍后整点抽奖，先把想要的商品打在公屏，马上安排。',
    tags: ['活动', '抽奖'],
    status: 'draft'
  },
  {
    title: '新品预热',
    content: '今晚有新品首发，想看上新细节的朋友先留在直播间。',
    tags: ['新品', '预热'],
    status: 'draft'
  },
  {
    title: '老粉回馈',
    content: '老粉福利场已结束，后续返场时间请留意开播公告。',
    tags: ['老粉', '福利'],
    status: 'disabled'
  },
  {
    title: '结束收尾',
    content: '今天直播到这里，感谢陪伴，明天同一时间不见不散。',
    tags: ['收尾'],
    status: 'enabled'
  }
]

const db = new DatabaseSync(dbPath)

db.exec(`
CREATE TABLE IF NOT EXISTS scripts (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT NOT NULL,
  tags_json TEXT NOT NULL DEFAULT '[]',
  status TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
`)

const existingTitles = new Set(
  db
    .prepare('SELECT title FROM scripts')
    .all()
    .map((row) => row.title)
)

const insertStatement = db.prepare(
  'INSERT INTO scripts (id, title, content, tags_json, status, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
)

let inserted = 0
for (const seed of SCRIPT_SEEDS) {
  if (existingTitles.has(seed.title)) {
    continue
  }
  const ts = Date.now() + inserted
  insertStatement.run(
    randomUUID(),
    seed.title,
    seed.content,
    JSON.stringify(seed.tags),
    seed.status,
    ts,
    ts
  )
  inserted += 1
}

const countRow = db.prepare('SELECT COUNT(*) AS c FROM scripts').get()
const latestRows = db
  .prepare('SELECT title, status FROM scripts ORDER BY created_at DESC LIMIT 5')
  .all()

console.log(`DB_PATH=${dbPath}`)
console.log(`INSERTED=${inserted}`)
console.log(`SCRIPT_COUNT=${countRow.c}`)
console.log(`LATEST=${JSON.stringify(latestRows)}`)

db.close()
