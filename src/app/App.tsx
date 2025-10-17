import { useEffect, useState } from 'react'
import sdk from '@farcaster/miniapp-sdk'
import { beginNeynarLogin, pollNeynarLogin, Session } from '@/auth/neynar'
import './boardcast.css'

type NoteColor = 'yellow' | 'pink' | 'mint' | 'lav' | 'blue'
type Note = {
  id: string
  title?: string
  body?: string
  color: NoteColor
  category?: string
  createdAt?: number
  author?: string
  likes?: number
  liked?: boolean
}

function timeAgo(ts: number) {
  const d = Date.now() - ts
  const m = Math.floor(d / 60000)
  if (m < 1) return 'now'
  if (m < 60) return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24) return `${h}h ago`
  const days = Math.floor(h / 24)
  return `${days}day ago`
}

function useTick(ms = 60000) {
  const [, setT] = useState(0)
  useEffect(() => {
    const id = setInterval(() => setT((t) => t + 1), ms)
    return () => clearInterval(id)
  }, [ms])
}

function NoteCard({ note, small, onClick }: { note: Note; small?: boolean; onClick?: () => void }) {
  return (
    <div
      className={`note ${small ? 'small' : ''}`}
      data-color={note.color}
      role="button"
      tabIndex={0}
      onClick={onClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault()
          onClick?.()
        }
      }}
    >
      {!small && <div className="pin" />}
      {small && note.category && <div className="catline">{note.category}</div>}
      {note.title && <div className="meta">{note.title}</div>}
      {note.body && <div className="preview">{note.body}</div>}
      <div className="footer">
        <div className="bytime">
          <span className="by">{note.author || '@anon'}</span>
          {small && (
            <span className="tim">{timeAgo(note.createdAt || Date.now())}</span>
          )}
        </div>
        <div className="likepill">
          <span className={"icon heart " + (note.liked ? "liked" : "")}>{note.liked ? "\u2665" : "\u2661"}</span>
          <span>{note.likes || 0}</span>
        </div>
      </div>
    </div>
  )
}

