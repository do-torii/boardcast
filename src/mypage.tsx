import React, { useEffect, useMemo, useState } from 'react'
import { createRoot } from 'react-dom/client'
import './app/boardcast.css'
import './styles.css'
import supabase from './lib/supabaseClient'
import { getCurrentStreak } from './lib/streaks'

type Note = {
  id: string
  title: string
  body: string
  color: 'yellow' | 'pink' | 'mint' | 'lav' | 'blue'
  category: string
  author: string
  created_at: string
  likes?: number | null
  pinned?: boolean | null
}

type Session = {
  fid?: number
  username?: string
  displayName?: string
  pfpUrl?: string
}

function getStoredSession(): Session | null {
  try { const s = sessionStorage.getItem('fc.session'); return s ? JSON.parse(s) : null } catch { return null }
}
function getLikeUserId(): string | undefined {
  const s = getStoredSession()
  const sid = (s?.fid != null ? String(s.fid) : (s?.username || ''))
  if (sid) return sid
  try {
    const key = 'like.user.id'
    let anon = localStorage.getItem(key)
    if (!anon) { anon = Math.random().toString(36).slice(2); localStorage.setItem(key, anon) }
    return anon
  } catch { return undefined }
}

function MyPage() {
  const [session, setSession] = useState<Session | null>(() => getStoredSession())
  const [notes, setNotes] = useState<Note[]>([])
  const [streak, setStreak] = useState(0)
  const authorHandle = useMemo(() => session?.username ? `@${session.username}` : undefined, [session])

  useEffect(() => {
    setSession(getStoredSession())
  }, [])

  useEffect(() => {
    const uid = getLikeUserId()
    if (uid) getCurrentStreak(uid).then((n) => setStreak(n)).catch(() => {})
  }, [session])

  useEffect(() => {
    (async () => {
      try {
        if (!authorHandle) { setNotes([]); return }
        const { data, error } = await supabase
          .from('notes')
          .select('*')
          .eq('author', authorHandle)
          .order('created_at', { ascending: false })
        if (error) throw error
        setNotes((data || []) as any)
      } catch (e) {
        console.warn('Load my notes failed', e)
        setNotes([])
      }
    })()
  }, [authorHandle])

  return (
    <div style={{ padding: 16 }}>
      <header style={{ display:'flex', alignItems:'center', justifyContent:'space-between', paddingBottom:8, borderBottom:'2px solid var(--ink)' }}>
        <div style={{ display:'flex', alignItems:'center', gap:10 }}>
          <div className="profile-pfp" style={{ width:40, height:40 }}>
            {session?.pfpUrl ? <img src={session.pfpUrl} alt="" /> : <div className="pfp-placeholder" />}
          </div>
          <div>
            <div className="profile-name">{session?.displayName || (session?.username ? `@${session.username}` : 'My Page')}</div>
            {session?.username && <div className="profile-username">@{session.username}</div>}
          </div>
        </div>
        <div className="streak-pill"><span role="img" aria-label="fire">🔥</span><span className="streak-num">{streak}</span></div>
      </header>

      <section style={{ marginTop: 12 }}>
        <div className="feed-hdr"><div className="feed-lbl">My Notes</div></div>
        {authorHandle ? (
          <div className="feed" id="feedGrid">
            {notes.map((n) => (
              <div key={n.id} className="note" data-color={n.color} style={{ position:'relative', minHeight:80, marginBottom:10, padding:'10px 10px 26px' }}>
                <div className="meta">{n.title}</div>
                {n.body && <div className="preview">{n.body}</div>}
                <div className="footer">
                  <div className="bytime">
                    <span className="by">{n.author}</span>
                    <span className="tim">{new Date(n.created_at).toLocaleDateString()}</span>
                  </div>
                  <div className="likepill"><span className="icon heart">❤</span><span>{n.likes || 0}</span></div>
                </div>
              </div>
            ))}
            {notes.length === 0 && <div style={{ color:'#666', padding:8 }}>No notes yet.</div>}
          </div>
        ) : (
          <div style={{ color:'#666', padding:8 }}>Sign in to view your notes.</div>
        )}
      </section>
    </div>
  )
}

const rootEl = document.getElementById('root')!
createRoot(rootEl).render(
  <React.StrictMode>
    <MyPage />
  </React.StrictMode>
)

