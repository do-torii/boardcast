import { createPublicClient, createWalletClient, custom, http, parseEther } from 'viem'
import { baseSepolia } from 'viem/chains'

type OnchainPost = {
  title: string
  content: string
  pinToTop?: boolean
  author?: string
  createdAt?: bigint | number
}

function getEnv<T = string>(key: string, required = true): T | undefined {
  const v = (import.meta as any).env?.[key]
  if (required && (v == null || v === '')) throw new Error(`Missing env ${key}`)
  return v as T
}

export function getContractAddress(): `0x${string}` {
  const addr = String(getEnv('VITE_CONTRACT_ADDRESS'))
  if (!addr || !addr.startsWith('0x')) throw new Error('Invalid VITE_CONTRACT_ADDRESS')
  return addr as `0x${string}`
}

export function getContractAbi(): any[] {
  const raw = String(getEnv('VITE_CONTRACT_ABI'))
  try {
    const abi = JSON.parse(raw)
    if (!Array.isArray(abi)) throw new Error('ABI must be an array')
    return abi
  } catch (e) {
    throw new Error('VITE_CONTRACT_ABI must be valid JSON array')
  }
}

export function getChainId(): number {
  const cid = Number(getEnv('VITE_NETWORK_CHAIN_ID'))
  if (!Number.isFinite(cid)) throw new Error('Invalid VITE_NETWORK_CHAIN_ID')
  return cid
}

export function getPublicClient() {
  const rpc = (import.meta as any).env?.VITE_BASE_SEPOLIA_RPC || 'https://sepolia.base.org'
  return createPublicClient({ chain: baseSepolia, transport: http(rpc) })
}

async function ensureInjected(): Promise<any> {
  if (typeof window === 'undefined') throw new Error('No window')
  const eth = (window as any).ethereum
  if (!eth) throw new Error('No injected wallet found. Please install MetaMask.')
  return eth
}

async function ensureChain(eth: any): Promise<void> {
  const targetHex = '0x14a34' // 84532 Base Sepolia
  try {
    await eth.request({ method: 'wallet_switchEthereumChain', params: [{ chainId: targetHex }] })
  } catch (err: any) {
    if (err?.code === 4902 || /Unrecognized chain ID/i.test(String(err?.message || ''))) {
      await eth.request({
        method: 'wallet_addEthereumChain',
        params: [{
          chainId: targetHex,
          chainName: 'Base Sepolia',
          nativeCurrency: { name: 'Ethereum', symbol: 'ETH', decimals: 18 },
          rpcUrls: ['https://sepolia.base.org'],
          blockExplorerUrls: ['https://sepolia.basescan.org'],
        }],
      })
    } else {
      throw err
    }
  }
}

export async function getWalletClientAndAccount() {
  const eth = await ensureInjected()
  await ensureChain(eth)
  const walletClient = createWalletClient({ chain: baseSepolia, transport: custom(eth) })
  const accounts = await eth.request({ method: 'eth_requestAccounts' })
  const account = (accounts && accounts[0]) as `0x${string}`
  if (!account) throw new Error('No account connected')
  return { walletClient, account }
}

export async function createPostTx(title: string, content: string, pinToTop: boolean): Promise<`0x${string}`> {
  const { walletClient, account } = await getWalletClientAndAccount()
  const address = getContractAddress()
  const abi = getContractAbi()
  const value = pinToTop ? parseEther('0.0011') : parseEther('0.0001')
  const hash = await walletClient.writeContract({
    account,
    address,
    abi,
    functionName: 'createPost',
    args: [title, content, pinToTop],
    value,
  })
  return hash
}

export async function waitForReceipt(hash: `0x${string}`) {
  const publicClient = getPublicClient()
  return publicClient.waitForTransactionReceipt({ hash })
}

export async function fetchOnchainPosts(): Promise<OnchainPost[]> {
  const publicClient = getPublicClient()
  const address = getContractAddress()
  const abi = getContractAbi()
  try {
    const res: any = await publicClient.readContract({ address, abi, functionName: 'getPosts' })
    if (Array.isArray(res)) {
      return res.map((p: any) => {
        const title = p?.title ?? p?.[0] ?? ''
        const content = p?.content ?? p?.[1] ?? ''
        const pinToTop = Boolean(p?.pinToTop ?? p?.pinned ?? p?.[2])
        const author = p?.author ?? p?.owner ?? p?.[3]
        const createdAt = p?.createdAt ?? p?.timestamp ?? p?.[4]
        return { title: String(title), content: String(content), pinToTop, author: author ? String(author) : undefined, createdAt }
      })
    }
    return []
  } catch (e) {
    console.error('[onchain] getPosts failed', e)
    return []
  }
}
