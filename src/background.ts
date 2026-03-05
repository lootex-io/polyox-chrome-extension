// ─── Background Service Worker ───
// Handles: game detection, wallet interactions, x402 payment flow.
// All state persisted in chrome.storage.session so sidepanel can restore.

import { numberToHex, toHex } from 'viem';
import { baseSepolia } from 'viem/chains';
import { setIconActive } from './icons';

// ─── Constants ───
const API_BASE = 'https://api-hoobs.polyox.io';
const USDC_ADDRESS = '0x036CbD53842c5426634e7929541eC2318f3dCF7e';

// ─── Types ───
interface Game {
  away: string;
  home: string;
  date: string;
  url: string;
}

interface WidgetState {
  connected?: boolean;
  address?: string;
  chainIdHex?: string;
  walletDetected?: boolean;
  tabId?: number;
  game?: Game | null;
  analysisResult?: unknown;
  analysisError?: string | null;
  analyzing?: boolean;
}

interface Message {
  action: string;
  game?: Game;
  [key: string]: unknown;
}

interface PaymentAccept {
  payTo: string;
  amount: number;
  asset?: string;
  maxTimeoutSeconds?: number;
  extra?: {
    name?: string;
    version?: string;
  };
}

// ─── State helpers ───
async function getState(): Promise<WidgetState> {
  return (await chrome.storage.session.get('widgetState'))?.widgetState || {};
}

async function saveState(updates: Partial<WidgetState>): Promise<WidgetState> {
  const current = await getState();
  const newState = { ...current, ...updates };
  await chrome.storage.session.set({ widgetState: newState });
  return newState;
}

// ─── Analysis cache (persists across side panel toggling) ───
function gameKey(game: Game): string {
  return `analysis_${game.away}_${game.home}_${game.date}`;
}

async function getCachedAnalysis(game: Game): Promise<unknown | null> {
  const key = gameKey(game);
  const data = await chrome.storage.local.get(key);
  return data[key] || null;
}

async function setCachedAnalysis(game: Game, result: unknown): Promise<void> {
  const key = gameKey(game);
  await chrome.storage.local.set({ [key]: result });
}

// ─── Execute code in the page's main world ───
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function executeInPage<T>(
  tabId: number,
  func: (...args: any[]) => T,
  args: unknown[] = [],
): Promise<T> {
  const results = await chrome.scripting.executeScript({
    target: { tabId },
    world: 'MAIN',
    func,
    args,
  } as any);
  const frame = results[0];
  if ('error' in frame) throw new Error((frame.error as Error).message);
  return frame.result as T;
}

function safeBase64Encode(data: string): string {
  const bytes = new TextEncoder().encode(data);
  const binaryString = Array.from(bytes, (byte) =>
    String.fromCharCode(byte),
  ).join('');
  return globalThis.btoa(binaryString);
}

async function getActiveTab(): Promise<chrome.tabs.Tab> {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  if (
    !tab ||
    tab.url?.startsWith('chrome://') ||
    tab.url?.startsWith('chrome-extension://')
  ) {
    throw new Error('Navigate to a regular webpage first.');
  }
  return tab;
}

// ─── Re-detect game when user switches tabs or navigates ───
function parseGameFromUrl(url: string): Game | null {
  const match = url.match(
    /polymarket\.com\/(?:sports\/nba|event)\/nba-([a-z]{3})-([a-z]{3})-(\d{4}-\d{2}-\d{2})/i,
  );
  if (!match) return null;
  const [, away, home, date] = match;
  return { away: away.toUpperCase(), home: home.toUpperCase(), date, url };
}

async function redetectGame(tabId: number) {
  try {
    const tab = await chrome.tabs.get(tabId);
    if (
      !tab.url ||
      tab.url.startsWith('chrome://') ||
      tab.url.startsWith('chrome-extension://')
    ) {
      await saveState({ game: null, analysisResult: null });
      await setIconActive(false);
      chrome.action.setBadgeText({ text: '' });
      return;
    }
    const game = parseGameFromUrl(tab.url);
    if (game) {
      const cached = await getCachedAnalysis(game);
      await saveState({ game, analysisResult: cached, analysisError: null });
      await setIconActive(true);
      chrome.action.setBadgeText({ text: 'NBA' });
      chrome.action.setBadgeBackgroundColor({ color: '#00FF41' });
    } else {
      await saveState({ game: null, analysisResult: null });
      await setIconActive(false);
      chrome.action.setBadgeText({ text: '' });
    }
  } catch {
    // Tab may have been closed or is not scriptable
  }
}

