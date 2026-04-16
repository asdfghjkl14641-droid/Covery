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

  // ══════════════════════════════════════════════════════════
  //  カタログ拡充 2026-04 (既存名と重複する場合は自動スキップ)
  // ══════════════════════════════════════════════════════════

  // ── 追加ボカロP ──
  'ハチ', 'DOVA-SYNDROME', '蝶々P', 'Last Note.', '150P',
  'Orangestar', '稲葉曇', 'Tani Yuuki', 'なとり',

  // ── 追加アニソン/声優系 ──
  '鈴木雅之', 'SawanoHiroyuki[nZk]', 'nano', '鬼頭明里',
  '内田真礼', '水瀬いのり', '早見沙織', 'fripSide', 'TRUE',
  'MYTH & ROID', 'PENGUIN RESEARCH',

  // ── 昭和〜平成ヒットメーカー追加 ──
  '山口百恵', 'テレサテン', '大滝詠一', 'BOØWY',
  '奥田民生', '一青窈',

  // ── K-POP (日本でカバーされやすい) ──
  'BTS', 'BLACKPINK', 'TWICE', 'IU', 'SEVENTEEN',
  'Stray Kids', 'aespa', 'NewJeans', 'LE SSERAFIM', 'IVE',

  // ── 最近の人気アーティスト ──
  '神はサイコロを振らない', 'INI',

  // ── 追加バンド/J-POP (カバー定番) ──
  'FUNKY MONKEY BABYS', 'Aqua Timez', 'flumpool',
  'ポルノグラフィティ', 'JUDY AND MARY',
  'スキマスイッチ', 'いきものがかり', 'GLAY',

  // ── シンガーソングライター・城南海系 ──
  '清塚信也', 'リーガルリリー', 'Saucy Dog',
  '秋山黄色', 'くるり', 'THE BACK HORN',
  'the band apart', 'ストレイテナー', 'MONOEYES',
  '04 Limited Sazabys',

  // ── 追加アイドル/男性グループ ──
  'なにわ男子', 'Travis Japan', 'WEST.', 'Aぇ! group',
  'timelesz', 'Number_i', '少年隊',

  // ── 追加女性アイドル/グループ ──
  'HKT48', 'NGT48', 'NMB48', 'SKE48', 'STU48',
  'ラストアイドル', '=LOVE', '≠ME', 'FRUITS ZIPPER',

  // ── 歌い手文化で人気のJ-POPバンド ──
  'セカオワ', 'オレンジスパイニクラブ', 'THE IDOLM@STER',
  'UNISON SQUARE GARDEN', 'ヒグチアイ', '菅原圭',
  'みゆはん', 'SHE\'S', 'vaundy',

  // ── トラップ・ラップ ──
  'BAD HOP', 'Anarchy', 'SIMI LAB',
  'tofubeats', 'PUNPEE', 'Daichi Yamamoto',

  // ── 最新世代 (2023-2025) ──
  'ロクデナシ', 'Kaneee', 'MAZZEL', 'MY LITTLE LOVER',
  'マルシィ', 'Omoinotake', '緑黄色社会', 'The Songbards',
  'indigo la End', '水曜日のカンパネラ', 'imase',
  'あたらよ', '羊文学', 'Ryokuoushoku Shakai',
  '秋茜', 'yonawo', 'Tempalay',

  // ══════════════════════════════════════════════════════════
  //  追加拡充 2026-04 バッチ2 (500+ / 5000+ songs目標)
  // ══════════════════════════════════════════════════════════

  // ── J-POP ソロ・シンガー ──
  'back number', '山下智久', '錦戸亮', '赤西仁', '亀梨和也',
  '手越祐也', 'ジェジュン', 'ユナク', '平野紫耀',
  '中島健人', '山田涼介', 'KAT-TUN', '北山宏光',
  'KinKi Kids', '堂本光一', '堂本剛', '近藤真彦',
  'ChayU', '井口裕香', '東山奈央', '佐倉綾音',
  '日笠陽子', '小倉唯', '石原夏織', '田中美海',
  '豊崎愛生', '戸松遥', '寿美菜子', '竹達彩奈',
  '悠木碧', '種田梨沙', '雨宮天', '伊藤美来',
  'Machico', '上坂すみれ',

  // ── 歌い手出身アーティスト ──
  'Eve', 'まふまふ', '天月-あまつき-', 'そらる', '浦島坂田船',
  'ぴょん吉', 'りぶ', 'Gero', 'un:c', 'いとくとら',
  'あらき', 'りぶろ', '灯油', 'ぐるたみん', 'ASK',
  'Kradness', 'clear', 'アユニ・D', 'しゆん', '島爺',
  'Will Stetson', 'kradness', 'luz', '奏音69',
  '蒼井翔太', '小林竜之', '蒼井ブルー',

  // ── ネット発アーティスト・ボカロ系 ──
  'カンザキイオリ', 'ぬゆり', 'Iyowa', 'ちゃんみな',
  '浜崎容子', 'GUMI', '巡音ルカ', '鏡音リン・レン',
  'はるまきごはん', '羽累', 'あるいは', 'TOOBOE',
  'R Sound Design', 'やなぎなぎ', 'nqrse',
  '花譜', 'ヰ世界情緒', '理芽', '春猿火',
  '笹川真生', 'amazarashi', 'RAISE A SUILEN',

  // ── インディーズ・ロック・オルタナ ──
  'クリープハイプ', 'andymori', 'UNISON', 'eastern youth',
  'サカナクション', 'シナリオアート', 'go!go!vanillas',
  'SHE\'S', 'lovely summer-chan', 'CHAI',
  'DADARAY', 'PEOPLE 1', 'メメタァ', 'My Hair is Bad',
  'a flood of circle', 'UVERworld', 'ROTTENGRAFFTY',
  '凛として時雨', 'ART-SCHOOL', 'GEZAN',
  'Czecho No Republic', 'LAMP IN TERREN', '夜の本気ダンス',
  'クラムボン', 'toconoma', 'Schroeder-Headz',

  // ── K-POP 追加 ──
  'EXO', 'Red Velvet', 'SHINee', 'Girls\' Generation',
  'MAMAMOO', 'TXT', 'ATEEZ', 'ENHYPEN', 'ITZY',
  '(G)I-DLE', 'Kep1er', 'NMIXX', 'BABYMONSTER',
  'ZEROBASEONE', 'RIIZE', 'ILLIT', 'tripleS',

  // ── アニメソング 追加 ──
  'GRANRODEO', 'angela', 'JAM Project', 'supercell',
  '奥井雅美', '影山ヒロノブ', '串田アキラ', '水木一郎',
  '堀江美都子', '栗林みな実', '小林香織', 'KOTOKO',
  'yuki kajiura', 'eufonius', 'Suara', 'Do As Infinity',
  '菅原紗由理', 'THE SIXTH LIE', 'Bentham', 'OxT',
  'Burnout Syndromes', '妖精帝國', 'Mashumairesh!!',
  'The Sketchbook', 'Wake Up, Girls!',

  // ── 演歌・歌謡曲 追加 ──
  '五木ひろし', '細川たかし', '森進一', '森昌子',
  '西田敏行', '八代亜紀', '都はるみ', '小林旭',
  '北原ミレイ', '前川清', '五代目 三遊亭圓楽',
  '田川寿美', '市川由紀乃', '岩佐美咲', '川中美幸',

  // ── 古典・80s/90sバンド ──
  'CHAGE and ASKA', '爆風スランプ', 'THE ALFEE',
  'チューリップ', 'オフコース', 'アリス', 'かぐや姫',
  'さだまさし', '南こうせつ', '吉田拓郎', 'RCサクセション',
  'BARBEE BOYS', 'バービーボーイズ', 'アンジー',
  '電気グルーヴ', 'ZIGGY', 'REBECCA', 'プリンセス プリンセス',
  'JUN SKY WALKER(S)', 'THE BOOM', 'ウルフルケイスケ',
  'アンジェラ・アキ', '川本真琴',

  // ── インストゥルメンタル・ジャズ・フュージョン ──
  'T-SQUARE', 'CASIOPEA', 'SPACE CRAFT', '日野皓正',
  '渡辺香津美', '向谷実', 'DEPAPEPE', '押尾コータロー',

  // ── 追加女性アーティスト ──
  '絢香', '新山詩織', 'chay', '住岡梨奈', 'Ms.OOJA',
  '秦基博', '清水翔太', 'AAAMYYY', '石崎ひゅーい',
  '塩塚モエカ', 'ヒグチアイ', '原田知世', 'キセル',
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
//  DEEZER-ONLY SNOWBALL BUILDER
// ══════════════════════════════════════════════════════════

