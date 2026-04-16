import axios from 'axios'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { execSync } from 'child_process'
import { loadCache, saveCache, getCached, setCache, printCacheStats } from './cacheManager.js'
import db from './db.js'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const OUTPUT_FILE = path.join(__dirname, '../src/data/songCatalog.json')
const WORKER_DIR = path.join(__dirname, '..', 'worker')

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// ══════════════════════════════════════════════════════════
//  TIME LIMIT
// ══════════════════════════════════════════════════════════
const TIME_LIMIT_MS = (parseInt(process.env.TIME_LIMIT_MINUTES || '5', 10)) * 60 * 1000
let BUILD_START_TIME = 0
function isTimeUp() { return (Date.now() - BUILD_START_TIME) >= TIME_LIMIT_MS }
function elapsedStr() {
  const s = Math.floor((Date.now() - BUILD_START_TIME) / 1000)
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')} / ${Math.floor(TIME_LIMIT_MS / 60000)}:00`
}

// ══════════════════════════════════════════════════════════
//  SEMAPHORE for parallel execution
// ══════════════════════════════════════════════════════════
function createSemaphore(max) {
  let active = 0
  const waiting = []
  return {
    async acquire() {
      if (active < max) { active++; return }
      await new Promise(resolve => waiting.push(resolve))
      active++
    },
    release() {
      active--
      if (waiting.length > 0) waiting.shift()()
    },
  }
}

// ══════════════════════════════════════════════════════════
//  RATE LIMITER with 429 backoff
// ══════════════════════════════════════════════════════════
let WAIT_MS = 50 // start at 50ms, back off on 429
let consecutive429 = 0

async function deezerGet(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await axios.get(url)
      consecutive429 = 0
      if (WAIT_MS > 50) WAIT_MS = Math.max(50, WAIT_MS - 10) // slowly recover
      return res.data
    } catch (e) {
      if (e.response?.status === 429) {
        consecutive429++
        const retryAfter = parseInt(e.response.headers?.['retry-after'] || '3', 10)
        WAIT_MS = 200 // back off
        console.warn(`[429] ${url.substring(0, 60)}... wait ${retryAfter + 1}s (consecutive: ${consecutive429})`)
        await sleep((retryAfter + 1) * 1000)
        if (consecutive429 >= 3) return null // skip after 3 consecutive 429s
        continue
      }
      if (i === retries - 1) return null
      await sleep(1000)
    }
  }
  return null
}

async function deezerJSON(url) {
  const data = await deezerGet(url)
  await sleep(WAIT_MS)
  return data
}

