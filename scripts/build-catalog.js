import axios from 'axios'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { loadCache, saveCache, getCached, setCache, printCacheStats } from './cacheManager.js'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const OUTPUT_FILE = path.join(__dirname, '../src/data/songCatalog.json')

const CLIENT_ID = process.env.SPOTIFY_CLIENT_ID
const CLIENT_SECRET = process.env.SPOTIFY_CLIENT_SECRET

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// ══════════════════════════════════════════════════════════
//  HARDCODED JAPANESE ARTIST LIST (200+ artists)
//  These are searched directly on Deezer with Japanese names
// ══════════════════════════════════════════════════════════
const JP_ARTISTS = [
  // ── 男性ソロ ──
  '米津玄師', '星野源', '藤井風', '優里', 'Vaundy', '菅田将暉', '福山雅治',
  '桑田佳祐', '尾崎豊', '玉置浩二', '槇原敬之', '平井堅', '秦基博',
  '森山直太朗', '三浦大知', '清水翔太', '山崎まさよし', 'スガシカオ',
  '久保田利伸', '小田和正', '布施明', '井上陽水', '長渕剛', '矢沢永吉',
  '浜田省吾', '吉田拓郎', '松山千春', '中島みゆき', '竹原ピストル',
  'ASKA', '德永英明', '氷室京介', '吉川晃司', '西川貴教',
  'GACKT', 'HYDE', 'Taka', '川崎鷹也', '瑛人',
  'imase', 'tuki.', 'キタニタツヤ', 'ano', '藤原聡',
  '大石昌良', 'TK from 凛として時雨', '澤野弘之',

  // ── 女性ソロ ──
  '宇多田ヒカル', 'あいみょん', 'Ado', 'MISIA', 'Aimer', 'LiSA', 'milet',
  '浜崎あゆみ', '安室奈美恵', '倉木麻衣', '中島美嘉', '西野カナ',
  '大塚愛', 'YUI', '家入レオ', '加藤ミリヤ', '絢香', 'AI', 'JUJU',
  'Superfly', '椎名林檎', 'aiko', '松任谷由実', '竹内まりや',
  '広瀬香美', '持田香織', '鬼束ちひろ', 'BoA', '倖田來未',
  'miwa', 'May J.', '新妻聖子', '島谷ひとみ', '柴咲コウ',
  '上白石萌音', '上白石萌歌', 'いきものがかり', 'yama',
  'Uru', '美波', '幾田りら', 'YUKI', '矢野顕子',
  '中森明菜', '松田聖子', '工藤静香', '華原朋美',

  // ── バンド・グループ ──
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

  // ── アイドル ──
  '嵐', 'SMAP', 'KAT-TUN', 'Hey! Say! JUMP',
  'SixTONES', 'Snow Man', 'King & Prince', 'なにわ男子',
  'NEWS', '関ジャニ∞', 'V6', 'TOKIO', 'Kinki Kids',
  '乃木坂46', '日向坂46', '櫻坂46', 'AKB48',
  'モーニング娘。', 'ハロー!プロジェクト',
  'Perfume', 'きゃりーぱみゅぱみゅ', 'E-girls',
  'ももいろクローバーZ', 'NiziU', 'BE:FIRST', 'JO1',
  '新しい学校のリーダーズ', 'BABYMETAL',

  // ── ダンス&ヒップホップ ──
  'EXILE', '三代目 J SOUL BROTHERS', 'GENERATIONS',
  'THE RAMPAGE', 'DA PUMP', 'w-inds.', 'Lead',
  'ZORN', '舐達麻', 'BAD HOP', 'JP THE WAVY',
  'Awich', 'CHICO CARLITO', 'Moment Joon',
  'KOHH', 'SKY-HI', 'Novel Core',

  // ── ボカロP ──
  'DECO*27', 'wowaka', '40mP', 'じん', 'ピノキオピー',
  'Ayase', 'syudou', 'Kanaria', 'ナユタン星人',
  'MARETU', 'Mitchie M', 'kemu', 'ryo', 'doriko',
  'DYES IWASAKI', 'Chinozo', 'Neru', 'n-buna',
  'sasakure.UK', 'cosMo@暴走P', 'livetune',

  // ── アニソン・ゲーム ──
  '水樹奈々', '林原めぐみ', '坂本真綾', '田村ゆかり',
  '花澤香菜', '鈴木このみ', 'fhána', 'ClariS',
  'Kalafina', '藍井エイル', 'ReoNa', 'ASCA',
  'TrySail', 'スフィア', 'μ\'s', 'Aqours',
  'Liella!', 'Roselia', 'Morfonica',
  '久石譲', '梶浦由記', '菅野よう子',

  // ── シティポップ・レトロ ──
  '山下達郎', '大貫妙子', '吉田美奈子', '荒井由実',
  '杏里', '角松敏生', '大橋純子', 'ブレッド&バター',
  'EPO', 'シュガー・ベイブ', '稲垣潤一',

  // ── 演歌・民謡 ──
  '美空ひばり', '北島三郎', '石川さゆり', '天童よしみ',
  '氷川きよし', '坂本冬美', '藤あや子', '島津亜矢',
  '三山ひろし', '山内惠介',
]

