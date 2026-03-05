import type { Game } from '../App';

interface GameCardProps {
  game?: Game | null;
  minimized?: boolean;
  connected?: boolean;
  analyzing?: boolean;
  onConnect?: () => void;
  onAnalyze?: () => void;
  onFreeAnalyze?: () => void;
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(`${dateStr}T00:00:00`);
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

export default function GameCard({
  game,
  minimized,
  connected,
  analyzing,
  onConnect,
  onAnalyze,
  onFreeAnalyze,
}: GameCardProps) {
  if (!game) {
    return (
      <div className="card">
        <div className="no-game">
          <div className="no-game-icon">🏀</div>
          <p>
            Navigate to a <span className="green">Polymarket NBA game</span> to
            get started
          </p>
        </div>
      </div>
    );
  }

  if (minimized) {
    return (
      <div className="card card-minimized">
        <div className="minimized-header">
          <div className="card-label" style={{ marginBottom: 0 }}>
            CURRENT MATCHUP
          </div>
          <div className="minimized-matchup">
            <span className="green">{game.away}</span> vs{' '}
            <span className="green">{game.home}</span>
          </div>
        </div>
        <div className="minimized-actions">
          {connected ? (
            <button
              type="button"
              className={`btn btn-primary mini-btn${analyzing ? ' loading' : ''}`}
              disabled={analyzing}
              onClick={onAnalyze}
            >
              <span className="btn-content">Paid</span>
            </button>
          ) : (
            <button
              type="button"
              className={`btn btn-primary mini-btn${analyzing ? ' loading' : ''}`}
              disabled={analyzing}
              onClick={onConnect}
            >
              <span className="btn-content">Connect</span>
            </button>
          )}
          <button
            type="button"
            className={`btn btn-secondary mini-btn${analyzing ? ' loading' : ''}`}
            disabled={analyzing}
            onClick={onFreeAnalyze}
          >
            <span className="btn-content">Free</span>
          </button>
        </div>
      </div>
    );
  }

  // Normal big view
  return (
    <div className="card">
      <div className="game-info">
        <div className="card-label">DETECTED MATCHUP</div>
        <div className="matchup">
          <div className="team">
            <span className="team-abbr">{game.away}</span>
            <span className="team-label">AWAY</span>
          </div>
          <div className="vs-badge">vs</div>
          <div className="team">
            <span className="team-abbr">{game.home}</span>
            <span className="team-label">HOME</span>
          </div>
        </div>
        <div className="game-date">{formatDate(game.date)}</div>
      </div>
    </div>
  );
}