// ══════════════════════════════════════════════════════════
//  SEED ARTISTS
// ══════════════════════════════════════════════════════════
const JP_ARTISTS = [
  '米津玄師', '星野源', '藤井風', '優里', 'Vaundy', '菅田将暉', '福山雅治',
  '桑田佳祐', '尾崎豊', '玉置浩二', '槇原敬之', '平井堅', '秦基博',
  '森山直太朗', '三浦大知', '清水翔太', '山崎まさよし', 'スガシカオ',
  '久保田利伸', '小田和正', '布施明', '井上陽水', '長渕剛', '矢沢永吉',
  '浜田省吾', '吉田拓郎', '松山千春', '中島みゆき', '竹原ピストル',
  'ASKA', '德永英明', '氷室京介', '吉川晃司', '西川貴教',
  'GACKT', 'HYDE', 'Taka', '川崎鷹也', '瑛人',
  'imase', 'tuki.', 'キタニタツヤ', 'ano', '藤原聡',
  '大石昌良', 'TK from 凛として時雨', '澤野弘之',
  '宇多田ヒカル', 'あいみょん', 'Ado', 'MISIA', 'Aimer', 'LiSA', 'milet',
  '浜崎あゆみ', '安室奈美恵', '倉木麻衣', '中島美嘉', '西野カナ',
  '大塚愛', 'YUI', '家入レオ', '加藤ミリヤ', '絢香', 'AI', 'JUJU',
  'Superfly', '椎名林檎', 'aiko', '松任谷由実', '竹内まりや',
  '広瀬香美', '持田香織', '鬼束ちひろ', 'BoA', '倖田來未',
  'miwa', 'May J.', '新妻聖子', '島谷ひとみ', '柴咲コウ',
  '上白石萌音', '上白石萌歌', 'いきものがかり', 'yama',
  'Uru', '美波', '幾田りら', 'YUKI', '矢野顕子',
  '中森明菜', '松田聖子', '工藤静香', '華原朋美',
  'YOASOBI', 'Official髭男dism', 'King Gnu', 'Mrs. GREEN APPLE',
  'ONE OK ROCK', 'back number', 'RADWIMPS', 'BUMP OF CHICKEN',
  'Mr.Children', 'スピッツ', 'サザンオールスターズ', 'ヨルシカ',
  'クリープハイプ', 'amazarashi', 'GReeeeN', 'コブクロ', 'ゆず',
  'SEKAI NO OWARI', 'サカナクション', 'フジファブリック',
  'ASIAN KUNG-FU GENERATION', 'ELLEGARDEN', 'NUMBER GIRL',
  'the pillows', 'UNISON SQUARE GARDEN', 'KANA-BOON',
  'sumika', 'マカロニえんぴつ', 'Saucy Dog', 'Novelbright',
  'My Hair is Bad', 'SUPER BEAVER', 'Hump Back', 'WANIMA',
  'SHISHAMO', 'フレデリック', '緑黄色社会', 'THE ORAL CIGARETTES',
  'BLUE ENCOUNT', 'ヤバイTシャツ屋さん', '04 Limited Sazabys',
  'flumpool', 'UVERworld', 'FLOW', 'L\'Arc~en~Ciel', 'GLAY',
  'B\'z', 'X JAPAN', 'LUNA SEA', 'THE YELLOW MONKEY',
  'ウルフルズ', 'エレファントカシマシ', 'THE BLUE HEARTS',
  'Hi-STANDARD', 'MONGOL800', 'HY', 'BEGIN', 'かりゆし58',
  '10-FEET', 'MAN WITH A MISSION', 'MY FIRST STORY',
  'SiM', 'coldrain', 'Fear, and Loathing in Las Vegas',
  'チャットモンチー', 'ねごと', 'SCANDAL', 'BAND-MAID',
  'Creepy Nuts', 'DISH//', 'Da-iCE', 'Kis-My-Ft2',
  'ずっと真夜中でいいのに。', 'Eve', 'Reol', '女王蜂',
  'ポルノグラフィティ', 'ORANGE RANGE', 'ケツメイシ',
  'RIP SLYME', 'KREVA', 'キックザカンクルー', 'Dragon Ash',
  'Aqua Timez', 'FUNKY MONKEY BABYS', 'AAA',
  'きのこ帝国', 'syrup16g', 'andymori', 'Base Ball Bear',
  'People In The Box', 'toe', 'MONO', 'Cornelius',
  '凛として時雨', 'ゲスの極み乙女。', 'indigo la End',
  '東京事変', '相対性理論',
  '嵐', 'SMAP', 'KAT-TUN', 'Hey! Say! JUMP',
  'SixTONES', 'Snow Man', 'King & Prince', 'なにわ男子',
  'NEWS', '関ジャニ∞', 'V6', 'TOKIO', 'Kinki Kids',
  '乃木坂46', '日向坂46', '櫻坂46', 'AKB48',
  'モーニング娘。', 'ハロー!プロジェクト', 'Perfume', 'きゃりーぱみゅぱみゅ',
  'E-girls', 'ももいろクローバーZ', 'NiziU', 'BE:FIRST', 'JO1',
  '新しい学校のリーダーズ', 'BABYMETAL',
  'EXILE', '三代目 J SOUL BROTHERS', 'GENERATIONS', 'THE RAMPAGE',
  'DA PUMP', 'w-inds.', 'Lead',
  'ZORN', '舐達麻', 'BAD HOP', 'JP THE WAVY', 'Awich', 'KOHH', 'SKY-HI',
  'DECO*27', 'wowaka', '40mP', 'じん', 'ピノキオピー',
  'Ayase', 'syudou', 'Kanaria', 'ナユタン星人',
  'MARETU', 'Mitchie M', 'kemu', 'ryo', 'doriko',
  'DYES IWASAKI', 'Chinozo', 'Neru', 'n-buna',
  'sasakure.UK', 'cosMo@暴走P', 'livetune',
  '水樹奈々', '林原めぐみ', '坂本真綾', '田村ゆかり', '花澤香菜',
  '鈴木このみ', 'fhána', 'ClariS', 'Kalafina', '藍井エイル',
  'ReoNa', 'ASCA', 'TrySail', 'スフィア', 'μ\'s', 'Aqours',
  'Roselia', '久石譲', '梶浦由記', '菅野よう子',
  '山下達郎', '大貫妙子', '吉田美奈子', '荒井由実', '杏里',
  '角松敏生', '大橋純子', 'EPO', '稲垣潤一',
  '美空ひばり', '北島三郎', '石川さゆり', '天童よしみ',
  '氷川きよし', '坂本冬美', '藤あや子', '島津亜矢', '三山ひろし', '山内惠介',
  'ハチ', 'DOVA-SYNDROME', '150P', 'Orangestar', 'Tani Yuuki', 'なとり',
  '鈴木雅之', 'nano', 'fripSide', 'MYTH & ROID',
  '山口百恵', '大滝詠一', 'BOØWY', '奥田民生',
  'BTS', 'BLACKPINK', 'TWICE', 'IU', 'SEVENTEEN',
  'Stray Kids', 'aespa', 'NewJeans', 'LE SSERAFIM', 'IVE',
  '神はサイコロを振らない', 'INI', 'JUDY AND MARY', 'スキマスイッチ',
  'くるり', 'THE BACK HORN', 'ストレイテナー',
  'Travis Japan', 'WEST.', 'Number_i',
  'FRUITS ZIPPER', 'tofubeats', 'PUNPEE',
  'ロクデナシ', 'MAZZEL', 'Omoinotake', '水曜日のカンパネラ',
  'あたらよ', '羊文学', 'yonawo', 'Tempalay',
  'まふまふ', 'そらる', 'luz', '蒼井翔太',
  'カンザキイオリ', 'ちゃんみな', 'はるまきごはん', 'TOOBOE',
  'やなぎなぎ', '花譜', 'a flood of circle', 'ROTTENGRAFFTY',
  'go!go!vanillas', 'CHAI', 'PEOPLE 1', '夜の本気ダンス', 'クラムボン',
  'EXO', 'Red Velvet', 'SHINee', 'MAMAMOO', 'TXT', 'ATEEZ',
  'ENHYPEN', 'ITZY', '(G)I-DLE', 'NMIXX',
  'GRANRODEO', 'angela', 'JAM Project', 'supercell', 'KOTOKO',
  'Do As Infinity', 'Burnout Syndromes', 'OxT',
  'CHAGE and ASKA', 'THE ALFEE', 'さだまさし', 'RCサクセション',
  '電気グルーヴ', 'REBECCA', 'T-SQUARE', 'DEPAPEPE', '押尾コータロー',
]

