# Polyox — NBA SPORTS INTELLIGENCE AGENT Chrome Extension 🏀

[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

AI-powered NBA game analysis on [Polymarket](https://polymarket.com), paid via x402 (Base Sepolia USDC).
Users on Polymarket NBA pages can open the PolyOx extension to auto-detect the game context. 
Connect wallet, click "Run Analysis", approve the x402 micropayment signature in MetaMask, and receive instant AI analytics.

## Install (Chrome / Brave / Edge)


1. Clone or download the repository:
   ```bash
   git clone https://github.com/lootex-io/polyox-chrome-extension.git
   ```
2. Open your browser and navigate to `chrome://extensions`
3. Enable **Developer mode** (toggle in the top-right corner)
4. Click **Load unpacked** and select the `polyox-chrome-extension` project root folder
5. The **PolyOx Agent** icon will appear in your toolbar — click it to open the popup

## Usage

1. Navigate to an NBA game page on [polymarket.com](https://polymarket.com)
2. Click the PolyOx extension icon
3. Connect your wallet
4. Hit **⚡ Run Analysis** to get an AI-powered breakdown of the matchup

## Development

If you want to modify the source code, install dependencies and rebuild:

```bash
npm install
npm run build     # one-off build
npm run watch     # rebuild on file changes
```

Source files live in `src/`; the build outputs to `dist/`.

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.
