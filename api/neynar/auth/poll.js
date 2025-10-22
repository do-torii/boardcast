// Vercel serverless function: Poll Neynar/Farcaster login status
// Expects envs:
// - NEYNAR_AUTH_POLL_URL: Full URL to Neynar poll/status endpoint
// - NEYNAR_API_KEY: API key (optional)
// - NEYNAR_API_KEY_HEADER: Header name for API key (default: 'api_key')
// - POLL_MAX_MS: optional max wait (default 60000)
// - POLL_INTERVAL_MS: optional interval (default 1500)

function sleep(ms) { return new Promise(r => setTimeout(r, ms)) }

function mapUserToSession(u) {
  if (!u) return null
  const fid = u.fid || u.user?.fid
  const username = u.username || u.user?.username || u.handle || u.user?.handle
  const displayName = u.displayName || u.display_name || u.name || u.user?.display_name || u.user?.name
  const pfpUrl = u.pfpUrl || u.pfp_url || u.profile?.pfp_url || u.user?.pfp_url
  if (!fid || !username) return null
  return { fid, username, displayName, pfpUrl }
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }
  let token
  try { token = (req.body && req.body.token) || JSON.parse(req.body || '{}').token } catch {}
  if (!token) {
    res.status(400).json({ error: 'missing_token' })
    return
  }

  const pollUrl = process.env.NEYNAR_AUTH_POLL_URL
  if (!pollUrl) {
    res.status(500).json({ error: 'Missing NEYNAR_AUTH_POLL_URL env' })
    return
  }
  const userUrl = process.env.NEYNAR_USER_URL || process.env.NEYNAR_AUTH_USER_URL

  const headers = { 'Accept': 'application/json' }
  const apiKey = process.env.NEYNAR_API_KEY
  const apiKeyHeader = process.env.NEYNAR_API_KEY_HEADER || 'api_key'
  if (apiKey) headers[apiKeyHeader] = apiKey
  const authScheme = process.env.NEYNAR_POLL_AUTH_SCHEME // e.g., 'Bearer'
  if (authScheme) headers['Authorization'] = `${authScheme} ${token}`

  const maxMs = Number(process.env.POLL_MAX_MS || 60000)
  const intervalMs = Number(process.env.POLL_INTERVAL_MS || 1500)
  const start = Date.now()

  try {
    while (Date.now() - start < maxMs) {
      const method = (process.env.NEYNAR_POLL_METHOD || 'POST').toUpperCase()
      const queryKey = process.env.NEYNAR_POLL_QUERY_KEY // e.g., 'token' or 'signer_uuid'
      const bodyKey = process.env.NEYNAR_POLL_BODY_KEY // e.g., 'token' or 'signer_uuid'

      let url = pollUrl
      let opts = { method, headers: { ...headers } }

      if (method === 'GET') {
        if (queryKey) {
          const u = new URL(url)
          u.searchParams.set(queryKey, token)
          url = u.toString()
        }
      } else {
        opts.headers['Content-Type'] = 'application/json'
        const key = bodyKey || 'token'
        opts.body = JSON.stringify({ [key]: token })
      }

      const r = await fetch(url, opts)
      if (!r.ok) {
        const text = await r.text().catch(() => '')
        res.status(r.status).json({ error: 'poll_failed', detail: text })
        return
      }
      const data = await r.json()

      // Check status/common shapes
      const status = (data.status || data.state || data.result?.status || '').toString().toLowerCase()
      const userRaw = data.user || data.result?.user || data.profile || data.result?.profile || data.data?.user
      const sess = mapUserToSession(userRaw)
      if (sess) { res.json(sess); return }

      // If this is an authorize-style flow, we might receive an access token first, then need a secondary call to fetch user
      const accessToken = data.access_token || data.result?.access_token || data.token || data.result?.token
      if (accessToken && userUrl) {
        const uh = { 'Accept': 'application/json' }
        if (apiKey) uh[apiKeyHeader] = apiKey
        uh['Authorization'] = `Bearer ${accessToken}`
        const ur = await fetch(userUrl, { headers: uh })
        if (ur.ok) {
          const udata = await ur.json().catch(() => ({}))
          const sess2 = mapUserToSession(udata.user || udata.result?.user || udata.profile || udata)
          if (sess2) { res.json(sess2); return }
        }
      }
      if (status.includes('approved') || status.includes('complete') || status === 'success') {
        // Some APIs return user data nested under different keys even after approved; try again mapping the root
        const s2 = mapUserToSession(data)
        if (s2) { res.json(s2); return }
      }

      await sleep(intervalMs)
    }
    res.status(202).json({ error: 'timeout', message: 'Login not approved in time' })
  } catch (err) {
    res.status(500).json({ error: 'poll_exception', message: String(err && err.message || err) })
  }
}