// ══════════════════════════════════════════════════════════
//  English → Japanese name map (for artists Spotify returns in English)
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
  'Kazuyoshi Saito': '斉藤和義', 'Masayoshi Yamazaki': '山崎まさよし',
  'Tatsuro Yamashita': '山下達郎', 'Yutaka Ozaki': '尾崎豊',
  'Mariya Takeuchi': '竹内まりや', 'Anri': '杏里',
  'Toshinobu Kubota': '久保田利伸', 'Nana Mizuki': '水樹奈々',
  'Namie Amuro': '安室奈美恵', 'Mai Kuraki': '倉木麻衣',
  'Ai Otsuka': '大塚愛', 'Kumi Koda': '倖田來未',
  'Akina Nakamori': '中森明菜', 'Seiko Matsuda': '松田聖子',
  'Momoe Yamaguchi': '山口百恵', 'Miyuki Nakajima': '中島みゆき',
  'Yosui Inoue': '井上陽水', 'Takuro Yoshida': '吉田拓郎',
  'Eikichi Yazawa': '矢沢永吉', 'Shogo Hamada': '浜田省吾',
  'Kazumasa Oda': '小田和正', 'Tokunaga Hideaki': '德永英明',
  'Arashi': '嵐', 'Hirai Ken': '平井堅', 'Joe Hisaishi': '久石譲',
  'Yuki Kajiura': '梶浦由記', 'Yoko Kanno': '菅野よう子',
  'Taeko Ohnuki': '大貫妙子', 'Minako Yoshida': '吉田美奈子',
  'Misora Hibari': '美空ひばり', 'Sayuri Ishikawa': '石川さゆり',
  'Kiyoshi Hikawa': '氷川きよし',
  'Suchmos': 'Suchmos', 'Sekai No Owari': 'SEKAI NO OWARI',
  'Amazarashi': 'amazarashi', 'Yorushika': 'ヨルシカ',
}

// ══════════════════════════════════════════════════════════
//  UTILITIES
// ══════════════════════════════════════════════════════════

async function deezerGet(url, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const res = await axios.get(url)
      return res.data
    } catch (e) {
      if (i === retries - 1) return null
      await sleep(1000)
    }
  }
  return null
}

async function spotifyGet(url, token) {
  try {
    const res = await axios.get(url, { headers: { 'Authorization': `Bearer ${token}` } })
    return res.data
  } catch (_) {
    return null
  }
}

async function getSpotifyToken() {
  const auth = Buffer.from(`${CLIENT_ID}:${CLIENT_SECRET}`).toString('base64')
  const res = await axios.post('https://accounts.spotify.com/api/token',
    'grant_type=client_credentials',
    { headers: { 'Authorization': `Basic ${auth}`, 'Content-Type': 'application/x-www-form-urlencoded' } }
  )
  return res.data.access_token
}

function resolveJapaneseName(name) {
  return NAME_MAP[name] || name
}

