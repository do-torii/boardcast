export type Session = {
  fid: number
  username: string
  displayName?: string
  pfpUrl?: string
  custodyAddress?: string
  accessToken?: string
}

export type BeginLogin = {
  token: string
  approvalUrl?: string
}

export async function beginNeynarLogin(): Promise<BeginLogin> {
  // Use demo only in local dev when explicitly enabled
  const usingDemo = import.meta.env.DEV && import.meta.env.VITE_NEYNAR_DEMO === '1'

  if (usingDemo) {
    return { token: 'demo-token', approvalUrl: undefined }
  }

  try {
    const res = await fetch('/api/neynar/auth/begin', { method: 'POST' })
    if (!res.ok) {
      if ((res as any).status === 404 && import.meta.env.DEV) {
        console.warn('[beginNeynarLogin] 404 in dev; falling back to demo')
        return { token: 'demo-token', approvalUrl: undefined }
      }
      throw new Error('로그인 시작 실패')
    }
    return res.json()
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[beginNeynarLogin] network error; falling back to demo:', err)
      return { token: 'demo-token', approvalUrl: undefined }
    }
    throw err
  }
}

export async function pollNeynarLogin(token: string): Promise<Session> {
  // Use demo only in local dev when explicitly enabled
  const usingDemo = import.meta.env.DEV && import.meta.env.VITE_NEYNAR_DEMO === '1'

  if (usingDemo) {
    await new Promise(r => setTimeout(r, 1200))
    return {
      fid: 999999,
      username: 'demo_user',
      displayName: 'Demo User',
      pfpUrl: 'https://avatars.githubusercontent.com/u/9919?s=80&v=4',
    }
  }

  try {
    const res = await fetch('/api/neynar/auth/poll', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token }),
    })
    if (!res.ok) {
      if ((res as any).status === 404 && import.meta.env.DEV) {
        console.warn('[pollNeynarLogin] 404 in dev; using demo session')
        return {
          fid: 999999,
          username: 'demo_user',
          displayName: 'Demo User',
          pfpUrl: 'https://avatars.githubusercontent.com/u/9919?s=80&v=4',
        }
      }
      throw new Error('승인 상태 조회 실패')
    }
    return res.json()
  } catch (err) {
    if (import.meta.env.DEV) {
      console.warn('[pollNeynarLogin] network error; using demo session:', err)
      return {
        fid: 999999,
        username: 'demo_user',
        displayName: 'Demo User',
        pfpUrl: 'https://avatars.githubusercontent.com/u/9919?s=80&v=4',
      }
    }
    throw err
  }
}

export function revokeSession(_session: Session) {
  // Implement if needed by calling your backend to revoke tokens
}