// Deezer genre → 日本語カテゴリ (album.genres[].name.toLowerCase() で照合)
const GENRE_MAP = {
  'j-pop': 'J-POP',
  'pop': 'J-POP',
  'j-rock': '邦ロック',
  'rock': '邦ロック',
  'alternative': 'オルタナティブ',
  'anime': 'アニソン',
  'rap/hip hop': 'ヒップホップ',
  'hip hop': 'ヒップホップ',
  'r&b': 'R&B',
  'electro': 'エレクトロ',
  'metal': 'メタル',
  'jazz': 'ジャズ',
  'classical': 'クラシック',
  'reggae': 'レゲエ',
  'folk': 'フォーク',
  'asian music': 'J-POP',
  'korean pop': 'K-POP',
  'k-pop': 'K-POP',
  'films/games': 'サウンドトラック',
  'soundtrack': 'サウンドトラック',
  'kids': 'キッズ',
  'latin music': 'ラテン',
  'african music': 'アフリカ',
  'dance': 'ダンス',
  'soul & funk': 'ソウル',
  'soul': 'ソウル',
  'funk': 'ファンク',
  'blues': 'ブルース',
  'country': 'カントリー',
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

// Japanese artist detection (Deezer has no artist-level genres)
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
  await sleep(100) // Deezer allows 50 req/s; 100ms is safe
  return data
}

