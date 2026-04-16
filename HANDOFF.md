# Covery プロジェクト引き継ぎドキュメント

## プロジェクト概要

**Covery** は YouTube の「歌ってみた」（カバー動画）を発見・比較・再生するための音楽Webアプリ。

- リポジトリ: https://github.com/asdfghjkl14641-droid/Covery
- 本番API: https://covery-api.asdfghjkl14641.workers.dev
- 技術スタック: React + Vite + Zustand / Cloudflare Workers + D1 (SQLite)

---

## アーキテクチャ

```
[ブラウザ (React SPA)]
    ↓ fetch
[Cloudflare Worker (covery-api)]
    ↓ SQL
[Cloudflare D1 (covery-db)]

[データ収集スクリプト (Node.js)]
    → Deezer API → D1
    → YouTube API → D1
```

### フロントエンド (src/)
- `React + Vite + Zustand` (状態管理)
- 全ページが **API のみ** を使用（metadata.json / songCatalog.json への依存を完全排除済み）
- JSON ファイルは scripts のバックアップ出力として残存するが、ユーザー画面では使わない

### バックエンド (worker/)
- Cloudflare Workers (ES Module)
- D1 (SQLite) データベース: `covery-db` (ID: `476821dc-d7b2-49ff-9248-dc1509b5eae7`)
- JWT 認証 (HS256) — Admin API 用

### データ収集 (scripts/)
- Deezer API でアーティスト・曲カタログを芋づる式収集
- YouTube API でカバー動画を検索・紐付け
- `wrangler d1 execute` 経由で D1 に直接書き込み

---

## D1 データベーススキーマ

```sql
CREATE TABLE artists (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL UNIQUE,
  spotify_id TEXT,
  reading TEXT,
  image_url TEXT DEFAULT '',
  genre TEXT DEFAULT '',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE songs (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  title TEXT NOT NULL,
  artist_id INTEGER NOT NULL,
  deezer_rank INTEGER DEFAULT 0,
  duration INTEGER,
  genre TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (artist_id) REFERENCES artists(id),
  UNIQUE(title, artist_id)
);

CREATE TABLE channels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  channel_id TEXT NOT NULL UNIQUE,   -- YouTube channel ID
  channel_name TEXT NOT NULL,
  channel_url TEXT,
  thumbnail_url TEXT,
  subscriber_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',     -- pending/approved/rejected/scanning
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE covers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id TEXT NOT NULL UNIQUE,     -- YouTube video ID
  song_id INTEGER NOT NULL,
  channel_id INTEGER NOT NULL,       -- channels.id (内部ID)
  youtube_title TEXT,
  view_count INTEGER DEFAULT 0,
  published_at DATETIME,
  duration INTEGER,
  status TEXT DEFAULT 'approved',    -- approved/rejected
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (song_id) REFERENCES songs(id),
  FOREIGN KEY (channel_id) REFERENCES channels(id)
);
```

### 現在のデータ量 (2026-04-16)

| テーブル | 件数 |
|---|---|
| artists | 628 (画像あり: 573) |
| songs | 4,014 |
| channels | 211 (approved: 1, pending: 200, rejected: 10) |
| covers | 315 |

---

## API エンドポイント一覧

### 公開 API (認証不要)

| Method | Path | 説明 |
|---|---|---|
| GET | `/api/songs?limit=20&random=true` | 承認チャンネルのカバーがある曲一覧 |
| GET | `/api/songs/:id/covers` | 特定曲の全カバー動画 |
| GET | `/api/artists` | アーティスト一覧 (imageUrl, genre, songCount 含む) |
| GET | `/api/artists/:id/songs` | 特定アーティストの曲一覧 |
| GET | `/api/singers?limit=10` | 承認済みチャンネル (歌い手) 一覧 |
| GET | `/api/channels/:channelId/covers` | 特定チャンネルのカバー一覧 |
| GET | `/api/similar-singers/:channelId` | 類似歌い手 (Jaccard係数) |
| GET | `/api/search?q=keyword` | 横断検索 |

