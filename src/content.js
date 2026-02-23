// Content script — runs on polymarket.com pages
// Detects NBA game events from the URL and notifies the background worker.

function detectNBAGame() {
  const url = window.location.href;

  // Match patterns like:
  //   /sports/nba/nba-sas-det-2026-02-23
  //   /event/nba-lal-bos-2025-02-15
  const match = url.match(
    /polymarket\.com\/(?:sports\/nba|event)\/nba-([a-z]{3})-([a-z]{3})-(\d{4}-\d{2}-\d{2})/i
  );

  if (match) {
    const [, away, home, date] = match;
    chrome.runtime.sendMessage({
      action: 'detect-game',
      game: {
        away: away.toUpperCase(),
        home: home.toUpperCase(),
        date,
        url,
      },
    });
  } else {
    chrome.runtime.sendMessage({ action: 'clear-game' });
  }
}

// Run on load
detectNBAGame();

// Also watch for SPA navigation (Polymarket is a React SPA)
let lastUrl = window.location.href;
const observer = new MutationObserver(() => {
  if (window.location.href !== lastUrl) {
    lastUrl = window.location.href;
    detectNBAGame();
  }
});
observer.observe(document.body, { subtree: true, childList: true });
