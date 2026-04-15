import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { findBestMatch } from './matchSong.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const METADATA_FILE = path.join(__dirname, '../src/data/metadata.json')
const CATALOG_FILE = path.join(__dirname, '../src/data/songCatalog.json')
const PREVIEW_FILE = path.join(__dirname, '../src/data/previewChannels.json')
const LAST_CHECK_FILE = path.join(__dirname, '../src/data/lastRssCheck.json')

const EXCLUDE_KEYWORDS = [
  'カラオケ', 'karaoke', 'joysound', 'dam', '練習', '弾き語り',
  'shorts', '#shorts', '切り抜き', 'ライブ', 'live',
  '配信', '生放送', 'リアクション', 'reaction', 'まとめ',
  '歌枠', 'ゲーム', '雑談', '踊ってみた', 'instrumental'
]

const sleep = (ms) => new Promise(r => setTimeout(r, ms))

// Simple XML tag extractor (no dependencies needed)
function extractTag(xml, tag) {
  const re = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)</${tag}>`, 'g')
  const matches = []
  let m
  while ((m = re.exec(xml)) !== null) matches.push(m[1].trim())
  return matches
}

function extractAttr(xml, tag, attr) {
  const re = new RegExp(`<${tag}[^>]*${attr}="([^"]*)"`, 'g')
  const matches = []
  let m
  while ((m = re.exec(xml)) !== null) matches.push(m[1])
  return matches
}

async function checkRssUpdates() {
  console.log('=== Covery RSS Update Checker ===\n')

  // Load data
  const metadata = JSON.parse(fs.readFileSync(METADATA_FILE, 'utf8'))
  const catalog = JSON.parse(fs.readFileSync(CATALOG_FILE, 'utf8'))
  let lastCheckData = { lastCheck: '2026-04-01T00:00:00Z' }
  try { lastCheckData = JSON.parse(fs.readFileSync(LAST_CHECK_FILE, 'utf8')) } catch {}

  const lastCheckDate = new Date(lastCheckData.lastCheck)
  console.log(`前回チェック: ${lastCheckData.lastCheck}`)

  // Build catalog entries for matching
  const catalogEntries = []
  for (const artist of catalog.artists) {
    for (const song of artist.songs) {
      catalogEntries.push({ title: song.title, artist: artist.name })
    }
  }

  // Get approved channel IDs from preview file
  // (In CI we can't access localStorage, so we check for an approvedChannels.json or use all channels with covers in metadata)
  let approvedIds = new Set()
  try {
    const approvedFile = path.join(__dirname, '../src/data/approvedChannels.json')
    if (fs.existsSync(approvedFile)) {
      const approved = JSON.parse(fs.readFileSync(approvedFile, 'utf8'))
      const list = approved.channels || approved
      if (Array.isArray(list)) list.forEach(ch => approvedIds.add(ch.channelId || ch))
    }
  } catch {}

  // Fallback: use channels already in metadata as "approved"
  if (approvedIds.size === 0) {
    metadata.singers.forEach(s => approvedIds.add(s.channelId))
  }

  console.log(`チェック対象: ${approvedIds.size}チャンネル\n`)

  // Existing video IDs to avoid duplicates
  const existingVideoIds = new Set()
  metadata.songs.forEach(s => s.covers.forEach(c => existingVideoIds.add(c.videoId)))

  const singersMap = new Map()
  metadata.singers.forEach(s => singersMap.set(s.channelId, s))

  let addedTotal = 0
  let checked = 0
  let errors = 0

  for (const channelId of approvedIds) {
    const rssUrl = `https://www.youtube.com/feeds/videos.xml?channel_id=${channelId}`

    try {
      const res = await fetch(rssUrl)
      if (!res.ok) { errors++; continue }
      const xml = await res.text()
      checked++

      // Extract entries
      const entries = xml.split('<entry>').slice(1) // Skip feed header

      for (const entry of entries) {
        // Extract published date
        const published = extractTag(entry, 'published')[0] || ''
        if (!published) continue
        const pubDate = new Date(published)
        if (pubDate <= lastCheckDate) continue // Skip old videos

        // Extract video ID and title
        const videoId = extractAttr(entry, 'yt:videoId', '')[0] || extractTag(entry, 'yt:videoId')[0] || ''
        if (!videoId || existingVideoIds.has(videoId)) continue

        const title = extractTag(entry, 'title')[0] || ''
        const lower = title.toLowerCase()

        // Filter (including shorts URL detection)
        if (EXCLUDE_KEYWORDS.some(k => lower.includes(k.toLowerCase()))) continue
        if (entry.includes('/shorts/')) continue
        if (!['歌ってみた', 'cover', 'カバー'].some(k => lower.includes(k))) continue

        // Match to catalog (strict) — skip if no match
        const match = findBestMatch(title, catalogEntries)
        if (!match) continue // カタログにない曲は追加しない
        const matchedTitle = match.title
        const matchedArtist = match.artist

        const channelName = extractTag(entry, 'name')[0] || singersMap.get(channelId)?.name || 'Unknown'

        // Ensure singer exists
        if (!singersMap.has(channelId)) {
          singersMap.set(channelId, { channelId, name: channelName, thumbnailUrl: '' })
        }

        metadata.songs.push({
          id: `song_${videoId}`,
          title: matchedTitle,
          originalArtist: matchedArtist,
          singerName: channelName,
          genre: ['J-POP'],
          covers: [{
            videoId,
            singerId: channelId,
            publishedAt: published.split('T')[0],
            thumbnailUrl: `https://img.youtube.com/vi/${videoId}/hqdefault.jpg`
          }]
        })
        existingVideoIds.add(videoId)
        addedTotal++
      }
    } catch {
      errors++
    }

    await sleep(200) // Be polite to YouTube RSS
  }

  // Update singers and save
  metadata.singers = [...singersMap.values()]
  fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2))

  // Update last check time
  fs.writeFileSync(LAST_CHECK_FILE, JSON.stringify({
    lastCheck: new Date().toISOString()
  }, null, 2))

  console.log(`=== 完了 ===`)
  console.log(`チェック済み: ${checked}チャンネル`)
  console.log(`新着カバー: +${addedTotal}`)
  console.log(`エラー: ${errors}`)
  console.log(`Total songs: ${metadata.songs.length}`)
}

checkRssUpdates().catch(e => console.error('FATAL:', e.message))