### 管理 API (Bearer Token 必須)

| Method | Path | 説明 |
|---|---|---|
| POST | `/api/admin/login` | JWT取得 `{password: "covery2026"}` |
| GET | `/api/admin/channels?status=&search=&limit=&offset=` | チャンネル管理一覧+統計 |
| GET | `/api/admin/channels/:channelId/covers` | チャンネルのカバー詳細 |
| PUT | `/api/admin/channels/:channelId/approve` | チャンネル承認 |
| PUT | `/api/admin/channels/:channelId/reject` | チャンネル拒否 |
| PUT | `/api/admin/channels/:channelId/reset` | pending に戻す |
| PUT | `/api/admin/covers/:videoId/reject` | カバー個別拒否 |
| PUT | `/api/admin/covers/:videoId/approve` | カバー個別承認 |
| GET | `/api/admin/stats` | 全テーブル統計 |
| POST | `/api/admin/spotify-search` | Spotify 曲検索 (Worker proxy) |
| POST | `/api/admin/add-song` | artists+songs に INSERT OR IGNORE |
| POST | `/api/admin/add-cover` | covers に INSERT OR IGNORE |
| POST | `/api/admin/identify-song` | Claude API で曲名判定 (要 ANTHROPIC_API_KEY) |

---

## フロントエンド ページ構成

| ファイル | ページ | データソース |
|---|---|---|
| `Home.jsx` | ホーム | `/api/songs` + `/api/singers` + `/api/songs/:id/covers` |
| `Search.jsx` | 検索 + アーティスト一覧 | `/api/artists` + `/api/search` |
| `SongCovers.jsx` | 曲の全カバー一覧 | `/api/songs/:id/covers` |
| `ArtistSongs.jsx` | アーティストの曲一覧 | `/api/artists/:id/songs` |
| `SingerPage.jsx` | 歌い手ページ | `/api/channels/:id/covers` + `/api/similar-singers` |
| `Library.jsx` | お気に入り/プレイリスト | ローカルストア (API未対応) |
| `Admin.jsx` | 管理画面 | Admin API 全般 |
| `AdminChannelDetail.jsx` | チャンネル詳細 | Admin API |
| `App.jsx` | ルーティング | — |

### 重要な設計判断
- **全ユーザー向けページは API のみ** — `metadata.json` / `songCatalog.json` の import は `src/pages/` から完全排除
- **承認フィルタ**: API 側の SQL で `ch.status = 'approved'` + `c.status = 'approved'` を必ず WHERE に含める
- **承認 0 件 → 「コンテンツを準備中です」** メッセージ表示 (Home.jsx)
- サムネイル画像: YouTube 動画の `hqdefault.jpg` を使用 (チャンネルアイコンではない)

---

## 管理画面 (Admin)

### 認証フロー
1. UI ゲート: `id1` + `id2` + `password` (ハードコード: `Minoru14641Hg`)
2. API トークン: `POST /api/admin/login` で JWT 取得 (パスワード: `covery2026`)
3. トークンは `localStorage['covery-admin-token']` に永続化
4. ログイン時に D1 の承認状態を `useAdminStore.decisions` に pull (D1 が真の情報源)

### チャンネルスキャン (3段階)
1. **Stage 2 — 逆引き検索**: D1 の人気曲 100 曲を `"{title} {artist} {channelName}"` で YouTube 検索 → channelId 一致でカバー登録
2. **Stage 3 — Claude API 判定**: 未紐付け動画のタイトルを Claude Sonnet 4 に送信 → 原曲判定 → Spotify で正規化 → D1 に追加
3. Spotify 検索: Worker 経由でCORS回避、多段階クエリ + 多方式スコアリング

### Stage 3 の有効化
`worker/wrangler.toml` の `ANTHROPIC_API_KEY` を設定 → `npx wrangler deploy`

---

## データ収集スクリプト

