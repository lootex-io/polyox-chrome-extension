function escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function StructuredAnalysis({ data }) {
  const homeWin = data.homeWinPct || 50;
  const awayWin = data.awayWinPct || 50;
  const confidence = data.confidence || 0;
  const homeName = data.homeTeam || '—';
  const awayName = data.awayTeam || '—';
  const favored = homeWin >= awayWin ? 'home' : 'away';

  return (
    <>
      {/* Win Probability */}
      <div className="r-section">
        <div className="r-label">WIN PROBABILITY</div>
        <div className="r-prob-row">
          <span className={`r-prob-team ${favored === 'away' ? 'r-favored' : ''}`}>
            {awayName}
          </span>
          <span className={`r-prob-pct ${favored === 'away' ? 'r-favored' : ''}`}>
            {awayWin}%
          </span>
        </div>
        <div className="r-bar-track">
          <div className="r-bar-fill" style={{ width: `${awayWin}%` }} />
        </div>
        <div className="r-prob-row" style={{ marginTop: 6 }}>
          <span className={`r-prob-team ${favored === 'home' ? 'r-favored' : ''}`}>
            {homeName}
          </span>
          <span className={`r-prob-pct ${favored === 'home' ? 'r-favored' : ''}`}>
            {homeWin}%
          </span>
        </div>
        <div className="r-bar-track">
          <div className="r-bar-fill" style={{ width: `${homeWin}%` }} />
        </div>
      </div>

      {/* Confidence */}
      <div className="r-section">
        <div className="r-label">CONFIDENCE</div>
        <div className="r-confidence">
          <div className="r-conf-bar-track">
            <div className="r-conf-bar-fill" style={{ width: `${confidence}%` }} />
          </div>
          <span className="r-conf-value">{confidence}%</span>
        </div>
      </div>

      {/* Key Factors */}
      {data.keyFactors?.length > 0 && (
        <div className="r-section">
          <div className="r-label">KEY FACTORS</div>
          <ul className="r-factors">
            {data.keyFactors.map((factor, i) => (
              <li key={i}>{factor}</li>
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
      {data.disclaimer && (
        <div className="r-disclaimer">{data.disclaimer}</div>
      )}
    </>
  );
}

function FallbackAnalysis({ data }) {
  let content = '';
  if (typeof data === 'string') {
    content = data;
  } else if (data?.analysis) {
    content = data.analysis;
  } else if (data?.result) {
    content = typeof data.result === 'string'
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

export default function AnalysisResult({ data }) {
  if (!data) return null;

  const isStructured = data && typeof data === 'object' && data.homeWinPct !== undefined;

  return (
    <div className="card result-card">
      <div className="result-header">
        <span className="result-label">ANALYSIS OUTPUT</span>
      </div>
      <div className="result-body">
        {isStructured ? (
          <StructuredAnalysis data={data} />
        ) : (
          <FallbackAnalysis data={data} />
        )}
      </div>
    </div>
  );
}
