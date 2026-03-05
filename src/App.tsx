import { ChartLineIcon, ChevronLeftIcon, ScrollTextIcon } from 'lucide-react';
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
          <div className="tab-game" style={{ height: '100%' }}>
            {game ? (
              <GameCard
                game={game}
                connected={connected}
                analyzing={analyzing}
                onConnect={handleConnect}
                onAnalyze={handleAnalyze}
                onFreeAnalyze={handleFreeAnalyze}
              />
            ) : (
              <div
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  flex: 1,
                  justifyContent: 'center',
                  alignItems: 'center',
                  height: '100%',
                }}
              >
                <div className="card">
                  <div className="no-game">
                    <div className="no-game-icon">🏀</div>
                    <p>
                      Navigate to a{' '}
                      <a
                        href="https://polymarket.com/sports/nba/games"
                        target="_blank"
                        rel="noopener noreferrer"
                        className="green"
                        style={{ textDecoration: 'underline' }}
                      >
                        Polymarket NBA game
                      </a>{' '}
                      to get started
                    </p>
                  </div>
                </div>
              </div>
            )}

            {state.analysisResult && (
              <AnalysisResult data={state.analysisResult} game={game} />
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
                {/* Back button */}
                <div
                  style={{
                    marginBottom: 12,
                    textAlign: 'left',
                    display: 'flex',
                    justifyContent: 'space-between',
                  }}
                >
                  <button
                    type="button"
                    className="text-link"
                    onClick={() => setViewingHistory(true)}
                    style={{ display: 'flex', alignItems: 'center' }}
                  >
                    <ChevronLeftIcon />
                    <span>
                      <span className="green">{activeAnalysis.game.away}</span>{' '}
                      <span style={{ color: 'var(--text-dim)' }}>vs</span>{' '}
                      <span className="green">{activeAnalysis.game.home}</span>
                    </span>
                  </button>
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
                <AnalysisResult
                  data={activeAnalysis.data}
                  game={activeAnalysis.game}
                />
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
          <ChartLineIcon size={20} />
          <span className="nav-label">Matchups</span>
        </button>
        <button
          type="button"
          className={`nav-btn ${currentTab === 'analysis' ? 'active' : ''}`}
          onClick={() => {
            setCurrentTab('analysis');
            setViewingHistory(true);
          }}
        >
          <ScrollTextIcon size={20} />
          <span className="nav-label">My Analysis</span>
        </button>
      </nav>
    </div>
  );
}