### scripts/build-catalog.js (Deezer 芋づる式)
- JP_ARTISTS シードリストから Deezer 検索 → 全アルバム → 全曲 → 関連アーティスト → キュー追加
- MAX_ARTISTS = 5000、100ms wait
- Phase 1: Deezer API のみ (D1 アクセスなし)、100 件ごと JSON 中間保存
- Phase 2: 最後に SQL ファイルで D1 一括投入
- `node scripts/build-catalog.js` or GitHub Actions `Build Song Catalog`

### scripts/fetch-data.js
- YouTube API で承認チャンネルのカバー動画を取得
- `metadata.json` に保存 + D1 に同期 (`channels` as pending + `covers`)

### scripts/fetch-preview.js
- 新規チャンネル候補を発見 → `previewChannels.json` + D1 channels (pending)

### scripts/check-rss-updates.js
- 承認チャンネルの RSS フィードで新着カバーを検出 → D1 covers に追加

### scripts/fix-artist-meta.js
- D1 の artists の空 `image_url` / `genre` を Deezer API で埋める

### scripts/db.js (共通 D1 ヘルパー)
- `batchInsertArtists / Songs / Channels / Covers` — 50 件ずつ SQL ファイル経由
- `batchUpdateArtistMeta` — 空カラムのみ UPDATE
- `batchExecute(statements, label)` — 汎用バッチ
- ESM (`import/export`)

---

## GitHub Actions ワークフロー

### .github/workflows/daily-update.yml
- `cron: '0 21 * * *'` (JST 06:00) + `workflow_dispatch`
- `check-rss-updates.js` → `fetch-data.js` → `fetch-preview.js` → git push
- `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID` 必要

### .github/workflows/build-catalog.yml
- `workflow_dispatch` のみ (手動)
- `build-catalog.js` を最大 6 時間実行 → JSON + D1 → git push
- `PAT_TOKEN` (push 権限) + `CLOUDFLARE_*` + `SPOTIFY_*` 必要

---

## 認証情報・環境変数

### Worker (wrangler.toml [vars])
| 変数 | 値 | 用途 |
|---|---|---|
| JWT_SECRET | `covery-jwt-secret-2026` | Admin JWT 署名 |
| ADMIN_PASSWORD | `covery2026` | API ログインパスワード |
| SPOTIFY_CLIENT_ID | `a92479af8aaa...` | Spotify API (Worker proxy) |
| SPOTIFY_CLIENT_SECRET | `162170e4a91c...` | 同上 |
| ANTHROPIC_API_KEY | (空) | Claude API Stage 3 (未設定) |

### ローカル (.env — gitignore 対象)
- `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET`
- `YOUTUBE_API_KEY` ～ `YOUTUBE_API_KEY_30` (30 キーローテーション)

### GitHub Secrets (要手動設定)
- `PAT_TOKEN` — git push 用 fine-grained PAT
- `CLOUDFLARE_API_TOKEN` / `CLOUDFLARE_ACCOUNT_ID`
- `SPOTIFY_CLIENT_ID` / `SPOTIFY_CLIENT_SECRET`
- `YOUTUBE_API_KEY` (+ `_1` ～ `_10`)

---

## Store (Zustand)

### usePlayerStore
- `currentTrack`, `queue`, `isPlaying`
- `setQueue(tracks, index)`, `startBGMMode(label, tracks)`
- YouTube IFrame Player API (デュアルプレイヤー・プリロード方式)

### useAdminStore
- `decisions` — `{ channelId: 'approved'|'rejected'|'scanning' }`
- `approvedIds` — Set (上記から derived)
- `devMode` — true で全データ表示 (開発用)
- `scanResults` — `{ channelId: { covers, stage2Matched, stage3Matched, skippedVideos } }`
- `previewChannels` — Admin チャンネル一覧
- `coverDecisions` — `{ videoId: 'approved'|'rejected' }`
- localStorage に永続化 (D1 pull で上書きされる)

