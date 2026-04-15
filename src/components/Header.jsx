import { Shield, LogOut, RefreshCw } from 'lucide-react';
import { truncateAddress } from '../lib/stellar';

export default function Header({ connected, publicKey, onDisconnect }) {
  return (
    <header className="header">
      <div className="header-inner">
        <div className="header-brand">
          <div className="header-logo">
            <Shield size={22} color="white" />
          </div>
          <div>
            <div className="header-title gradient-text">Club Treasury</div>
            <div className="header-subtitle">Multi-Signature Stellar Wallet</div>
          </div>
        </div>

        <div className="header-actions">
          <div className="header-network">
            <span className="status-dot active" />
            Stellar Testnet
          </div>

          {connected && publicKey && (
            <>
              <div className="header-network" style={{ fontFamily: 'var(--font-mono)' }}>
                {truncateAddress(publicKey, 8, 6)}
              </div>
              <button
                className="btn btn-icon"
                onClick={onDisconnect}
                title="Disconnect Wallet"
                id="disconnect-btn"
              >
                <LogOut size={16} />
              </button>
            </>
          )}
        </div>
      </div>
    </header>
  );
}
