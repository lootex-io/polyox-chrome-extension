import { useState, useEffect, useCallback } from 'react';
import Header from './components/Header';
import GameCard from './components/GameCard';
import AnalysisResult from './components/AnalysisResult';
import ErrorCard from './components/ErrorCard';

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

export default function App() {
  const [state, setState] = useState({});
  const [connecting, setConnecting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  // ─── Load initial state & listen for changes ───
  useEffect(() => {
    // Fetch initial state
    sendMsg({ action: 'getState' })
      .then((s) => {
        setState(s);
        // Try to detect wallet if not connected
        if (!s.connected) {
          sendMsg({ action: 'detect' }).catch(() => {});
        }
      })
      .catch(console.error);

    // Reactively update when background changes state
    const listener = (changes) => {
      if (changes.widgetState) {
        setState(changes.widgetState.newValue || {});
      }
    };
    chrome.storage.session.onChanged.addListener(listener);
    return () => chrome.storage.session.onChanged.removeListener(listener);
  }, []);

  // ─── Connect wallet ───
  const handleConnect = useCallback(async () => {
    setConnecting(true);
    try {
      await sendMsg({ action: 'connect' });
      const s = await sendMsg({ action: 'getState' });
      setState(s);
    } catch (err) {
      setState((prev) => ({ ...prev, analysisError: err.message }));
    } finally {
      setConnecting(false);
    }
  }, []);

  // ─── Analyze ───
  const handleAnalyze = useCallback(async () => {
    setAnalyzing(true);
    setState((prev) => ({ ...prev, analysisError: null, analysisResult: null }));
    try {
      const result = await sendMsg({ action: 'analyze' });
      setState((prev) => ({ ...prev, analysisResult: result }));
    } catch (err) {
      setState((prev) => ({ ...prev, analysisError: err.message }));
    } finally {
      setAnalyzing(false);
    }
  }, []);

  const { connected, address, game, analysisResult, analysisError } = state;

  return (
    <div className="container">
      <Header
        connected={connected}
        address={address}
        connecting={connecting}
        onConnect={handleConnect}
      />

      <div className="divider" />

      <GameCard game={game} />

      {game && connected && (
        <button
          className={`btn btn-primary${analyzing ? ' loading' : ''}`}
          disabled={analyzing}
          onClick={handleAnalyze}
        >
          <span className="btn-content">⚡ Run Analysis</span>
        </button>
      )}

      {analysisResult && <AnalysisResult data={analysisResult} />}

      {analysisError && <ErrorCard message={analysisError} />}

      <footer className="footer">
        <span>PolyOx: <span className="green">Hoops</span></span>
      </footer>
    </div>
  );
}
