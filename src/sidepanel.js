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

  // Structured response from PolyOx API
  if (data && typeof data === 'object' && data.homeWinPct !== undefined) {
    resultBody.innerHTML = renderStructuredAnalysis(data);
    show(resultCard);
    return;
  }

  // Fallback for other shapes
  let content = '';
  if (typeof data === 'string') {
    content = data;
  } else if (data?.analysis) {
    content = data.analysis;
  } else if (data?.result) {
    content = typeof data.result === 'string' ? data.result : JSON.stringify(data.result, null, 2);
  } else {
    content = JSON.stringify(data, null, 2);
  }

  resultBody.innerHTML = escapeHtml(content)
    .replace(/### (.+)/g, '<h3>$1</h3>')
    .replace(/## (.+)/g, '<h2>$1</h2>')
    .replace(/# (.+)/g, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');

  show(resultCard);
}

function escapeHtml(str) {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function renderStructuredAnalysis(d) {
  const homeWin = d.homeWinPct || 50;
  const awayWin = d.awayWinPct || 50;
  const confidence = d.confidence || 0;
  const homeName = d.homeTeam || '—';
  const awayName = d.awayTeam || '—';

  // Determine favored team
  const favored = homeWin >= awayWin ? 'home' : 'away';

  let html = '';

  // ── Win Probability Section ──
  html += `<div class="r-section">`;
  html += `<div class="r-label">WIN PROBABILITY</div>`;
  html += `<div class="r-prob-row">`;
  html += `  <span class="r-prob-team ${favored === 'away' ? 'r-favored' : ''}">${awayName}</span>`;
  html += `  <span class="r-prob-pct ${favored === 'away' ? 'r-favored' : ''}">${awayWin}%</span>`;
  html += `</div>`;
  html += `<div class="r-bar-track"><div class="r-bar-fill" style="width:${awayWin}%"></div></div>`;
  html += `<div class="r-prob-row" style="margin-top:6px">`;
  html += `  <span class="r-prob-team ${favored === 'home' ? 'r-favored' : ''}">${homeName}</span>`;
  html += `  <span class="r-prob-pct ${favored === 'home' ? 'r-favored' : ''}">${homeWin}%</span>`;
  html += `</div>`;
  html += `<div class="r-bar-track"><div class="r-bar-fill" style="width:${homeWin}%"></div></div>`;
  html += `</div>`;

  // ── Confidence ──
  html += `<div class="r-section">`;
  html += `<div class="r-label">CONFIDENCE</div>`;
  html += `<div class="r-confidence">`;
  html += `  <div class="r-conf-bar-track">`;
  html += `    <div class="r-conf-bar-fill" style="width:${confidence}%"></div>`;
  html += `  </div>`;
  html += `  <span class="r-conf-value">${confidence}%</span>`;
  html += `</div>`;
  html += `</div>`;

  // ── Key Factors ──
  if (d.keyFactors && d.keyFactors.length) {
    html += `<div class="r-section">`;
    html += `<div class="r-label">KEY FACTORS</div>`;
    html += `<ul class="r-factors">`;
    for (const factor of d.keyFactors) {
      html += `<li>${escapeHtml(factor)}</li>`;
    }
    html += `</ul>`;
    html += `</div>`;
  }

  // ── Analysis ──
  if (d.analysis) {
    html += `<div class="r-section">`;
    html += `<div class="r-label">ANALYSIS</div>`;
    html += `<p class="r-analysis">${escapeHtml(d.analysis)}</p>`;
    html += `</div>`;
  }

  // ── Meta ──
  html += `<div class="r-meta">`;
  if (d.model) html += `<span>model: ${escapeHtml(d.model)}</span>`;
  if (d.generatedAt) {
    const t = new Date(d.generatedAt);
    html += `<span>${t.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' })}</span>`;
  }
  html += `</div>`;

  // ── Disclaimer ──
  if (d.disclaimer) {
    html += `<div class="r-disclaimer">${escapeHtml(d.disclaimer)}</div>`;
  }

  return html;
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
    } else {
      hide(analyzeBtn);
    }
  } else {
    show(noGame);
    hide(gameInfo);
    hide(analyzeBtn);
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

// ─── Reactively update when background changes state ───
// The side panel persists (unlike the popup which re-inits on every open),
// so we listen for storage changes to keep the UI in sync.
chrome.storage.session.onChanged.addListener((changes) => {
  if (changes.widgetState) {
    renderState(changes.widgetState.newValue || {});
  }
});
