import axios from 'axios'
import dotenv from 'dotenv'
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { loadCache, saveCache, getCached, setCache, printCacheStats } from './cacheManager.js'
import db from './db.js'

dotenv.config()

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)
const OUTPUT_FILE = path.join(__dirname, '../src/data/songCatalog.json')

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms))

// ══════════════════════════════════════════════════════════
//  TIME LIMIT (default 5 minutes, override with TIME_LIMIT_MINUTES env)
// ══════════════════════════════════════════════════════════
const TIME_LIMIT_MS = (parseInt(process.env.TIME_LIMIT_MINUTES || '5', 10)) * 60 * 1000
let BUILD_START_TIME = 0

function isTimeUp() {
  return (Date.now() - BUILD_START_TIME) >= TIME_LIMIT_MS
}

function elapsedStr() {
  const s = Math.floor((Date.now() - BUILD_START_TIME) / 1000)
  const m = Math.floor(s / 60)
  const sec = s % 60
  const limitMin = Math.floor(TIME_LIMIT_MS / 60000)
  return `${m}:${String(sec).padStart(2, '0')} / ${limitMin}:00`
}

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

  // ── カタログ拡充 2026-04 ──
  'ハチ', 'DOVA-SYNDROME', '蝶々P', 'Last Note.', '150P',
  'Orangestar', '稲葉曇', 'Tani Yuuki', 'なとり',
  '鈴木雅之', 'SawanoHiroyuki[nZk]', 'nano', '鬼頭明里',
  '内田真礼', '水瀬いのり', '早見沙織', 'fripSide', 'TRUE',
  'MYTH & ROID', 'PENGUIN RESEARCH',
  '山口百恵', 'テレサテン', '大滝詠一', 'BOØWY', '奥田民生', '一青窈',
  'BTS', 'BLACKPINK', 'TWICE', 'IU', 'SEVENTEEN',
  'Stray Kids', 'aespa', 'NewJeans', 'LE SSERAFIM', 'IVE',
  '神はサイコロを振らない', 'INI',
  'JUDY AND MARY', 'スキマスイッチ',
  '清塚信也', 'リーガルリリー', '秋山黄色', 'くるり', 'THE BACK HORN',
  'the band apart', 'ストレイテナー', 'MONOEYES',
  'Travis Japan', 'WEST.', 'Aぇ! group', 'timelesz', 'Number_i', '少年隊',
  'HKT48', 'NGT48', 'NMB48', 'SKE48', 'STU48',
  '=LOVE', '≠ME', 'FRUITS ZIPPER',
  'オレンジスパイニクラブ', 'ヒグチアイ', '菅原圭', 'SHE\'S',
  'tofubeats', 'PUNPEE', 'Daichi Yamamoto',
  'ロクデナシ', 'MAZZEL', 'MY LITTLE LOVER', 'マルシィ', 'Omoinotake',
  'The Songbards', '水曜日のカンパネラ', 'あたらよ', '羊文学',
  'yonawo', 'Tempalay',
  'Eve', 'まふまふ', '天月-あまつき-', 'そらる', '浦島坂田船',
  'luz', '蒼井翔太',
  'カンザキイオリ', 'ぬゆり', 'ちゃんみな', 'はるまきごはん', 'TOOBOE',
  'やなぎなぎ', '花譜', '理芽',
  'a flood of circle', 'ROTTENGRAFFTY', 'eastern youth',
  'go!go!vanillas', 'CHAI', 'PEOPLE 1', '夜の本気ダンス',
  'クラムボン', 'Schroeder-Headz',
  'EXO', 'Red Velvet', 'SHINee', 'MAMAMOO', 'TXT', 'ATEEZ',
  'ENHYPEN', 'ITZY', '(G)I-DLE', 'NMIXX',
  'GRANRODEO', 'angela', 'JAM Project', 'supercell',
  'KOTOKO', 'Do As Infinity', 'Burnout Syndromes', 'OxT',
  '五木ひろし', '細川たかし', '八代亜紀', '都はるみ',
  'CHAGE and ASKA', 'THE ALFEE', 'さだまさし', 'RCサクセション',
  '電気グルーヴ', 'REBECCA', 'プリンセス プリンセス',
  'T-SQUARE', 'DEPAPEPE', '押尾コータロー',
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
//  GENRE MAP (with katakana support + soundtrack exclusion)
// ══════════════════════════════════════════════════════════
const GENRE_MAP = {
  'j-pop': 'J-POP', 'pop': 'J-POP',
  'j-rock': '邦ロック', 'rock': '邦ロック', 'ロック': '邦ロック',
  'alternative': 'オルタナティブ',
  'anime': 'アニソン', 'アニメ': 'アニソン',
  'rap/hip hop': 'ヒップホップ', 'hip hop': 'ヒップホップ', 'ヒップホップ': 'ヒップホップ',
  'r&b': 'R&B', 'electro': 'エレクトロ',
  'metal': 'メタル', 'メタル': 'メタル',
  'jazz': 'ジャズ', 'classical': 'クラシック', 'reggae': 'レゲエ', 'folk': 'フォーク',
  'asian music': 'J-POP', 'アジア': 'J-POP', 'ポップ': 'J-POP',
  'korean pop': 'K-POP', 'k-pop': 'K-POP',
  'films/games': 'サウンドトラック', 'soundtrack': 'サウンドトラック', '映画': 'サウンドトラック',
  'kids': 'キッズ', 'dance': 'ダンス',
  'soul & funk': 'ソウル', 'soul': 'ソウル', 'blues': 'ブルース',
  'enka': '演歌', '演歌': '演歌',
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
  if (/[\u3040-\u309F\u30A0-\u30FF\u4E00-\u9FFF]/.test(artist.name || '')) return true
  return false
}

