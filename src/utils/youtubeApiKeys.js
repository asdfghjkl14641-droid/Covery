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
  'AIzaSyBjh0qfk11q0v37bvckEZyTezh83TjxBqs',
  'AIzaSyABpjafs0679bIVpDEt48YU0MQJZWrpuyA',
  'AIzaSyB7IAQ8Ih7K7eLZHsguU28FCoZnbgu6FS4',
  'AIzaSyCClWQY3n71Txh7TB-yp63EGTTJKa5h-Pc',
  'AIzaSyDBj7pLSQcJF_irEwfwre7e__6hjMqNRg4',
  'AIzaSyB5EXQf3lo_xi72wfAULbxhD_FERZ9o9sc',
  'AIzaSyCssDKHy2IzNhsOgYxkQOPss27X8m34ZzY',
  'AIzaSyAZsRIUlkrGa2If6mXkp31nhPAiOJJV4t4',
  'AIzaSyABcZdJJRwFDqQoVU-CKFPKX3YNK5KcfF0',
  'AIzaSyAmullRyTupPJj-UgAcUOIJwCuHxycfDhg',
  'AIzaSyAqYHAFbVeOjHZ2s4ray4nUoUSNwNkvI-U',
  'AIzaSyDwmrmr20yMvQWvbOEqTKik_3WKBslt1fA',
  'AIzaSyBFHi5yi8UQdk2dKUIF7ZkdM0ayc_AzQqM',
  'AIzaSyDNy56oYF2kDIKS7yEplLeEIKQVotUeL60',
  'AIzaSyC5eCUbuDahKf-eXpMBO1KHAhZIpivVbMo',
  'AIzaSyCfeGkztKaGRUUw4476UfbafF3-QhDVsGU',
  'AIzaSyA3PcbMM8MBVsF8jguI0Q0WDIqypI4uZ0A',
  'AIzaSyCEJqpLGgLZONbLKthFz7phLbCeSUBtho8',
  'AIzaSyAdZ9bv3ejagwPgMfrEest3KX3YLGGEyp8',
  'AIzaSyAmZjpSynrBXPCOZ985FFyHRwGfbkihnfk',
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