chrome.tabs.onActivated.addListener(({ tabId }) => {
  redetectGame(tabId);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
  if (changeInfo.status === 'complete' && tab.active) {
    redetectGame(tabId);
  }
});

// ─── Message handler ───
chrome.runtime.onMessage.addListener(
  (message: Message, sender: chrome.runtime.MessageSender, sendResponse) => {
    handleMessage(message, sender)
      .then((result) => sendResponse({ success: true, data: result }))
      .catch((err: Error) =>
        sendResponse({ success: false, error: err.message }),
      );
    return true; // async
  },
);

async function handleMessage(
  message: Message,
  _sender: chrome.runtime.MessageSender,
): Promise<unknown> {
  const { action } = message;

  switch (action) {
    // ── Game detection (from content script) ──
    case 'detect-game': {
      const { game } = message;
      if (!game) throw new Error('No game data');

      const cached = await getCachedAnalysis(game);
      await saveState({ game, analysisResult: cached, analysisError: null });
      await setIconActive(true);

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
      const hasWallet = await executeInPage<boolean>(
        tab.id!,
        () => typeof window.ethereum !== 'undefined',
      );
      await saveState({ walletDetected: hasWallet, tabId: tab.id });
      return hasWallet;
    }

    case 'connect': {
      const tab = await getActiveTab();
      const accounts = await executeInPage<string[]>(
        tab.id!,
        () => window.ethereum.request({ method: 'eth_requestAccounts' }) as any,
      );
      if (!accounts?.length) throw new Error('No accounts returned');

      const address = accounts[0];
      const chainIdHex = await executeInPage<string>(
        tab.id!,
        () => window.ethereum.request({ method: 'eth_chainId' }) as any,
      );

      await saveState({ connected: true, address, chainIdHex });
      return { address, chainIdHex };
    }

    // ── Analysis with x402 payment ──
    case 'analyze': {
      const state = await getState();
      if (!state.game) throw new Error('No game detected');
      if (!state.address) throw new Error('Connect wallet first');

      await saveState({
        analyzing: true,
        analysisResult: null,
        analysisError: null,
      });

      try {
        const result = await performAnalysis(state);
        await setCachedAnalysis(state.game, result);
        await saveState({ analyzing: false, analysisResult: result });
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await saveState({ analyzing: false, analysisError: message });
        throw err;
      }
    }

    // ── Free analysis (no payment) ──
    case 'analyze-free': {
      const state = await getState();
      if (!state.game) throw new Error('No game detected');

      await saveState({
        analyzing: true,
        analysisResult: null,
        analysisError: null,
      });

      try {
        const res = await fetch(`${API_BASE}/nba/analysis/free`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            date: state.game.date,
            home: state.game.home,
            away: state.game.away,
          }),
        });

        if (!res.ok) {
          const errText = await res.text().catch(() => '');
          throw new Error(`Free analysis failed (${res.status}): ${errText}`);
        }

        const result = await res.json();
        await setCachedAnalysis(state.game, result);
        await saveState({ analyzing: false, analysisResult: result });
        return result;
      } catch (err) {
        const message = err instanceof Error ? err.message : String(err);
        await saveState({ analyzing: false, analysisError: message });
        throw err;
      }
    }

    // ── History ──
    case 'get-history': {
      const allData = await chrome.storage.local.get(null);
      const history = [];
      for (const [key, value] of Object.entries(allData)) {
        if (key.startsWith('analysis_')) {
          // Parse game details from key: analysis_AWAY_HOME_DATE
          const parts = key.split('_');
          if (parts.length >= 4) {
            const away = parts[1];
            const home = parts[2];
            const date = parts.slice(3).join('_');
            history.push({
              game: { away, home, date },
              analysis: value,
            });
          }
        }
      }
      // Sort by latest generatedAt if available, otherwise fallback
      history.sort((a, b) => {
        const tA = (a.analysis as any)?.generatedAt
          ? new Date((a.analysis as any).generatedAt).getTime()
          : 0;
        const tB = (b.analysis as any)?.generatedAt
          ? new Date((b.analysis as any).generatedAt).getTime()
          : 0;
        return tB - tA; // descending
      });
      return history;
    }

    // ── State ──
    case 'getState': {
      return await getState();
    }

    case 'disconnect': {
      await saveState({
        connected: false,
        address: undefined,
        chainIdHex: undefined,
      });
      return true;
    }

    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

