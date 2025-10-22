// Vercel serverless function: Begin Neynar/Farcaster login
// Expects envs:
// - NEYNAR_AUTH_BEGIN_URL: Full URL to Neynar begin endpoint
// - NEYNAR_API_KEY: API key (optional)
// - NEYNAR_API_KEY_HEADER: Header name for API key (default: 'api_key')
// - NEYNAR_CLIENT_ID: Optional client id to send
// - NEYNAR_REDIRECT_URI: Optional redirect URI to send

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' })
    return
  }

  const beginUrl = process.env.NEYNAR_AUTH_BEGIN_URL
  if (!beginUrl) {
    res.status(500).json({ error: 'Missing NEYNAR_AUTH_BEGIN_URL env' })
    return
  }

  const headers = { 'Accept': 'application/json' }
  const apiKey = process.env.NEYNAR_API_KEY
  const apiKeyHeader = process.env.NEYNAR_API_KEY_HEADER || 'api_key'
  if (apiKey) headers[apiKeyHeader] = apiKey

  const payload = {}
  if (process.env.NEYNAR_CLIENT_ID) payload.client_id = process.env.NEYNAR_CLIENT_ID
  if (process.env.NEYNAR_REDIRECT_URI) payload.redirect_uri = process.env.NEYNAR_REDIRECT_URI
  if (process.env.NEYNAR_SCOPE) payload.scope = process.env.NEYNAR_SCOPE
  if (process.env.NEYNAR_RESPONSE_TYPE) payload.response_type = process.env.NEYNAR_RESPONSE_TYPE

  try {
    const method = (process.env.NEYNAR_BEGIN_METHOD || 'POST').toUpperCase()
    let url = beginUrl
    let opts = { method, headers: { ...headers } }
    if (method === 'GET') {
      const u = new URL(url)
      for (const [k, v] of Object.entries(payload)) if (v != null) u.searchParams.set(k, v)
      url = u.toString()
    } else {
      opts.headers['Content-Type'] = 'application/json'
      opts.body = JSON.stringify(payload)
    }
    const r = await fetch(url, opts)
    if (!r.ok) {
      const text = await r.text().catch(() => '')
      res.status(r.status).json({ error: 'begin_failed', detail: text })
      return
    }
    const data = await r.json()

    // Best-effort mapping of different field names to a common shape
    const token = data?.token || data?.request_token || data?.requestToken || data?.result?.token || data?.signer_uuid || data?.result?.signer_uuid
    const approvalUrl = data?.approval_url || data?.approvalUrl || data?.url || data?.deeplink_url || data?.sign_in_url || data?.result?.approval_url

    if (!token) {
      res.status(502).json({ error: 'missing_token_in_begin_response', raw: data })
      return
    }

    res.json({ token, approvalUrl })
  } catch (err) {
    res.status(500).json({ error: 'begin_exception', message: String(err && err.message || err) })
  }
}
