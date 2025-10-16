/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_NEYNAR_DEMO: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
