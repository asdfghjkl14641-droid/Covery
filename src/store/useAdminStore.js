import { create } from 'zustand'

const DECISIONS_KEY = 'covery-channel-decisions'
const COVER_DECISIONS_KEY = 'covery-cover-decisions'
const DEVMODE_KEY = 'covery-dev-mode'
const SCAN_RESULTS_KEY = 'covery-scan-results'
const CHANNELS_KEY = 'covery-preview-channels'

function loadJSON(key, fallback) {
  try { const r = localStorage.getItem(key); return r ? JSON.parse(r) : fallback } catch { return fallback }
}
function saveJSON(key, val) {
  try { localStorage.setItem(key, JSON.stringify(val)) } catch {}
}

function buildApprovedIds(decisions) {
  return new Set(
    Object.entries(decisions).filter(([, v]) => v === 'approved').map(([k]) => k)
  )
}

const initDec = loadJSON(DECISIONS_KEY, {})

export const useAdminStore = create((set, get) => ({
  decisions: initDec,
  approvedIds: buildApprovedIds(initDec),
  devMode: localStorage.getItem(DEVMODE_KEY) === 'true',

  // Preview channels — persisted in localStorage
  previewChannels: loadJSON(CHANNELS_KEY, null), // null = not yet initialized

  // Per-cover decisions (persisted)
  coverDecisions: loadJSON(COVER_DECISIONS_KEY, {}), // { videoId: 'approved'|'rejected' }

  // Scan state
  scanProgress: {},
  scanResults: loadJSON(SCAN_RESULTS_KEY, {}),

  reload: () => {
    const d = loadJSON(DECISIONS_KEY, {})
    set({ decisions: d, approvedIds: buildApprovedIds(d) })
  },

  setDevMode: (val) => {
    localStorage.setItem(DEVMODE_KEY, String(val))
    set({ devMode: val })
  },

  saveDecisions: (d) => {
    saveJSON(DECISIONS_KEY, d)
    set({ decisions: d, approvedIds: buildApprovedIds(d) })
  },

  // ── Preview channels management ──
  initChannels: (channels) => {
    // Only set if not already in localStorage
    if (get().previewChannels) return
    saveJSON(CHANNELS_KEY, channels)
    set({ previewChannels: channels })
  },

  addChannels: (newChannels) => {
    const existing = get().previewChannels || []
    const existingIds = new Set(existing.map(c => c.channelId))
    const unique = newChannels.filter(c => !existingIds.has(c.channelId))
    if (unique.length === 0) return
    const updated = [...existing, ...unique]
    saveJSON(CHANNELS_KEY, updated)
    set({ previewChannels: updated })
  },

  getKnownChannelIds: () => {
    const chs = get().previewChannels || []
    const ids = new Set(chs.map(c => c.channelId))
    Object.keys(get().decisions).forEach(id => ids.add(id))
    return ids
  },

  // Scan lifecycle
  startScan: (channelId) => {
    const d = { ...get().decisions, [channelId]: 'scanning' }
    saveJSON(DECISIONS_KEY, d)
    set({ decisions: d, scanProgress: { ...get().scanProgress, [channelId]: { found: 0, filtered: 0, current: '開始...' } } })
  },

  updateScanProgress: (channelId, progress) => {
    set({ scanProgress: { ...get().scanProgress, [channelId]: progress } })
  },

  completeScan: (channelId, results) => {
    const sr = { ...get().scanResults, [channelId]: {
      covers: results.covers,
      scannedAt: new Date().toISOString(),
      catalogMatched: results.catalogMatched || 0,
      spotifyAdded: results.spotifyAdded || 0,
      unmatchedSkipped: results.unmatchedSkipped || 0,
      stage2Matched: results.stage2Matched || 0,
      stage3Matched: results.stage3Matched || 0,
      skippedVideos: results.skippedVideos || [],
    } }
    saveJSON(SCAN_RESULTS_KEY, sr)
    const d = { ...get().decisions, [channelId]: 'approved' }
    saveJSON(DECISIONS_KEY, d)
    const { [channelId]: _, ...restProgress } = get().scanProgress
    set({ decisions: d, approvedIds: buildApprovedIds(d), scanResults: sr, scanProgress: restProgress })
  },

  failScan: (channelId, error) => {
    const d = { ...get().decisions, [channelId]: 'pending' }
    saveJSON(DECISIONS_KEY, d)
    const { [channelId]: _, ...restProgress } = get().scanProgress
    set({ decisions: d, approvedIds: buildApprovedIds(d), scanProgress: restProgress })
  },

  // ── Per-cover decisions ──
  setCoverDecision: (videoId, status) => {
    const cd = { ...get().coverDecisions, [videoId]: status }
    saveJSON(COVER_DECISIONS_KEY, cd)
    set({ coverDecisions: cd })
  },

  rejectCover: (videoId) => {
    const cd = { ...get().coverDecisions, [videoId]: 'rejected' }
    saveJSON(COVER_DECISIONS_KEY, cd)
    set({ coverDecisions: cd })
  },

  // Auto-replenish state (in-memory only)
  autoReplenish: true,
  replenishProgress: null,
  setAutoReplenish: (val) => set({ autoReplenish: val }),
  setReplenishProgress: (p) => set({ replenishProgress: p }),
}))