async function deezerSearchArtist(name) {
  const cacheKey = `dz_search_${name}`
  const cached = getCached('deezerArtistSearch', cacheKey)
  if (cached) return cached
  const data = await deezerJSON(`https://api.deezer.com/search/artist?q=${encodeURIComponent(name)}&limit=1`)
  const hit = data?.data?.[0] || null
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

async function deezerGetAlbumsByArtist(deezerId) {
  const cacheKey = `dz_albums_${deezerId}`
  const cached = getCached('deezerAlbums', cacheKey)
  if (cached) return cached
  const data = await deezerJSON(`https://api.deezer.com/artist/${deezerId}/albums?limit=100`)
  const albums = data?.data || []
  setCache('deezerAlbums', cacheKey, albums)
  return albums
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

// Derive genre by looking at the artist's first album
async function deezerResolveGenre(deezerId) {
  const albums = await deezerGetAlbumsByArtist(deezerId)
  if (albums.length === 0) return 'J-POP'
  const album = await deezerGetAlbumDetail(albums[0].id)
  const gArr = album?.genres?.data || []
  if (gArr.length === 0) return 'J-POP'
  return mapGenre(gArr[0].name)
}

// ══════════════════════════════════════════════════════════
//  MAIN (Deezer-only snowball)
// ══════════════════════════════════════════════════════════
async function buildCatalog() {
  const startTime = Date.now()
  console.log('=== Covery Catalog Builder v5 (Deezer-only snowball) ===\n')
  loadCache()

  const catalog = loadExisting()
  const byName = new Map(catalog.artists.map(a => [a.name.toLowerCase(), a]))
  console.log(`Loaded existing catalog: ${catalog.artists.length} artists\n`)

  const seedNames = new Set(JP_ARTISTS)
  const queue = []          // [{deezerId, displayName}]
  const seenIds = new Set()
  const processed = new Set()

  // ── Seed queue via Deezer search ──
  console.log(`── Deezer検索で ${JP_ARTISTS.length} 件の初期アーティストを解決 ──`)
  for (const name of JP_ARTISTS) {
    const hit = await deezerSearchArtist(name)
    if (hit && !seenIds.has(hit.id)) {
      queue.push({ deezerId: hit.id, displayName: name })
      seenIds.add(hit.id)
    }
  }
  console.log(`  → キュー開始: ${queue.length}件\n`)

  const MAX_ARTISTS = 5000
  let processedCount = 0
  let newArtists = 0
  let newSongs = 0
  let updatedMeta = 0

  while (queue.length > 0 && processedCount < MAX_ARTISTS) {
    const { deezerId, displayName } = queue.shift()
    if (processed.has(deezerId)) continue
    processed.add(deezerId)

    // Step 1: artist detail
    const detail = await deezerGetArtistById(deezerId)
    if (!detail || !detail.id) continue

    // Display name: prefer seed name if match, else NAME_MAP, else Deezer's
    const rawName = detail.name
    const name = seedNames.has(displayName)
      ? displayName
      : (resolveJapaneseName(rawName) || rawName)

    // Japanese check — skip non-Japanese unless explicitly seeded
    if (!isJapaneseArtist({ name }, seedNames) && !seedNames.has(displayName)) {
      continue
    }

    const imageUrl = detail.picture_xl || detail.picture_big || detail.picture_medium || detail.picture || ''
    const reading = generateReading(name)
    const genre = await deezerResolveGenre(deezerId)

    console.log(`[Deezer] ${name} (画像: ${imageUrl ? 'あり' : 'なし'}, ジャンル: ${genre})`)

    // Upsert into in-memory catalog
    let entry = byName.get(name.toLowerCase())
    if (!entry) {
      entry = { name, reading, deezerId, imageUrl, genre, songs: [] }
      catalog.artists.push(entry)
      byName.set(name.toLowerCase(), entry)
      newArtists++
    } else {
      if (!entry.imageUrl && imageUrl) entry.imageUrl = imageUrl
      if (!entry.genre && genre) entry.genre = genre
      if (!entry.deezerId) entry.deezerId = deezerId
      updatedMeta++
    }

    // Step 2+3: albums + tracks
    const albums = await deezerGetAlbumsByArtist(deezerId)
    const existingTitles = new Set((entry.songs || []).map(s => s.title.toLowerCase()))
    let addedHere = 0
    let tracksFetched = 0
    for (const album of albums) {
      const tracks = await deezerGetAlbumTracks(album.id)
      tracksFetched += tracks.length
      for (const t of tracks) {
        const title = (t.title || '').trim()
        if (!title) continue
        const lower = title.toLowerCase()
        if (existingTitles.has(lower)) continue
        existingTitles.add(lower)
        entry.songs.push({ title, deezerRank: 0, genre })
        addedHere++
      }
    }
    newSongs += addedHere
    console.log(`  [Deezer] アルバム ${albums.length}枚 → ${tracksFetched}曲取得（新規${addedHere}曲）`)

    // Step 4: related artists
    const related = await deezerGetRelatedArtists(deezerId)
    let queuedRelated = 0
    for (const r of related) {
      if (seenIds.has(r.id)) continue
      if (!isJapaneseArtist({ name: r.name }, seedNames)) continue
      seenIds.add(r.id)
      queue.push({ deezerId: r.id, displayName: resolveJapaneseName(r.name) || r.name })
      queuedRelated++
    }
    console.log(`  [Deezer] 関連アーティスト ${related.length}組（うち日本${queuedRelated}組）`)

    processedCount++
    const totalSongs = catalog.artists.reduce((n, a) => n + (a.songs?.length || 0), 0)
    console.log(`  進捗: ${processedCount}組処理済み / キュー残り${queue.length} / 合計${totalSongs}曲\n`)

    // Intermediate JSON save every 100 artists (crash recovery, no D1 mid-loop)
    if (processedCount % 100 === 0) {
      saveCatalog(catalog)
      saveCache()
      console.log('  💾 JSON中間保存完了')
    }

    await sleep(100)
  }

  // ── Phase 1 complete: save JSON ──
  saveCatalog(catalog)
  saveCache()

  const elapsed = ((Date.now() - startTime) / 1000).toFixed(1)
  const totalSongs = catalog.artists.reduce((n, a) => n + (a.songs?.length || 0), 0)
  console.log(`\n=== Phase 1 (Deezer収集) 完了 ===`)
  console.log(`処理アーティスト: ${processedCount}`)
  console.log(`新規アーティスト: ${newArtists} / 既存メタ更新: ${updatedMeta}`)
  console.log(`新規曲: ${newSongs}`)
  console.log(`合計アーティスト: ${catalog.artists.length}`)
  console.log(`合計曲: ${totalSongs}`)
  console.log(`Time: ${elapsed}s`)
  printCacheStats()

  // ── Phase 2: D1に一括投入 (SQL file) ──
  if (!db.isAvailable()) {
    console.log('\n[D1] skipped (wrangler not available or COVERY_SKIP_D1=1)')
    return
  }
  console.log(`\n=== Phase 2: D1一括投入 ===`)
  syncToD1ViaFile(catalog)
  console.log('=== D1投入完了 ===')
}

// Generate a .sql file per batch and execute via wrangler --file (fast)
function syncToD1ViaFile(catalog) {
  const esc = db.escape

  // ── Artists ──
  const artistStmts = catalog.artists.map(a =>
    `INSERT OR IGNORE INTO artists (name, reading, spotify_id, image_url, genre) VALUES ('${esc(a.name)}', '${esc(a.reading || '')}', '${esc(a.spotifyId || '')}', '${esc(a.imageUrl || '')}', '${esc(a.genre || '')}')`
  )
  // Also UPDATE image_url/genre for pre-existing rows where empty
  const metaStmts = catalog.artists
    .filter(a => a.imageUrl || a.genre)
    .map(a =>
      `UPDATE artists SET image_url = CASE WHEN IFNULL(image_url,'')='' THEN '${esc(a.imageUrl || '')}' ELSE image_url END, genre = CASE WHEN IFNULL(genre,'')='' THEN '${esc(a.genre || '')}' ELSE genre END WHERE name = '${esc(a.name)}'`
    )

  // ── Songs ──
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

  // Execute in chunks via batchExecute (writes temp SQL files, 50 stmts per file)
  db.batchExecute(artistStmts, 'artists-insert')
  if (metaStmts.length > 0) db.batchExecute(metaStmts, 'artists-meta')
  db.batchExecute(songStmts, 'songs-insert')
}

buildCatalog().catch(e => console.error('FATAL:', e.message))
