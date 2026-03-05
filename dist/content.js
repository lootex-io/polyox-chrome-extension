"use strict";
(() => {
  // src/content.ts
  function detectNBAGame() {
    const url = window.location.href;
    const match = url.match(
      /polymarket\.com\/(?:sports\/nba|event)\/nba-([a-z]{3})-([a-z]{3})-(\d{4}-\d{2}-\d{2})/i
    );
    if (match) {
      const [, away, home, date] = match;
      chrome.runtime.sendMessage({
        action: "detect-game",
        game: {
          away: away.toUpperCase(),
          home: home.toUpperCase(),
          date,
          url
        }
      });
    } else {
      chrome.runtime.sendMessage({ action: "clear-game" });
    }
  }
  detectNBAGame();
  var lastUrl = window.location.href;
  var observer = new MutationObserver(() => {
    if (window.location.href !== lastUrl) {
      lastUrl = window.location.href;
      detectNBAGame();
    }
  });
  observer.observe(document.body, { subtree: true, childList: true });
})();
//# sourceMappingURL=content.js.map
