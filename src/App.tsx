import { useCallback, useEffect, useState } from 'react';
import AnalysisResult from './components/AnalysisResult';
import ErrorCard from './components/ErrorCard';
import GameCard from './components/GameCard';
import Header from './components/Header';
import HistoryList from './components/HistoryList';

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
export function sendMsg<T = unknown>(
  payload: Record<string, unknown>,
): Promise<T> {
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

  // New UI State
  const [currentTab, setCurrentTab] = useState<'game' | 'analysis'>('game');
  const [viewingHistory, setViewingHistory] = useState(false);
  const [activeAnalysis, setActiveAnalysis] = useState<{
    game: Game;
    data: AnalysisData;
  } | null>(null);

  // ─── Load initial state & listen for changes ───
  useEffect(() => {
    sendMsg<WidgetState>({ action: 'getState' })
      .then((s) => {
        setState(s);
        if (!s.connected) {
          sendMsg({ action: 'detect' }).catch(() => {});
        }
        if (s.game && s.analysisResult) {
          setActiveAnalysis({ game: s.game, data: s.analysisResult });
        }
      })
      .catch(console.error);

    const listener = (changes: {
      [key: string]: chrome.storage.StorageChange;
    }) => {
      if (changes.widgetState) {
        const newState = (changes.widgetState.newValue as WidgetState) || {};
        setState(newState);

        // Auto-update active analysis if it's for the current game
        if (newState.game && newState.analysisResult) {
          setActiveAnalysis({
            game: newState.game,
            data: newState.analysisResult,
          });
        }
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

  // ─── Analyze (Run for CURRENT game) ───
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
      if (state.game) {
        setActiveAnalysis({ game: state.game, data: result });
        setCurrentTab('analysis'); // Auto switch tab
        setViewingHistory(false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setState((prev) => ({ ...prev, analysisError: message }));
    } finally {
      setAnalyzing(false);
    }
  }, [state.game]);

  // ─── Free Analyze (Run for CURRENT game) ───
  const handleFreeAnalyze = useCallback(async () => {
    setAnalyzing(true);
    setState((prev) => ({
      ...prev,
      analysisError: null,
      analysisResult: null,
    }));
    try {
      const result = await sendMsg<AnalysisData>({ action: 'analyze-free' });
      setState((prev) => ({ ...prev, analysisResult: result }));
      if (state.game) {
        setActiveAnalysis({ game: state.game, data: result });
        setCurrentTab('analysis'); // Auto switch tab
        setViewingHistory(false);
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      setState((prev) => ({ ...prev, analysisError: message }));
    } finally {
      setAnalyzing(false);
    }
  }, [state.game]);

  // ─── History Selection ───
  const handleSelectHistory = useCallback(
    (item: { game: Game; analysis: AnalysisData }) => {
      setActiveAnalysis({ game: item.game, data: item.analysis });
      setViewingHistory(false);
      setState((prev) => ({ ...prev, analysisError: null }));
    },
    [],
  );

  const { connected, address, game, analysisError } = state;

  return (
    <div className="container app-container">
      <Header
        connected={connected}
        address={address}
        connecting={connecting}
        onConnect={handleConnect}
      />

      <div className="divider" />

      <main className="main-content">
        {currentTab === 'game' && (
          <div className="tab-game">
            <GameCard
              game={game}
              connected={connected}
              analyzing={analyzing}
              onConnect={handleConnect}
              onAnalyze={handleAnalyze}
              onFreeAnalyze={handleFreeAnalyze}
            />

            {game && !analyzing && (
              <div
                className="card"
                style={{
                  marginTop: 12,
                  textAlign: 'center',
                  padding: '20px 0',
                }}
              >
                <p style={{ color: 'var(--text-dim)', marginBottom: 12 }}>
                  {state.analysisResult ? 'Re-run analysis' : 'Run analysis'}{' '}
                  for {game.away} vs {game.home}
                </p>
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    gap: 8,
                    padding: '0 16px',
                  }}
                >
                  <button
                    type="button"
                    className={`btn btn-primary${analyzing ? ' loading' : ''}`}
                    disabled={analyzing}
                    onClick={handleAnalyze}
                  >
                    Paid Analysis (x402)
                  </button>
                  <button
                    type="button"
                    className={`btn btn-secondary${analyzing ? ' loading' : ''}`}
                    disabled={analyzing}
                    onClick={handleFreeAnalyze}
                  >
                    Free Analysis
                  </button>
                </div>
              </div>
            )}

            {state.analysisResult && (
              <AnalysisResult data={state.analysisResult} />
            )}
          </div>
        )}

        {currentTab === 'analysis' && (
          <div
            className="tab-analysis"
            style={{ display: 'flex', flexDirection: 'column', flex: 1 }}
          >
            {!activeAnalysis || viewingHistory ? (
              <HistoryList sendMsg={sendMsg} onSelect={handleSelectHistory} />
            ) : (
              <>
                <div
                  className="card card-minimized"
                  style={{ marginBottom: 12 }}
                >
                  <div className="minimized-header" style={{ width: '100%' }}>
                    <div
                      className="card-label"
                      style={{
                        marginBottom: 4,
                        display: 'flex',
                        justifyContent: 'space-between',
                      }}
                    >
                      <span>VIEWING MATCHUP</span>
                      <button
                        type="button"
                        className="text-link"
                        onClick={() => setViewingHistory(true)}
                      >
                        View History
                      </button>
                    </div>
                    <div className="minimized-matchup">
                      <span className="green">{activeAnalysis.game.away}</span>{' '}
                      vs{' '}
                      <span className="green">{activeAnalysis.game.home}</span>
                    </div>
                    <div
                      style={{
                        fontSize: 11,
                        color: 'var(--text-dim)',
                        marginTop: 2,
                      }}
                    >
                      {activeAnalysis.game.date}
                    </div>
                  </div>
                </div>
                <AnalysisResult data={activeAnalysis.data} />
              </>
            )}
          </div>
        )}
      </main>

      {analysisError && (
        <div style={{ padding: '0 16px' }}>
          <ErrorCard message={analysisError} />
        </div>
      )}

      <nav className="bottom-nav">
        <button
          type="button"
          className={`nav-btn ${currentTab === 'game' ? 'active' : ''}`}
          onClick={() => setCurrentTab('game')}
        >
          <span className="nav-icon">🏀</span>
          <span className="nav-label">Game</span>
        </button>
        <button
          type="button"
          className={`nav-btn ${currentTab === 'analysis' ? 'active' : ''}`}
          onClick={() => {
            setCurrentTab('analysis');
            if (!activeAnalysis) setViewingHistory(true);
          }}
        >
          <span className="nav-icon">📊</span>
          <span className="nav-label">Analysis</span>
        </button>
      </nav>
    </div>
  );
}
