// ─── Background Service Worker ───
// Handles: game detection, wallet interactions, x402 payment flow.
// All state persisted in chrome.storage.session so popup can restore.

import { setIconActive } from './icons.js';

// ─── Constants ───
const API_BASE = 'https://api-hoobs.polyox.io';
const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';
const BASE_SEPOLIA_CHAIN_ID = 84532;

// ─── State helpers ───
async function getState() {
  return (await chrome.storage.session.get('widgetState'))?.widgetState || {};
}

async function saveState(updates) {
  const current = await getState();
  const newState = { ...current, ...updates };
  await chrome.storage.session.set({ widgetState: newState });
  return newState;
}

// ─── Analysis cache (persists across side panel toggling) ───
function gameKey(game) {
  return `analysis_${game.away}_${game.home}_${game.date}`;
}

async function getCachedAnalysis(game) {
  const key = gameKey(game);
  const data = await chrome.storage.local.get(key);
  return data[key] || null;
}

async function setCachedAnalysis(game, result) {
  const key = gameKey(game);
  await chrome.storage.local.set({ [key]: result });
}

// ─── Execute code in the page's main world ───
async function executeInPage(tabId, func, args = []) {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func,
    args,
  });
  if (results[0]?.error) throw new Error(results[0].error.message);
  return results[0]?.result;
}

function safeBase64Encode(data) {
  if (typeof globalThis !== "undefined" && typeof globalThis.btoa === "function") {
    const bytes = new TextEncoder().encode(data);
    const binaryString = Array.from(bytes, byte => String.fromCharCode(byte)).join("");
    return globalThis.btoa(binaryString);
  }
  return Buffer.from(data, "utf8").toString("base64");
}

async function getActiveTab() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (!tab || tab.url?.startsWith('chrome://') || tab.url?.startsWith('chrome-extension://')) {
    throw new Error('Navigate to a regular webpage first.');
  }
  return tab;
}

// ─── Message handler ───
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  handleMessage(message, sender)
    .then((result) => sendResponse({ success: true, data: result }))
    .catch((err) => sendResponse({ success: false, error: err.message }));
  return true; // async
});

