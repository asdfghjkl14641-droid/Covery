import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import AdminChannelDetail, { StatusBadge } from "./AdminChannelDetail";
import { useAdminStore } from "../store/useAdminStore";
import { scanChannel } from "../utils/channelScanner";

// ── Covery Host Admin Panel ──
const ADMIN_PASSWORD = "covery2026";

// Storage Polyfill for non-tauri/special environments
const storage = window.storage || {
  get: (key) => Promise.resolve({ value: localStorage.getItem(key) }),
  set: (key, value) => {
    localStorage.setItem(key, value);
    return Promise.resolve();
  }
};

// Load channels from previewChannels.json (static import, always exists)
import previewRaw from "../data/previewChannels.json";
import metaRaw from "../data/metadata.json";

function buildChannelList() {
  // Build singer thumbnail lookup from metadata
  const singerThumbMap = new Map();
  for (const s of (metaRaw.singers || [])) {
    if (s.thumbnailUrl) singerThumbMap.set(s.channelId, s.thumbnailUrl);
  }

  const preview = previewRaw?.channels || [];
  if (preview.length > 0) {
    return preview.map(ch => ({
      channelId: ch.channelId,
      channelName: ch.channelName,
      thumbnailUrl: ch.thumbnailUrl || singerThumbMap.get(ch.channelId) || "",
      coverCount: ch.totalFound || ch.sampleCovers?.length || 0,
      subscriberCount: ch.subscriberCount || 0,
      sampleCovers: (ch.sampleCovers || []).map(sc => ({
        title: sc.title, videoId: sc.videoId,
        originalArtist: sc.originalArtist || "", publishedAt: sc.publishedAt || "",
      })),
    }));
  }
  // Fallback: build from metadata.json
  const singerMap = new Map();
  for (const song of (metaRaw.songs || [])) {
    for (const c of (song.covers || [])) {
      if (!singerMap.has(c.singerId)) {
        const singer = (metaRaw.singers || []).find(s => s.channelId === c.singerId);
        singerMap.set(c.singerId, { channelId: c.singerId, channelName: singer?.name || c.singerId, thumbnailUrl: singer?.thumbnailUrl || "", coverCount: 0, sampleCovers: [] });
      }
      const entry = singerMap.get(c.singerId);
      entry.coverCount++;
      if (entry.sampleCovers.length < 3) {
        entry.sampleCovers.push({ title: song.title, videoId: c.videoId, originalArtist: song.originalArtist || "", publishedAt: c.publishedAt || "" });
      }
    }
  }
  return [...singerMap.values()].sort((a, b) => b.coverCount - a.coverCount);
}

const PREVIEW_CHANNELS = buildChannelList();

const ADMIN_PLAYER_ID = "admin-yt-player";