// ══════════════════════════════════════════════════════════
//  English → Japanese name map
// ══════════════════════════════════════════════════════════
const NAME_MAP = {
  'Kenshi Yonezu': '米津玄師', 'Aimyon': 'あいみょん', 'Yuuri': '優里',
  'Fujii Kaze': '藤井風', 'SPITZ': 'スピッツ',
  'OFFICIAL HIGE DANDISM': 'Official髭男dism', 'Official HIGE DANdism': 'Official髭男dism',
  'Hikaru Utada': '宇多田ヒカル', 'Utada Hikaru': '宇多田ヒカル',
  'Masaharu Fukuyama': '福山雅治', 'Sheena Ringo': '椎名林檎',
  'Yumi Matsutoya': '松任谷由実', 'Southern All Stars': 'サザンオールスターズ',
  'Ayumi Hamasaki': '浜崎あゆみ', 'Mika Nakashima': '中島美嘉',
  'Daichi Miura': '三浦大知', 'Gen Hoshino': '星野源',
  'Masaki Suda': '菅田将暉', 'Kana Nishino': '西野カナ',
  'Noriyuki Makihara': '槇原敬之', 'Ken Hirai': '平井堅',
  'Motohiro Hata': '秦基博', 'Naotaro Moriyama': '森山直太朗',
  'Tatsuro Yamashita': '山下達郎', 'Yutaka Ozaki': '尾崎豊',
  'Mariya Takeuchi': '竹内まりや', 'Anri': '杏里',
  'Toshinobu Kubota': '久保田利伸', 'Nana Mizuki': '水樹奈々',
  'Namie Amuro': '安室奈美恵', 'Mai Kuraki': '倉木麻衣',
  'Ai Otsuka': '大塚愛', 'Kumi Koda': '倖田來未',
  'Akina Nakamori': '中森明菜', 'Seiko Matsuda': '松田聖子',
  'Miyuki Nakajima': '中島みゆき', 'Yosui Inoue': '井上陽水',
  'Eikichi Yazawa': '矢沢永吉', 'Kazumasa Oda': '小田和正',
  'Arashi': '嵐', 'Joe Hisaishi': '久石譲',
  'Yuki Kajiura': '梶浦由記', 'Yoko Kanno': '菅野よう子',
  'Misora Hibari': '美空ひばり', 'Sayuri Ishikawa': '石川さゆり',
  'Kiyoshi Hikawa': '氷川きよし',
  'Suchmos': 'Suchmos', 'Sekai No Owari': 'SEKAI NO OWARI',
  'Amazarashi': 'amazarashi', 'Yorushika': 'ヨルシカ',
}