// ══════════════════════════════════════════════════════════
//  Deezer helpers (all cached, 200ms politeness delay)
// ══════════════════════════════════════════════════════════

async function deezerJSON(url) {
  const data = await deezerGet(url)
  await sleep(200)
  return data
}

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

// Paginated album fetch
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
      // Also cache under legacy key for offset=0
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

// Multi-album genre resolution (skip soundtracks)
async function deezerResolveGenre(deezerId, albums) {
  const candidates = [...(albums || [])]
    .filter(a => a.release_date && (a.record_type === 'album' || a.record_type === 'ep'))
    .sort((a, b) => (b.release_date || '').localeCompare(a.release_date || ''))
    .slice(0, 3)

  if (candidates.length === 0 && albums?.length > 0) {
    candidates.push(albums[0]) // fallback to any album
  }

  const genreCounts = {}
  for (const alb of candidates) {
    const detail = await deezerGetAlbumDetail(alb.id)
    const genres = detail?.genres?.data || []
    for (const g of genres) {
      const mapped = mapGenre(g.name)
      if (!SOUNDTRACK_GENRES.has(mapped)) {
        genreCounts[mapped] = (genreCounts[mapped] || 0) + 1
      }
    }
  }

  const sorted = Object.entries(genreCounts).sort((a, b) => b[1] - a[1])
  return sorted.length > 0 ? sorted[0][0] : 'J-POP'
}

