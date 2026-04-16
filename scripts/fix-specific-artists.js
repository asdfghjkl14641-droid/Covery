// ══════════════════════════════════════════════════════════
//  3アーティストのアイコン画像・ジャンルをDeezerから取得してD1に反映
//  対象: Ado, 10-FEET, ONE OK ROCK
// ══════════════════════════════════════════════════════════

import { execSync } from 'child_process'
import path from 'path'
import { fileURLToPath } from 'url'
import db from './db.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const WORKER_DIR = path.join(__dirname, '..', 'worker')

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const GENRE_MAP = {
  'j-pop': 'J-POP', 'pop': 'J-POP', 'j-rock': '邦ロック', 'rock': '邦ロック',
  'ロック': '邦ロック', 'ポップ': 'J-POP', 'ヒップホップ': 'ヒップホップ',
  'alternative': 'オルタナティブ', 'anime': 'アニソン', 'アニメ': 'アニソン',
  'rap/hip hop': 'ヒップホップ', 'hip hop': 'ヒップホップ',
  'r&b': 'R&B', 'electro': 'エレクトロ', 'metal': 'メタル', 'メタル': 'メタル',
  'asian music': 'J-POP', 'アジア': 'J-POP', 'dance': 'ダンス',
  '映画': 'サウンドトラック', 'films/games': 'サウンドトラック', 'soundtrack': 'サウンドトラック',
}

function mapGenre(name) {
  if (!name) return 'J-POP'
  const lower = String(name).toLowerCase()
  for (const [key, value] of Object.entries(GENRE_MAP)) {
    if (lower.includes(key)) return value
  }
  return 'J-POP'
}

async function deezerGet(url) {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`Deezer API error: ${res.status}`)
  return res.json()
}

const TARGET_ARTISTS = ['Ado', '10-FEET', 'ONE OK ROCK']

async function main() {
  console.log('=== 3アーティスト画像・ジャンル修正 ===\n')

  // Step 1: D1からID取得
  const placeholders = TARGET_ARTISTS.map(n => `'${db.escape(n)}'`).join(',')
  const out = execSync(
    `npx wrangler d1 execute covery-db --remote --json --command="SELECT id, name, image_url, genre FROM artists WHERE name IN (${placeholders})"`,
    { cwd: WORKER_DIR, encoding: 'utf-8', timeout: 30000 }
  )
  const parsed = JSON.parse(out)
  const artists = parsed[0]?.results || []
  console.log(`D1から${artists.length}件取得:`)
  artists.forEach(a => console.log(`  id=${a.id} name="${a.name}" genre="${a.genre}" image=${a.image_url ? 'あり' : 'なし'}`))

  if (artists.length === 0) {
    console.error('対象アーティストが見つかりません')
    process.exit(1)
  }

  const updates = []

  for (const artist of artists) {
    console.log(`\n--- ${artist.name} ---`)

    // Step 2a: Deezer search
    const searchData = await deezerGet(`https://api.deezer.com/search/artist?q=${encodeURIComponent(artist.name)}&limit=5`)
    await sleep(200)

    const hit = searchData.data?.find(a => a.name.toLowerCase() === artist.name.toLowerCase()) || searchData.data?.[0]
    if (!hit) {
      console.log(`  Deezerでヒットなし → スキップ`)
      continue
    }
    console.log(`  Deezer検索: "${hit.name}" (ID: ${hit.id})`)

    // Step 2b: アーティスト詳細 → 画像取得
    const detail = await deezerGet(`https://api.deezer.com/artist/${hit.id}`)
    await sleep(200)

    const imageUrl = detail.picture_xl || detail.picture_big || detail.picture_medium || ''
    console.log(`  画像: ${imageUrl ? imageUrl.substring(0, 60) + '...' : 'なし'}`)

    // Step 2c: ジャンル取得 (最新アルバムから)
    const albumsData = await deezerGet(`https://api.deezer.com/artist/${hit.id}/albums?limit=10`)
    await sleep(200)

    let genre = 'J-POP'
    const albums = albumsData.data || []
    // Check up to 3 albums (newest first) and pick most common non-soundtrack genre
    const sorted = [...albums]
      .filter(a => a.release_date && (a.record_type === 'album' || a.record_type === 'ep'))
      .sort((a, b) => b.release_date.localeCompare(a.release_date))

    const genreCounts = {}
    const checked = Math.min(sorted.length, 3)
    for (let ai = 0; ai < checked; ai++) {
      const albumDetail = await deezerGet(`https://api.deezer.com/album/${sorted[ai].id}`)
      await sleep(200)
      const genres = albumDetail?.genres?.data || []
      for (const g of genres) {
        const mapped = mapGenre(g.name)
        if (mapped !== 'サウンドトラック') { // Prefer non-soundtrack genres
          genreCounts[mapped] = (genreCounts[mapped] || 0) + 1
        }
      }
      console.log(`  アルバム "${sorted[ai].title}" ジャンル: ${genres.map(g => g.name).join(', ')}`)
    }

    // Pick most common genre, fallback to J-POP
    const sortedGenres = Object.entries(genreCounts).sort((a, b) => b[1] - a[1])
    if (sortedGenres.length > 0) {
      genre = sortedGenres[0][0]
    }
    console.log(`  → 決定ジャンル: ${genre}`)

    updates.push({ id: artist.id, name: artist.name, imageUrl, genre })
  }

  // Step 3: D1 UPDATE
  if (updates.length === 0) {
    console.log('\n更新対象なし')
    return
  }

  console.log(`\n=== D1更新 (${updates.length}件) ===`)
  const esc = db.escape
  const sqls = updates.map(u =>
    `UPDATE artists SET image_url = '${esc(u.imageUrl)}', genre = '${esc(u.genre)}' WHERE id = ${u.id}`
  )
  const ok = db.batchExecute(sqls, 'fix-3artists')
  console.log(`${ok} statements executed`)

  // 確認
  console.log('\n=== 結果 ===')
  updates.forEach(u => {
    console.log(`  ${u.name}: image=${u.imageUrl ? 'あり' : 'なし'} genre=${u.genre}`)
  })
}

main().catch(e => {
  console.error('Fatal:', e)
  process.exit(1)
})
