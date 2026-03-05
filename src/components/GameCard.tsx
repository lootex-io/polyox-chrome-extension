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
    return null;
  }

  // Normal big view
  return (
    <div className="card">
      <div className="game-info">
        <div className="card-label">MATCHUP</div>
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

      <div
        style={{
          display: 'flex',
          flexDirection: 'row',
          gap: 8,
          marginTop: 12,
        }}
      >
        <button
          type="button"
          className={`btn btn-primary${analyzing ? ' loading' : ''}`}
          disabled={analyzing}
          onClick={onAnalyze}
        >
          Pro Analysis
        </button>
        <button
          type="button"
          className={`btn btn-secondary${analyzing ? ' loading' : ''}`}
          disabled={analyzing}
          onClick={onFreeAnalyze}
        >
          Free Analysis
        </button>
      </div>
    </div>
  );
}