const AdminMiniPlayer = ({ miniPlayer, onClose }) => {
  const playerRef = useRef(null);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [currentTime, setCurrentTime] = useState(0);
  const [isSeeking, setIsSeeking] = useState(false);
  const intervalRef = useRef(null);

  // Create / load YT player
  useEffect(() => {
    const init = () => {
      if (playerRef.current) {
        playerRef.current.loadVideoById(miniPlayer.videoId);
        return;
      }
      playerRef.current = new window.YT.Player(ADMIN_PLAYER_ID, {
        height: "100%", width: "100%",
        videoId: miniPlayer.videoId,
        playerVars: { autoplay: 1, controls: 0, modestbranding: 1, rel: 0, playsinline: 1 },
        events: {
          onReady: () => startPolling(),
          onStateChange: (e) => { if (e.data === window.YT.PlayerState.PLAYING) startPolling(); },
        },
      });
    };
    if (window.YT?.Player) init();
    else {
      const check = setInterval(() => { if (window.YT?.Player) { clearInterval(check); init(); } }, 200);
      return () => clearInterval(check);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [miniPlayer.videoId]);

  const startPolling = () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    intervalRef.current = setInterval(() => {
      const p = playerRef.current;
      if (!p?.getCurrentTime || isSeeking) return;
      const t = p.getCurrentTime();
      const d = p.getDuration();
      setCurrentTime(t);
      if (d > 0) { setDuration(d); setProgress((t / d) * 100); }
    }, 500);
  };

  const handleSeek = (e) => {
    const val = parseFloat(e.target.value);
    setProgress(val);
    const seekTo = (val / 100) * duration;
    setCurrentTime(seekTo);
    if (playerRef.current?.seekTo) playerRef.current.seekTo(seekTo, true);
  };

  // Cleanup player on unmount
  useEffect(() => () => {
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (playerRef.current?.destroy) { try { playerRef.current.destroy(); } catch (_) {} playerRef.current = null; }
  }, []);

  const fmt = (s) => { const m = Math.floor(s / 60); return `${m}:${String(Math.floor(s % 60)).padStart(2, "0")}`; };

  return (
    <div style={{ position: "fixed", bottom: 0, left: 0, right: 0, background: "#141832", borderTop: "1px solid rgba(99,102,241,0.15)", zIndex: 200, boxShadow: "0 -4px 20px rgba(0,0,0,0.5)" }}>
      {/* Seekbar */}
      <div style={{ padding: "8px 20px 0", display: "flex", alignItems: "center", gap: "10px" }}>
        <span style={{ fontSize: "11px", color: "#94a3b8", minWidth: "36px" }}>{fmt(currentTime)}</span>
        <input type="range" min={0} max={100} value={progress}
          onMouseDown={() => setIsSeeking(true)} onMouseUp={() => setIsSeeking(false)}
          onTouchStart={() => setIsSeeking(true)} onTouchEnd={() => setIsSeeking(false)}
          onChange={handleSeek}
          style={{ flex: 1, height: "6px", appearance: "none", background: "rgba(255,255,255,0.08)", borderRadius: "3px", outline: "none", cursor: "pointer", accentColor: "#6366f1" }}
        />
        <span style={{ fontSize: "11px", color: "#64748b", minWidth: "36px", textAlign: "right" }}>{duration > 0 ? fmt(duration) : "--:--"}</span>
      </div>
      {/* Content */}
      <div style={{ display: "flex", alignItems: "center", padding: "8px 20px 12px", gap: "16px" }}>
        <div style={{ width: "112px", height: "63px", borderRadius: "6px", overflow: "hidden", flexShrink: 0, background: "#000" }}>
          <div id={ADMIN_PLAYER_ID} />
        </div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: "14px", fontWeight: 600, color: "#f1f5f9", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{miniPlayer.title}</div>
          <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "2px" }}>{miniPlayer.channelName}</div>
        </div>
        <button onClick={() => { if (playerRef.current?.destroy) { try { playerRef.current.destroy(); } catch(_){} playerRef.current = null; } onClose(); }} style={{ background: "rgba(255,255,255,0.1)", border: "none", borderRadius: "50%", width: "36px", height: "36px", display: "flex", alignItems: "center", justifyContent: "center", color: "#94a3b8", fontSize: "18px", cursor: "pointer", flexShrink: 0 }}>✕</button>
      </div>
      <style>{`input[type=range]::-webkit-slider-thumb{appearance:none;width:14px;height:14px;border-radius:50%;background:#6366f1;cursor:pointer;border:2px solid #141832;margin-top:-4px}input[type=range]::-webkit-slider-runnable-track{height:6px;border-radius:3px}`}</style>
    </div>
  );
};

