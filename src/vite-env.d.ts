/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NEYNAR_DEMO: string
  readonly VITE_SUPABASE_URL: string
  readonly VITE_SUPABASE_ANON_KEY: string
  readonly VITE_FC_RPC_URL?: string
  readonly VITE_CONTRACT_ADDRESS?: string
  readonly VITE_CONTRACT_ABI?: string
  readonly VITE_NETWORK_CHAIN_ID?: string
  readonly VITE_BASE_SEPOLIA_RPC?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
