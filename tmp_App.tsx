import { useEffect, useState } from 'react'
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
    <div className={`note ${small ? 'small' : ''}`} data-color={note.color} role="button" tabIndex={0} onClick={onClick}
      onKeyDown={(e)=>{ if(e.key==='Enter' || e.key===' ') { e.preventDefault(); onClick?.() } }}>
      {!small && <div className="pin" />}
      {small && note.category && <div className="catline">{note.category}</div>}
      {note.title && <div className="meta">{note.title}</div>}
      {note.body && <div className="preview">{note.body}</div>}
      <div className="footer">
        <div className="bytime">
          <span className="by">{note.author || '@anon'}</span>
          <span className="tim">{timeAgo(note.createdAt || Date.now())}</span>
        </div>
        <div className="likepill"><span className="icon">{note.liked ? '?�️' : '?��'}</span><span>{note.likes || 0}</span></div>
      </div>
    </div>
  )
}

export default function App() {
  useTick(30_000)
  const [pinned, setPinned] = useState<Note[]>([
    { id: 'p1', title: '팀 회의', body: '오늘 4시 회의 노트', color: 'mint', author: '@mj', createdAt: Date.now() - 3600_000, likes: 3 },
    { id: 'p2', title: '아이디어', body: '보드 인터랙션 개선안', color: 'yellow', author: '@jk', createdAt: Date.now() - 7200_000, likes: 1 },
    { id: 'p3', title: 'Sprint', body: '다음 스프린트 목표 정리', color: 'blue', author: '@pm', createdAt: Date.now() - 5400_000, likes: 5 },
  ])
  const [feed, setFeed] = useState<Note[]>([
    { id: 'f1', title: '리서치', body: '사용자 테스트 일정', color: 'lav', category: '리서치', author: '@ux', createdAt: Date.now() - 14 * 60_000, likes: 2 },
    { id: 'f2', title: '버그', body: '모바일 스크롤 튐', color: 'pink', category: '버그', author: '@fe', createdAt: Date.now() - 30 * 60_000 },
    { id: 'f3', title: '릴리즈', body: 'v0.1.2 태그', color: 'yellow', category: '릴리즈', author: '@ops', createdAt: Date.now() - 6 * 3600_000, likes: 7 },
    { id: 'f4', title: '문의', body: '고객사 A 요청 정리', color: 'mint', category: '문의', author: '@cs', createdAt: Date.now() - 2 * 3600_000 },
    { id: 'f5', title: '디자인', body: '새 버튼 스타일', color: 'blue', category: '디자인', author: '@ds', createdAt: Date.now() - 50 * 60_000 },
  ])
  const [showCompose, setShowCompose] = useState(false)
  const [session, setSession] = useState<Session | null>(null)
  const [loginBusy, setLoginBusy] = useState<'idle'|'loading'|'polling'>('idle')

  useEffect(() => {
    const cached = sessionStorage.getItem('fc.session')
    if (cached) setSession(JSON.parse(cached))
  }, [])

  useEffect(() => {
    if (session) sessionStorage.setItem('fc.session', JSON.stringify(session))
    else sessionStorage.removeItem('fc.session')
  }, [session])

  async function handleAvatarLogin() {
    try {
      setLoginBusy('loading')
      const init = await beginNeynarLogin()
      setLoginBusy('polling')
      if (init.approvalUrl) window.open(init.approvalUrl, '_blank')
      const sess = await pollNeynarLogin(init.token)
      setSession(sess)
      alert(`로그???�료: @${sess.username}`)
    } catch (e) {
      console.error(e)
      alert('?�캐?�터 로그?�에 ?�패?�습?�다')
    } finally {
      setLoginBusy('idle')
    }
  }

  function openDetail(id: string) {
    const n = pinned.find(x=>x.id===id) || feed.find(x=>x.id===id)
    if (n) setDetail(n)
  }

  function toggleLike(n: Note) {
    n.liked = !n.liked
    n.likes = Math.max(0, (n.likes || 0) + (n.liked ? 1 : -1))
    setPinned([...pinned])
    setFeed([...feed])
    setDetail(n => (n ? { ...n } : n))
  }

  function addNote(form: FormData) {
    const title = String(form.get('title') || '')
    const body = String(form.get('body') || '')
    const category = String(form.get('category') || '') || undefined
    const color = (String(form.get('color') || 'yellow') as NoteColor)
    const pin = form.get('pin') === 'on'
    const author = String(form.get('author') || (session?.username ? '@'+session.username : '@anon'))
    const n: Note = { id: Math.random().toString(36).slice(2), title, body, category, color, author, createdAt: Date.now(), likes: 0, liked: false }
    if (pin) setPinned([n, ...pinned])
    else setFeed([n, ...feed])
  }

  const pinnedFillers: Note[] = pinned.length ? pinned : [
    { id: 'e1', color: 'mint' }, { id: 'e2', color: 'yellow' }, { id: 'e3', color: 'blue' }
  ]

  return (
    <div className="bc">
      <div className="phone" id="app">
        <header>
  <div className="hdr-left">
    <button className="iconbtn" id="btnHome" aria-label="home">
      <svg viewBox="0 0 24 24" width="22" height="22"><path d="M3 12l9-8 9 8v8H14v-5H10v5H3z"/></svg>
    </button>
    <div className="title">BOARD CAST</div>
  </div>
  <button className="avatarbtn" id="btnProfile" title="profile" onClick={handleAvatarLogin} disabled={loginBusy!=='idle'}>
    <div className="ring"></div><div className="base"></div>
  </button>
</header>

        <div className="today">Today</div>

        <div className="hero" id="heroRow">
          {pinnedFillers.map(n => (
            <div key={n.id} onClick={()=>openDetail(n.id)}>
              <NoteCard note={n} />
            </div>
          ))}
        </div>

        <div className="feed-lbl">New</div>
        <div className="feed" id="feedGrid">
          {feed.map(n => (
            <div key={n.id} onClick={()=>openDetail(n.id)}>
              <NoteCard note={n} small />
            </div>
          ))}
        </div>

        <div className="btbar">
          <button className="fab" id="btnCompose" onClick={()=>setShowCompose(true)}>+</button>
        </div>
      </div>

      {(showCompose || detail) && <div className="backdrop" onClick={()=>{ setShowCompose(false); setDetail(null) }} />}

      {showCompose && (
        <div className="sheet" role="dialog" aria-modal="true" aria-label="Compose note">
          <div className="sheet-hdr">
            <div>Compose</div>
            <button className="iconbtn" onClick={()=>setShowCompose(false)} aria-label="Close">x</button>
          </div>
          <form onSubmit={(e)=>{ e.preventDefault(); const fd = new FormData(e.currentTarget); addNote(fd); setShowCompose(false); e.currentTarget.reset() }} id="composeForm">
            <label className="field">
              <div className="lb">Title</div>
              <input name="title" id="titleInput" placeholder="keep it short and clear" />
            </label>
            <label className="field">
              <div className="lb">Content</div>
              <textarea name="body" id="bodyInput" rows={5} placeholder="Write like a one-page sticky note"></textarea>
            </label>
            <div className="row gap">
              <label className="field">
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
              <label className="field">
                <div className="lb">color</div>
                <select name="color" id="colorSelect" defaultValue="yellow">
                  <option value="yellow">yellow</option>
                  <option value="pink">pink</option>
                  <option value="mint">mint</option>
                  <option value="lav">purple</option>
                  <option value="blue">blue</option>
                </select>
              </label>
            </div>
            <div className="row gap">
              <label className="field">
                <div className="lb">Posted by</div>
                <input name="author" id="authorInput" placeholder="@handle" defaultValue={session ? ("@" + session.username) : ""} />
              </label>
              <label className="chk">
                <input type="checkbox" name="pin" id="pinCheck" /> Pin to top
              </label>
            </div>
            <div className="row end">
              <button className="btn" type="submit">Post</button>
            </div>
          </form>
        </div>
      )}

    </div>
  )
}
