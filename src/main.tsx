import React from 'react'
import { createRoot } from 'react-dom/client'
import App from './app/App'
import '@farcaster/auth-kit/styles.css'
import { AuthKitProvider } from '@farcaster/auth-kit'
import './styles.css'

const root = document.getElementById('root')!
createRoot(root).render(
  <React.StrictMode>
    <AuthKitProvider
      config={{
        // Optimism RPC URL for AuthKit; defaults to mainnet endpoint
        rpcUrl: (import.meta as any).env.VITE_FC_RPC_URL || 'https://mainnet.optimism.io',
        // Your app domain must be set (required)
        domain: typeof window !== 'undefined' ? window.location.host : 'localhost',
        // A URI identifying your app (required). Using origin is fine.
        siweUri: typeof window !== 'undefined' ? window.location.origin : 'http://localhost',
      }}
    >
      <App />
    </AuthKitProvider>
  </React.StrictMode>
)
