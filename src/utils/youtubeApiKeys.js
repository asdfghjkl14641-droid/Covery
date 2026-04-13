const KEYS = [
  'AIzaSyDdSK0JD-v9ql2HkXwILCVLX2RBpxe-GiQ',
  'AIzaSyC7MrE2yA_CseuAtROtLUuLuy7Bhjok0ww',
  'AIzaSyBITV4S01F3Ig8CrwKtq1v4MMeXVXuGeEA',
  'AIzaSyBAhuZwed17ykmhhYFMTdcTnfeB86btnk4',
  'AIzaSyAU7liph9pmhiDTPCaOgHu_YSVfMZr4_6E',
  'AIzaSyC0UKfU2iwYAqL0UM2QXaVsUZatKwxlmU8',
  'AIzaSyA_56zIBY3wWRhEwqx9SjDbZ5RQ4VfVt44',
  'AIzaSyBJs8fy9LL7sd0dxhZzumr3pTXLUceSCoQ',
  'AIzaSyAvNz83-XKmdGSSRp1O-NcuVIYdcQfEpWY',
  'AIzaSyB7iWz-Rc4ASxfo_hkhJpwQcwdN89FGxW0',
  'AIzaSyBGVptHTPA57aFaCgB2ClBv4QaulMpHY0A',
]

let currentIndex = 0

function rotateKey() {
  currentIndex++
  if (currentIndex >= KEYS.length) throw new Error('ALL_KEYS_EXHAUSTED')
  console.log(`[Covery] APIキー切替: ${currentIndex + 1}/${KEYS.length}`)
  return KEYS[currentIndex]
}

/**
 * Fetch YouTube API with auto key rotation on 403.
 */
export async function ytFetch(url) {
  const sep = url.includes('?') ? '&' : '?'

  while (currentIndex < KEYS.length) {
    const res = await fetch(`${url}${sep}key=${KEYS[currentIndex]}`)
    if (res.status === 403) {
      try { rotateKey() } catch { throw new Error('ALL_KEYS_EXHAUSTED') }
      continue
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    return res.json()
  }

  throw new Error('ALL_KEYS_EXHAUSTED')
}
