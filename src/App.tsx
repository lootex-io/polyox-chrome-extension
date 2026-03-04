import { useCallback, useEffect, useState } from 'react';
import AnalysisResult from './components/AnalysisResult';
import ErrorCard from './components/ErrorCard';
import GameCard from './components/GameCard';
import Header from './components/Header';

// ─── Types ───
export interface Game {
  away: string;
  home: string;
  date: string;
  url: string;
}

export interface AnalysisData {
  homeWinPct?: number;
  awayWinPct?: number;
  confidence?: number;
  homeTeam?: string;
  awayTeam?: string;
  keyFactors?: string[];
  analysis?: string;
  model?: string;
  generatedAt?: string;
  disclaimer?: string;
  result?: string | Record<string, unknown>;
}

export interface WidgetState {
  connected?: boolean;
  address?: string;
  chainIdHex?: string;
  walletDetected?: boolean;
  tabId?: number;
  game?: Game | null;
  analysisResult?: AnalysisData | null;
  analysisError?: string | null;
  analyzing?: boolean;
}

interface MessageResponse {
  success: boolean;
  data?: unknown;
  error?: string;
}

// ─── Messaging ───
function sendMsg<T = unknown>(payload: Record<string, unknown>): Promise<T> {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(payload, (response: MessageResponse) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      if (!response?.success) {
        reject(new Error(response?.error || 'Unknown error'));
        return;
      }
      resolve(response.data as T);
    });
  });
}

export default function App() {
  const [state, setState] = useState<WidgetState>({});
  const [connecting, setConnecting] = useState(false);
  const [analyzing, setAnalyzing] = useState(false);

  // ─── Load initial state & listen for changes ───
  useEffect(() => {
    sendMsg<WidgetState>({ action: 'getState' })
      .then((s) => {
        setState(s);
        if (!s.connected) {
          sendMsg({ action: 'detect' }).catch(() => {});
        }
      })
      .catch(console.error);

    const listener = (changes: {
      [key: string]: chrome.storage.StorageChange;
    }) => {
      if (changes.widgetState) {
        setState((changes.widgetState.newValue as WidgetState) || {});
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
      const s = await sendMsg<WidgetState>({ action: 'getState' });
      setState(s);
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setState((prev) => ({ ...prev, analysisError: message }));
    } finally {
      setConnecting(false);
    }
  }, []);

  // ─── Analyze ───
  const handleAnalyze = useCallback(async () => {
    setAnalyzing(true);
    setState((prev) => ({
      ...prev,
      analysisError: null,
      analysisResult: null,
    }));
    try {
      const result = await sendMsg<AnalysisData>({ action: 'analyze' });
      setState((prev) => ({ ...prev, analysisResult: result }));
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setState((prev) => ({ ...prev, analysisError: message }));
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
          type="button"
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
        <span>
          PolyOx: <span className="green">Hoops</span>
        </span>
      </footer>
    </div>
  );
}