const ChannelIcon = ({ src, name }) => {
  const [err, setErr] = useState(false);
  if (src && !err) {
    return <img src={src} alt="" onError={() => setErr(true)} style={{ width: 48, height: 48, borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} />;
  }
  return (
    <div style={{ width: 48, height: 48, borderRadius: "50%", flexShrink: 0, background: "linear-gradient(135deg,#6366f1,#818cf8)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, fontWeight: 700, color: "#fff" }}>
      {(name || "?").charAt(0)}
    </div>
  );
};

const StatsCard = ({ label, value, color }) => (
  <div style={{ background: "rgba(20,24,50,0.6)", borderRadius: "14px", padding: "16px 20px", border: "1px solid rgba(99,102,241,0.1)", flex: 1, minWidth: "100px" }}>
    <div style={{ fontSize: "28px", fontWeight: 700, color, letterSpacing: "-1px" }}>{value}</div>
    <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "4px" }}>{label}</div>
  </div>
);

export default function Admin() {
  const [isLoggedIn, setIsLoggedIn] = useState(import.meta.env.DEV);
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [filter, setFilter] = useState("all");
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedChannel, setSelectedChannel] = useState(null);
  const [expandedId, setExpandedId] = useState(null);
  const [miniPlayer, setMiniPlayer] = useState(null);
  const [scanError, setScanError] = useState(null);

  const decisions = useAdminStore(s => s.decisions);
  const devMode = useAdminStore(s => s.devMode);
  const setDevMode = useAdminStore(s => s.setDevMode);
  const scanProgress = useAdminStore(s => s.scanProgress);
  const saveDecisions = useAdminStore(s => s.saveDecisions);
  const startScan = useAdminStore(s => s.startScan);
  const completeScan = useAdminStore(s => s.completeScan);
  const failScan = useAdminStore(s => s.failScan);
  const updateScanProgress = useAdminStore(s => s.updateScanProgress);

  const save = useCallback((d) => saveDecisions(d), [saveDecisions]);

  const handleLogin = () => { if (password === ADMIN_PASSWORD) { setIsLoggedIn(true); setError(""); } else setError("パスワードが違います"); };
  const getStatus = (id) => decisions[id] || "pending";

  const handleApprove = async (ch) => {
    setScanError(null);
    startScan(ch.channelId);
    try {
      const results = await scanChannel(ch.channelId, ch.channelName, (p) => updateScanProgress(ch.channelId, p));
      completeScan(ch.channelId, results);
    } catch (e) {
      failScan(ch.channelId, e.message);
      setScanError(`${ch.channelName}: ${e.message === 'QUOTA_EXCEEDED' ? 'APIクォータ上限' : e.message}`);
    }
  };

  const stats = useMemo(() => {
    const vals = Object.values(decisions);
    const a = vals.filter(v => v === "approved").length;
    const s = vals.filter(v => v === "scanning").length;
    const r = vals.filter(v => v === "rejected").length;
    return { approved: a, scanning: s, rejected: r, pending: PREVIEW_CHANNELS.length - a - s - r, total: PREVIEW_CHANNELS.length };
  }, [decisions]);

  const filtered = useMemo(() => PREVIEW_CHANNELS.filter(ch => {
    if (filter !== "all" && getStatus(ch.channelId) !== filter) return false;
    if (searchQuery && !ch.channelName.toLowerCase().includes(searchQuery.toLowerCase())) return false;
    return true;
  }), [filter, searchQuery, decisions]);

  const exportList = () => {
    const channels = PREVIEW_CHANNELS.filter(ch => getStatus(ch.channelId) === "approved").map(ch => ({
      channelId: ch.channelId,
      channelName: ch.channelName,
      thumbnailUrl: ch.thumbnailUrl || "",
    }));
    const blob = new Blob([JSON.stringify({ channels }, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "approvedChannels.json";
    a.click();
  };

  if (!isLoggedIn) return (
    <div style={{ minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(160deg, #050816, #0a0e27 40%, #111340)", fontFamily: "'Outfit','Noto Sans JP',sans-serif" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;600;700;800&family=Noto+Sans+JP:wght@400;600;700&display=swap');@keyframes fadeIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}*{box-sizing:border-box}input::placeholder{color:#64748b}`}</style>
      <div style={{ width: "380px", padding: "48px 40px", borderRadius: "24px", background: "rgba(20,24,50,0.7)", backdropFilter: "blur(20px)", border: "1px solid rgba(99,102,241,0.15)", boxShadow: "0 24px 80px rgba(0,0,0,0.5)", animation: "fadeIn 0.4s" }}>
        <div style={{ textAlign: "center", marginBottom: "36px" }}>
          <div style={{ fontSize: "36px", fontWeight: 800, background: "linear-gradient(135deg,#6366f1,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Covery</div>
          <div style={{ fontSize: "13px", color: "#94a3b8", marginTop: "8px", letterSpacing: "3px", textTransform: "uppercase" }}>Host Panel</div>
        </div>
        <label style={{ fontSize: "12px", color: "#94a3b8", marginBottom: "8px", display: "block" }}>パスワード</label>
        <input type="password" value={password} onChange={e => { setPassword(e.target.value); setError(""); }} onKeyDown={e => e.key === "Enter" && handleLogin()} placeholder="ホストパスワードを入力" style={{ width: "100%", padding: "14px 16px", borderRadius: "12px", border: error ? "1px solid rgba(239,68,68,0.5)" : "1px solid rgba(99,102,241,0.2)", background: "rgba(10,14,39,0.8)", color: "#f1f5f9", fontSize: "15px", outline: "none", marginBottom: "6px" }} />
        {error && <div style={{ color: "#ef4444", fontSize: "13px", marginBottom: "8px" }}>{error}</div>}
        <button onClick={handleLogin} style={{ width: "100%", padding: "14px", borderRadius: "12px", border: "none", background: "linear-gradient(135deg,#6366f1,#818cf8)", color: "#fff", fontSize: "15px", fontWeight: 600, cursor: "pointer", marginTop: "12px" }}>ログイン</button>
        <div style={{ textAlign: "center", marginTop: "24px", fontSize: "12px", color: "#64748b" }}>管理者専用ページです</div>
      </div>
    </div>
  );


  return (
    <div style={{ minHeight: "100vh", background: "linear-gradient(160deg, #050816, #0a0e27 40%, #111340)", fontFamily: "'Outfit','Noto Sans JP',sans-serif", color: "#f1f5f9" }}>
      <style>{`@import url('https://fonts.googleapis.com/css2?family=Outfit:wght@400;500;600;700;800&family=Noto+Sans+JP:wght@400;500;600;700&display=swap');@keyframes fadeIn{from{opacity:0;transform:translateY(-8px)}to{opacity:1;transform:translateY(0)}}@keyframes spin{to{transform:rotate(360deg)}}*{box-sizing:border-box}input::placeholder{color:#64748b}button:hover{opacity:.85}::-webkit-scrollbar{width:6px}::-webkit-scrollbar-thumb{background:rgba(99,102,241,.3);border-radius:3px}`}</style>

      <div style={{ padding: "16px 32px", display: "flex", alignItems: "center", justifyContent: "space-between", borderBottom: "1px solid rgba(99,102,241,0.08)", position: "sticky", top: 0, background: "rgba(5,8,22,0.92)", backdropFilter: "blur(12px)", zIndex: 100 }}>
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ fontSize: "24px", fontWeight: 800, background: "linear-gradient(135deg,#6366f1,#a78bfa)", WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent" }}>Covery</div>
          <span style={{ padding: "4px 10px", borderRadius: "8px", fontSize: "11px", background: "rgba(99,102,241,0.15)", color: "#818cf8", fontWeight: 600 }}>HOST</span>
        </div>
        <div style={{ display: "flex", gap: "10px" }}>
          <button onClick={exportList} style={{ padding: "8px 16px", borderRadius: "10px", border: "1px solid rgba(99,102,241,0.3)", background: "transparent", color: "#818cf8", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>承認リスト出力</button>
          <button onClick={() => setIsLoggedIn(false)} style={{ padding: "8px 16px", borderRadius: "10px", border: "1px solid rgba(148,163,184,0.2)", background: "transparent", color: "#94a3b8", fontSize: "13px", cursor: "pointer" }}>ログアウト</button>
        </div>
      </div>

      <div style={{ maxWidth: "960px", margin: "0 auto", padding: "28px 24px", paddingBottom: miniPlayer ? "110px" : "28px" }}>
        {selectedChannel ? (
          <AdminChannelDetail
            channel={selectedChannel}
            status={getStatus(selectedChannel.channelId)}
            scanProgress={scanProgress[selectedChannel.channelId]}
            onApprove={() => handleApprove(selectedChannel)}
            onReject={() => save({ ...decisions, [selectedChannel.channelId]: "rejected" })}
            onReset={() => { const d = { ...decisions }; delete d[selectedChannel.channelId]; save(d); }}
            onBack={() => setSelectedChannel(null)}
          />
        ) : (
          <>
            <div style={{ display: "flex", gap: "12px", marginBottom: "28px", flexWrap: "wrap" }}>
              <StatsCard label="総チャンネル" value={stats.total} color="#f1f5f9" />
              <StatsCard label="承認済" value={stats.approved} color="#22c55e" />
              <StatsCard label="スキャン中" value={stats.scanning} color="#3b82f6" />
              <StatsCard label="拒否" value={stats.rejected} color="#ef4444" />
              <StatsCard label="未審査" value={stats.pending} color="#eab308" />
            </div>

            {/* Dev mode toggle */}
            <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "20px", padding: "12px 16px", borderRadius: "12px", background: "rgba(20,24,50,0.6)", border: "1px solid rgba(99,102,241,0.1)" }}>
              <span style={{ fontSize: "13px", color: "#94a3b8" }}>ユーザー画面表示:</span>
              <button onClick={() => setDevMode(true)} style={{ padding: "6px 14px", borderRadius: "8px", border: "none", fontSize: "12px", fontWeight: 600, cursor: "pointer", background: devMode ? "rgba(99,102,241,0.3)" : "transparent", color: devMode ? "#818cf8" : "#64748b" }}>全表示（開発）</button>
              <button onClick={() => setDevMode(false)} style={{ padding: "6px 14px", borderRadius: "8px", border: "none", fontSize: "12px", fontWeight: 600, cursor: "pointer", background: !devMode ? "rgba(34,197,94,0.3)" : "transparent", color: !devMode ? "#22c55e" : "#64748b" }}>承認のみ（本番）</button>
            </div>

            <div style={{ display: "flex", gap: "12px", marginBottom: "20px", flexWrap: "wrap", alignItems: "center" }}>
              <input type="text" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} placeholder="チャンネル名で検索..." style={{ flex: 1, minWidth: "200px", padding: "12px 16px", borderRadius: "12px", border: "1px solid rgba(99,102,241,0.15)", background: "rgba(10,14,39,0.6)", color: "#f1f5f9", fontSize: "14px", outline: "none" }} />
              <div style={{ display: "flex", gap: "4px", background: "rgba(20,24,50,0.6)", borderRadius: "12px", padding: "4px" }}>
                {[{ key: "all", label: "すべて" }, { key: "pending", label: "未審査" }, { key: "scanning", label: "スキャン中" }, { key: "approved", label: "承認済" }, { key: "rejected", label: "拒否" }].map(f => (
                  <button key={f.key} onClick={() => setFilter(f.key)} style={{ padding: "8px 14px", borderRadius: "8px", border: "none", background: filter === f.key ? "rgba(99,102,241,0.2)" : "transparent", color: filter === f.key ? "#818cf8" : "#94a3b8", fontSize: "13px", fontWeight: 500, cursor: "pointer" }}>{f.label}</button>
                ))}
              </div>
            </div>

            <div style={{ display: "flex", gap: "8px", marginBottom: "20px" }}>
              <button onClick={() => { const d = { ...decisions }; filtered.forEach(ch => { if (!d[ch.channelId]) d[ch.channelId] = "approved"; }); save(d); }} style={{ padding: "8px 14px", borderRadius: "8px", border: "1px solid rgba(34,197,94,0.3)", background: "rgba(34,197,94,0.1)", color: "#22c55e", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>未審査を全て承認</button>
              <button onClick={() => { const d = { ...decisions }; filtered.forEach(ch => { if (!d[ch.channelId]) d[ch.channelId] = "rejected"; }); save(d); }} style={{ padding: "8px 14px", borderRadius: "8px", border: "1px solid rgba(239,68,68,0.3)", background: "rgba(239,68,68,0.1)", color: "#ef4444", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}>未審査を全て拒否</button>
            </div>

            {scanError && (
              <div style={{ padding: "12px 16px", borderRadius: "10px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.2)", color: "#ef4444", fontSize: "13px", marginBottom: "14px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>{scanError}</span>
                <button onClick={() => setScanError(null)} style={{ background: "none", border: "none", color: "#ef4444", cursor: "pointer", fontSize: "16px" }}>✕</button>
              </div>
            )}
            <div style={{ fontSize: "13px", color: "#64748b", marginBottom: "14px" }}>{filtered.length}件のチャンネル</div>

            <div style={{ display: "flex", flexDirection: "column", gap: "6px" }}>
              {filtered.map(ch => {
                const st = getStatus(ch.channelId);
                const isOpen = expandedId === ch.channelId;
                const borderColor = st === "approved" ? "rgba(34,197,94,0.2)" : st === "rejected" ? "rgba(239,68,68,0.2)" : "rgba(99,102,241,0.08)";
                return (
                  <div key={ch.channelId} style={{ borderRadius: "14px", border: `1px solid ${borderColor}`, background: "rgba(20,24,50,0.8)", overflow: "hidden", transition: "all 0.2s" }}>
                    {/* Row header */}
                    <div onClick={() => setExpandedId(isOpen ? null : ch.channelId)} style={{ display: "flex", alignItems: "center", gap: "14px", padding: "14px 18px", cursor: "pointer" }}>
                      <ChannelIcon src={ch.thumbnailUrl} name={ch.channelName} />
                      <div style={{ flex: 1, minWidth: 0 }}>
                        <div style={{ fontSize: "15px", fontWeight: 600, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>{ch.channelName}</div>
                        <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "2px" }}>
                          {ch.coverCount}曲
                          {st === "pending" && ch.subscriberCount > 0 && <span style={{ marginLeft: "6px", color: "#64748b" }}>· {ch.subscriberCount >= 10000 ? `${(ch.subscriberCount / 10000).toFixed(1)}万人` : ch.subscriberCount >= 1000 ? `${(ch.subscriberCount / 1000).toFixed(1)}千人` : `${ch.subscriberCount}人`}</span>}
                          <span style={{ marginLeft: "6px" }}>· {ch.sampleCovers.map(c => c.title).slice(0, 2).join(", ")}{ch.sampleCovers.length > 2 ? "..." : ""}</span>
                        </div>
                      </div>
                      <StatusBadge status={st} />
                      <div style={{ color: "#64748b", fontSize: "14px", transform: isOpen ? "rotate(90deg)" : "none", transition: "transform 0.2s" }}>▶</div>
                    </div>

                    {/* Accordion panel */}
                    {isOpen && (
                      <div style={{ padding: "0 18px 18px", borderTop: "1px solid rgba(99,102,241,0.06)", animation: "fadeIn 0.2s" }}>
                        <div style={{ display: "flex", gap: "20px", flexWrap: "wrap", paddingTop: "14px" }}>
                          {/* Left: sample covers */}
                          <div style={{ flex: 1, minWidth: "240px" }}>
                            <div style={{ fontSize: "12px", color: "#64748b", marginBottom: "10px", fontWeight: 600 }}>サンプル動画</div>
                            <div style={{ display: "flex", gap: "10px", overflowX: "auto", scrollbarWidth: "none" }}>
                              {ch.sampleCovers.map((sc, i) => (
                                <div key={i} onClick={(e) => { e.stopPropagation(); setMiniPlayer({ videoId: sc.videoId, title: sc.title, channelName: ch.channelName }); }} style={{ cursor: "pointer", flexShrink: 0 }}>
                                  <div style={{ width: "140px", height: "79px", borderRadius: "8px", overflow: "hidden", position: "relative", background: "#1e2248" }}>
                                    <img src={`https://img.youtube.com/vi/${sc.videoId}/mqdefault.jpg`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                                    <div style={{ position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", background: "rgba(0,0,0,0.3)" }}>
                                      <div style={{ width: "28px", height: "28px", borderRadius: "50%", background: "rgba(99,102,241,0.9)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "12px", color: "#fff" }}>▶</div>
                                    </div>
                                  </div>
                                  <div style={{ fontSize: "11px", color: "#94a3b8", marginTop: "4px", width: "140px", display: "flex", gap: "6px", alignItems: "baseline" }}>
                                    <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", flex: 1 }}>{sc.title}</span>
                                    {sc.duration && <span style={{ fontSize: "10px", color: "#64748b", flexShrink: 0 }}>{sc.duration}</span>}
                                  </div>
                                  {sc.originalArtist && <div style={{ fontSize: "10px", color: "#6366f1" }}>{sc.originalArtist}</div>}
                                </div>
                              ))}
                            </div>
                          </div>
                          {/* Right: actions */}
                          <div style={{ display: "flex", flexDirection: "column", gap: "8px", minWidth: "140px" }}>
                            <button onClick={(e) => { e.stopPropagation(); if (st === "scanning") return; handleApprove(ch); }} disabled={st === "scanning"} style={{ padding: "10px 16px", borderRadius: "10px", border: "none", background: st === "approved" ? "#22c55e" : st === "scanning" ? "rgba(59,130,246,0.15)" : "rgba(34,197,94,0.15)", color: st === "approved" ? "#fff" : st === "scanning" ? "#3b82f6" : "#22c55e", fontSize: "13px", fontWeight: 600, cursor: st === "scanning" ? "not-allowed" : "pointer", opacity: st === "scanning" ? 0.7 : 1 }}>{st === "scanning" ? "スキャン中..." : st === "approved" ? "✓ 承認済" : "✓ 承認+スキャン"}</button>
                            <button onClick={(e) => { e.stopPropagation(); save({ ...decisions, [ch.channelId]: "rejected" }); }} style={{ padding: "10px 16px", borderRadius: "10px", border: "none", background: st === "rejected" ? "#ef4444" : "rgba(239,68,68,0.15)", color: st === "rejected" ? "#fff" : "#ef4444", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>✕ 拒否</button>
                            <button onClick={(e) => { e.stopPropagation(); const d = { ...decisions }; delete d[ch.channelId]; save(d); }} style={{ padding: "10px 16px", borderRadius: "10px", border: "1px solid rgba(148,163,184,0.15)", background: "transparent", color: "#94a3b8", fontSize: "13px", cursor: "pointer" }}>未審査に戻す</button>
                            <button onClick={(e) => { e.stopPropagation(); setSelectedChannel(ch); }} style={{ padding: "10px 16px", borderRadius: "10px", border: "1px solid rgba(99,102,241,0.3)", background: "transparent", color: "#818cf8", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>チャンネル詳細 →</button>
                            <a href={`https://www.youtube.com/channel/${ch.channelId}`} target="_blank" rel="noopener noreferrer" onClick={e => e.stopPropagation()} style={{ padding: "10px 16px", borderRadius: "10px", border: "1px solid rgba(148,163,184,0.1)", background: "transparent", color: "#94a3b8", fontSize: "12px", textAlign: "center", textDecoration: "none" }}>YouTubeで確認</a>
                          </div>
                        </div>
                        {/* Scan progress */}
                        {st === "scanning" && scanProgress[ch.channelId] && (
                          <div style={{ marginTop: "12px", padding: "12px", borderRadius: "10px", background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.15)" }}>
                            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "12px", marginBottom: "6px" }}>
                              <span style={{ color: "#3b82f6", fontWeight: 600 }}>{scanProgress[ch.channelId].filtered}曲取得</span>
                              <span style={{ color: "#64748b" }}>{scanProgress[ch.channelId].current}</span>
                            </div>
                            <div style={{ height: "4px", background: "rgba(59,130,246,0.15)", borderRadius: "2px", overflow: "hidden" }}>
                              <div style={{ height: "100%", background: "#3b82f6", borderRadius: "2px", transition: "width 0.3s", width: scanProgress[ch.channelId].found > 0 ? `${Math.min((scanProgress[ch.channelId].filtered / Math.max(scanProgress[ch.channelId].found, 1)) * 100, 100)}%` : "10%" }} />
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
              {filtered.length === 0 && <div style={{ textAlign: "center", padding: "60px", color: "#64748b" }}>該当するチャンネルがありません</div>}
            </div>

            {/* Admin mini-player */}
            {miniPlayer && (
              <AdminMiniPlayer miniPlayer={miniPlayer} onClose={() => setMiniPlayer(null)} />
            )}
          </>
        )}
      </div>
    </div>
  );
}
