// ══════════════════════════════════════════════════════════
//  テスト: 3アーティスト限定の全曲取得
//  対象: Ado, 10-FEET, ONE OK ROCK
//  既存データは壊さない（INSERT OR IGNORE）
// ══════════════════════════════════════════════════════════

import axios from 'axios'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { loadCache, saveCache, getCached, setCache, getCacheStats } from './cacheManager.js'
import db from './db.js'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// ── Genre mapping (from build-catalog.js) ──
const GENRE_MAP = {
  'j-pop': 'J-POP', 'pop': 'J-POP', 'j-rock': '邦ロック', 'rock': '邦ロック',
  'alternative': 'オルタナティブ', 'anime': 'アニソン',
  'rap/hip hop': 'ヒップホップ', 'hip hop': 'ヒップホップ',
  'r&b': 'R&B', 'electro': 'エレクトロ', 'metal': 'メタル',
  'jazz': 'ジャズ', 'classical': 'クラシック', 'reggae': 'レゲエ',
  'folk': 'フォーク', 'asian music': 'J-POP', 'korean pop': 'K-POP',
  'k-pop': 'K-POP', 'films/games': 'サウンドトラック',
  'soundtrack': 'サウンドトラック', 'kids': 'キッズ',
  'latin music': 'ラテン', 'dance': 'ダンス',
  'soul & funk': 'ソウル', 'soul': 'ソウル', 'blues': 'ブルース',
  'enka': '演歌',
}

function mapGenre(name) {
  if (!name) return 'J-POP'
  const lower = String(name).toLowerCase()
  for (const [key, value] of Object.entries(GENRE_MAP)) {
    if (lower.includes(key)) return value
  }
  return 'J-POP'
}

// ── Deezer API helpers (with cache + rate limit) ──
let apiCalls = 0
let cacheHits = 0

async function deezerGet(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await axios.get(url)
      apiCalls++
      await sleep(200) // 200ms wait between requests
      return res.data
    } catch (e) {
      if (i === retries - 1) {
        console.error(`  [ERROR] API failed: ${url} - ${e.message}`)
        return null
      }
      await sleep(1000)
    }
  }
  return null
}

async function cachedDeezerGet(category, cacheKey, url) {
  const cached = getCached(category, cacheKey)
  if (cached) {
    cacheHits++
    return cached
  }
  const data = await deezerGet(url)
  if (data) setCache(category, cacheKey, data)
  return data
}

// ══════════════════════════════════════════════════════════
//  MAIN
// ══════════════════════════════════════════════════════════

const TARGET_ARTISTS = ['Ado', '10-FEET', 'ONE OK ROCK']

