# Polyox — NBA Sports Intelligence Agent

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

AI-powered NBA game analysis on [Polymarket](https://polymarket.com), paid via x402 (Base Sepolia USDC).

## What is PolyOx?

PolyOx is a Chrome extension that automatically detects NBA matchup pages on Polymarket and provides deep, AI-driven game analysis — including win probabilities, key factors, recent team form, and live injury reports — right in a side panel.

### Features

- **Auto Game Detection** — Detects NBA game URLs on Polymarket automatically; no manual input needed.
- **Recent Form Stats** — Displays PPG, REB, AST, Offensive Rating, and Defensive Rating for both teams based on recent games.
- **Live Injury Report** — Shows per-team injury statuses (Out / Doubtful / Questionable / Probable) with color-coded indicators.
- **Pro Analysis** — Full AI analysis via x402 micropayment (Base Sepolia USDC); no subscription required.
- **Free Analysis** — Lightweight AI analysis available without payment.
- **Predicted Outcome** — Win probability breakdown with confidence score and key deciding factors.
- **Analysis History** — "My Analysis" tab stores past results locally; browse and revisit previous matchup analyses.
- **Cached Game Context** — Stats and injury data are cached to avoid redundant fetches; manual refresh available.
- **Seamless Web3** — Connect MetaMask, sign the x402 payment request, and receive results instantly.

## Install (Chrome / Brave / Edge)

1. Clone or download the repository:
   ```bash
   git clone https://github.com/lootex-io/polyox-chrome-extension.git
   ```
2. Open your browser and navigate to `chrome://extensions`
3. Enable **Developer mode** (toggle in the top-right corner)
4. Click **Load unpacked** and select the repo root folder
5. The PolyOx icon will appear in your toolbar

## Usage

1. Navigate to any NBA game page on [polymarket.com](https://polymarket.com/sports/nba/games)
2. Open the PolyOx side panel
3. View auto-loaded team stats and injury report
4. Connect your wallet (required for Pro Analysis)
5. Click **Pro Analysis** (paid, x402 USDC) or **Free Analysis**
6. Results appear instantly with win probabilities, key factors, and a full breakdown
7. Browse past analyses in the **My Analysis** tab

## Development

```bash
npm install
npm run build     # one-off production build
npm run watch     # rebuild on file changes
npm run typecheck # TypeScript type check
npm run lint      # lint with Biome
npm run format    # format with Biome
```

Source files are in `src/`; build outputs to `dist/`. After building, reload the extension at `chrome://extensions`.

## Architecture

Three entry points compiled by esbuild into `dist/`:

| File | Role |
|------|------|
| `src/content.ts` | Content script — detects NBA game URLs, sends game info to background |
| `src/background.ts` | Service worker — wallet connection, x402 payment flow, API calls, caching |
| `src/sidepanel.tsx` / `App.tsx` | React 19 side panel UI — Matchups tab + My Analysis tab |

State is split between `chrome.storage.session` (ephemeral: wallet, current game, analysis result) and `chrome.storage.local` (persistent: cached analyses).

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

MIT — see [LICENSE](LICENSE) for details.