async function handleMessage(message, sender) {
  const { action } = message;

  switch (action) {
    // ── Game detection (from content script) ──
    case 'detect-game': {
      const { game } = message;

      // Check for cached analysis for this game
      const cached = await getCachedAnalysis(game);
      await saveState({ game, analysisResult: cached, analysisError: null });
      await setIconActive(true);

      // Set badge
      chrome.action.setBadgeText({ text: 'NBA' });
      chrome.action.setBadgeBackgroundColor({ color: '#00FF41' });
      return true;
    }

    case 'clear-game': {
      await saveState({ game: null, analysisResult: null });
      await setIconActive(false);
      chrome.action.setBadgeText({ text: '' });
      return true;
    }

    // ── Wallet ──
    case 'detect': {
      const tab = await getActiveTab();
      const hasWallet = await executeInPage(tab.id, () => {
        return typeof window.ethereum !== 'undefined';
      });
      await saveState({ walletDetected: hasWallet, tabId: tab.id });
      return hasWallet;
    }

    case 'connect': {
      const tab = await getActiveTab();
      const accounts = await executeInPage(tab.id, () => {
        return window.ethereum.request({ method: 'eth_requestAccounts' });
      });
      if (!accounts?.length) throw new Error('No accounts returned');

      const address = accounts[0];
      const chainIdHex = await executeInPage(tab.id, () => {
        return window.ethereum.request({ method: 'eth_chainId' });
      });

      await saveState({ connected: true, address, chainIdHex });
      return { address, chainIdHex };
    }

    // ── Analysis with x402 payment ──
    case 'analyze': {
      const state = await getState();
      if (!state.game) throw new Error('No game detected');
      if (!state.address) throw new Error('Connect wallet first');

      await saveState({ analyzing: true, analysisResult: null, analysisError: null });

      try {
        const result = await performAnalysis(state);
        await setCachedAnalysis(state.game, result);
        await saveState({ analyzing: false, analysisResult: result });
        return result;
      } catch (err) {
        await saveState({ analyzing: false, analysisError: err.message });
        throw err;
      }
    }

    // ── State ──
    case 'getState': {
      return await getState();
    }

    case 'disconnect': {
      const state = await getState();
      await saveState({ connected: false, address: null, chainIdHex: null });
      return true;
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

// ─── x402 Analysis Flow ───
async function performAnalysis(state) {
  const { game, address } = state;
  const body = JSON.stringify({
    date: game.date,
    home: game.home,
    away: game.away,
  });

  // Step 1: Send initial request → expect 402
  const res402 = await fetch(`${API_BASE}/nba/analysis`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
  });

  // If it's not 402, maybe it's free or an error
  if (res402.ok) {
    return await res402.json();
  }

  if (res402.status !== 402) {
    const errText = await res402.text().catch(() => '');
    throw new Error(`API returned ${res402.status}: ${errText}`);
  }

  // Step 2: Parse 402 response (x402 v2 format)
  // The payment requirements may come from a header or the response body
  let paymentReq;
  const paymentRequiredHeader = res402.headers.get('payment-required');
  if (paymentRequiredHeader) {
    paymentReq = JSON.parse(atob(paymentRequiredHeader));
  } else {
    // x402 v2: requirements are in the response body
    paymentReq = await res402.json();
  }

  // x402 v2: payment details are in accepts[0]
  if (!paymentReq.accepts || !paymentReq.accepts.length) {
    throw new Error(`No accepted payment methods: ${JSON.stringify(paymentReq)}`);
  }

  const accept = paymentReq.accepts[0];
  const payTo = accept.payTo;
  const amount = accept.amount;
  const asset = accept.asset || USDC_ADDRESS;
  const maxTimeout = accept.maxTimeoutSeconds || 300;
  const usdcName = accept.extra?.name || 'USD Coin';
  const usdcVersion = accept.extra?.version || '2';

  // Step 3: Ensure wallet is on the correct chain (Base Sepolia)
  const tab = await getActiveTab();

  const targetChainHex = '0x' + BASE_SEPOLIA_CHAIN_ID.toString(16);

  // Fire-and-forget switch request, then poll for result (same pattern as signing)
  await executeInPage(tab.id, (chainHex) => {
    window.__polyoxSwitchResult = null;

    window.ethereum
      .request({
        method: 'wallet_switchEthereumChain',
        params: [{ chainId: chainHex }],
      })
      .then(() => {
        window.__polyoxSwitchResult = { success: true };
      })
      .catch((err) => {
        // 4902 = chain not added to wallet yet
        if (err.code === 4902) {
          return window.ethereum
            .request({
              method: 'wallet_addEthereumChain',
              params: [{
                chainId: chainHex,
                chainName: 'Base Sepolia',
                nativeCurrency: { name: 'ETH', symbol: 'ETH', decimals: 18 },
                rpcUrls: ['https://sepolia.base.org'],
                blockExplorerUrls: ['https://sepolia.basescan.org'],
              }],
            })
            .then(() => {
              window.__polyoxSwitchResult = { success: true };
            });
        }
        throw err;
      })
      .catch((err) => {
        window.__polyoxSwitchResult = { error: err.message || String(err) };
      });

    return 'started';
  }, [targetChainHex]);

  // Poll for switch result
  await new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 120; // 60 seconds

    const poll = async () => {
      attempts++;
      try {
        const result = await executeInPage(tab.id, () => window.__polyoxSwitchResult);
        if (result) {
          if (result.error) {
            reject(new Error(`Chain switch failed: ${result.error}`));
          } else {
            resolve();
          }
          return;
        }
      } catch (err) {
        reject(err);
        return;
      }

      if (attempts >= maxAttempts) {
        reject(new Error('Chain switch timed out'));
        return;
      }

      setTimeout(poll, 500);
    };

    poll();
  });

  // Step 4: Sign EIP-712 TransferWithAuthorization via MetaMask

  // Generate a random nonce (bytes32) — client-side for x402 v2
  const nonceBytes = new Uint8Array(32);
  crypto.getRandomValues(nonceBytes);
  const nonce = '0x' + Array.from(nonceBytes).map(b => b.toString(16).padStart(2, '0')).join('');

  const validAfter = 0;
  const validBefore = Math.floor(Date.now() / 1000) + maxTimeout;

  // Build the full typedData string here in the background,
  // so the injected function is a simple one-liner (like connect).
  const typedData = JSON.stringify({
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
      TransferWithAuthorization: [
        { name: 'from', type: 'address' },
        { name: 'to', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'validAfter', type: 'uint256' },
        { name: 'validBefore', type: 'uint256' },
        { name: 'nonce', type: 'bytes32' },
      ],
    },
    primaryType: 'TransferWithAuthorization',
    domain: {
      name: usdcName,
      version: usdcVersion,
      chainId: BASE_SEPOLIA_CHAIN_ID,
      verifyingContract: asset,
    },
    message: {
      from: address,
      to: payTo,
      value: String(amount),
      validAfter: validAfter,
      validBefore: validBefore,
      nonce: nonce,
    },
  });

  // chrome.scripting.executeScript with world:'MAIN' does NOT properly
  // await Promises that require user interaction (MetaMask popup).
  // Workaround: fire-and-forget to start the request, then poll for the result.

  // Step A: Fire-and-forget — kick off the MetaMask signing.
  // This function is SYNCHRONOUS (returns undefined immediately).
  // MetaMask will open its popup in the background.
  await executeInPage(tab.id, (signer, data) => {
    // Clear any previous result
    window.__polyoxSignResult = null;

    window.ethereum
      .request({
        method: 'eth_signTypedData_v4',
        params: [signer, data],
      })
      .then((sig) => {
        window.__polyoxSignResult = { signature: sig };
      })
      .catch((err) => {
        window.__polyoxSignResult = { error: err.message || String(err) };
      });

    // Return immediately — don't wait for MetaMask
    return 'started';
  }, [address, typedData]);

  // Step B: Poll for the result every 500ms (up to 5 minutes)
  const signature = await new Promise((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 600; // 5 minutes

    const poll = async () => {
      attempts++;
      try {
        const result = await executeInPage(tab.id, () => {
          return window.__polyoxSignResult;
        });

        if (result) {
          if (result.error) {
            reject(new Error(result.error));
          } else {
            resolve(result.signature);
          }
          return;
        }
      } catch (err) {
        reject(err);
        return;
      }

      if (attempts >= maxAttempts) {
        reject(new Error('Signing timed out'));
        return;
      }

      setTimeout(poll, 500);
    };

    poll();
  });

  if (!signature) {
    throw new Error('Signing failed — no signature returned');
  }

  // Step 4: Build payment payload and retry
  const paymentPayload = {
    x402Version: 2,
    accepted: {
      scheme: 'exact',
      network: 'eip155:84532',
      payTo,
      amount,
      asset,
      maxTimeoutSeconds: maxTimeout,
      extra: {
        name: usdcName,
        version: usdcVersion,
      },
    },
    payload: {
      signature,
      authorization: {
        from: address,
        to: payTo,
        value: String(amount),
        validAfter: String(validAfter),
        validBefore: String(validBefore),
        nonce: String(nonce),
      },
    },
  };

  const paymentSigHeader = safeBase64Encode(JSON.stringify(paymentPayload));

  const resAnalysis = await fetch(`${API_BASE}/nba/analysis`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Payment-Signature': paymentSigHeader,
    },
    body,
  });

  if (!resAnalysis.ok) {
    const errText = await resAnalysis.text().catch(() => '');
    throw new Error(`Analysis request failed (${resAnalysis.status}): ${errText}`);
  }

  return await resAnalysis.json();
}

// ─── Init ───
// Open the side panel when the toolbar icon is clicked
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

setIconActive(false); // fire-and-forget on init
