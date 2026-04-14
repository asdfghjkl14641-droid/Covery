import axios from 'axios'

let keys = null
let currentIndex = 0

function ensureKeys() {
  if (keys) return
  keys = [
    process.env.YOUTUBE_API_KEY,
    ...Array.from({ length: 30 }, (_, i) => process.env[`YOUTUBE_API_KEY_${i + 1}`]),
  ].filter(Boolean)
}

export function getApiKey() {
  ensureKeys()
  return keys[currentIndex]
}

export function rotateKey() {
  ensureKeys()
  currentIndex++
  if (currentIndex >= keys.length) {
    throw new Error('ALL_KEYS_EXHAUSTED')
  }
  console.log(`  🔑 APIキー切替: ${currentIndex + 1}/${keys.length}番目`)
  return keys[currentIndex]
}

export function getKeyStatus() {
  ensureKeys()
  return `キー ${Math.min(currentIndex + 1, keys.length)}/${keys.length}`
}

export async function ytFetch(url) {
  ensureKeys()
  const sep = url.includes('?') ? '&' : '?'

  while (currentIndex < keys.length) {
    try {
      const res = await axios.get(`${url}${sep}key=${keys[currentIndex]}`)
      return res.data
    } catch (e) {
      if (e.response?.status === 403) {
        try { rotateKey() } catch { throw new Error('ALL_KEYS_EXHAUSTED') }
        continue
      }
      throw e
    }
  }

  throw new Error('ALL_KEYS_EXHAUSTED')
}
