// ─── Background Service Worker ───
// Handles all ethereum interactions via chrome.scripting.executeScript.
// This survives popup closure (e.g. when MetaMask steals focus).
// State is persisted in chrome.storage.session so the popup can restore on reopen.

// ─── Execute in page's main world ───
async function executeInPage(tabId, func, args = []) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func,
    args,
  });

  if (results[0]?.error) {
    throw new Error(results[0].error.message);
  }

  return results[0]?.result;
}

// ─── Get active tab ───
async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://')) {
    throw new Error('Navigate to a regular webpage first.');
  }
  return tab;
}

// ─── Save state ───
async function saveState(updates) {
  const current = (await chrome.storage.session.get('walletState'))?.walletState || {};
  await chrome.storage.session.set({
    walletState: { ...current, ...updates },
  });
}

// ─── Message handler ───
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message)
    .then((result) => sendResponse({ success: true, data: result }))
    .catch((err) => sendResponse({ success: false, error: err.message }));

  // Return true to indicate async response
  return true;
});

async function handleMessage(message) {
  const { action } = message;

  switch (action) {
    case 'detect': {
      const tab = await getActiveTab();
      const hasWallet = await executeInPage(tab.id, () => {
        return typeof window.ethereum !== 'undefined';
      });
      await saveState({ detected: hasWallet, tabId: tab.id });
      return hasWallet;
    }

    case 'connect': {
      const tab = await getActiveTab();
      const accounts = await executeInPage(tab.id, () => {
        return window.ethereum.request({ method: 'eth_requestAccounts' });
      });

      if (!accounts || accounts.length === 0) {
        throw new Error('No accounts returned');
      }

      const address = accounts[0];

      // Fetch chain ID
      const chainIdHex = await executeInPage(tab.id, () => {
        return window.ethereum.request({ method: 'eth_chainId' });
      });

      // Fetch balance
      const balanceHex = await executeInPage(tab.id, (addr) => {
        return window.ethereum.request({
          method: 'eth_getBalance',
          params: [addr, 'latest'],
        });
      }, [address]);

      await saveState({
        connected: true,
        address,
        balanceHex,
        chainIdHex,
        signature: null,
      });

      return { address, balanceHex, chainIdHex };
    }

    case 'sign': {
      const state = (await chrome.storage.session.get('walletState'))?.walletState;
      if (!state?.address) throw new Error('Not connected');

      const tab = await getActiveTab();
      const { address, signMessage: msg } = message;

      // Mark signing in progress
      await saveState({ signing: true });

      const signature = await executeInPage(tab.id, (addr, m) => {
        const hex =
          '0x' +
          Array.from(new TextEncoder().encode(m))
            .map((b) => b.toString(16).padStart(2, '0'))
            .join('');
        return window.ethereum.request({
          method: 'personal_sign',
          params: [hex, addr],
        });
      }, [address, msg]);

      await saveState({ signature, signing: false });

      return signature;
    }

    case 'refreshBalance': {
      const state = (await chrome.storage.session.get('walletState'))?.walletState;
      if (!state?.address) throw new Error('Not connected');

      const tab = await getActiveTab();
      const balanceHex = await executeInPage(tab.id, (addr) => {
        return window.ethereum.request({
          method: 'eth_getBalance',
          params: [addr, 'latest'],
        });
      }, [state.address]);

      await saveState({ balanceHex });
      return balanceHex;
    }

    case 'getState': {
      const state = (await chrome.storage.session.get('walletState'))?.walletState;
      return state || {};
    }

    case 'disconnect': {
      await chrome.storage.session.remove('walletState');
      return true;
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}
