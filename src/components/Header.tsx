interface HeaderProps {
  connected?: boolean;
  address?: string;
  connecting: boolean;
  onConnect: () => void;
}

function truncateAddr(addr: string): string {
  return addr.slice(0, 6) + '…' + addr.slice(-4);
}

export default function Header({
  connected,
  address,
  connecting,
  onConnect,
}: HeaderProps) {
  return (
    <header className="header">
      <div className="logo">
        <img src="icon.png" width="20" height="20" alt="PolyOx Logo" />
        <span className="logo-text">
          <span className="logo-green">Poly</span>Ox
        </span>
      </div>
      <div className="header-right">
        {connected && address ? (
          <span className="wallet-pill">
            <span className="wallet-dot" />
            <span className="wallet-addr">{truncateAddr(address)}</span>
          </span>
        ) : (
          <button
            className={`connect-btn${connecting ? ' loading' : ''}`}
            disabled={connecting}
            onClick={onConnect}
          >
            Connect Wallet
          </button>
        )}
      </div>
    </header>
  );
}