export default function App() {
  useTick(30_000)
  const [pinned, setPinned] = useState<Note[]>([    { id: 'p1', title: 'Team Meeting', body: 'Notes for today at 4 PM', color: 'mint', category: 'event', author: '@mj', createdAt: Date.now() - 3600_000, likes: 3 },
    { id: 'p2', title: 'Idea', body: 'Improvement to board interactions', color: 'yellow', category: 'boast', author: '@jk', createdAt: Date.now() - 7200_000, likes: 1 },
    { id: 'p3', title: 'Sprint', body: 'Next sprint goals', color: 'blue', category: 'notice', author: '@pm', createdAt: Date.now() - 5400_000, likes: 5 },
  ])
  const [feed, setFeed] = useState<Note[]>([    { id: 'f1', title: 'Research', body: 'User testing schedule', color: 'lav', category: 'talk', author: '@ux', createdAt: Date.now() - 14 * 60_000, likes: 2 },
    { id: 'f2', title: 'Bug', body: 'Mobile scroll jitter', color: 'pink', category: 'notice', author: '@fe', createdAt: Date.now() - 30 * 60_000 },
    { id: 'f3', title: 'Release', body: 'v0.1.2 tag', color: 'yellow', category: 'event', author: '@ops', createdAt: Date.now() - 50 * 60_000, likes: 7 },
    { id: 'f4', title: 'Inquiry', body: 'Client A request summary', color: 'mint', category: 'talk', author: '@cs', createdAt: Date.now() - 2 * 3600_000 },
    { id: 'f5', title: 'Design', body: 'New button style', color: 'blue', category: 'boast', author: '@ds', createdAt: Date.now() - 6 * 3600_000 },
  ])
  const [detail, setDetail] = useState<Note | null>(null)
  const [showCompose, setShowCompose] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [loginBusy, setLoginBusy] = useState<'idle' | 'loading' | 'polling'>('idle')
  const [activeCategory, setActiveCategory] = useState('')
  const [showSplash, setShowSplash] = useState(true)
  const [showProfile, setShowProfile] = useState(false)
  const [walletName, setWalletName] = useState<string | null>(null)

  useEffect(() => {
    const cached = sessionStorage.getItem('fc.session')
    if (cached) setSession(JSON.parse(cached))
  }, [])

  // Always signal readiness ASAP so the splash hides in Mini Apps
  useEffect(() => {
    try { void sdk.actions.ready() } catch {}
  }, [])

  // Keep an in-app splash briefly for smoother transition
  useEffect(() => {
    const t = setTimeout(() => setShowSplash(false), 900)
    return () => clearTimeout(t)
  }, [])
  useEffect(() => { if (session) setShowSplash(false) }, [session])

  // Auto-login & display when running inside Farcaster Mini App
  useEffect(() => {
    (async () => {
      try {
        const inMini = await sdk.isInMiniApp().catch(() => false)
        if (!inMini) return

        await sdk.actions.ready()
        const ctx = await sdk.context
        if (!ctx?.user?.fid) return

        let accessToken: string | undefined
        try {
          const { token } = await sdk.quickAuth.getToken()
          accessToken = token
        } catch {}

        const next: Session = {
          fid: ctx.user.fid,
          username: ctx.user.username || String(ctx.user.fid),
          displayName: ctx.user.displayName,
          pfpUrl: ctx.user.pfpUrl,
          accessToken,
        }
        setSession((prev) => (prev?.fid === next.fid ? prev : next))
      } catch (err) {
        console.warn('[miniapp] auto-login skipped:', err)
      }
    })()
  }, [])

  useEffect(() => {
    if (session) sessionStorage.setItem('fc.session', JSON.stringify(session))
    else sessionStorage.removeItem('fc.session')
  }, [session])

  function signOut() {
    setSession(null)
    setShowProfile(false)
  }

  async function handleAvatarClick() {
    if (session) {
      setShowProfile((v) => !v)
      return
    }
    await handleAvatarLogin()
  }

  function handleConnectClick() {
    // Placeholder: integrate real wallet connection here
    console.log('connect wallet clicked')
  }

  async function handleAvatarLogin() {
    try {
      setLoginBusy('loading')
      const inMini = await sdk.isInMiniApp().catch(() => false)

      if (inMini) {
        await sdk.actions.ready()
        const ctx = await sdk.context
        // Force a Quick Auth prompt to ensure the user explicitly signs in
        const { token } = await sdk.quickAuth.getToken({ force: '1' } as any)
        const next: Session = {
          fid: ctx.user.fid,
          username: ctx.user.username || String(ctx.user.fid),
          displayName: ctx.user.displayName,
          pfpUrl: ctx.user.pfpUrl,
          accessToken: token,
        }
        setSession(next)
        alert(`Signed in as @${next.username}`)
      } else {
        // Fallback to Neynar Login for web preview
        const init = await beginNeynarLogin()
        setLoginBusy('polling')
        if (init.approvalUrl) window.open(init.approvalUrl, '_blank')
        const sess = await pollNeynarLogin(init.token)
        setSession(sess)
        alert(`Signed in as @${sess.username}`)
      }
    } catch (e) {
      console.error(e)
      alert('Sign-in failed. Please try again.')
    } finally {
      setLoginBusy('idle')
    }
  }

  function openDetail(id: string) {
    const n = pinned.find((x) => x.id === id) || feed.find((x) => x.id === id)
    if (n) setDetail(n)
  }

  function toggleLike(n: Note) {
    n.liked = !n.liked
    n.likes = Math.max(0, (n.likes || 0) + (n.liked ? 1 : -1))
    setPinned([...pinned])
    setFeed([...feed])
    setDetail((v) => (v ? { ...v } : v))
  }

  function addNote(form: FormData) {
    const title = String(form.get('title') || '').trim()
    const body = String(form.get('body') || '').trim()
    const categoryRaw = String(form.get('category') || '').trim()
    const color = String(form.get('color') || 'yellow') as NoteColor
    const pin = form.get('pin') === 'on'
    const uname = (session?.username || '').trim()
    const author = uname ? (uname.startsWith('@') ? uname : '@' + uname) : '@anon'
    if (!title || !body) {
      alert('Please enter both title and content')
      return
    }
    if (!categoryRaw) {
      alert('Please select a category')
      return
    }
    const n: Note = {
      id: Math.random().toString(36).slice(2),
      title,
      body,
      category: categoryRaw,
      color,
      author,
      createdAt: Date.now(),
      likes: 0,
      liked: false,
    }
    if (pin) setPinned(([n, ...pinned]).slice(0, 3))
    else setFeed([n, ...feed])
  }

  const pinnedFillers: Note[] = pinned.length ? pinned : [
    { id: 'e1', color: 'mint' },
    { id: 'e2', color: 'yellow' },
    { id: 'e3', color: 'blue' },
  ]
  // Show all selectable categories, even if there are no notes yet
  const categories = ['notice', 'event', 'talk', 'boast', 'recruit']
  const visibleFeed = feed.filter(n => (activeCategory ? n.category === activeCategory : true))

  return (
    <div className="bc">
      <div className="phone" id="app">
        <header>
          <div className="hdr-left">
            <button className="iconbtn" id="btnHome" aria-label="home">
              <svg viewBox="0 0 24 24" width="26" height="26">
                <path d="M3 12l9-8 9 8v8H14v-5H10v5H3z" />
              </svg>
            </button>
            <div className="title">BOARD CAST</div>
          </div>
          <div className="hdr-right">
            <button
              className="connectbtn"
              id="btnConnect"
              onClick={handleConnectClick}
              title="connect wallet"
            >
              {walletName || 'connect'}
            </button>
            <button
              className="avatarbtn"
              id="btnProfile"
              title="profile"
              onClick={handleAvatarClick}
              disabled={loginBusy !== 'idle'}
              aria-haspopup="dialog"
              aria-expanded={showProfile}
            >
              {session?.pfpUrl ? (
                <img src={session.pfpUrl} alt="" />
              ) : (
                <svg viewBox="0 0 24 24" aria-hidden="true" width="30" height="30">
                  <circle cx="12" cy="9" r="4" />
                  <path d="M5 20c0-3.5 3.3-6 7-6s7 2.5 7 6" />
                </svg>
              )}
            </button>
          </div>
        </header>

        <div className="content">
          <div className="today">Today’s Notes</div>

          <div className="hero" id="heroRow">
            {pinnedFillers.map((n) => (
              <div key={n.id} onClick={() => openDetail(n.id)}>
                <NoteCard note={n} />
              </div>
            ))}
          </div>

          <div className="feed-hdr">
            <div className="feed-lbl">Categories</div>
          </div>

          <div className="catrow">
            <button className={`catchip ${activeCategory==='' ? 'active' : ''}`} onClick={() => setActiveCategory('')}>All</button>
            {categories.map(c => (
              <button key={c} className={`catchip ${activeCategory===c ? 'active' : ''}`} onClick={() => setActiveCategory(c)}>{c}</button>
            ))}
          </div>

          <div className="feed-scroll">
            <div className="feed" id="feedGrid">
              {visibleFeed.map((n) => (
                <div key={n.id} onClick={() => openDetail(n.id)}>
                  <NoteCard note={n} small />
                </div>
              ))}
            </div>
          </div>
        </div>

        <div className="btbar">
          <button className="fab" id="btnCompose" onClick={() => setShowCompose(true)}>+</button>
        </div>

        {showSplash && (
          <div className="splash" aria-label="Loading">
            <div className="splash-inner">
              <div className="splash-logo" />
              <div className="splash-title">BOARD CAST</div>
              <div className="splash-sub">Loading...</div>
            </div>
          </div>
        )}

        {showProfile && session && (
          <>
            <div className="backdrop" onClick={() => setShowProfile(false)} />
            <div className="profile-pop" role="dialog" aria-modal="true" aria-label="Profile">
              <div className="profile-card">
                <div className="profile-head">
                  <div className="profile-pfp">
                    {session.pfpUrl ? (
                      <img src={session.pfpUrl} alt="" />
                    ) : (
                      <div className="pfp-placeholder" />
                    )}
                  </div>
                  <div className="profile-main">
                    <div className="profile-name">{session.displayName || `@${session.username}`}</div>
                    <div className="profile-username">@{session.username}</div>
                  </div>
                </div>
                <div className="row end" style={{ marginTop: 12 }}>
                  <button className="btn" onClick={signOut}>Sign out</button>
                </div>
              </div>
            </div>
          </>
        )}

      {(showCompose || detail) && (
  <div className="backdrop" onClick={() => { setShowCompose(false); setDetail(null) }} />
)}

{showCompose && (
  <div className="sheet" role="dialog" aria-modal="true" aria-label="Compose note">
    <div className="sheet-hdr">
      <div>Compose</div>
      <button className="iconbtn" onClick={() => setShowCompose(false)} aria-label="Close">x</button>
    </div>
    <form
      onSubmit={(e) => {
        e.preventDefault()
        const fd = new FormData(e.currentTarget)
        const t = String(fd.get('title') || '').trim()
        const b = String(fd.get('body') || '').trim()
        const c = String(fd.get('category') || '').trim()
        if (!t || !b) { alert('Please enter both title and content'); return }
        if (!c) { alert('Please select a category'); return }
        addNote(fd)
        setShowCompose(false)
        e.currentTarget.reset()
      }}
      id="composeForm"
    >
      <div className="row gap">
        <label className="field" style={{ flex: 1 }}>
          <div className="lb">Category</div>
          <select name="category" id="categorySelect" defaultValue="">
            <option value="">Select a category</option>
            <option value="notice">Notice</option>
            <option value="event">Event</option>
            <option value="talk">Talk</option>
            <option value="boast">Boast</option>
            <option value="recruit">Recruit</option>
          </select>
        </label>
        <label className="field" style={{ width: '40%' }}>
          <div className="lb">color</div>
          <select name="color" id="colorSelect" defaultValue="yellow">
            <option value="yellow">yellow</option>
            <option value="pink">pink</option>
            <option value="mint">mint</option>
            <option value="lav">purple</option>
            <option value="blue">blue</option>
          </select>
        </label>
        <label className="chk">
          <input type="checkbox" name="pin" id="pinCheck" /> Pin to top
        </label>
      </div>

      <label className="field">
        <div className="lb">Title</div>
        <input name="title" id="titleInput" placeholder="keep it short and clear" />
      </label>
      <label className="field">
        <div className="lb">Content</div>
        <textarea name="body" id="bodyInput" rows={5} placeholder="Write like a one-page sticky note" />
      </label>

      <div className="row gap">
        <div className="field" style={{ flex: 1 }}>
          <div className="lb">Posted by</div>
          <div id="authorDisplay">@{session?.username || 'anon'}</div>
        </div>
      </div>

      <div className="row end">
        <button className="btn" type="submit">Post</button>
      </div>
    </form>
  </div>
)}

{detail && (
  <div className="modal" role="dialog" aria-modal="true" aria-label="Detail">
    <div className="detail-card">
      <div className={`detail-pad color-${detail.color}`}>
        {detail.category && <div className="catline">{detail.category}</div>}
        <button className="iconbtn detail-close" onClick={() => setDetail(null)} aria-label="Close">x</button>
        <div className="detail-title">{detail.title || 'Untitled'}</div>
        <div style={{ whiteSpace: 'pre-wrap', lineHeight: 1.45 }}>{detail.body}</div>
        <div className="detail-meta">
          <span>{detail.author || '@anon'}</span>
          <span>-</span>
          <span>{new Date(detail.createdAt || Date.now()).toLocaleString()}</span>
        </div>
        <button
          className={`likebtn ${detail.liked ? 'liked' : ''} detail-like`}
          onClick={() => toggleLike(detail)}>
          <span className={"icon heart " + (detail.liked ? "liked" : "")}>{detail.liked ? "\u2665" : "\u2661"}</span> <span className="cnt">{detail.likes || 0}</span>
        </button>
    </div>
  </div>
  </div>
)}
      </div>
    </div>
  )
}
