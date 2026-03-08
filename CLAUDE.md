# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run build        # Production build via esbuild
npm run watch        # Rebuild on file changes (development)
npm run typecheck    # TypeScript type-check without emitting
npm run lint         # Lint src/ with Biome
npm run lint:fix     # Auto-fix linting issues
npm run format       # Format code with Biome
```

After building, load the extension in Chrome via `chrome://extensions` → Load unpacked → select the repo root (which includes `manifest.json` and `dist/`).

## Architecture

This is a **Chrome Extension (Manifest V3)** with three independent entry points compiled by esbuild into `dist/`:

### Entry Points

- **`src/content.ts`** — Content script injected on `polymarket.com/*`. Detects NBA game URLs, parses team names and dates, sends `detect-game` / `clear-game` messages to the background.

- **`src/background.ts`** — Service worker (persistent state hub). Handles wallet connection via `window.ethereum`, orchestrates the x402 micropayment flow, manages caching in `chrome.storage.local`, and responds to messages from both content scripts and the side panel.

- **`src/sidepanel.tsx`** → **`src/App.tsx`** — React 19 UI rendered in the side panel. Two tabs: "Matchups" (current game + analysis buttons) and "My Analysis" (history). Communicates exclusively via `chrome.runtime.sendMessage` and listens to `chrome.storage.session` for state changes.

### Message Flow

```
Polymarket tab (content.ts)
  → chrome.runtime.sendMessage("detect-game", gameInfo)
    → background.ts stores game in chrome.storage.session

Side panel (App.tsx)
  → chrome.runtime.sendMessage("analyze" | "analyze-free" | "connect" | "getState")
    → background.ts → API → chrome.storage.session update
      → Side panel reads updated state from storage
```

### State Storage

- **`chrome.storage.session`** — Ephemeral: connected wallet address, current game, current analysis result, loading/error states
- **`chrome.storage.local`** — Persistent cache: analysis results keyed as `analysis_AWAY_HOME_DATE`

### API

- Free: `POST https://api-hoobs.polyox.io/nba/analysis/free`
- Paid: `POST https://api-hoobs.polyox.io/nba/analysis` — returns HTTP 402 with an x402 v2 payment request; background handles signing and resubmitting with `X-PAYMENT` header
- Payment token: USDC on Base Sepolia (`0x036CbD53842c5426634e7929541eC2318f3dCF7e`)
- Full API can be found in `https://polyox.io/skill.md`

### Key Libraries

- **viem** — Used for EIP-712 signature creation and chain detection in the x402 payment flow
- **lucide-react** — Icons
- **Biome** — Linter/formatter (replaces ESLint + Prettier); configured in `biome.json`

### Build Notes

- `dist/` is committed to the repo intentionally (for easy extension installation without a build step)
- esbuild config: `esbuild.config.mjs`; format is IIFE, target Chrome 120+
- Sourcemaps are generated only in watch mode
