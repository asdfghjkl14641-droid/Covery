import { create } from 'zustand'

const DECISIONS_KEY = 'covery-channel-decisions'
const DEVMODE_KEY = 'covery-dev-mode'
const SCAN_RESULTS_KEY = 'covery-scan-results'

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
  devMode: localStorage.getItem(DEVMODE_KEY) !== 'false',

  // Scan state (in-memory only — progress resets on reload, results persist)
  scanProgress: {},   // { channelId: { found, filtered, current } }
  scanResults: loadJSON(SCAN_RESULTS_KEY, {}), // { channelId: { covers, scannedAt } }

  reload: () => {
    const d = loadJSON(DECISIONS_KEY, {})
    set({ decisions: d, approvedIds: buildApprovedIds(d) })
  },

  setDevMode: (val) => {
    localStorage.setItem(DEVMODE_KEY, String(val))
    set({ devMode: val })
  },

  // Save decisions to localStorage + rebuild approvedIds
  saveDecisions: (d) => {
    saveJSON(DECISIONS_KEY, d)
    set({ decisions: d, approvedIds: buildApprovedIds(d) })
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
    // Save results
    const sr = { ...get().scanResults, [channelId]: { covers: results.covers, scannedAt: new Date().toISOString() } }
    saveJSON(SCAN_RESULTS_KEY, sr)
    // Set status to approved
    const d = { ...get().decisions, [channelId]: 'approved' }
    saveJSON(DECISIONS_KEY, d)
    const { [channelId]: _, ...restProgress } = get().scanProgress
    set({ decisions: d, approvedIds: buildApprovedIds(d), scanResults: sr, scanProgress: restProgress })
  },

  failScan: (channelId, error) => {
    // Revert to pending
    const d = { ...get().decisions, [channelId]: 'pending' }
    saveJSON(DECISIONS_KEY, d)
    const { [channelId]: _, ...restProgress } = get().scanProgress
    set({ decisions: d, approvedIds: buildApprovedIds(d), scanProgress: restProgress })
  },
}))
