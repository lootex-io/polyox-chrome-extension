import { formatEther } from 'viem';

// ─── DOM Elements ───
const statusDot = document.getElementById('statusDot');
const statusText = document.getElementById('statusText');
const networkBadge = document.getElementById('networkBadge');
const walletCard = document.getElementById('walletCard');
const addressText = document.getElementById('addressText');
const balanceText = document.getElementById('balanceText');
const connectBtn = document.getElementById('connectBtn');
const signBtn = document.getElementById('signBtn');
const signatureCard = document.getElementById('signatureCard');
const signatureText = document.getElementById('signatureText');
const copyBtn = document.getElementById('copyBtn');

// ─── Chain ID → Name map ───
const CHAIN_NAMES = {
  1: 'Mainnet',
  5: 'Goerli',
  11155111: 'Sepolia',
  137: 'Polygon',
  42161: 'Arbitrum',
  10: 'Optimism',
  8453: 'Base',
  56: 'BSC',
  43114: 'Avalanche',
};

// ─── Send message to background service worker ───
function sendMsg(payload) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(payload, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!response?.success) {
        reject(new Error(response?.error || 'Unknown error'));
        return;
      }
      resolve(response.data);
    });
  });
}

// ─── Helpers ───
function setStatus(state, text) {
  statusDot.className = `status-dot ${state}`;
  statusText.textContent = text;
}

function showElement(el) {
  el.classList.remove('hidden');
}

function hideElement(el) {
  el.classList.add('hidden');
}

function setLoading(btn, loading) {
  if (loading) {
    btn.classList.add('loading');
    btn.disabled = true;
  } else {
    btn.classList.remove('loading');
    btn.disabled = false;
  }
}

function formatBalance(balanceHex) {
  const formatted = formatEther(BigInt(balanceHex));
  const num = parseFloat(formatted);
  return num < 0.000001 && num > 0
    ? '< 0.000001'
    : num.toFixed(6).replace(/\.?0+$/, '') || '0';
}

function getChainName(chainIdHex) {
  const chainId = parseInt(chainIdHex, 16);
  return CHAIN_NAMES[chainId] || `Chain ${chainId}`;
}

// ─── Render connected state ───
function renderConnected(state) {
  setStatus('connected', 'Connected');
  addressText.textContent = state.address;

  if (state.balanceHex) {
    balanceText.textContent = formatBalance(state.balanceHex);
  }

  if (state.chainIdHex) {
    networkBadge.textContent = getChainName(state.chainIdHex);
  }

  showElement(walletCard);
  showElement(signBtn);
  hideElement(connectBtn);

  if (state.signature) {
    signatureText.textContent = state.signature;
    showElement(signatureCard);
  }

  if (state.signing) {
    setLoading(signBtn, true);
  }
}

// ─── Init: restore state from background ───
async function init() {
  try {
    const state = await sendMsg({ action: 'getState' });

    if (state.connected && state.address) {
      // Restore previously connected state
      renderConnected(state);
      return;
    }

    // Not connected yet — detect wallet
    const detected = await sendMsg({ action: 'detect' });

    if (detected) {
      setStatus('detected', 'Ethereum wallet detected');
      connectBtn.querySelector('.btn-content').textContent = 'Connect Wallet';
    } else {
      setStatus('error', 'No Ethereum wallet detected');
      connectBtn.querySelector('.btn-content').textContent = 'Install MetaMask';
      connectBtn.onclick = () => window.open('https://metamask.io/download/', '_blank');
    }
  } catch (err) {
    setStatus('error', err.message || 'Cannot detect wallet');
    connectBtn.querySelector('.btn-content').textContent = 'Open a webpage first';
    connectBtn.disabled = true;
  }
}

// ─── Connect ───
async function connectWallet() {
  setLoading(connectBtn, true);
  try {
    const result = await sendMsg({ action: 'connect' });
    renderConnected({
      connected: true,
      address: result.address,
      balanceHex: result.balanceHex,
      chainIdHex: result.chainIdHex,
    });
  } catch (err) {
    console.error('Connection error:', err);
    if (err.message?.includes('4001') || err.message?.includes('rejected')) {
      setStatus('error', 'Connection rejected by user');
    } else {
      setStatus('error', err.message || 'Connection failed');
    }
  } finally {
    setLoading(connectBtn, false);
  }
}

// ─── Sign ───
async function signMessage() {
  setLoading(signBtn, true);
  try {
    const state = await sendMsg({ action: 'getState' });
    const message = `Hello from Polyox!\n\nTimestamp: ${new Date().toISOString()}\nAddress: ${state.address}`;

    const signature = await sendMsg({
      action: 'sign',
      address: state.address,
      signMessage: message,
    });

    signatureText.textContent = signature;
    showElement(signatureCard);
  } catch (err) {
    console.error('Signing error:', err);
    if (!err.message?.includes('4001') && !err.message?.includes('rejected')) {
      signatureText.textContent = `Error: ${err.message}`;
      showElement(signatureCard);
    }
  } finally {
    setLoading(signBtn, false);
  }
}

// ─── Copy Address ───
copyBtn.addEventListener('click', () => {
  const addr = addressText.textContent;
  if (!addr || addr === '—') return;
  navigator.clipboard.writeText(addr).then(() => {
    copyBtn.classList.add('copied');
    setTimeout(() => copyBtn.classList.remove('copied'), 1500);
  });
});

// ─── Event Listeners ───
connectBtn.addEventListener('click', connectWallet);
signBtn.addEventListener('click', signMessage);

// ─── Start ───
init();