// ─── x402 Analysis Flow ───
async function performAnalysis(state: WidgetState): Promise<unknown> {
  const { game, address } = state;
  if (!game || !address) throw new Error('Missing game or address');

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

  if (res402.ok) {
    return await res402.json();
  }

  if (res402.status !== 402) {
    const errText = await res402.text().catch(() => '');
    throw new Error(`API returned ${res402.status}: ${errText}`);
  }

  // Step 2: Parse 402 response (x402 v2 format)
  let paymentReq: { accepts: PaymentAccept[] };
  const paymentRequiredHeader = res402.headers.get('payment-required');
  if (paymentRequiredHeader) {
    paymentReq = JSON.parse(atob(paymentRequiredHeader));
  } else {
    paymentReq = await res402.json();
  }

  if (!paymentReq.accepts || !paymentReq.accepts.length) {
    throw new Error(
      `No accepted payment methods: ${JSON.stringify(paymentReq)}`,
    );
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

  const targetChainHex = numberToHex(baseSepolia.id);

  // Chain metadata from viem for wallet_addEthereumChain
  const chainConfig = {
    chainId: targetChainHex,
    chainName: baseSepolia.name,
    nativeCurrency: baseSepolia.nativeCurrency,
    rpcUrls: [baseSepolia.rpcUrls.default.http[0]],
    blockExplorerUrls: [baseSepolia.blockExplorers.default.url],
  };

  // Fire-and-forget switch request, then poll for result
  await executeInPage(
    tab.id!,
    (chainHex: unknown, chainCfg: unknown) => {
      const hex = chainHex as string;
      const cfg = chainCfg as Record<string, unknown>;
      window.__polyoxSwitchResult = null;

      window.ethereum
        .request({
          method: 'wallet_switchEthereumChain',
          params: [{ chainId: hex }],
        })
        .then(() => {
          window.__polyoxSwitchResult = { success: true };
        })
        .catch((err: { code?: number; message?: string }) => {
          if (err.code === 4902) {
            return window.ethereum
              .request({
                method: 'wallet_addEthereumChain',
                params: [cfg],
              })
              .then(() => {
                window.__polyoxSwitchResult = { success: true };
              });
          }
          throw err;
        })
        .catch((err: { message?: string }) => {
          window.__polyoxSwitchResult = { error: err.message || String(err) };
        });

      return 'started';
    },
    [targetChainHex, chainConfig],
  );

  // Poll for switch result
  await new Promise<void>((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 120;

    const poll = async () => {
      attempts++;
      try {
        const result = await executeInPage<{
          success?: boolean;
          error?: string;
        } | null>(tab.id!, () => window.__polyoxSwitchResult);
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
  const nonceBytes = new Uint8Array(32);
  crypto.getRandomValues(nonceBytes);
  const nonce = toHex(nonceBytes);

  const validAfter = 0;
  const validBefore = Math.floor(Date.now() / 1000) + maxTimeout;

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
      chainId: baseSepolia.id,
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

  // Fire-and-forget — kick off MetaMask signing
  await executeInPage(
    tab.id!,
    (signer: unknown, data: unknown) => {
      const signerAddr = signer as string;
      const typedDataStr = data as string;
      window.__polyoxSignResult = null;

      window.ethereum
        .request({
          method: 'eth_signTypedData_v4',
          params: [signerAddr, typedDataStr],
        })
        .then((sig: unknown) => {
          window.__polyoxSignResult = { signature: sig as string };
        })
        .catch((err: { message?: string }) => {
          window.__polyoxSignResult = { error: err.message || String(err) };
        });

      return 'started';
    },
    [address, typedData],
  );

  // Poll for signature
  const signature = await new Promise<string>((resolve, reject) => {
    let attempts = 0;
    const maxAttempts = 600;

    const poll = async () => {
      attempts++;
      try {
        const result = await executeInPage<{
          signature?: string;
          error?: string;
        } | null>(tab.id!, () => window.__polyoxSignResult);

        if (result) {
          if (result.error) {
            reject(new Error(result.error));
          } else {
            resolve(result.signature!);
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

  // Step 5: Build payment payload and retry
  const paymentPayload = {
    x402Version: 2,
    accepted: {
      scheme: 'exact',
      network: `eip155:${baseSepolia.id}`,
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
    throw new Error(
      `Analysis request failed (${resAnalysis.status}): ${errText}`,
    );
  }

  return await resAnalysis.json();
}

// ─── Init ───
// Open the side panel when the toolbar icon is clicked
chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

setIconActive(false);