// ── Reading (ひらがな) map for 50-on sort ──
const READING_MAP = {
  '米津玄師':'よねづけんし','星野源':'ほしのげん','藤井風':'ふじいかぜ','優里':'ゆうり',
  '菅田将暉':'すだまさき','福山雅治':'ふくやままさはる','桑田佳祐':'くわたけいすけ',
  '尾崎豊':'おざきゆたか','玉置浩二':'たまきこうじ','槇原敬之':'まきはらのりゆき',
  '平井堅':'ひらいけん','秦基博':'はたもとひろ','森山直太朗':'もりやまなおたろう',
  '三浦大知':'みうらだいち','清水翔太':'しみずしょうた','山崎まさよし':'やまざきまさよし',
  '久保田利伸':'くぼたとしのぶ','小田和正':'おだかずまさ','布施明':'ふせあきら',
  '井上陽水':'いのうえようすい','長渕剛':'ながぶちつよし','矢沢永吉':'やざわえいきち',
  '浜田省吾':'はまだしょうご','吉田拓郎':'よしだたくろう','松山千春':'まつやまちはる',
  '中島みゆき':'なかじまみゆき','竹原ピストル':'たけはらぴすとる','德永英明':'とくながひであき',
  '氷室京介':'ひむろきょうすけ','吉川晃司':'よしかわこうじ','西川貴教':'にしかわたかのり',
  '川崎鷹也':'かわさきたかや','瑛人':'えいと','藤原聡':'ふじわらさとし',
  '大石昌良':'おおいしまさよし','澤野弘之':'さわのひろゆき',
  '宇多田ヒカル':'うただひかる','浜崎あゆみ':'はまさきあゆみ','安室奈美恵':'あむろなみえ',
  '倉木麻衣':'くらきまい','中島美嘉':'なかしまみか','西野カナ':'にしのかな',
  '大塚愛':'おおつかあい','家入レオ':'いえいりれお','加藤ミリヤ':'かとうみりや',
  '絢香':'あやか','椎名林檎':'しいなりんご','松任谷由実':'まつとうやゆみ',
  '竹内まりや':'たけうちまりや','広瀬香美':'ひろせこうみ','持田香織':'もちだかおり',
  '鬼束ちひろ':'おにつかちひろ','倖田來未':'こうだくみ','新妻聖子':'にいづませいこ',
  '島谷ひとみ':'しまたにひとみ','柴咲コウ':'しばさきこう','上白石萌音':'かみしらいしもね',
  '上白石萌歌':'かみしらいしもか','美波':'みなみ','幾田りら':'いくたりら',
  '矢野顕子':'やのあきこ','中森明菜':'なかもりあきな','松田聖子':'まつだせいこ',
  '工藤静香':'くどうしずか','華原朋美':'かはらともみ','嵐':'あらし',
  '緑黄色社会':'りょくおうしょくしゃかい','東京事変':'とうきょうじへん',
  '凛として時雨':'りんとしてしぐれ','相対性理論':'そうたいせいりろん',
  '女王蜂':'じょおうばち','関ジャニ∞':'かんじゃにえいと','なにわ男子':'なにわだんし',
  '乃木坂46':'のぎざかふぉーてぃしっくす','日向坂46':'ひなたざかふぉーてぃしっくす',
  '櫻坂46':'さくらざかふぉーてぃしっくす','舐達麻':'なめだるま',
  '水樹奈々':'みずきなな','林原めぐみ':'はやしばらめぐみ','坂本真綾':'さかもとまあや',
  '田村ゆかり':'たむらゆかり','花澤香菜':'はなざわかな','鈴木このみ':'すずきこのみ',
  '藍井エイル':'あおいえいる','久石譲':'ひさいしじょう','梶浦由記':'かじうらゆき',
  '菅野よう子':'かんのようこ','山下達郎':'やましたたつろう','大貫妙子':'おおぬきたえこ',
  '吉田美奈子':'よしだみなこ','荒井由実':'あらいゆみ','杏里':'あんり',
  '角松敏生':'かどまつとしき','大橋純子':'おおはしじゅんこ','稲垣潤一':'いながきじゅんいち',
  '美空ひばり':'みそらひばり','北島三郎':'きたじまさぶろう','石川さゆり':'いしかわさゆり',
  '天童よしみ':'てんどうよしみ','氷川きよし':'ひかわきよし','坂本冬美':'さかもとふゆみ',
  '藤あや子':'ふじあやこ','島津亜矢':'しまづあや','三山ひろし':'みやまひろし',
  '山内惠介':'やまうちけいすけ','三代目 J SOUL BROTHERS':'さんだいめじぇいそうるぶらざーず',
  'μ\'s':'みゅーず',
}

function katakanaToHiragana(str) {
  return str.replace(/[\u30A1-\u30F6]/g, ch => String.fromCharCode(ch.charCodeAt(0) - 0x60))
}

