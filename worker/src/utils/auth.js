// JWT (HS256) using Web Crypto API — works in Cloudflare Workers

const enc = new TextEncoder()
const dec = new TextDecoder()

function b64urlEncode(buffer) {
  let str
  if (buffer instanceof ArrayBuffer || buffer instanceof Uint8Array) {
    const bytes = buffer instanceof ArrayBuffer ? new Uint8Array(buffer) : buffer
    str = btoa(String.fromCharCode(...bytes))
  } else {
    str = btoa(buffer)
  }
  return str.replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

function b64urlDecode(str) {
  let s = str.replace(/-/g, '+').replace(/_/g, '/')
  while (s.length % 4) s += '='
  return atob(s)
}

async function importKey(secret) {
  return crypto.subtle.importKey(
    'raw', enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false, ['sign', 'verify']
  )
}

export async function signJWT(payload, secret) {
  const header = { alg: 'HS256', typ: 'JWT' }
  const headerB64 = b64urlEncode(JSON.stringify(header))
  const payloadB64 = b64urlEncode(JSON.stringify(payload))
  const data = `${headerB64}.${payloadB64}`

  const key = await importKey(secret)
  const sig = await crypto.subtle.sign('HMAC', key, enc.encode(data))
  const sigB64 = b64urlEncode(sig)

  return `${data}.${sigB64}`
}

export async function verifyJWT(token, secret) {
  try {
    const parts = token.split('.')
    if (parts.length !== 3) return null
    const [headerB64, payloadB64, sigB64] = parts
    const data = `${headerB64}.${payloadB64}`

    // Verify signature
    const key = await importKey(secret)
    const sigBytes = Uint8Array.from(b64urlDecode(sigB64), c => c.charCodeAt(0))
    const valid = await crypto.subtle.verify('HMAC', key, sigBytes, enc.encode(data))
    if (!valid) return null

    // Parse + check expiry
    const payload = JSON.parse(b64urlDecode(payloadB64))
    if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null
    return payload
  } catch {
    return null
  }
}

/**
 * Verify request has valid admin Authorization header.
 * Returns payload on success, null on failure.
 */
export async function verifyAuth(request, env) {
  const auth = request.headers.get('Authorization')
  if (!auth || !auth.startsWith('Bearer ')) return null
  const token = auth.substring(7)
  return await verifyJWT(token, env.JWT_SECRET || 'covery-jwt-secret-2026')
}
