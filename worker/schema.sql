-- Covery D1 Database Schema

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
  channel_id TEXT NOT NULL UNIQUE,
  channel_name TEXT NOT NULL,
  channel_url TEXT,
  thumbnail_url TEXT,
  subscriber_count INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE covers (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  video_id TEXT NOT NULL UNIQUE,
  song_id INTEGER NOT NULL,
  channel_id INTEGER NOT NULL,
  youtube_title TEXT,
  view_count INTEGER DEFAULT 0,
  published_at DATETIME,
  duration INTEGER,
  status TEXT DEFAULT 'approved',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (song_id) REFERENCES songs(id),
  FOREIGN KEY (channel_id) REFERENCES channels(id)
);

CREATE TABLE api_cache (
  cache_key TEXT PRIMARY KEY,
  category TEXT NOT NULL,
  data TEXT NOT NULL,
  fetched_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