const READING_MAP = {
  '米津玄師':'よねづけんし','星野源':'ほしのげん','藤井風':'ふじいかぜ','優里':'ゆうり',
  '菅田将暉':'すだまさき','福山雅治':'ふくやままさはる','桑田佳祐':'くわたけいすけ',
  '尾崎豊':'おざきゆたか','玉置浩二':'たまきこうじ','槇原敬之':'まきはらのりゆき',
  '平井堅':'ひらいけん','秦基博':'はたもとひろ','森山直太朗':'もりやまなおたろう',
  '三浦大知':'みうらだいち','清水翔太':'しみずしょうた','山崎まさよし':'やまざきまさよし',
  '久保田利伸':'くぼたとしのぶ','小田和正':'おだかずまさ','布施明':'ふせあきら',
  '井上陽水':'いのうえようすい','長渕剛':'ながぶちつよし','矢沢永吉':'やざわえいきち',
  '浜田省吾':'はまだしょうご','吉田拓郎':'よしだたくろう','松山千春':'まつやまちはる',
  '中島みゆき':'なかじまみゆき','德永英明':'とくながひであき',
  '宇多田ヒカル':'うただひかる','浜崎あゆみ':'はまさきあゆみ','安室奈美恵':'あむろなみえ',
  '倉木麻衣':'くらきまい','中島美嘉':'なかしまみか','西野カナ':'にしのかな',
  '大塚愛':'おおつかあい','椎名林檎':'しいなりんご','松任谷由実':'まつとうやゆみ',
  '竹内まりや':'たけうちまりや','嵐':'あらし',
  '緑黄色社会':'りょくおうしょくしゃかい','東京事変':'とうきょうじへん',
  '凛として時雨':'りんとしてしぐれ','女王蜂':'じょおうばち',
  '関ジャニ∞':'かんじゃにえいと','なにわ男子':'なにわだんし',
  '乃木坂46':'のぎざかふぉーてぃしっくす','日向坂46':'ひなたざかふぉーてぃしっくす',
  '櫻坂46':'さくらざかふぉーてぃしっくす','舐達麻':'なめだるま',
  '水樹奈々':'みずきなな','花澤香菜':'はなざわかな',
  '久石譲':'ひさいしじょう','梶浦由記':'かじうらゆき','菅野よう子':'かんのようこ',
  '山下達郎':'やましたたつろう','美空ひばり':'みそらひばり',
  '北島三郎':'きたじまさぶろう','石川さゆり':'いしかわさゆり',
  '氷川きよし':'ひかわきよし',
  '三代目 J SOUL BROTHERS':'さんだいめじぇいそうるぶらざーず','μ\'s':'みゅーず',
}

function resolveJapaneseName(name) { return NAME_MAP[name] || name }
function katakanaToHiragana(str) {
  return str.replace(/[\u30A1-\u30F6]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60))
}
function generateReading(name) {
  if (READING_MAP[name]) return READING_MAP[name]
  if (/^[A-Za-z0-9]/.test(name)) return name
  const c = katakanaToHiragana(name)
  if (c !== name) return c.toLowerCase()
  return name
}

function loadExisting() {
  if (fs.existsSync(OUTPUT_FILE)) {
    try { return JSON.parse(fs.readFileSync(OUTPUT_FILE, 'utf8')) } catch (_) {}
  }
  return { artists: [] }
}
function saveCatalog(catalog) {
  const dir = path.dirname(OUTPUT_FILE)
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true })
  fs.writeFileSync(OUTPUT_FILE, JSON.stringify(catalog, null, 2))
}

