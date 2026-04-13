import axios from 'axios'

const keys = [
  process.env.YOUTUBE_API_KEY,
  process.env.YOUTUBE_API_KEY_1,
  process.env.YOUTUBE_API_KEY_2,
  process.env.YOUTUBE_API_KEY_3,
  process.env.YOUTUBE_API_KEY_4,
  process.env.YOUTUBE_API_KEY_5,
  process.env.YOUTUBE_API_KEY_6,
  process.env.YOUTUBE_API_KEY_7,
  process.env.YOUTUBE_API_KEY_8,
  process.env.YOUTUBE_API_KEY_9,
  process.env.YOUTUBE_API_KEY_10,
].filter(Boolean)

let currentIndex = 0

export function getApiKey() {
  return keys[currentIndex]
}

export function rotateKey() {
  currentIndex++
  if (currentIndex >= keys.length) {
    throw new Error('ALL_KEYS_EXHAUSTED')
  }
  console.log(`  🔑 APIキー切替: ${currentIndex + 1}/${keys.length}番目`)
  return keys[currentIndex]
}

export function getKeyStatus() {
  return `キー ${Math.min(currentIndex + 1, keys.length)}/${keys.length}`
}

/**
 * Fetch from YouTube API with automatic key rotation on 403.
 * @param {string} url - Full URL without &key= parameter
 * @returns {Promise<object>} JSON response
 */
export async function ytFetch(url) {
  const sep = url.includes('?') ? '&' : '?'

  while (currentIndex < keys.length) {
    try {
      const res = await axios.get(`${url}${sep}key=${keys[currentIndex]}`)
      return res.data
    } catch (e) {
      if (e.response?.status === 403) {
        try {
          rotateKey()
        } catch {
          throw new Error('ALL_KEYS_EXHAUSTED')
        }
        continue // retry with new key
      }
      throw e // other error, don't retry
    }
  }

  throw new Error('ALL_KEYS_EXHAUSTED')
}
