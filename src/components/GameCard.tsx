import { RefreshCwIcon } from 'lucide-react';
import type { Game, GameContext } from '../App';

interface GameCardProps {
  game?: Game | null;
  gameContext?: GameContext | null;
  loadingContext?: boolean;
  minimized?: boolean;
  connected?: boolean;
  analyzing?: boolean;
  onConnect?: () => void;
  onAnalyze?: () => void;
  onFreeAnalyze?: () => void;
  onReloadContext?: () => void;
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

function fmt(n: number, decimals = 1): string {
  return n.toFixed(decimals);
}

// Format player name: "James,LeBron" → "L. James"
function formatPlayerName(raw: string): string {
  const [last, first] = raw.split(',');
  if (!first) return raw;
  return `${first.trim()[0]}. ${last.trim()}`;
}

const STATUS_ORDER = ['Out', 'Doubtful', 'Questionable', 'Probable'];

function statusColor(status: string): string {
  if (status === 'Out') return 'var(--red)';
  if (status === 'Doubtful') return '#ff8c41';
  if (status === 'Questionable') return '#ffd041';
  return 'var(--text-dim)';
}

function statusTag(status: string): string {
  if (status === 'Out') return 'OUT';
  if (status === 'Doubtful') return 'DTF';
  if (status === 'Questionable') return 'Q';
  if (status === 'Probable') return 'PRB';
  return status.slice(0, 3).toUpperCase();
}

const STAT_TOOLTIPS: Record<string, string> = {
  PPG: 'Points Per Game',
  REB: 'Rebounds Per Game',
  AST: 'Assists Per Game',
  ORTG: 'Offensive Rating — estimated points scored per 100 possessions (higher is better)',
  DRTG: 'Defensive Rating — estimated points allowed per 100 possessions (lower is better)',
};

const STATUS_TOOLTIPS: Record<string, string> = {
  OUT: 'Out — will not play',
  DTF: 'Doubtful — very unlikely to play',
  Q: 'Questionable — uncertain availability',
  PRB: 'Probable — expected to play',
};

export default function GameCard({
  game,
  gameContext,
  loadingContext,
  analyzing,
  onAnalyze,
  onFreeAnalyze,
  onReloadContext,
}: GameCardProps) {
  if (!game) {
    return null;
  }

  const { homeStats, awayStats, homeInjuries, awayInjuries } =
    gameContext || {};

  // Stats rows: [label, awayVal, homeVal, lowerIsBetter] — only include rows with real data
  const allStatRows: [string, number, number, boolean][] = homeStats && awayStats
    ? [
        ['PPG', awayStats.pts, homeStats.pts, false],
        ['REB', awayStats.reb, homeStats.reb, false],
        ['AST', awayStats.ast, homeStats.ast, false],
        ['ORTG', awayStats.offRtg, homeStats.offRtg, false],
        ['DRTG', awayStats.defRtg, homeStats.defRtg, true],
      ]
    : [];
  const statsRows = allStatRows.filter(([, a, h]) => a > 0 || h > 0);

  // Merge and sort injuries
  const awayOut = (awayInjuries || []).filter((p) =>
    STATUS_ORDER.includes(p.status),
  );
  const homeOut = (homeInjuries || []).filter((p) =>
    STATUS_ORDER.includes(p.status),
  );
  const hasInjuries = awayOut.length > 0 || homeOut.length > 0;

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

      {/* ── Team Stats ── */}
      {loadingContext && (
        <div className="stats-loading">loading stats...</div>
      )}

      {!loadingContext && statsRows && statsRows.length > 0 && (
        <div className="stats-section">
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <div className="stats-label" style={{ marginBottom: 0 }}>
              RECENT FORM (L{homeStats?.gamesPlayed ?? 10})
            </div>
            <button
              type="button"
              className="context-reload-btn"
              onClick={onReloadContext}
              disabled={loadingContext}
              title="Refresh stats and injury data"
            >
              <RefreshCwIcon size={11} />
            </button>
          </div>
          <table className="stats-table">
            <thead>
              <tr>
                <th className="stats-th stats-th-stat" />
                <th className="stats-th stats-th-team">{game.away}</th>
                <th className="stats-th stats-th-team">{game.home}</th>
              </tr>
            </thead>
            <tbody>
              {statsRows.map(([label, awayVal, homeVal, lowerIsBetter]) => {
                const awayBetter = lowerIsBetter
                  ? awayVal < homeVal
                  : awayVal > homeVal;
                const homeBetter = lowerIsBetter
                  ? homeVal < awayVal
                  : homeVal > awayVal;
                return (
                  <tr key={label}>
                    <td className="stats-td stats-td-label" title={STAT_TOOLTIPS[label]}>{label}</td>
                    <td
                      className={`stats-td stats-td-val${awayBetter ? ' stats-td-better' : ''}`}
                    >
                      {fmt(awayVal)}
                    </td>
                    <td
                      className={`stats-td stats-td-val${homeBetter ? ' stats-td-better' : ''}`}
                    >
                      {fmt(homeVal)}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* ── Injuries ── */}
      {!loadingContext && hasInjuries && (
        <div className="injuries-section">
          <div className="stats-label">INJURY REPORT</div>
          <div className="injuries-grid">
            {[
              { abbr: game.away, players: awayOut },
              { abbr: game.home, players: homeOut },
            ].map(({ abbr, players }) => (
              <div key={abbr} className="injury-col">
                <div className="injury-col-header">{abbr}</div>
                {players.length === 0 ? (
                  <div className="injury-none">—</div>
                ) : (
                  players.map((p) => (
                    <div key={p.playerName} className="injury-row">
                      <span
                        className="injury-status"
                        style={{ color: statusColor(p.status) }}
                        title={STATUS_TOOLTIPS[statusTag(p.status)]}
                      >
                        {statusTag(p.status)}
                      </span>
                      <span className="injury-name">
                        {formatPlayerName(p.playerName)}
                      </span>
                    </div>
                  ))
                )}
              </div>
            ))}
          </div>
        </div>
      )}

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