// ══════════════════════════════════════════════════════════
//  GENRE
// ══════════════════════════════════════════════════════════
const GENRE_MAP = {
  'j-pop': 'J-POP', 'pop': 'J-POP', 'ポップ': 'J-POP', 'asian music': 'J-POP', 'アジア': 'J-POP',
  'j-rock': '邦ロック', 'rock': '邦ロック', 'ロック': '邦ロック',
  'alternative': 'オルタナティブ',
  'anime': 'アニソン', 'アニメ': 'アニソン',
  'rap/hip hop': 'ヒップホップ', 'hip hop': 'ヒップホップ', 'ヒップホップ': 'ヒップホップ',
  'r&b': 'R&B', 'electro': 'エレクトロ',
  'metal': 'メタル', 'メタル': 'メタル',
  'jazz': 'ジャズ', 'classical': 'クラシック', 'folk': 'フォーク',
  'korean pop': 'K-POP', 'k-pop': 'K-POP',
  'films/games': 'サウンドトラック', 'soundtrack': 'サウンドトラック', '映画': 'サウンドトラック',
  'dance': 'ダンス', 'soul': 'ソウル', 'blues': 'ブルース', 'enka': '演歌', '演歌': '演歌',
}
const SOUNDTRACK_GENRES = new Set(['サウンドトラック', 'キッズ'])

function mapGenre(name) {
  if (!name) return 'J-POP'
  const lower = String(name).toLowerCase()
  for (const [key, value] of Object.entries(GENRE_MAP)) {
    if (lower.includes(key)) return value
  }
  return 'J-POP'
}

