#!/usr/bin/env node
// ══════════════════════════════════════════════════════════
//  Fix artist image_url + genre in D1
//  1. Apply imageUrl from songCatalog.json (291 images)
//  2. Fetch missing via Deezer API (picture + album genre)
//  3. Batch UPDATE to D1
// ══════════════════════════════════════════════════════════
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import axios from 'axios'
import db from './db.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const CATALOG_FILE = path.join(__dirname, '../src/data/songCatalog.json')
const sleep = (ms) => new Promise(r => setTimeout(r, ms))

const GENRE_MAP = {
  'pop': 'J-POP', 'j-pop': 'J-POP', 'rock': '邦ロック', 'j-rock': '邦ロック',
  'alternative': 'オルタナティブ', 'anime': 'アニソン', 'rap/hip hop': 'ヒップホップ',
  'hip hop': 'ヒップホップ', 'r&b': 'R&B', 'electro': 'エレクトロ', 'metal': 'メタル',
  'jazz': 'ジャズ', 'classical': 'クラシック', 'reggae': 'レゲエ', 'folk': 'フォーク',
  'asian music': 'J-POP', 'korean pop': 'K-POP', 'k-pop': 'K-POP',
  'films/games': 'サウンドトラック', 'dance': 'ダンス', 'soul & funk': 'ソウル',
  'blues': 'ブルース', 'country': 'カントリー', 'enka': '演歌',
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
  try {
    const r = await axios.get(url)
    return r.data
  } catch (_) { return null }
}

async function main() {
  console.log('=== Fix Artist Meta (image_url + genre) ===\n')

  // Step 1: Load catalog images
  const catalog = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'))
  const catalogImages = new Map()
  for (const a of catalog.artists) {
    if (a.imageUrl) catalogImages.set(a.name, a.imageUrl)
  }
  console.log(`Catalog: ${catalogImages.size} images available\n`)

  // Step 2: Build UPDATE statements for catalog images
  const imgUpdates = []
  for (const [name, imageUrl] of catalogImages) {
    const eName = db.escape(name)
    const eImg = db.escape(imageUrl)
    imgUpdates.push(`UPDATE artists SET image_url = '${eImg}' WHERE name = '${eName}' AND (image_url IS NULL OR image_url = '')`)
  }
  if (imgUpdates.length > 0) {
    console.log(`[D1] Catalog画像を ${imgUpdates.length}件 UPDATE...`)
    db.batchExecute(imgUpdates, 'catalog-img')
  }

  // Step 3: Deezer API for ALL artists — fetch image + genre
  // Get all artist names from D1 (via catalog + extra from D1)
  // We'll process the full catalog.artists + any extra D1 names not in catalog
  const allNames = new Set(catalog.artists.map(a => a.name))
  // We don't query D1 for names since we can't easily — just process what we have
  // The catalog has 579, D1 has 628 — the extra 49 were added by芋づる but are in catalog too now

  console.log(`\n[Deezer] ${allNames.size}アーティストの画像+ジャンルを取得...\n`)

  const updates = []
  let fetched = 0, imagesFound = 0, genresFound = 0

  for (const name of allNames) {
    fetched++
    // Search artist
    const searchData = await deezerGet(`https://api.deezer.com/search/artist?q=${encodeURIComponent(name)}&limit=1`)
    const hit = searchData?.data?.[0]
    if (!hit) {
      if (fetched % 50 === 0) console.log(`  進捗: ${fetched}/${allNames.size}`)
      await sleep(200)
      continue
    }

    const imageUrl = hit.picture_xl || hit.picture_big || hit.picture_medium || hit.picture || ''

    // Get genre from first album
    let genre = ''
    const albumsData = await deezerGet(`https://api.deezer.com/artist/${hit.id}/albums?limit=1`)
    await sleep(200)
    const firstAlbum = albumsData?.data?.[0]
    if (firstAlbum) {
      const albumDetail = await deezerGet(`https://api.deezer.com/album/${firstAlbum.id}`)
      await sleep(200)
      const gArr = albumDetail?.genres?.data || []
      if (gArr.length > 0) {
        genre = mapGenre(gArr[0].name)
        genresFound++
      }
    }

    if (imageUrl) imagesFound++

    const eName = db.escape(name)
    const eImg = db.escape(imageUrl)
    const eGenre = db.escape(genre || 'J-POP')
    // Always overwrite with Deezer data (fresher/higher res than Spotify)
    updates.push(`UPDATE artists SET image_url = '${eImg}', genre = '${eGenre}' WHERE name = '${eName}'`)

    if (fetched % 50 === 0) {
      console.log(`  進捗: ${fetched}/${allNames.size} (画像${imagesFound}, ジャンル${genresFound})`)
      // Batch flush
      if (updates.length >= 50) {
        db.batchExecute(updates.splice(0), 'deezer-meta')
      }
    }

    await sleep(200)
  }

  // Flush remaining
  if (updates.length > 0) {
    db.batchExecute(updates, 'deezer-meta-final')
  }

  console.log(`\n=== 完了 ===`)
  console.log(`処理: ${fetched}アーティスト`)
  console.log(`画像取得: ${imagesFound}`)
  console.log(`ジャンル取得: ${genresFound}`)
}

main().catch(e => console.error('FATAL:', e.message))