function generateReading(name) {
  if (READING_MAP[name]) return READING_MAP[name]
  if (/^[A-Za-z0-9]/.test(name)) return name
  // Try katakana→hiragana auto
  const converted = katakanaToHiragana(name)
  if (converted !== name) return converted.toLowerCase()
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
//  MAIN
// ══════════════════════════════════════════════════════════
async function buildCatalog() {
  const startTime = Date.now()
  console.log('=== Covery Catalog Builder v3 (Deezer-primary) ===\n')
  loadCache()

  const catalog = loadExisting()
  const existingNames = new Set(catalog.artists.map(a => a.name.toLowerCase()))
  console.log(`Loaded existing catalog: ${catalog.artists.length} artists\n`)

  // Get Spotify token for artist images
  let spotifyToken = null
  if (CLIENT_ID && CLIENT_SECRET) {
    spotifyToken = await getSpotifyToken()
    console.log('✓ Spotify token acquired (for images)\n')
  }

  // ════════════════════════════════════════
  //  Process each artist from the hardcoded list
  // ════════════════════════════════════════
  console.log(`── Processing ${JP_ARTISTS.length} Japanese artists ──\n`)

  let added = 0
  let skipped = 0

  for (let i = 0; i < JP_ARTISTS.length; i++) {
    const artistName = JP_ARTISTS[i]

    // Skip if already in catalog
    if (existingNames.has(artistName.toLowerCase())) {
      skipped++
      continue
    }

    // ── Step 1: Search Deezer for tracks (cached) ──
    let tracks
    const deezerCacheKey = `deezer_search_${artistName}`
    const cachedDeezer = getCached('deezerTracks', deezerCacheKey)
    if (cachedDeezer) {
      tracks = cachedDeezer
    } else {
      const searchData = await deezerGet(
        `https://api.deezer.com/search?q=${encodeURIComponent(artistName)}&limit=10`
      )
      tracks = searchData?.data || []
      setCache('deezerTracks', deezerCacheKey, tracks)
      await sleep(200)
    }
    if (tracks.length === 0) {
      console.log(`  ✗ No tracks found: ${artistName}`)
      continue
    }

    // Verify tracks actually belong to this artist (Deezer can return loose matches)
    const artistTracks = tracks.filter(t => {
      const tn = t.artist?.name?.toLowerCase() || ''
      const an = artistName.toLowerCase()
      // Match if artist name contains search name or vice versa (handles partial matches)
      return tn.includes(an) || an.includes(tn) ||
        resolveJapaneseName(t.artist?.name)?.toLowerCase() === an
    })

    // If strict match found none, use all tracks but check at least first result
    const useTracks = artistTracks.length > 0 ? artistTracks : tracks.slice(0, 5)

    // Deduplicate by title
    const seenTitles = new Set()
    const uniqueTracks = []
    for (const t of useTracks) {
      const title = t.title?.replace(/\s*\(.*?\)\s*/g, '').trim()
      if (!seenTitles.has(title?.toLowerCase())) {
        seenTitles.add(title?.toLowerCase())
        uniqueTracks.push(t)
      }
    }

    if (uniqueTracks.length === 0) {
      console.log(`  ✗ No matching tracks: ${artistName}`)
      continue
    }

    // ── Step 2: Get Spotify image (cached) ──
    let imageUrl = ''
    const cachedSpotify = getCached('spotifyArtists', artistName)
    if (cachedSpotify) {
      imageUrl = cachedSpotify.imageUrl || ''
    } else if (spotifyToken) {
      const spData = await spotifyGet(
        `https://api.spotify.com/v1/search?q=${encodeURIComponent(artistName)}&type=artist&market=JP&limit=1`,
        spotifyToken
      )
      imageUrl = spData?.artists?.items?.[0]?.images?.[0]?.url || ''
      setCache('spotifyArtists', artistName, { imageUrl, spotifyId: spData?.artists?.items?.[0]?.id || '' })
      await sleep(200)
    }

    // ── Step 3: Build entry ──
    const entry = {
      name: artistName,
      reading: generateReading(artistName),
      spotifyId: '',
      imageUrl,
      songs: uniqueTracks.map(t => ({
        title: t.title,
        deezerRank: t.rank || 0
      }))
    }

    catalog.artists.push(entry)
    existingNames.add(artistName.toLowerCase())
    added++

    // Progress log
    if (added % 10 === 0) {
      saveCatalog(catalog)
      const pct = ((i / JP_ARTISTS.length) * 100).toFixed(0)
      console.log(`  💾 ${pct}% — ${catalog.artists.length} artists (+${added} new)`)
    }
  }

  // ════════════════════════════════════════
  //  Final save
  // ════════════════════════════════════════
  saveCatalog(catalog)
  saveCache()

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  let totalSongs = 0, jpCount = 0, enCount = 0
  catalog.artists.forEach(a => {
    totalSongs += a.songs.length
    if (/[\u3000-\u9FFF\uF900-\uFAFF]/.test(a.name)) jpCount++; else enCount++
  })

  console.log(`\n=== Catalog Build Complete ===`)
  console.log(`Total Artists: ${catalog.artists.length} (+${added} new, ${skipped} skipped)`)
  console.log(`Total Songs: ${totalSongs}`)
  console.log(`Japanese names: ${jpCount} / English names: ${enCount}`)
  console.log(`Time: ${elapsed}s`)
  printCacheStats()
}

buildCatalog().catch(e => console.error('FATAL:', e.message))