function isJapaneseArtist(artist, seedNames = new Set()) {
  if (!artist) return false
  if (seedNames.has(artist.name)) return true
  return /[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(artist.name || '')
}

// ══════════════════════════════════════════════════════════
//  Deezer helpers (cached)
// ══════════════════════════════════════════════════════════

async function deezerSearchArtist(name) {
  const cacheKey = `dz_search_${name}`
  const cached = getCached('deezerArtistSearch', cacheKey)
  if (cached) return cached
  const data = await deezerJSON(`https://api.deezer.com/search/artist?q=${encodeURIComponent(name)}&limit=5`)
  const hit = data?.data?.find(a => a.name.toLowerCase() === name.toLowerCase()) || data?.data?.[0] || null
  if (hit) setCache('deezerArtistSearch', cacheKey, hit)
  return hit
}

async function deezerGetArtistById(deezerId) {
  const cacheKey = `dz_artist_${deezerId}`
  const cached = getCached('deezerArtistDetail', cacheKey)
  if (cached) return cached
  const data = await deezerJSON(`https://api.deezer.com/artist/${deezerId}`)
  if (data && data.id) setCache('deezerArtistDetail', cacheKey, data)
  return data
}

async function deezerGetAllAlbums(deezerId) {
  const allAlbums = []
  let offset = 0
  while (true) {
    const cacheKey = `dz_albums_${deezerId}_${offset}`
    let page = getCached('deezerAlbums', cacheKey)
    if (!page) {
      const data = await deezerJSON(`https://api.deezer.com/artist/${deezerId}/albums?limit=100&index=${offset}`)
      page = data?.data || []
      setCache('deezerAlbums', cacheKey, page)
      if (offset === 0) setCache('deezerAlbums', `dz_albums_${deezerId}`, page)
    }
    allAlbums.push(...page)
    if (page.length < 100) break
    offset += 100
  }
  return allAlbums
}

async function deezerGetAlbumTracks(albumId) {
  const cacheKey = `dz_album_tracks_${albumId}`
  const cached = getCached('deezerAlbumTracks', cacheKey)
  if (cached) return cached
  const data = await deezerJSON(`https://api.deezer.com/album/${albumId}/tracks?limit=100`)
  const tracks = data?.data || []
  setCache('deezerAlbumTracks', cacheKey, tracks)
  return tracks
}

async function deezerGetAlbumDetail(albumId) {
  const cacheKey = `dz_album_detail_${albumId}`
  const cached = getCached('deezerAlbumDetail', cacheKey)
  if (cached) return cached
  const data = await deezerJSON(`https://api.deezer.com/album/${albumId}`)
  if (data) setCache('deezerAlbumDetail', cacheKey, data)
  return data
}

async function deezerGetRelatedArtists(deezerId) {
  const cacheKey = `dz_related_${deezerId}`
  const cached = getCached('deezerRelated', cacheKey)
  if (cached) return cached
  const data = await deezerJSON(`https://api.deezer.com/artist/${deezerId}/related?limit=20`)
  const related = data?.data || []
  setCache('deezerRelated', cacheKey, related)
  return related
}

async function deezerResolveGenre(deezerId, albums) {
  const candidates = [...(albums || [])]
    .filter(a => a.release_date && (a.record_type === 'album' || a.record_type === 'ep'))
    .sort((a, b) => (b.release_date || '').localeCompare(a.release_date || ''))
    .slice(0, 3)
  if (candidates.length === 0 && albums?.length > 0) candidates.push(albums[0])

  const sem = createSemaphore(3)
  const genreCounts = {}
  await Promise.all(candidates.map(async (alb) => {
    await sem.acquire()
    try {
      const detail = await deezerGetAlbumDetail(alb.id)
      for (const g of (detail?.genres?.data || [])) {
        const mapped = mapGenre(g.name)
        if (!SOUNDTRACK_GENRES.has(mapped)) genreCounts[mapped] = (genreCounts[mapped] || 0) + 1
      }
    } finally { sem.release() }
  }))

  const sorted = Object.entries(genreCounts).sort((a, b) => b[1] - a[1])
  return sorted.length > 0 ? sorted[0][0] : 'J-POP'
}

// ══════════════════════════════════════════════════════════
//  D1: fetch existing deezer_ids
// ══════════════════════════════════════════════════════════
function fetchDeezerIdsFromD1() {
  try {
    const out = execSync(
      'npx wrangler d1 execute covery-db --remote --json --command="SELECT name, deezer_id FROM artists WHERE deezer_id IS NOT NULL AND deezer_id != 0"',
      { cwd: WORKER_DIR, encoding: 'utf-8', maxBuffer: 10 * 1024 * 1024, timeout: 30000, stdio: ['ignore', 'pipe', 'pipe'] }
    )
    const parsed = JSON.parse(out)
    const results = parsed[0]?.results || []
    const map = new Map()
    for (const r of results) map.set(r.name, r.deezer_id)
    return map
  } catch (_) {
    return new Map()
  }
}

// ══════════════════════════════════════════════════════════
//  Process a single artist (called in parallel)
// ══════════════════════════════════════════════════════════
async function processOneArtist(deezerId, displayName, { seedNames, catalog, byName }) {
  const detail = await deezerGetArtistById(deezerId)
  if (!detail || !detail.id) return null

  const rawName = detail.name
  const name = seedNames.has(displayName)
    ? displayName
    : (resolveJapaneseName(rawName) || rawName)

  if (!isJapaneseArtist({ name }, seedNames) && !seedNames.has(displayName)) return null

  const imageUrl = detail.picture_xl || detail.picture_big || detail.picture_medium || detail.picture || ''
  const reading = generateReading(name)

  // Albums (paginated)
  const albums = await deezerGetAllAlbums(deezerId)

  // Tracks (parallel 10)
  const trackSem = createSemaphore(10)
  const allTracks = [] // [{albumTitle, tracks: []}]
  await Promise.all(albums.map(async (album) => {
    await trackSem.acquire()
    try {
      const tracks = await deezerGetAlbumTracks(album.id)
      allTracks.push({ albumTitle: album.title, tracks })
    } finally { trackSem.release() }
  }))

  // Dedup songs
  const existingTitles = new Set((byName.get(name.toLowerCase())?.songs || []).map(s => s.title.toLowerCase()))
  const newSongsList = []
  let tracksFetched = 0
  for (const { tracks } of allTracks) {
    tracksFetched += tracks.length
    for (const t of tracks) {
      const title = (t.title || '').trim()
      if (!title) continue
      if (existingTitles.has(title.toLowerCase())) continue
      existingTitles.add(title.toLowerCase())
      newSongsList.push({ title, deezerRank: t.rank || 0 })
    }
  }

  // Genre (parallel 3, skip soundtracks)
  const genre = await deezerResolveGenre(deezerId, albums)

  // Related
  const related = await deezerGetRelatedArtists(deezerId)

  return { name, reading, deezerId, imageUrl, genre, albums: albums.length, tracksFetched, newSongs: newSongsList, related }
}

// ══════════════════════════════════════════════════════════
//  MAIN
// ══════════════════════════════════════════════════════════
async function buildCatalog() {
  BUILD_START_TIME = Date.now()
  const limitMin = Math.floor(TIME_LIMIT_MS / 60000)
  console.log(`=== Covery Catalog Builder v7 (parallel + deezer_id) ===`)
  console.log(`[制限時間] ${limitMin}分 | [並列] 10 | [wait] ${WAIT_MS}ms\n`)
  loadCache()

  const catalog = loadExisting()
  const byName = new Map(catalog.artists.map(a => [a.name.toLowerCase(), a]))
  console.log(`既存カタログ: ${catalog.artists.length}アーティスト`)

  // ── Load existing deezer_ids from D1 ──
  const d1DeezerIds = fetchDeezerIdsFromD1()
  const hasDeezerIdCount = d1DeezerIds.size
  console.log(`D1 deezer_id保持: ${hasDeezerIdCount}件 | 未保持: ${JP_ARTISTS.length - hasDeezerIdCount}件\n`)

  const seedNames = new Set(JP_ARTISTS)
  const queue = []
  const seenIds = new Set()
  const processed = new Set()
  const deezerIdUpdates = [] // {name, deezerId} for Phase 2

  // ── Seed queue: use cached deezer_id where available ──
  console.log(`── シード解決 (${JP_ARTISTS.length}件) ──`)
  const seedSem = createSemaphore(10)
  let searchCount = 0
  let skipCount = 0

  await Promise.all(JP_ARTISTS.map(async (name) => {
    if (isTimeUp()) return
    const knownId = d1DeezerIds.get(name) || byName.get(name.toLowerCase())?.deezerId
    if (knownId) {
      if (!seenIds.has(knownId)) {
        seenIds.add(knownId)
        queue.push({ deezerId: knownId, displayName: name })
      }
      skipCount++
      return
    }
    await seedSem.acquire()
    try {
      if (isTimeUp()) return
      const hit = await deezerSearchArtist(name)
      if (hit && !seenIds.has(hit.id)) {
        queue.push({ deezerId: hit.id, displayName: name })
        seenIds.add(hit.id)
        deezerIdUpdates.push({ name, deezerId: hit.id })
      }
      searchCount++
    } finally { seedSem.release() }
  }))

  console.log(`  → キュー: ${queue.length}件 (deezer_idスキップ: ${skipCount}, 検索: ${searchCount}) [${elapsedStr()}]\n`)

  const MAX_ARTISTS = 5000
  let processedCount = 0
  let newArtistCount = 0
  let newSongCount = 0
  let updatedMeta = 0
  const artistSem = createSemaphore(10)

  // Process queue in batches of 10
  while (queue.length > 0 && processedCount < MAX_ARTISTS && !isTimeUp()) {
    const batch = []
    while (batch.length < 10 && queue.length > 0) {
      const item = queue.shift()
      if (processed.has(item.deezerId)) continue
      processed.add(item.deezerId)
      batch.push(item)
    }
    if (batch.length === 0) continue

    const results = await Promise.all(batch.map(async ({ deezerId, displayName }) => {
      await artistSem.acquire()
      try {
        return await processOneArtist(deezerId, displayName, { seedNames, catalog, byName })
      } catch (e) {
        console.error(`  [ERROR] ${displayName}: ${e.message}`)
        return null
      } finally { artistSem.release() }
    }))

    for (const r of results) {
      if (!r) continue
      processedCount++

      // Upsert into catalog
      let entry = byName.get(r.name.toLowerCase())
      if (!entry) {
        entry = { name: r.name, reading: r.reading, deezerId: r.deezerId, imageUrl: r.imageUrl, genre: r.genre, songs: [] }
        catalog.artists.push(entry)
        byName.set(r.name.toLowerCase(), entry)
        newArtistCount++
      } else {
        if (r.imageUrl) entry.imageUrl = r.imageUrl
        if (r.genre && r.genre !== 'J-POP') entry.genre = r.genre
        if (!entry.deezerId) entry.deezerId = r.deezerId
        updatedMeta++
      }

      // Add new songs
      const existingTitles = new Set(entry.songs.map(s => s.title.toLowerCase()))
      for (const s of r.newSongs) {
        if (!existingTitles.has(s.title.toLowerCase())) {
          existingTitles.add(s.title.toLowerCase())
          entry.songs.push({ title: s.title, deezerRank: s.deezerRank, genre: r.genre })
          newSongCount++
        }
      }

      // Track deezer_id for UPDATE
      if (r.deezerId) deezerIdUpdates.push({ name: r.name, deezerId: r.deezerId })

      // Related artists → queue
      let queuedRelated = 0
      for (const rel of (r.related || [])) {
        if (seenIds.has(rel.id)) continue
        if (!isJapaneseArtist({ name: rel.name }, seedNames)) continue
        seenIds.add(rel.id)
        queue.push({ deezerId: rel.id, displayName: resolveJapaneseName(rel.name) || rel.name })
        queuedRelated++
      }

      console.log(`[${processedCount}] ${r.name} | ${r.albums}枚→${r.tracksFetched}曲 (新規${r.newSongs.length}) | ${r.genre} | 関連+${queuedRelated} [${elapsedStr()}]`)
    }

    // Intermediate save every 50 artists
    if (processedCount % 50 === 0) {
      saveCatalog(catalog)
      saveCache()
    }
  }

  if (isTimeUp()) console.log(`\n[時間切れ] ${elapsedStr()}`)

  // ── Phase 1 complete ──
  saveCatalog(catalog)
  saveCache()

  const totalSongs = catalog.artists.reduce((n, a) => n + (a.songs?.length || 0), 0)
  console.log(`\n=== Phase 1 完了 [${elapsedStr()}] ===`)
  console.log(`処理: ${processedCount} | 新規artist: ${newArtistCount} | メタ更新: ${updatedMeta}`)
  console.log(`新規曲: ${newSongCount} | 合計: ${catalog.artists.length}アーティスト / ${totalSongs}曲`)
  printCacheStats()

  // ── Phase 2: D1 ──
  if (!db.isAvailable()) {
    console.log('\n[D1] skipped (wrangler not available or COVERY_SKIP_D1=1)')
    return
  }
  console.log(`\n=== Phase 2: D1一括投入 ===`)
  syncToD1(catalog, deezerIdUpdates)
  console.log(`=== 完了 (総処理時間: ${((Date.now() - BUILD_START_TIME) / 1000).toFixed(1)}s) ===`)
}

function syncToD1(catalog, deezerIdUpdates) {
  const esc = db.escape

  // Artists INSERT OR IGNORE
  const artistStmts = catalog.artists.map(a =>
    `INSERT OR IGNORE INTO artists (name, reading, spotify_id, image_url, genre) VALUES ('${esc(a.name)}', '${esc(a.reading || '')}', '${esc(a.spotifyId || '')}', '${esc(a.imageUrl || '')}', '${esc(a.genre || '')}')`
  )
  // UPDATE image_url/genre where empty
  const metaStmts = catalog.artists.filter(a => a.imageUrl || a.genre).map(a =>
    `UPDATE artists SET image_url = CASE WHEN IFNULL(image_url,'')='' THEN '${esc(a.imageUrl || '')}' ELSE image_url END, genre = CASE WHEN IFNULL(genre,'')='' THEN '${esc(a.genre || '')}' ELSE genre END WHERE name = '${esc(a.name)}'`
  )

  // deezer_id UPDATEs
  const uniqueDeezerIds = new Map()
  for (const u of deezerIdUpdates) uniqueDeezerIds.set(u.name, u.deezerId)
  const deezerIdStmts = [...uniqueDeezerIds.entries()].map(([name, did]) =>
    `UPDATE artists SET deezer_id = ${did} WHERE name = '${esc(name)}' AND (deezer_id IS NULL OR deezer_id = 0)`
  )

  // Songs INSERT OR IGNORE
  const songStmts = []
  for (const a of catalog.artists) {
    for (const s of (a.songs || [])) {
      songStmts.push(
        `INSERT OR IGNORE INTO songs (title, artist_id, deezer_rank, genre) VALUES ('${esc(s.title)}', (SELECT id FROM artists WHERE name = '${esc(a.name)}'), ${s.deezerRank || 0}, '${esc(s.genre || a.genre || '')}')`
      )
    }
  }

  console.log(`[D1] Artists: ${artistStmts.length} INSERT + ${metaStmts.length} UPDATE`)
  console.log(`[D1] deezer_id UPDATE: ${deezerIdStmts.length}件`)
  console.log(`[D1] Songs: ${songStmts.length} INSERT`)

  db.batchExecute(artistStmts, 'artists-insert')
  if (metaStmts.length > 0) db.batchExecute(metaStmts, 'artists-meta')
  if (deezerIdStmts.length > 0) db.batchExecute(deezerIdStmts, 'deezer-id')
  db.batchExecute(songStmts, 'songs-insert')
}

buildCatalog().catch(e => console.error('FATAL:', e.message))
