import type { AnalysisData, Game } from '../App';

interface AnalysisResultProps {
  data: AnalysisData;
  game?: Game | null;
}

function escapeHtml(str: string): string {
  return str.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function StructuredAnalysis({
  data,
  game,
}: {
  data: AnalysisData;
  game?: Game | null;
}) {
  const homeWin = data.homeWinPct ?? 50;
  const awayWin = data.awayWinPct ?? 50;
  const confidence = data.confidence ?? 0;
  const homeName = data.homeTeam ?? '—';
  const awayName = data.awayTeam ?? '—';
  const favored = homeWin >= awayWin ? 'home' : 'away';
  const winnerName = favored === 'home' ? homeName : awayName;
  const winnerCode = favored === 'home' ? game?.home : game?.away;
  const winnerProb = favored === 'home' ? homeWin : awayWin;

  return (
    <>
      {/* Explicit Prediction Card */}
      <div className="r-prediction-card">
        <div className="r-pred-header">PREDICTED OUTCOME</div>
        <div className="r-pred-winner">{winnerCode || winnerName}</div>
        {winnerCode && <div className="r-pred-winner-sub">{winnerName}</div>}
        <div className="r-pred-stats">
          <div className="r-pred-stat">
            <span className="r-pred-label">Win Probability</span>
            <span className="r-pred-value">{winnerProb}%</span>
          </div>
          <div className="r-pred-stat">
            <span className="r-pred-label">Confidence</span>
            <span className="r-pred-value">{confidence}%</span>
          </div>
        </div>
      </div>

      {/* Probability Breakdown */}
      <div className="r-section">
        <div className="r-label">BREAKDOWN</div>
        <div className="r-prob-row">
          <span
            className={`r-prob-team ${favored === 'away' ? 'r-favored' : ''}`}
          >
            {awayName}
          </span>
          <span
            className={`r-prob-pct ${favored === 'away' ? 'r-favored' : ''}`}
          >
            {awayWin}%
          </span>
        </div>
        <div className="r-bar-track">
          <div
            className={`r-bar-fill ${favored === 'away' ? 'r-favored' : ''}`}
            style={{ width: `${awayWin}%` }}
          />
        </div>
        <div className="r-prob-row" style={{ marginTop: 10 }}>
          <span
            className={`r-prob-team ${favored === 'home' ? 'r-favored' : ''}`}
          >
            {homeName}
          </span>
          <span
            className={`r-prob-pct ${favored === 'home' ? 'r-favored' : ''}`}
          >
            {homeWin}%
          </span>
        </div>
        <div className="r-bar-track">
          <div
            className={`r-bar-fill ${favored === 'home' ? 'r-favored' : ''}`}
            style={{ width: `${homeWin}%` }}
          />
        </div>
      </div>

      {/* Key Factors */}
      {data.keyFactors && data.keyFactors.length > 0 && (
        <div className="r-section">
          <div className="r-label">KEY FACTORS</div>
          <ul className="r-factors">
            {data.keyFactors.map((factor) => (
              <li key={factor.substring(0, 30)}>{factor}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Analysis */}
      {data.analysis && (
        <div className="r-section">
          <div className="r-label">ANALYSIS</div>
          <p className="r-analysis">{data.analysis}</p>
        </div>
      )}

      {/* Meta */}
      <div className="r-meta">
        {data.model && <span>model: {data.model}</span>}
        {data.generatedAt && (
          <span>
            {new Date(data.generatedAt).toLocaleTimeString('en-US', {
              hour: '2-digit',
              minute: '2-digit',
            })}
          </span>
        )}
      </div>

      {/* Disclaimer */}
      {data.disclaimer && <div className="r-disclaimer">{data.disclaimer}</div>}
    </>
  );
}

function FallbackAnalysis({ data }: { data: AnalysisData }) {
  let content = '';
  if (typeof data === 'string') {
    content = data;
  } else if (data?.analysis) {
    content = data.analysis;
  } else if (data?.result) {
    content =
      typeof data.result === 'string'
        ? data.result
        : JSON.stringify(data.result, null, 2);
  } else {
    content = JSON.stringify(data, null, 2);
  }

  const html = escapeHtml(content)
    .replace(/### (.+)/g, '<h3>$1</h3>')
    .replace(/## (.+)/g, '<h2>$1</h2>')
    .replace(/# (.+)/g, '<h1>$1</h1>')
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\n/g, '<br>');

  return <div dangerouslySetInnerHTML={{ __html: html }} />;
}

export default function AnalysisResult({ data, game }: AnalysisResultProps) {
  if (!data) return null;

  const isStructured =
    data && typeof data === 'object' && data.homeWinPct !== undefined;

  return (
    <div className="card result-card">
      <div className="result-header">
        <span className="card-label">ANALYSIS RESULT</span>
      </div>
      <div className="result-body">
        {isStructured ? (
          <StructuredAnalysis data={data} game={game} />
        ) : (
          <FallbackAnalysis data={data} />
        )}
      </div>
    </div>
  );
}