// ══════════════════════════════════════════════════════════
//  MAIN (Deezer-only snowball with time limit)
// ══════════════════════════════════════════════════════════
async function buildCatalog() {
  BUILD_START_TIME = Date.now()
  const limitMin = Math.floor(TIME_LIMIT_MS / 60000)
  console.log(`=== Covery Catalog Builder v6 (time-limited snowball) ===`)
  console.log(`[制限時間] ${limitMin}分\n`)
  loadCache()

  const catalog = loadExisting()
  const byName = new Map(catalog.artists.map(a => [a.name.toLowerCase(), a]))
  console.log(`既存カタログ: ${catalog.artists.length}アーティスト\n`)

  const seedNames = new Set(JP_ARTISTS)
  const queue = []
  const seenIds = new Set()
  const processed = new Set()

  // ── Seed queue via Deezer search ──
  console.log(`── Deezer検索で ${JP_ARTISTS.length} 件の初期アーティストを解決 ──`)
  for (const name of JP_ARTISTS) {
    if (isTimeUp()) break
    const hit = await deezerSearchArtist(name)
    if (hit && !seenIds.has(hit.id)) {
      queue.push({ deezerId: hit.id, displayName: name })
      seenIds.add(hit.id)
    }
  }
  console.log(`  → キュー開始: ${queue.length}件 [経過: ${elapsedStr()}]\n`)

  const MAX_ARTISTS = 5000
  let processedCount = 0
  let newArtists = 0
  let newSongs = 0
  let updatedMeta = 0

  while (queue.length > 0 && processedCount < MAX_ARTISTS) {
    // ── Time check ──
    if (isTimeUp()) {
      console.log(`\n[時間切れ] ${elapsedStr()} Phase 1打ち切り`)
      break
    }

    const { deezerId, displayName } = queue.shift()
    if (processed.has(deezerId)) continue
    processed.add(deezerId)

    // Step 1: artist detail
    const detail = await deezerGetArtistById(deezerId)
    if (!detail || !detail.id) continue

    const rawName = detail.name
    const name = seedNames.has(displayName)
      ? displayName
      : (resolveJapaneseName(rawName) || rawName)

    if (!isJapaneseArtist({ name }, seedNames) && !seedNames.has(displayName)) {
      continue
    }

    const imageUrl = detail.picture_xl || detail.picture_big || detail.picture_medium || detail.picture || ''
    const reading = generateReading(name)

    // Step 2+3: albums + tracks (paginated)
    const albums = await deezerGetAllAlbums(deezerId)
    const existingTitles = new Set((byName.get(name.toLowerCase())?.songs || []).map(s => s.title.toLowerCase()))

    let addedHere = 0
    let tracksFetched = 0
    for (const album of albums) {
      if (isTimeUp()) break
      const tracks = await deezerGetAlbumTracks(album.id)
      tracksFetched += tracks.length
      for (const t of tracks) {
        const title = (t.title || '').trim()
        if (!title) continue
        const lower = title.toLowerCase()
        if (existingTitles.has(lower)) continue
        existingTitles.add(lower)
        addedHere++
      }
    }

    // Step 4: genre (multi-album, skip soundtracks)
    const genre = await deezerResolveGenre(deezerId, albums)

    console.log(`[${processedCount + 1}] ${name} | アルバム${albums.length}枚 → ${tracksFetched}曲 (新規${addedHere}) | 画像:${imageUrl ? 'あり' : 'なし'} | ${genre} [${elapsedStr()}]`)

    // Upsert into in-memory catalog
    let entry = byName.get(name.toLowerCase())
    if (!entry) {
      entry = { name, reading, deezerId, imageUrl, genre, songs: [] }
      catalog.artists.push(entry)
      byName.set(name.toLowerCase(), entry)
      newArtists++
    } else {
      if (!entry.imageUrl && imageUrl) entry.imageUrl = imageUrl
      if (imageUrl) entry.imageUrl = imageUrl // always update to latest
      if (!entry.genre || entry.genre === 'J-POP') entry.genre = genre
      if (!entry.deezerId) entry.deezerId = deezerId
      updatedMeta++
    }

    // Re-add songs (use existing entry's songs as base)
    const entrySongTitles = new Set((entry.songs || []).map(s => s.title.toLowerCase()))
    for (const album of albums) {
      const tracks = await deezerGetAlbumTracks(album.id) // cached
      for (const t of tracks) {
        const title = (t.title || '').trim()
        if (!title) continue
        if (entrySongTitles.has(title.toLowerCase())) continue
        entrySongTitles.add(title.toLowerCase())
        entry.songs.push({ title, deezerRank: t.rank || 0, genre })
      }
    }
    newSongs += addedHere

    // Step 5: related artists
    const related = await deezerGetRelatedArtists(deezerId)
    let queuedRelated = 0
    for (const r of related) {
      if (seenIds.has(r.id)) continue
      if (!isJapaneseArtist({ name: r.name }, seedNames)) continue
      seenIds.add(r.id)
      queue.push({ deezerId: r.id, displayName: resolveJapaneseName(r.name) || r.name })
      queuedRelated++
    }
    if (queuedRelated > 0) console.log(`  → 関連${related.length}組 (日本語${queuedRelated}組キュー追加)`)

    processedCount++

    // Intermediate save every 100 artists
    if (processedCount % 100 === 0) {
      saveCatalog(catalog)
      saveCache()
      console.log(`  [中間保存] ${processedCount}組完了`)
    }
  }

  // ── Phase 1 complete: save JSON ──
  saveCatalog(catalog)
  saveCache()

  const totalSongs = catalog.artists.reduce((n, a) => n + (a.songs?.length || 0), 0)
  console.log(`\n=== Phase 1 完了 [${elapsedStr()}] ===`)
  console.log(`処理: ${processedCount}組 | 新規アーティスト: ${newArtists} | メタ更新: ${updatedMeta}`)
  console.log(`新規曲: ${newSongs} | 合計: ${catalog.artists.length}アーティスト / ${totalSongs}曲`)
  printCacheStats()

  // ── Phase 2: D1一括投入 ──
  if (!db.isAvailable()) {
    console.log('\n[D1] skipped (wrangler not available or COVERY_SKIP_D1=1)')
    return
  }
  console.log(`\n=== Phase 2: D1一括投入 ===`)
  syncToD1ViaFile(catalog)
  const finalElapsed = ((Date.now() - BUILD_START_TIME) / 1000).toFixed(1)
  console.log(`=== 完了 (総処理時間: ${finalElapsed}s) ===`)
}

