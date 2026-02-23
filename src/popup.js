// ─── Popup UI ───
// Thin UI layer: reads persisted state, sends commands to background worker.

// ─── DOM ───
const walletPill = document.getElementById('walletPill');
const walletAddr = document.getElementById('walletAddr');
const connectBtn = document.getElementById('connectBtn');
const noGame = document.getElementById('noGame');
const gameInfo = document.getElementById('gameInfo');
const awayTeam = document.getElementById('awayTeam');
const homeTeam = document.getElementById('homeTeam');
const gameDate = document.getElementById('gameDate');
const analyzeBtn = document.getElementById('analyzeBtn');
const paymentNote = document.getElementById('paymentNote');
const resultCard = document.getElementById('resultCard');
const resultBody = document.getElementById('resultBody');
const errorCard = document.getElementById('errorCard');
const errorText = document.getElementById('errorText');

// ─── Messaging ───
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
function show(el) { el.classList.remove('hidden'); }
function hide(el) { el.classList.add('hidden'); }

function truncateAddr(addr) {
  if (!addr) return '—';
  return addr.slice(0, 6) + '…' + addr.slice(-4);
}

function formatDate(dateStr) {
  try {
    const d = new Date(dateStr + 'T00:00:00');
    return d.toLocaleDateString('en-US', {
      weekday: 'short',
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return dateStr;
  }
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

// ─── Render analysis result ───
function renderResult(data) {
  hide(errorCard);

  // The API might return various shapes. Handle common ones.
  let content = '';

  if (typeof data === 'string') {
    content = data;
  } else if (data?.analysis) {
    content = data.analysis;
  } else if (data?.result) {
    content = typeof data.result === 'string' ? data.result : JSON.stringify(data.result, null, 2);
  } else if (data?.prediction) {
    content = data.prediction;
  } else {
    content = JSON.stringify(data, null, 2);
  }

  // Simple markdown-like rendering
  resultBody.innerHTML = content
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/### (.+)/g, '<h3>$1</h3>')
    .replace(/## (.+)/g, '<h2>$1</h2>')
    .replace(/# (.+)/g, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');

  show(resultCard);
}

function showError(msg) {
  hide(resultCard);
  errorText.textContent = msg;
  show(errorCard);
}

// ─── Render state ───
function renderState(state) {
  // Wallet
  if (state.connected && state.address) {
    hide(connectBtn);
    walletAddr.textContent = truncateAddr(state.address);
    show(walletPill);
  } else {
    hide(walletPill);
    show(connectBtn);
  }

  // Game
  if (state.game) {
    awayTeam.textContent = state.game.away;
    homeTeam.textContent = state.game.home;
    gameDate.textContent = formatDate(state.game.date);
    hide(noGame);
    show(gameInfo);

    // Show analyze button if wallet connected
    if (state.connected) {
      show(analyzeBtn);
      show(paymentNote);
    } else {
      hide(analyzeBtn);
      hide(paymentNote);
    }
  } else {
    show(noGame);
    hide(gameInfo);
    hide(analyzeBtn);
    hide(paymentNote);
  }

  // Analysis result
  if (state.analysisResult) {
    renderResult(state.analysisResult);
  }

  if (state.analysisError) {
    showError(state.analysisError);
  }

  if (state.analyzing) {
    setLoading(analyzeBtn, true);
  }
}

// ─── Init ───
async function init() {
  try {
    const state = await sendMsg({ action: 'getState' });
    renderState(state);

    // Try to detect wallet if not connected
    if (!state.connected) {
      try {
        await sendMsg({ action: 'detect' });
      } catch {
        // Might be on a chrome:// page, that's fine
      }
    }
  } catch (err) {
    console.error('Init error:', err);
  }
}

// ─── Connect wallet ───
connectBtn.addEventListener('click', async () => {
  connectBtn.classList.add('loading');
  connectBtn.disabled = true;

  try {
    const result = await sendMsg({ action: 'connect' });
    hide(connectBtn);
    walletAddr.textContent = truncateAddr(result.address);
    show(walletPill);

    // Show analyze if game is detected
    const state = await sendMsg({ action: 'getState' });
    if (state.game) {
      show(analyzeBtn);
      show(paymentNote);
    }
  } catch (err) {
    showError(err.message);
  } finally {
    connectBtn.classList.remove('loading');
    connectBtn.disabled = false;
  }
});

// ─── Analyze ───
analyzeBtn.addEventListener('click', async () => {
  setLoading(analyzeBtn, true);
  hide(errorCard);
  hide(resultCard);

  try {
    const result = await sendMsg({ action: 'analyze' });
    renderResult(result);
  } catch (err) {
    showError(err.message);
  } finally {
    setLoading(analyzeBtn, false);
  }
});

// ─── Start ───
init();