### useCollectionStore
- `favorites` — 曲 ID 配列
- `playlists` — `{ id, name, songIds }` 配列
- localStorage に永続化

---

## 重要な過去の修正と教訓

### 承認フィルタ漏れ
- `filterCovers.js` に「approvedIds.size === 0 なら全曲表示」フォールバックがあった → 削除済み
- `fetch-data.js` が新チャンネルを `status='approved'` で INSERT していた → `'pending'` に修正済み
- D1 の誤承認 119 件を `UPDATE SET status='pending'` でリセット済み

### APIパスワード不一致
- Admin.jsx は UI ゲートに `Minoru14641Hg` を使用
- API は `covery2026` — 分離して `API_PASSWORD` 定数で管理

### Spotify → Deezer 移行
- Spotify API のレート制限が厳しい → Deezer API に完全移行
- Deezer は認証不要、秒間 50 リクエスト許容
- build-catalog.js は Deezer のみで動作

### D1 中間書き込みのボトルネック
- wrangler d1 execute --remote は 1 回あたり数秒 → ループ内で呼ぶと 6 時間超
- Phase 1 (API収集) と Phase 2 (D1投入) を分離して 10 倍以上高速化

### updated_at カラム問題
- Worker の admin.js が D1 に存在しない `updated_at` を参照 → 500 エラー
- SQL から削除して解決 (スキーマに追加せず)

---

## 未実装・今後の課題

1. **Library.jsx お気に入り**: 現在 `covers: []` で表示できない。API でお気に入り曲の covers を取得する仕組みが必要
2. **SongCard.jsx の metadata.json 依存**: `data.singers` / `data.songs` を参照する箇所が残存。API 化が必要
3. **ANTHROPIC_API_KEY 未設定**: Stage 3 (Claude判定) は skipped のまま
4. **カタログ 5,000 曲目標**: 現在 4,014 曲。build-catalog.js の再実行で拡充可能
5. **usePlayerStore の sameCovers**: ローカル JSON に依存。API `/api/songs/:id/covers` への切り替えが望ましい
6. **PWA**: manifest.json + service worker は存在するが、オフライン対応は未実装

---

## 開発コマンド

```bash
# ローカル開発
npm run dev              # Vite dev server (port 5173)
npm run build            # プロダクションビルド

# Worker
cd worker
npx wrangler dev         # ローカル Worker (port 8787)
npx wrangler deploy      # 本番デプロイ

# D1
npx wrangler d1 execute covery-db --remote --command="SELECT ..."

# データ収集
node scripts/build-catalog.js    # カタログ構築 (Deezer芋づる式)
node scripts/fetch-data.js       # カバー動画取得 (YouTube API)
node scripts/fetch-preview.js    # 新チャンネル発見
node scripts/check-rss-updates.js # RSS新着チェック
node scripts/fix-artist-meta.js  # アーティスト画像・ジャンル修正
```

---

## コミット履歴 (主要なもの)

```
a6379a7 検索画面: アーティスト画像表示、ソート修正
1fe8aa5 カタログ構築高速化: D1書き込みを最後に一括実行
c4421c7 アーティスト画像・ジャンルをD1に反映
ac8161c カタログ収集: Deezerメインに切替、芋づる式全曲収集
8ce0125 3段階スキャン: 逆引き検索 + Claude API判定
6a399eb Spotify検索の精度を大幅改善（照合ロジック強化）
a7ab8d9 スキャン時にSpotify APIで未知の曲を自動カタログ追加
2a0b939 全ページからJSONフォールバック完全削除、APIのみ使用
b1b92e9 承認フィルタ修正: 承認0件時の全表示フォールバックを削除
bfcd661 承認/拒否API修正: updated_atカラム削除 + APIパスワード分離
cb08e18 Step 5-B: 全ページをバックエンドAPI接続に切替
2a059ff D1データベース作成、Worker本番デプロイ完了
4c4664a Step 1: Cloudflare Workers + D1 プロジェクト構造とDB定義
```