async function main() {
  const startTime = Date.now()
  console.log(`\n[テスト] 対象: ${TARGET_ARTISTS.join(', ')}`)
  console.log('='.repeat(60))

  loadCache()

  const results = [] // per-artist summary

  for (let i = 0; i < TARGET_ARTISTS.length; i++) {
    const artistName = TARGET_ARTISTS[i]
    console.log(`\n=== ${i + 1}/${TARGET_ARTISTS.length}: ${artistName} ===`)

    // ── Step 1: Search artist on Deezer ──
    const searchKey = `dz_search_${artistName}`
    let searchHit = getCached('deezerArtistSearch', searchKey)
    if (searchHit) {
      cacheHits++
      console.log(`[Step 1] Deezer検索: "${artistName}" → ID: ${searchHit.id} (キャッシュ)`)
    } else {
      const searchData = await deezerGet(`https://api.deezer.com/search/artist?q=${encodeURIComponent(artistName)}&limit=5`)
      if (!searchData?.data?.length) {
        console.error(`[Step 1] "${artistName}" が見つかりません！スキップ`)
        results.push({ name: artistName, error: 'not found' })
        continue
      }
      // Find best match
      searchHit = searchData.data.find(a => a.name.toLowerCase() === artistName.toLowerCase()) || searchData.data[0]
      setCache('deezerArtistSearch', searchKey, searchHit)
      console.log(`[Step 1] Deezer検索: "${artistName}" → ID: ${searchHit.id} (名前: ${searchHit.name})`)
    }

    const deezerId = searchHit.id

    // ── Step 2: Get artist details ──
    const detailKey = `dz_artist_${deezerId}`
    let detail = getCached('deezerArtistDetail', detailKey)
    if (detail) {
      cacheHits++
    } else {
      detail = await deezerGet(`https://api.deezer.com/artist/${deezerId}`)
      if (detail?.id) setCache('deezerArtistDetail', detailKey, detail)
    }

    if (!detail?.id) {
      console.error(`[Step 2] アーティスト詳細取得失敗: ${artistName}`)
      results.push({ name: artistName, error: 'detail fetch failed' })
      continue
    }

    const imageUrl = detail.picture_xl || detail.picture_big || detail.picture_medium || detail.picture || ''
    console.log(`[Step 2] アーティスト情報取得`)
    console.log(`  - 名前: ${detail.name}`)
    console.log(`  - 画像: ${imageUrl ? imageUrl.substring(0, 60) + '...' : 'なし'}`)
    console.log(`  - Deezer上のアルバム数: ${detail.nb_album || '不明'}`)
    console.log(`  - ファン数: ${(detail.nb_fan || 0).toLocaleString()}`)

    // ── Step 3: Get all albums (with pagination) ──
    console.log(`[Step 3] 全アルバム取得中...`)
    let allAlbums = []
    let offset = 0
    const ALBUM_LIMIT = 100

    while (true) {
      const albumsCacheKey = `dz_albums_${deezerId}_${offset}`
      let albumsPage = getCached('deezerAlbums', albumsCacheKey)
      if (albumsPage) {
        cacheHits++
      } else {
        const albumsData = await deezerGet(`https://api.deezer.com/artist/${deezerId}/albums?limit=${ALBUM_LIMIT}&index=${offset}`)
        if (!albumsData?.data) break
        albumsPage = albumsData.data
        setCache('deezerAlbums', albumsCacheKey, albumsPage)

        // Also store under the old cache key format for compatibility
        if (offset === 0) {
          setCache('deezerAlbums', `dz_albums_${deezerId}`, albumsPage)
        }

        // Check if there are more pages
        if (!albumsData.next || albumsPage.length < ALBUM_LIMIT) {
          allAlbums = allAlbums.concat(albumsPage)
          break
        }
      }

      allAlbums = allAlbums.concat(albumsPage)
      if (albumsPage.length < ALBUM_LIMIT) break
      offset += ALBUM_LIMIT
    }

    for (const alb of allAlbums) {
      console.log(`  - ${alb.title} (${alb.release_date || '日付不明'}, ${alb.record_type || 'unknown'}, ${alb.nb_tracks || '?'}曲)`)
    }
    console.log(`  合計: ${allAlbums.length}アルバム`)

    // ── Step 4: Get all tracks from all albums ──
    console.log(`[Step 4] 全曲取得中...`)
    const uniqueSongs = new Map() // title.toLowerCase() → { title, duration, deezerRank }
    let totalTracksRaw = 0

    for (const album of allAlbums) {
      const tracksCacheKey = `dz_album_tracks_${album.id}`
      let tracks = getCached('deezerAlbumTracks', tracksCacheKey)
      if (tracks) {
        cacheHits++
      } else {
        const tracksData = await deezerGet(`https://api.deezer.com/album/${album.id}/tracks?limit=100`)
        tracks = tracksData?.data || []
        setCache('deezerAlbumTracks', tracksCacheKey, tracks)
      }

      const titles = []
      for (const t of tracks) {
        const title = (t.title || '').trim()
        if (!title) continue
        totalTracksRaw++
        const lower = title.toLowerCase()
        if (!uniqueSongs.has(lower)) {
          uniqueSongs.set(lower, {
            title,
            duration: t.duration || 0,
            deezerRank: t.rank || 0,
          })
          titles.push(title)
        }
      }

      if (titles.length > 0) {
        const preview = titles.slice(0, 3).map(t => `"${t}"`).join(', ')
        const more = titles.length > 3 ? `, ...他${titles.length - 3}曲` : ''
        console.log(`  - "${album.title}" から${tracks.length}曲取得 (新規${titles.length}): [${preview}${more}]`)
      }
    }

    console.log(`  重複除去後: 合計${uniqueSongs.size}曲 (元${totalTracksRaw}トラック)`)

    // ── Step 5: Get genre from newest album ──
    console.log(`[Step 5] ジャンル取得`)
    let genre = 'J-POP'
    // Sort albums by release_date descending, pick newest
    const sortedAlbums = [...allAlbums]
      .filter(a => a.release_date)
      .sort((a, b) => (b.release_date || '').localeCompare(a.release_date || ''))

    if (sortedAlbums.length > 0) {
      const newestAlbum = sortedAlbums[0]
      const albumDetailKey = `dz_album_detail_${newestAlbum.id}`
      let albumDetail = getCached('deezerAlbumDetail', albumDetailKey)
      if (albumDetail) {
        cacheHits++
      } else {
        albumDetail = await deezerGet(`https://api.deezer.com/album/${newestAlbum.id}`)
        if (albumDetail) setCache('deezerAlbumDetail', albumDetailKey, albumDetail)
      }

      const genres = albumDetail?.genres?.data || []
      if (genres.length > 0) {
        genre = mapGenre(genres[0].name)
        console.log(`  最新アルバム "${newestAlbum.title}" → ジャンル: ${genres.map(g => g.name).join(', ')} → ${genre}`)
      } else {
        console.log(`  最新アルバムにジャンル情報なし → デフォルト: ${genre}`)
      }
    }

    // ── Store result ──
    results.push({
      name: artistName,
      deezerId,
      imageUrl,
      genre,
      albumCount: allAlbums.length,
      totalTracksRaw,
      uniqueSongCount: uniqueSongs.size,
      songs: uniqueSongs,
    })

    console.log(`\n[D1登録準備]`)
    console.log(`  - アーティスト: ${artistName} / image_url=${imageUrl ? 'あり' : 'なし'} / genre=${genre}`)
    console.log(`  - 曲数: ${uniqueSongs.size}曲`)
  }

  // ══════════════════════════════════════════════════════════
  //  D1一括書き込み
  // ══════════════════════════════════════════════════════════
  console.log('\n' + '='.repeat(60))
  console.log('=== D1一括書き込み ===')

  if (!db.isAvailable()) {
    console.log('[D1] wrangler利用不可。COVERY_SKIP_D1=1 またはwrangler未設定')
    saveCache()
    return
  }

  const esc = db.escape
  const allStatements = []

  for (const r of results) {
    if (r.error) continue

    // INSERT OR IGNORE artist
    allStatements.push(
      `INSERT OR IGNORE INTO artists (name, reading, image_url, genre) VALUES ('${esc(r.name)}', '', '${esc(r.imageUrl)}', '${esc(r.genre)}')`
    )

    // UPDATE image_url and genre (only if currently empty)
    allStatements.push(
      `UPDATE artists SET image_url = CASE WHEN IFNULL(image_url,'')='' THEN '${esc(r.imageUrl)}' ELSE image_url END, genre = CASE WHEN IFNULL(genre,'')='' THEN '${esc(r.genre)}' ELSE genre END WHERE name = '${esc(r.name)}'`
    )

    // INSERT OR IGNORE songs
    let newSongCount = 0
    for (const [, song] of r.songs) {
      allStatements.push(
        `INSERT OR IGNORE INTO songs (title, artist_id, deezer_rank, duration, genre) VALUES ('${esc(song.title)}', (SELECT id FROM artists WHERE name = '${esc(r.name)}'), ${song.deezerRank}, ${song.duration}, '${esc(r.genre)}')`
      )
      newSongCount++
    }
    console.log(`  ${r.name}: ${newSongCount}曲のINSERT OR IGNORE準備完了`)
  }

  console.log(`\n合計SQL文: ${allStatements.length}`)
  const d1Result = db.batchExecute(allStatements, '3artists-test')
  console.log(`D1実行完了: ${d1Result} statements executed`)

  // ══════════════════════════════════════════════════════════
  //  完了レポート
  // ══════════════════════════════════════════════════════════
  saveCache()

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  const stats = getCacheStats()

  console.log('\n' + '='.repeat(60))
  console.log('=== 完了 ===')
  console.log(`処理時間: ${elapsed}秒`)
  console.log(`API呼び出し回数: ${apiCalls}回（キャッシュ命中: ${cacheHits}回）`)
  console.log(`キャッシュ統計: ${stats.hits}ヒット / ${stats.misses}新規 / 節約率${stats.rate}%`)
  console.log('')
  console.log('登録結果:')

  for (const r of results) {
    if (r.error) {
      console.log(`  - ${r.name}: エラー (${r.error})`)
    } else {
      console.log(`  - ${r.name}: アルバム${r.albumCount}枚 / 曲${r.uniqueSongCount} / 画像: ${r.imageUrl ? 'あり' : 'なし'} / ジャンル: ${r.genre}`)
    }
  }

  console.log('\n' + '='.repeat(60))
  console.log('★ 各アーティストの取得曲数:')
  for (const r of results) {
    if (r.error) {
      console.log(`  ${r.name}: 取得失敗`)
    } else {
      console.log(`  ${r.name}: ${r.uniqueSongCount}曲 (${r.albumCount}アルバムから / 重複除去前: ${r.totalTracksRaw}トラック)`)
    }
  }
  console.log('='.repeat(60))
}

main().catch(e => {
  console.error('Fatal error:', e)
  process.exit(1)
})
