// Initialize processed-artists.json with 50 already-processed artists
// Usage: node scripts/init-processed-log.js

import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const LOG_PATH = path.join(__dirname, 'logs', 'processed-artists.json')

const ALREADY_PROCESSED = [
  '米津玄師', '星野源', '藤井風', '優里', 'Vaundy', '菅田将暉', '福山雅治',
  '桑田佳祐', '尾崎豊', '玉置浩二', '槇原敬之', '平井堅', '秦基博',
  '森山直太朗', '三浦大知', '清水翔太', '山崎まさよし', 'スガシカオ',
  '久保田利伸', '小田和正', '布施明', '井上陽水', '長渕剛', '矢沢永吉',
  '浜田省吾', '吉田拓郎', '松山千春', '中島みゆき', '竹原ピストル',
  'ASKA', '德永英明', '氷室京介', '吉川晃司', '西川貴教',
  'GACKT', 'HYDE', 'Taka', '川崎鷹也', '瑛人',
  'imase', 'tuki.', 'キタニタツヤ', 'ano', '藤原聡',
  '大石昌良', 'TK from 凛として時雨', '澤野弘之',
  '宇多田ヒカル', 'あいみょん', 'Ado',
]

let existing = []
try {
  if (fs.existsSync(LOG_PATH)) existing = JSON.parse(fs.readFileSync(LOG_PATH, 'utf8')).processed || []
} catch (_) {}

const existingNames = new Set(existing.map(e => e.name.toLowerCase()))
const now = new Date().toISOString()
let added = 0

for (const name of ALREADY_PROCESSED) {
  if (existingNames.has(name.toLowerCase())) continue
  existing.push({ name, deezerId: 0, processedAt: now, songCount: 0 })
  added++
}

const dir = path.dirname(LOG_PATH)
if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
fs.writeFileSync(LOG_PATH, JSON.stringify({ processed: existing }, null, 2))
console.log(`processed-artists.json: ${added}件追加 (合計${existing.length}件)`)
