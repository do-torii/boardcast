# BoardCast — Farcaster Mini App + Web

BoardCast is a playful “sticky‑note board” for communities. It runs both as a Farcaster Mini App inside Warpcast and as a regular web app. Users can sign in with Farcaster, connect a wallet, post colorful notes by category, pin items to the top, like notes, browse by calendar, and see a lightweight leaderboard.

The app persists notes in Supabase and also triggers an on‑chain transaction for each post (Base Sepolia by default) using viem. It bundles a simple serverless backend (Vercel) to integrate Farcaster login via Neynar/Farcaster Auth.

## Features

- Farcaster sign‑in
  - In Mini App: auto/quick auth via `@farcaster/miniapp-sdk`
  - On web: one‑click sign‑in via `@farcaster/auth-kit` (Neynar/Farcaster Auth compatible)
- Wallet connect (EIP‑6963 discovery) with Coinbase/MetaMask/Rainbow and more, plus a QR fallback for Coinbase Wallet
- Create notes with title, content, color, category; optional “pin to top”
- Likes with optimistic UI and per‑user like state
- Calendar view (filter notes by selected date)
- Leaderboard (by streak, pins, and total writes)
- Supabase persistence for notes and likes
- On‑chain post write using viem on Base Sepolia (configurable)

## Tech Stack

- React 18 + Vite + TypeScript
- Farcaster SDKs: `@farcaster/miniapp-sdk`, `@farcaster/auth-kit`
- Supabase: `@supabase/supabase-js`
- Ethereum tooling: `viem`
- Optional Coinbase Wallet SDK (QR connect fallback)
- Vercel serverless functions for auth proxying

## Quick Start

1) Install dependencies

```
npm install
```

2) Configure environment

```
cp .env.example .env
# For easiest local testing, enable demo mode:
# VITE_NEYNAR_DEMO=1
```

3) Run dev server

```
npm run dev
```

Build and preview:

```
npm run build && npm run preview
```

## Environment Variables

Frontend (Vite) envs:

- `VITE_NEYNAR_DEMO` — Set `1` in local dev to bypass real auth and use demo sessions.
- `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY` — Supabase project URL and anon key.
- `VITE_NETWORK_CHAIN_ID` — Target chain id (hex or number). Default flow uses Base Sepolia (84532).
- `VITE_CONTRACT_ADDRESS` — Deployed contract address used for `createPost`.
- `VITE_CONTRACT_ABI` — Contract ABI as a single‑line JSON string.
- `VITE_BASE_SEPOLIA_RPC` — Optional RPC URL for Base Sepolia reads.
- `VITE_FC_RPC_URL` — Optional Optimism RPC for AuthKit (defaults to public mainnet endpoint).

Backend (Vercel serverless) envs for Farcaster/Neynar auth:

- `NEYNAR_AUTH_BEGIN_URL`, `NEYNAR_AUTH_POLL_URL` — Your provider’s begin/poll endpoints.
- `NEYNAR_API_KEY` and optional `NEYNAR_API_KEY_HEADER` (defaults to `api_key`).
- Optional flow customizations:
  - `NEYNAR_CLIENT_ID`, `NEYNAR_REDIRECT_URI`, `NEYNAR_SCOPE`, `NEYNAR_RESPONSE_TYPE`
  - `POLL_MAX_MS`, `POLL_INTERVAL_MS`
  - `NEYNAR_POLL_METHOD` (`GET`/`POST`), `NEYNAR_POLL_QUERY_KEY`, `NEYNAR_POLL_BODY_KEY`
  - `NEYNAR_POLL_AUTH_SCHEME` (e.g., `Bearer` if token must go in `Authorization`)
  - `NEYNAR_USER_URL` if your flow returns an access token that must be exchanged for profile data

## Data Model (Supabase)

The app expects two tables. You can adapt types, but keep column names consistent with the code in `src/lib/notes.ts`.

Notes table (`notes`):

- `id` text or uuid primary key
- `title` text
- `body` text
- `color` text enum: `yellow|pink|mint|lav|blue`
- `category` text (e.g., `notice|event|talk|boast|recruit`)
- `author` text (e.g., `@username`)
- `created_at` timestamp with time zone
- `note_date` date (nullable) — optional date shown under note body
- `likes` integer (default 0)
- `pinned` boolean (default false)

Likes table (`note_likes`):

- `note_id` references `notes.id`
- `user_id` text (Farcaster `fid` or username)
- Unique constraint on `(note_id, user_id)`

The client updates `notes.likes` based on row counts in `note_likes` for the note.

## On‑Chain Posting

- Code: `src/lib/eth.ts`
- Uses `viem` with an injected EIP‑1193 provider.
- Defaults to Base Sepolia (84532). Chain can be switched from the UI.
- Function invoked: `createPost(title, content, pinToTop)` on your contract.
  - Sends a small value with the tx; code uses a higher amount when `pinToTop` is true.
- Configure via:
  - `VITE_CONTRACT_ADDRESS`
  - `VITE_CONTRACT_ABI` (JSON array)
  - `VITE_NETWORK_CHAIN_ID`

## Farcaster Login

- Inside Mini App: `@farcaster/miniapp-sdk` quick auth is used; the app auto‑reads `context.user` and stores a session.
- On web: `@farcaster/auth-kit` provides the “Sign in with Farcaster” button/modal.
- For production, set the `api/neynar/auth` serverless endpoints to proxy your auth provider (Neynar or compatible) using the envs above.

API routes (Vercel):

- `POST /api/neynar/auth/begin` → returns `{ token, approvalUrl }`
- `POST /api/neynar/auth/poll` with `{ token }` → returns `{ fid, username, displayName?, pfpUrl? }`

## Mini App Manifest

- `public/.well-known/miniapp.json` — update `name`, `description`, `developer` fields for your app.
- `public/llms-full.txt` — keep this up‑to‑date per Farcaster docs.

Docs: https://miniapps.farcaster.xyz/docs/getting-started

## Build & Deploy

- Local: `npm run dev`
- Build: `npm run build`
- Preview: `npm run preview`
- Vercel: this repo includes `vercel.json` and serverless functions under `api/`.
  - Set the Vite envs (prefixed `VITE_…`) and the `NEYNAR_…` envs in your Vercel Project Settings.
  - Ensure `/.well-known/miniapp.json` and `/llms-full.txt` are publicly served after deploy.

## Project Structure

- `index.html`, `src/` — Vite + React app
- `src/app/App.tsx` — main UI, wallet connect, calendar, leaderboard, compose flow
- `src/lib/` — `supabaseClient`, `notes`, `streaks`, `eth`
- `src/auth/neynar.ts` — frontend helpers for begin/poll or demo mode
- `api/neynar/auth/*` — Vercel serverless auth proxy (begin/poll)
- `public/.well-known/miniapp.json` — Mini App manifest

## Notes

- Do not commit real secrets. Keep `VITE_SUPABASE_ANON_KEY` and any Neynar keys in your deployment env.
- Demo mode (`VITE_NEYNAR_DEMO=1`) is for local development only.