function syncToD1ViaFile(catalog) {
  const esc = db.escape

  const artistStmts = catalog.artists.map(a =>
    `INSERT OR IGNORE INTO artists (name, reading, spotify_id, image_url, genre) VALUES ('${esc(a.name)}', '${esc(a.reading || '')}', '${esc(a.spotifyId || '')}', '${esc(a.imageUrl || '')}', '${esc(a.genre || '')}')`
  )
  const metaStmts = catalog.artists
    .filter(a => a.imageUrl || a.genre)
    .map(a =>
      `UPDATE artists SET image_url = CASE WHEN IFNULL(image_url,'')='' THEN '${esc(a.imageUrl || '')}' ELSE image_url END, genre = CASE WHEN IFNULL(genre,'')='' THEN '${esc(a.genre || '')}' ELSE genre END WHERE name = '${esc(a.name)}'`
    )

  const songStmts = []
  for (const a of catalog.artists) {
    for (const s of (a.songs || [])) {
      songStmts.push(
        `INSERT OR IGNORE INTO songs (title, artist_id, deezer_rank, genre) VALUES ('${esc(s.title)}', (SELECT id FROM artists WHERE name = '${esc(a.name)}'), ${s.deezerRank || 0}, '${esc(s.genre || a.genre || '')}')`
      )
    }
  }

  console.log(`[D1] Artists: ${artistStmts.length} INSERT + ${metaStmts.length} UPDATE`)
  console.log(`[D1] Songs: ${songStmts.length} INSERT`)

  db.batchExecute(artistStmts, 'artists-insert')
  if (metaStmts.length > 0) db.batchExecute(metaStmts, 'artists-meta')
  db.batchExecute(songStmts, 'songs-insert')
}

buildCatalog().catch(e => console.error('FATAL:', e.message))
