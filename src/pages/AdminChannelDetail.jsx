import { useState, useMemo } from "react";

export const StatusBadge = ({ status }) => {
  const c = {
    approved: { bg: "rgba(34,197,94,0.15)", color: "#22c55e", border: "rgba(34,197,94,0.3)", label: "承認済" },
    scanning: { bg: "rgba(59,130,246,0.15)", color: "#3b82f6", border: "rgba(59,130,246,0.3)", label: "スキャン中" },
    rejected: { bg: "rgba(239,68,68,0.15)", color: "#ef4444", border: "rgba(239,68,68,0.3)", label: "拒否" },
    pending: { bg: "rgba(234,179,8,0.15)", color: "#eab308", border: "rgba(234,179,8,0.3)", label: "未審査" }
  }[status] || { bg: "rgba(148,163,184,0.15)", color: "#94a3b8", border: "rgba(148,163,184,0.3)", label: status };
  return (
    <span style={{ padding: "4px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: 600, background: c.bg, color: c.color, border: `1px solid ${c.border}`, display: "inline-flex", alignItems: "center", gap: "6px" }}>
      {status === "scanning" && <span style={{ width: 10, height: 10, border: "2px solid #3b82f6", borderTopColor: "transparent", borderRadius: "50%", animation: "spin 0.8s linear infinite", display: "inline-block" }} />}
      {c.label}
    </span>
  );
};

export default function AdminChannelDetail({ channel, status, scanProgress, scanResult, onApprove, onReject, onReset, onBack }) {
  const [activeSubTab, setActiveSubTab] = useState("preview"); // "preview" or "channel"
  const [previewVideoId, setPreviewVideoId] = useState(channel.sampleCovers[0]?.videoId || null);
  const [skippedOpen, setSkippedOpen] = useState(false);

  const channelUrl = `https://www.youtube.com/channel/${channel.channelId}/videos`;
  const fallbackSearchUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(channel.channelName + " 歌ってみた")}`;

  return (
    <div style={{ animation: "fadeIn 0.3s ease" }}>
      {/* 1. ← 戻るボタン */}
      <button 
        onClick={onBack} 
        style={{ 
          background: "none", border: "none", color: "#94a3b8", fontSize: "14px", 
          cursor: "pointer", marginBottom: "24px", display: "flex", alignItems: "center", gap: "8px" 
        }}
      >
        ← チャンネル一覧に戻る
      </button>

      {/* 2. チャンネルヘッダー */}
      <div style={{ background: "rgba(20,24,50,0.8)", borderRadius: "20px", padding: "32px", border: "1px solid rgba(99,102,241,0.1)", marginBottom: "24px", backdropFilter: "blur(10px)" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "24px", marginBottom: "24px", flexWrap: "wrap" }}>
          {channel.thumbnailUrl ? (
            <img src={channel.thumbnailUrl} alt="" style={{ width: "80px", height: "80px", borderRadius: "50%", objectFit: "cover", flexShrink: 0 }} onError={e => { e.target.style.display = "none"; e.target.nextSibling.style.display = "flex"; }} />
          ) : null}
          <div style={{
            width: "80px", height: "80px", borderRadius: "50%", flexShrink: 0,
            background: "linear-gradient(135deg, #6366f1, #a78bfa)",
            display: channel.thumbnailUrl ? "none" : "flex", alignItems: "center", justifyContent: "center",
            fontSize: "32px", fontWeight: 700, color: "#fff"
          }}>
            {channel.channelName.charAt(0)}
          </div>
          <div style={{ flex: 1, minWidth: "200px" }}>
            <div style={{ fontSize: "24px", fontWeight: 700, color: "#f1f5f9", marginBottom: "4px" }}>{channel.channelName}</div>
            <div style={{ fontSize: "14px", color: "#94a3b8", marginBottom: "12px" }}>カバー {channel.coverCount}曲収録</div>
            <StatusBadge status={status} />
          </div>
        </div>

        {/* 3. 承認/拒否/リセット ボタン */}
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <button
            onClick={onApprove}
            disabled={status === "scanning"}
            style={{
              padding: "14px 32px", borderRadius: "12px", border: "none",
              background: status === "approved" ? "#22c55e" : status === "scanning" ? "rgba(59,130,246,0.15)" : "rgba(34,197,94,0.15)",
              color: status === "approved" ? "#fff" : status === "scanning" ? "#3b82f6" : "#22c55e",
              fontSize: "15px", fontWeight: 700, cursor: status === "scanning" ? "not-allowed" : "pointer", transition: "all 0.2s"
            }}
          >
            {status === "scanning" ? "スキャン中..." : status === "approved" ? "✓ 承認済" : "✓ 承認+スキャン"}
          </button>
          <button 
            onClick={onReject} 
            style={{ 
              padding: "14px 32px", borderRadius: "12px", border: "none", 
              background: status === "rejected" ? "#ef4444" : "rgba(239,68,68,0.15)", 
              color: status === "rejected" ? "#fff" : "#ef4444", 
              fontSize: "15px", fontWeight: 700, cursor: "pointer", transition: "all 0.2s" 
            }}
          >
            ✕ 拒否する
          </button>
          <button 
            onClick={onReset} 
            style={{ 
              padding: "14px 24px", borderRadius: "12px", border: "1px solid rgba(148,163,184,0.2)", 
              background: "transparent", color: "#94a3b8", fontSize: "15px", cursor: "pointer" 
            }}
          >
            未審査に戻す
          </button>
        </div>

        {/* Scan progress */}
        {status === "scanning" && scanProgress && (
          <div style={{ marginTop: "16px", padding: "16px 20px", borderRadius: "14px", background: "rgba(59,130,246,0.08)", border: "1px solid rgba(59,130,246,0.15)" }}>
            <div style={{ display: "flex", justifyContent: "space-between", fontSize: "14px", marginBottom: "8px" }}>
              <span style={{ color: "#3b82f6", fontWeight: 600 }}>{scanProgress.filtered}曲取得</span>
              <span style={{ color: "#94a3b8" }}>{scanProgress.current}</span>
            </div>
            <div style={{ height: "6px", background: "rgba(59,130,246,0.15)", borderRadius: "3px", overflow: "hidden" }}>
              <div style={{ height: "100%", background: "#3b82f6", borderRadius: "3px", transition: "width 0.3s", width: scanProgress.found > 0 ? `${Math.min((scanProgress.filtered / Math.max(scanProgress.found, 1)) * 100, 100)}%` : "10%" }} />
            </div>
          </div>
        )}
      </div>

      {/* 4. タブ（「動画試聴」/「チャンネル確認」） */}
      <div style={{ display: "flex", gap: "8px", marginBottom: "20px", background: "rgba(20,24,50,0.6)", borderRadius: "12px", padding: "6px", width: "fit-content" }}>
        <button 
          onClick={() => setActiveSubTab("preview")}
          style={{ 
            padding: "10px 24px", borderRadius: "10px", border: "none", 
            background: activeSubTab === "preview" ? "rgba(99,102,241,0.25)" : "transparent", 
            color: activeSubTab === "preview" ? "#818cf8" : "#94a3b8", 
            fontSize: "14px", fontWeight: 700, cursor: "pointer", transition: "all 0.2s" 
          }}
        >
          動画試聴
        </button>
        <button 
          onClick={() => setActiveSubTab("channel")}
          style={{ 
            padding: "10px 24px", borderRadius: "10px", border: "none", 
            background: activeSubTab === "channel" ? "rgba(99,102,241,0.25)" : "transparent", 
            color: activeSubTab === "channel" ? "#818cf8" : "#94a3b8", 
            fontSize: "14px", fontWeight: 700, cursor: "pointer", transition: "all 0.2s" 
          }}
        >
          チャンネル確認
        </button>
      </div>

      {/* 5. 動画プレイヤーエリア */}
      <div style={{ 
        background: "#000", borderRadius: "16px", overflow: "hidden", 
        border: "1px solid rgba(99,102,241,0.2)", marginBottom: "24px", 
        boxShadow: "0 10px 40px rgba(0,0,0,0.5)", position: "relative"
      }}>
        {activeSubTab === "preview" ? (
          <div style={{ position: "relative", paddingBottom: "56.25%", height: 0 }}>
            {previewVideoId ? (
              <iframe 
                src={`https://www.youtube.com/embed/${previewVideoId}?autoplay=1`} 
                style={{ position: "absolute", top: 0, left: 0, width: "100%", height: "100%", border: "none" }} 
                allow="autoplay; encrypted-media" 
                allowFullScreen 
              />
            ) : (
              <div style={{ 
                position: "absolute", inset: 0, display: "flex", alignItems: "center", 
                justifyContent: "center", color: "#64748b", fontSize: "16px" 
              }}>
                動画を選択してください
              </div>
            )}
          </div>
        ) : (
          <div style={{ height: "400px", position: "relative" }}>
            <iframe 
              src={channelUrl} 
              style={{ width: "100%", height: "100%", border: "none" }} 
              title="YouTube Channel"
            />
            {/* Overlay button in case of block */}
            <div style={{ 
              position: "absolute", inset: 0, pointerEvents: "none", 
              display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", 
              background: "rgba(0,0,0,0.45)", backdropFilter: "blur(2px)", textAlign: "center", padding: "20px"
            }}>
              <div style={{ color: "#fff", marginBottom: "16px", fontSize: "14px", fontWeight: 500 }}>
                YouTubeのセキュリティ設定により、この表示がブロックされる場合があります。<br/>
                読み込まれない場合は、下のボタンから直接チャンネルを確認してください。
              </div>
              <a 
                href={channelUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                style={{ 
                  pointerEvents: "auto", padding: "12px 24px", borderRadius: "10px", 
                  background: "#ef4444", color: "#fff", textDecoration: "none", 
                  fontSize: "14px", fontWeight: 700, boxShadow: "0 4px 15px rgba(239,68,68,0.3)" 
                }}
              >
                YouTubeを別タブで開く
              </a>
              <div style={{ marginTop: "12px", pointerEvents: "auto" }}>
                <a href={fallbackSearchUrl} target="_blank" rel="noopener noreferrer" style={{ color: "#94a3b8", fontSize: "12px", textDecoration: "underline" }}>
                  検索結果で確認する
                </a>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* 6. カバー動画リスト（動画試聴タブ選択時のみ表示） */}
      {activeSubTab === "preview" && (
        <div style={{ 
          background: "rgba(20,24,50,0.8)", borderRadius: "20px", padding: "28px", 
          border: "1px solid rgba(99,102,241,0.1)", backdropFilter: "blur(10px)" 
        }}>
          <div style={{ fontSize: "16px", fontWeight: 700, color: "#f1f5f9", marginBottom: "20px" }}>
            収録カバー動画（{channel.sampleCovers.length}曲）
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {channel.sampleCovers.map((cover, i) => (
              <div 
                key={i} 
                onClick={() => setPreviewVideoId(cover.videoId)} 
                style={{ 
                  display: "flex", alignItems: "center", gap: "16px", padding: "12px 16px", 
                  borderRadius: "12px", 
                  background: previewVideoId === cover.videoId ? "rgba(99,102,241,0.15)" : "rgba(10,14,39,0.5)", 
                  border: previewVideoId === cover.videoId ? "1px solid rgba(99,102,241,0.4)" : "1px solid rgba(99,102,241,0.08)", 
                  cursor: "pointer", transition: "all 0.2s" 
                }}
              >
                <div style={{ 
                  width: "100px", height: "56px", borderRadius: "8px", overflow: "hidden", 
                  flexShrink: 0, position: "relative", background: "#1e2248" 
                }}>
                  <img src={`https://img.youtube.com/vi/${cover.videoId}/mqdefault.jpg`} alt="" style={{ width: "100%", height: "100%", objectFit: "cover" }} />
                  <div style={{ 
                    position: "absolute", inset: 0, display: "flex", alignItems: "center", justifyContent: "center", 
                    background: previewVideoId === cover.videoId ? "rgba(99,102,241,0.1)" : "rgba(0,0,0,0.25)" 
                  }}>
                    <div style={{ 
                      width: "32px", height: "32px", borderRadius: "50%", 
                      background: previewVideoId === cover.videoId ? "#6366f1" : "rgba(99,102,241,0.9)", 
                      display: "flex", alignItems: "center", justifyContent: "center", fontSize: "14px", color: "#fff" 
                    }}>
                      {previewVideoId === cover.videoId ? "▶" : "▷"}
                    </div>
                  </div>
                </div>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ 
                    fontSize: "15px", fontWeight: 600, 
                    color: previewVideoId === cover.videoId ? "#818cf8" : "#f1f5f9", 
                    whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" 
                  }}>
                    {cover.title}
                  </div>
                  <div style={{ fontSize: "12px", color: "#94a3b8", marginTop: "3px" }}>
                    {previewVideoId === cover.videoId ? "再生中" : "タップで再生"}
                  </div>
                </div>
                {previewVideoId === cover.videoId && (
                  <div style={{ 
                    width: "8px", height: "8px", borderRadius: "50%", background: "#6366f1", 
                    boxShadow: "0 0 10px #6366f1" 
                  }} />
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Scan result summary + skipped videos (collapsible) */}
      {scanResult && (scanResult.catalogMatched != null || scanResult.skippedVideos?.length > 0) && (
        <div style={{
          background: "rgba(20,24,50,0.8)", borderRadius: "20px", padding: "24px",
          border: "1px solid rgba(99,102,241,0.1)", marginTop: "20px", backdropFilter: "blur(10px)"
        }}>
          <div style={{ fontSize: "14px", fontWeight: 700, color: "#f1f5f9", marginBottom: "12px" }}>
            スキャン結果サマリ
          </div>
          <div style={{ display: "flex", gap: "16px", flexWrap: "wrap", fontSize: "13px", color: "#94a3b8", marginBottom: "12px" }}>
            <span style={{ color: "#22c55e" }}>Stage 2 (逆引き): {scanResult.stage2Matched || 0}曲</span>
            <span style={{ color: "#818cf8" }}>Stage 3 (AI判定): {scanResult.stage3Matched || 0}曲</span>
            <span style={{ color: "#eab308" }}>スキップ: {scanResult.unmatchedSkipped || 0}曲</span>
            <span>登録合計: {scanResult.covers?.length || 0}曲</span>
          </div>
          {scanResult.skippedVideos?.length > 0 && (
            <>
              <button
                onClick={() => setSkippedOpen(v => !v)}
                style={{
                  background: "rgba(234,179,8,0.1)", border: "1px solid rgba(234,179,8,0.25)",
                  color: "#eab308", fontSize: "12px", padding: "6px 12px", borderRadius: "8px",
                  cursor: "pointer", marginBottom: skippedOpen ? "12px" : 0,
                }}
              >
                {skippedOpen ? "▼" : "▶"} スキップされた{scanResult.skippedVideos.length}曲を表示
              </button>
              {skippedOpen && (
                <div style={{ display: "flex", flexDirection: "column", gap: "6px", fontSize: "12px" }}>
                  {scanResult.skippedVideos.map((s, i) => (
                    <div key={i} style={{
                      padding: "8px 12px", borderRadius: "8px",
                      background: "rgba(10,14,39,0.5)", border: "1px solid rgba(99,102,241,0.08)",
                    }}>
                      <div style={{ color: "#f1f5f9", fontWeight: 500 }}>{s.youtubeTitle}</div>
                      {s.searchQuery && (
                        <div style={{ color: "#94a3b8", marginTop: "2px" }}>
                          クエリ: {s.searchQuery} → 理由: {s.reason}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      )}
    </div>
  );
}
