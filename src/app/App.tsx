import { useEffect, useState } from 'react'
import sdk from '@farcaster/miniapp-sdk'
import { useMemo, useRef } from 'react'
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
  const [account, setAccount] = useState<string | null>(null)
  const [showWalletPicker, setShowWalletPicker] = useState(false)
  const [showNetworkPopup, setShowNetworkPopup] = useState(false)
  const [providers, setProviders] = useState<any[]>([])
  const activeProviderRef = useRef<any | null>(null)
  const [pendingAction, setPendingAction] = useState<null | 'compose'>(null)
  const [chainId, setChainId] = useState<string | null>(null)

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

  // In external browsers, we do not auto-login; user clicks avatar to sign in.

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
  
  // Discover EIP-6963 compatible providers
  useEffect(() => {
    const onAnnounce = (event: any) => {
      const detail = event?.detail
      if (!detail?.provider || !detail?.info) return
      setProviders((prev) => {
        if (prev.some((p) => p.info?.uuid === detail.info.uuid)) return prev
        return [...prev, detail]
      })
    }
    try {
      window.addEventListener('eip6963:announceProvider', onAnnounce as any)
      window.dispatchEvent(new Event('eip6963:requestProvider'))
    } catch {}
    return () => {
      try { window.removeEventListener('eip6963:announceProvider', onAnnounce as any) } catch {}
    }
  }, [])

  const injectedFallback = useMemo(() => (typeof window !== 'undefined' ? (window as any).ethereum : null), [])
  const fallbackIsMetaMask = useMemo(() => {
    try { return Boolean((injectedFallback as any)?.isMetaMask) } catch { return false }
  }, [injectedFallback])

  function chainNameFromId(id?: string | number | null) {
    if (id == null) return 'Unknown'
    const hex = typeof id === 'number' ? '0x' + id.toString(16) : String(id)
    const map: Record<string, string> = {
      '0x1': 'Mainnet',
      '0xaa36a7': 'Sepolia',
      '0x2105': 'Base',
      '0x14a33': 'Base Sepolia',
      '0xa': 'OP Mainnet',
      '0x1a4': 'OP Sepolia',
      '0xa4b1': 'Arbitrum One',
      '0x66eee': 'Arb Sepolia',
      '0x89': 'Polygon',
      '0x13881': 'Mumbai',
    }
    return map[hex.toLowerCase()] || `Chain ${hex}`
  }

  type KnownWallet = {
    id: string
    name: string
    installUrl: string
    icon?: string
    match: (info: any) => boolean
    action?: 'farcaster' | 'browser' | 'wc'
  }

  const knownWallets: KnownWallet[] = useMemo(() => [
    // 1. Coinbase Wallet
    {
      id: 'coinbase',
      name: 'Coinbase Wallet',
      installUrl: 'https://www.coinbase.com/wallet/extensions',
      icon: 'https://avatars.githubusercontent.com/u/1885080?s=200&v=4',
      match: (info) => {
        const n = String(info?.name || info?.rdns || '').toLowerCase()
        return n.includes('coinbase') || n.includes('walletlink') || n.includes('cbw') || n.includes('com.coinbase.wallet')
      },
    },
    // 2. MetaMask
    {
      id: 'metamask',
      name: 'MetaMask',
      installUrl: 'https://metamask.io/download/',
      icon: 'https://raw.githubusercontent.com/MetaMask/brand-resources/master/SVG/metamask-fox.svg',
      match: (info) => {
        const n = String(info?.name || info?.rdns || '').toLowerCase()
        return n.includes('metamask') || n.includes('io.metamask')
      },
    },
    // 3. Rainbow
    {
      id: 'rainbow',
      name: 'Rainbow',
      installUrl: 'https://rainbow.me/extension',
      icon: 'https://assets.website-files.com/5f82eae1ca021b4a45bae10a/60e5a1c0e8f7436c2a2bfb91_rainbow-icon.png',
      match: (info) => {
        const n = String(info?.name || info?.rdns || '').toLowerCase()
        return n.includes('rainbow')
      },
    },
    // 4. Farcaster (Mini App sign-in)
    {
      id: 'farcaster',
      name: 'Farcaster',
      installUrl: 'https://warpcast.com/',
      icon: 'https://warpcast.com/favicon-32x32.png',
      // If a Farcaster wallet provider is injected (e.g., Warpcast wallet), match it here
      match: (info) => {
        const n = String(info?.name || info?.rdns || '').toLowerCase()
        return n.includes('farcaster') || n.includes('warpcast')
      },
      action: 'farcaster',
    },
    // 5. WalletConnect (QR connect)
    {
      id: 'walletconnect',
      name: 'WalletConnect',
      installUrl: 'https://walletconnect.com/wallets',
      icon: 'https://walletconnect.com/_next/static/media/logo_mark.84dd8525.svg',
      match: () => false,
      action: 'wc',
    },
    // 6. Trust Wallet
    {
      id: 'trust',
      name: 'Trust Wallet',
      installUrl: 'https://trustwallet.com/browser-extension',
      icon: 'https://assets.trustwallet.com/assets/images/favicon.png',
      match: (info) => {
        const n = String(info?.name || info?.rdns || '').toLowerCase()
        return n.includes('trust')
      },
    },
    // 7. Zerion
    {
      id: 'zerion',
      name: 'Zerion',
      installUrl: 'https://zerion.io/extension',
      icon: 'https://storage.googleapis.com/zerion-public/brand/zerion-icon-512.png',
      match: (info) => {
        const n = String(info?.name || info?.rdns || '').toLowerCase()
        return n.includes('zerion')
      },
    },
    // Others (always visible after featured)
    {
      id: 'rabby',
      name: 'Rabby Wallet',
      installUrl: 'https://rabby.io',
      icon: 'https://rabby.io/assets/favicon/apple-touch-icon.png',
      match: (info) => {
        const n = String(info?.name || info?.rdns || '').toLowerCase()
        return n.includes('rabby')
      },
    },
    {
      id: 'okx',
      name: 'OKX Wallet',
      installUrl: 'https://www.okx.com/download',
      icon: 'https://static.okx.com/cdn/assets/imgs/237/1F4C7C5C7E3B8C0E.png',
      match: (info) => {
        const n = String(info?.name || info?.rdns || '').toLowerCase()
        return n.includes('okx')
      },
    },
    {
      id: 'brave',
      name: 'Brave Wallet',
      installUrl: 'https://support.brave.com/hc/en-us/articles/4418779394957-Brave-Wallet',
      icon: 'https://brave.com/static-assets/images/optimized/brave-logo.png',
      match: (info) => {
        const n = String(info?.name || info?.rdns || '').toLowerCase()
        return n.includes('brave')
      },
    },
  ], [])

  const installedMap = useMemo(() => {
    const m = new Map<string, any>()
    for (const p of providers) {
      const kw = knownWallets.find((k) => k.match(p.info))
      if (kw) m.set(kw.id, p.provider)
    }
    // Fallback heuristics: if only injectedFallback exists and is MetaMask
    if (fallbackIsMetaMask && !m.has('metamask') && injectedFallback) {
      m.set('metamask', injectedFallback)
    }
    return m
  }, [providers, knownWallets, fallbackIsMetaMask, injectedFallback])

  const otherProviders = useMemo(() => {
    return providers.filter((p) => !knownWallets.some((k) => k.match(p.info)))
  }, [providers, knownWallets])

  const autoConnectTriedRef = useRef(false)

  // Auto-connect wallet when running inside Farcaster Mini App
  useEffect(() => {
    (async () => {
      if (autoConnectTriedRef.current) return
      if (account) return
      try {
        const inMini = await sdk.isInMiniApp().catch(() => false)
        if (!inMini) return
        // Prefer well-known providers in this order
        const order = ['coinbase', 'metamask', 'rainbow']
        for (const id of order) {
          const prov = (installedMap as Map<string, any>).get(id)
          if (prov) {
            autoConnectTriedRef.current = true
            await connectWithProvider(prov)
            return
          }
        }
        const anyProv = providers[0]?.provider || injectedFallback
        if (anyProv) {
          autoConnectTriedRef.current = true
          await connectWithProvider(anyProv)
        }
      } catch {}
    })()
  }, [providers, installedMap, injectedFallback, account])

  function WalletIcon({ id }: { id?: string }) {
    const sz = 20
    const common = { width: sz, height: sz } as any
    switch (id) {
      case 'coinbase':
        return (
          <svg {...common} viewBox="0 0 24 24" aria-hidden>
            <circle cx="12" cy="12" r="12" fill="#0052FF" />
            <circle cx="12" cy="12" r="6.8" fill="#fff" />
          </svg>
        )
      case 'metamask':
        return (
          <svg {...common} viewBox="0 0 24 24" aria-hidden>
            <rect x="2" y="2" width="20" height="20" rx="4" fill="#F6851B" />
            <path d="M7 9l5-3 5 3-5 7-5-7z" fill="#fff"/>
          </svg>
        )
      case 'rainbow':
        return (
          <svg {...common} viewBox="0 0 24 24" aria-hidden>
            <defs>
              <linearGradient id="rg" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#ff4d4d" />
                <stop offset="50%" stopColor="#7b61ff" />
                <stop offset="100%" stopColor="#00d4ff" />
              </linearGradient>
            </defs>
            <rect x="2" y="2" width="20" height="20" rx="4" fill="url(#rg)" />
          </svg>
        )
      case 'farcaster':
        return (
          <svg {...common} viewBox="0 0 24 24" aria-hidden>
            <rect x="2" y="2" width="20" height="20" rx="4" fill="#7C4DFF" />
            <path d="M8 7h8v3h-5v2h4v3h-4v2H8V7z" fill="#fff" />
          </svg>
        )
      case 'walletconnect':
        return (
          <svg {...common} viewBox="0 0 24 24" aria-hidden>
            <rect x="2" y="2" width="20" height="20" rx="4" fill="#3B99FC" />
            <path d="M7 12c1.5-1.5 3-2 5-2s3.5.5 5 2l-1.4 1.4C14.7 11.6 13.3 11.2 12 11.2s-2.7.4-3.6 2.2L7 12z" fill="#fff" />
          </svg>
        )
      case 'trust':
        return (
          <svg {...common} viewBox="0 0 24 24" aria-hidden>
            <rect x="2" y="2" width="20" height="20" rx="4" fill="#3375FF" />
            <path d="M12 6l5 2v4c0 3.5-2.4 6.1-5 7-2.6-.9-5-3.5-5-7V8l5-2z" fill="#fff" />
          </svg>
        )
      case 'zerion':
        return (
          <svg {...common} viewBox="0 0 24 24" aria-hidden>
            <rect x="2" y="2" width="20" height="20" rx="4" fill="#2962FF" />
            <path d="M8 7h8l-8 10h8" fill="none" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )
      default:
        return (
          <svg {...common} viewBox="0 0 24 24" aria-hidden>
            <rect x="2" y="2" width="20" height="20" rx="4" fill="#ddd" stroke="#111" />
          </svg>
        )
    }
  }

  function ChainIcon({ id, size = 14 }: { id?: string | null; size?: number }) {
    const sz = size
    const common = { width: sz, height: sz } as any
    const hex = typeof id === 'number' ? '0x' + id.toString(16) : (id || '').toLowerCase()
    switch (hex) {
      // Base
      case '0x2105':
      case '0x14a33':
        return (
          <svg {...common} viewBox="0 0 24 24" aria-hidden>
            <circle cx="12" cy="12" r="10" fill="#0052FF" />
            <rect x="7" y="11" width="10" height="2" rx="1" fill="#fff" />
          </svg>
        )
      // Ethereum
      case '0x1':
      case '0xaa36a7':
        return (
          <svg {...common} viewBox="0 0 24 24" aria-hidden>
            <circle cx="12" cy="12" r="10" fill="#f5f5f5" stroke="#111" />
            <path d="M12 5l4 7-4 3-4-3 4-7zm0 14l-4-6 4 2 4-2-4 6z" fill="#6f6f6f" />
          </svg>
        )
      // Optimism
      case '0xa':
      case '0x1a4':
        return (
          <svg {...common} viewBox="0 0 24 24" aria-hidden>
            <circle cx="12" cy="12" r="10" fill="#ff0420" />
            <text x="12" y="14" textAnchor="middle" fontSize="8" fontWeight="900" fill="#fff">OP</text>
          </svg>
        )
      // Arbitrum
      case '0xa4b1':
      case '0x66eee':
        return (
          <svg {...common} viewBox="0 0 24 24" aria-hidden>
            <rect x="4" y="4" width="16" height="16" rx="4" fill="#2d6cff" />
            <path d="M8 16l3-8h2l-3 8H8zm6 0l3-8h-2l-3 8h2z" fill="#fff" />
          </svg>
        )
      // Polygon
      case '0x89':
      case '0x13881':
        return (
          <svg {...common} viewBox="0 0 24 24" aria-hidden>
            <circle cx="12" cy="12" r="10" fill="#8247e5" />
            <path d="M8 10.5l2-1.2 4 2.3 2-1.2v2.4l-2 1.2-4-2.3-2 1.2v-2.4z" fill="#fff"/>
          </svg>
        )
      default:
        return (
          <svg {...common} viewBox="0 0 24 24" aria-hidden>
            <circle cx="12" cy="12" r="10" fill="#ddd" stroke="#111" />
          </svg>
        )
    }
  }

  async function connectWithProvider(p: any) {
    try {
      if (!p) {
        alert('No wallet provider found. Please install a wallet extension.')
        return
      }
      const accounts: string[] = await p.request({ method: 'eth_requestAccounts' })
      const addr = accounts?.[0]
      const cid: string | undefined = await p.request({ method: 'eth_chainId' }).catch(() => undefined)
      if (addr) {
        setAccount(addr)
        setWalletName(shorten(addr))
        if (cid) setChainId(cid)
        activeProviderRef.current = p
        console.log('Connected wallet address:', addr)
        if (cid) console.log('Connected chain:', chainNameFromId(cid))
        if (pendingAction === 'compose') {
          setPendingAction(null)
          setShowCompose(true)
        }
        try {
          p.removeListener?.('accountsChanged', onAccountsChanged)
          p.on?.('accountsChanged', onAccountsChanged)
          p.removeListener?.('chainChanged', onChainChanged)
          p.on?.('chainChanged', onChainChanged)
        } catch {}
      }
    } catch (err: any) {
      console.error('wallet connect failed', err)
      alert(err?.message || 'Failed to connect wallet')
    } finally {
      setShowWalletPicker(false)
    }
  }

  function onAccountsChanged(accs: string[]) {
    const a = accs?.[0] || null
    setAccount(a)
    setWalletName(a ? shorten(a) : null)
    if (a) console.log('Switched wallet address:', a)
  }

  function onChainChanged(next: string) {
    setChainId(next)
    console.log('Switched chain:', chainNameFromId(next))
  }

  const featuredIds = ['coinbase','metamask','rainbow','farcaster','walletconnect','trust','zerion']
  const allOtherKnown = useMemo(() => knownWallets.filter(w => !featuredIds.includes(w.id)), [knownWallets])
  const [showAllWallets, setShowAllWallets] = useState(false)

  function handleConnectClick() {
    if (account) {
      setShowNetworkPopup(true)
      setShowAllWallets(false)
      setShowWalletPicker(false)
    } else {
      // Always show picker so user can choose a wallet
      setShowWalletPicker((v) => !v)
      setShowAllWallets(false)
    }
  }

  function handleComposeClick() {
    if (!account) {
      setPendingAction('compose')
      setShowWalletPicker(true)
      setShowAllWallets(false)
      return
    }
    setShowCompose(true)
  }

  function shorten(addr: string) {
    return addr ? `${addr.slice(0, 6)}…${addr.slice(-4)}` : ''
  }

  function openInstall(url: string) {
    try { window.open(url, '_blank') } catch {}
  }

  // Chain switching
  type ChainOpt = { id: string; name: string; params?: any }
  const chainOptions: ChainOpt[] = [
    { id: '0x2105', name: 'Base', params: { chainId: '0x2105', chainName: 'Base', nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: ['https://mainnet.base.org'], blockExplorerUrls: ['https://basescan.org'] } },
    { id: '0x14a33', name: 'Base Sepolia', params: { chainId: '0x14a33', chainName: 'Base Sepolia', nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: ['https://sepolia.base.org'], blockExplorerUrls: ['https://sepolia.basescan.org'] } },
    { id: '0x1', name: 'Ethereum', params: { chainId: '0x1', chainName: 'Ethereum', nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: ['https://cloudflare-eth.com'], blockExplorerUrls: ['https://etherscan.io'] } },
    { id: '0xaa36a7', name: 'Sepolia', params: { chainId: '0xaa36a7', chainName: 'Sepolia', nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: ['https://rpc.sepolia.org'], blockExplorerUrls: ['https://sepolia.etherscan.io'] } },
    { id: '0xa', name: 'OP Mainnet', params: { chainId: '0xa', chainName: 'OP Mainnet', nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: ['https://mainnet.optimism.io'], blockExplorerUrls: ['https://optimistic.etherscan.io'] } },
    { id: '0xa4b1', name: 'Arbitrum One', params: { chainId: '0xa4b1', chainName: 'Arbitrum One', nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 }, rpcUrls: ['https://arb1.arbitrum.io/rpc'], blockExplorerUrls: ['https://arbiscan.io'] } },
    { id: '0x89', name: 'Polygon', params: { chainId: '0x89', chainName: 'Polygon', nativeCurrency: { name: 'MATIC', symbol: 'MATIC', decimals: 18 }, rpcUrls: ['https://polygon-rpc.com'], blockExplorerUrls: ['https://polygonscan.com'] } },
  ]

  async function switchChain(targetId: string) {
    const prov = activeProviderRef.current
    if (!prov) return
    try {
      await prov.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: targetId }] })
      setChainId(targetId)
      setShowNetworkPopup(false)
    } catch (err: any) {
      if (err?.code === 4902) {
        const opt = chainOptions.find((c) => c.id === targetId)
        if (opt?.params) {
          try {
            await prov.request({ method: 'wallet_addEthereumChain', params: [opt.params] })
            setChainId(targetId)
            setShowNetworkPopup(false)
            return
          } catch {}
        }
      }
      alert('Failed to switch network')
    }
  }

  function disconnectWallet() {
    setAccount(null)
    setWalletName(null)
    setChainId(null)
    setShowNetworkPopup(false)
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
              {walletName ? (
                <span className="chainwrap"><ChainIcon id={chainId} /></span>
              ) : (
                'connect'
              )}
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

        {showWalletPicker && (
          <>
            <div
              className="wallet-overlay"
              onClick={() => { setShowWalletPicker(false); setShowAllWallets(false) }}
              aria-hidden
            />
            <div className="wallet-pop" role="dialog" aria-modal="true" aria-label="Select wallet">
              <div className="wallet-card" onClick={(e) => e.stopPropagation()}>
                <button
                  className="wallet-close"
                  aria-label="Close"
                  onClick={() => { setShowWalletPicker(false); setShowAllWallets(false) }}
                >x</button>
              {!showAllWallets ? (
                <>
                  <div className="wallet-title">Connect Wallet</div>
                  {knownWallets
                    .filter(w => featuredIds.includes(w.id))
                    .sort((a,b) => featuredIds.indexOf(a.id) - featuredIds.indexOf(b.id))
                    .map((w) => {
                      const installed = installedMap.has(w.id)
                      return (
                        <button
                          key={w.id}
                          className="wallet-item"
                          onClick={() => (
                            installed
                              ? connectWithProvider(installedMap.get(w.id))
                              : w.action === 'farcaster'
                                ? (setShowWalletPicker(false), void handleAvatarLogin())
                                : w.action === 'wc'
                                  ? openInstall(w.installUrl)
                                  : openInstall(w.installUrl)
                          )}
                        >
                          <WalletIcon id={w.id} />
                          <span style={{ flex: 1 }}>{w.name}</span>
                          {installed && w.action !== 'farcaster' && <span className="tag">installed</span>}
                        </button>
                      )
                    })}

                  <button className="wallet-item" onClick={() => setShowAllWallets(true)}>
                    <div className="wallet-icon-fallback" />
                    <span style={{ flex: 1 }}>All wallets</span>
                  </button>
                </>
              ) : (
                <>
                  <div className="wallet-subhdr">
                    <button className="wallet-back" onClick={() => setShowAllWallets(false)}>◀</button>
                    <div className="wallet-sec-hdr" style={{ margin: 0 }}>All wallets</div>
                  </div>
                  {allOtherKnown.map((w) => {
                    const installed = installedMap.has(w.id)
                    return (
                      <button
                        key={w.id}
                        className="wallet-item"
                        onClick={() => (installed ? connectWithProvider(installedMap.get(w.id)) : openInstall(w.installUrl))}
                      >
                        <WalletIcon id={w.id} />
                        <span style={{ flex: 1 }}>{w.name}</span>
                        {installed && <span className="tag">installed</span>}
                      </button>
                    )
                  })}
                  {otherProviders.length > 0 && otherProviders.map((p) => (
                    <button key={p.info.uuid} className="wallet-item" onClick={() => connectWithProvider(p.provider)}>
                      <WalletIcon />
                      <span style={{ flex: 1 }}>{p.info.name}</span>
                      <span className="tag">installed</span>
                    </button>
                  ))}
                </>
              )}
              </div>
            </div>
          </>
        )}

        {/* No blocking login overlay for external browsers */}

        {showNetworkPopup && (
          <>
            <div className="wallet-overlay" onClick={() => setShowNetworkPopup(false)} aria-hidden />
            <div className="wallet-pop" role="dialog" aria-modal="true" aria-label="Choose network">
              <div className="wallet-card" onClick={(e) => e.stopPropagation()}>
                <button className="wallet-close" aria-label="Close" onClick={() => setShowNetworkPopup(false)}>x</button>
                <div className="wallet-title">Choose Network</div>
                {account && (
                  <div className="addrrow">
                    <span className="chainwrap" style={{ marginRight: 6 }}><ChainIcon id={chainId} size={20} /></span>
                    <span className="addr light">{walletName}</span>
                    <button className="btn small" style={{ marginLeft: 'auto' }} onClick={disconnectWallet}>disconnect</button>
                  </div>
                )}
                {chainOptions.map((c) => (
                  <button key={c.id} className="wallet-item" onClick={() => switchChain(c.id)}>
                    <span className="chainwrap"><ChainIcon id={c.id} size={20} /></span>
                    <span style={{ flex: 1 }}>{c.name}</span>
                    {chainId?.toLowerCase() === c.id.toLowerCase() && <span className="tag active">active</span>}
                  </button>
                ))}
              </div>
            </div>
          </>
        )}

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
          <button className="fab" id="btnCompose" onClick={handleComposeClick}>+</button>
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
        <label className="field" style={{ width: '54%' }}>
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
        <label className="field" style={{ width: '25%' }}>
          <div className="lb-row">
            <div className="lb" style={{ margin: 0 }}>Color</div>
            <div className="color-picks" role="radiogroup" aria-label="Note color">
              {(['yellow','pink','mint','lav','blue'] as NoteColor[]).map((c) => (
                <label key={c} className={`color-dot c-${c}`} title={c}>
                  <input type="radio" name="color" value={c} defaultChecked={c==='yellow'} aria-label={c} />
                  <span />
                </label>
              ))}
            </div>
          </div>
          <label className="chk small" htmlFor="pinCheck" style={{ paddingTop: 8 }}>
            <input type="checkbox" name="pin" id="pinCheck" /> Pin to top
          </label>
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
