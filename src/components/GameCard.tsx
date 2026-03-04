import type { Game } from '../App';

interface GameCardProps {
  game?: Game | null;
}

function formatDate(dateStr: string): string {
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

export default function GameCard({ game }: GameCardProps) {
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
