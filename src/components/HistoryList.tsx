import { useEffect, useState } from 'react';
import type { AnalysisData, Game } from '../App';

interface HistoryItem {
  game: Game;
  analysis: AnalysisData;
}

interface HistoryListProps {
  onSelect: (item: HistoryItem) => void;
  sendMsg: <T>(payload: Record<string, unknown>) => Promise<T>;
}

function formatDateDisplay(dateStr: string) {
  try {
    const d = new Date(`${dateStr}T00:00:00`);
    return d.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return dateStr;
  }
}

export default function HistoryList({ onSelect, sendMsg }: HistoryListProps) {
  const [history, setHistory] = useState<HistoryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    sendMsg<HistoryItem[]>({ action: 'get-history' })
      .then(setHistory)
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [sendMsg]);

  if (loading) {
    return (
      <div className="history-list-container">
        <div className="history-loading">Loading history...</div>
      </div>
    );
  }

  if (history.length === 0) {
    return (
      <div className="history-list-container">
        <div className="history-loading">No past analyses found.</div>
      </div>
    );
  }

  return (
    <div className="history-list-container">
      <div className="result-header" style={{ marginBottom: 12 }}>
        <span className="result-label">PAST ANALYSES</span>
      </div>
      <div className="history-scroll">
        {history.map((item, _i) => {
          const { game, analysis } = item;
          // Favored team styling for history card
          const homeWin = analysis.homeWinPct ?? 50;
          const awayWin = analysis.awayWinPct ?? 50;

          return (
            <button
              key={`${game.away}_${game.home}_${game.date}`}
              className="history-card"
              onClick={() => onSelect(item)}
              type="button"
            >
              <div className="history-card-teams">
                <span className={awayWin > homeWin ? 'green' : ''}>
                  {game.away}
                </span>
                <span className="history-card-vs">vs</span>
                <span className={homeWin > awayWin ? 'green' : ''}>
                  {game.home}
                </span>
              </div>
              <div className="history-card-date">
                {formatDateDisplay(game.date)}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
