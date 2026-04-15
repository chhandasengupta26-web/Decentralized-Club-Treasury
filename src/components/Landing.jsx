import { useState } from 'react';
import {
  Shield,
  Users,
  Eye,
  Wallet,
  Plus,
  Download,
  Loader2,
} from 'lucide-react';
import { isValidSecretKey } from '../lib/stellar';

export default function Landing({ onCreateTreasury, onImportTreasury, loading }) {
  const [showImport, setShowImport] = useState(false);
  const [importKey, setImportKey] = useState('');

  const handleImport = () => {
    if (!isValidSecretKey(importKey.trim())) {
      alert('Invalid Stellar secret key. Must start with "S".');
      return;
    }
    onImportTreasury(importKey.trim());
  };

  return (
    <section className="landing-section">
      {/* Animated background orbs */}
      <div className="landing-orb landing-orb-1" />
      <div className="landing-orb landing-orb-2" />

      <div className="animate-fadeIn" style={{ position: 'relative', zIndex: 1 }}>
        <div className="landing-vault-icon">
          <Shield size={44} color="white" />
        </div>

        <h1 className="landing-title">
          <span className="gradient-text">Decentralized</span>
          <br />
          Club Treasury
        </h1>

        <p className="landing-description">
          A multi-signature wallet interface designed for student organizations
          to manage their funds transparently on the Stellar blockchain.
        </p>

        <div className="landing-features animate-slideUp animate-delay-2">
          <div className="landing-feature">
            <div
              className="landing-feature-icon"
              style={{ background: 'rgba(99, 102, 241, 0.15)' }}
            >
              <Users size={20} color="var(--color-indigo-400)" />
            </div>
            <h4>Multi-Signature</h4>
            <p>Require multiple approvals for every transaction</p>
          </div>

          <div className="landing-feature">
            <div
              className="landing-feature-icon"
              style={{ background: 'rgba(16, 185, 129, 0.15)' }}
            >
              <Eye size={20} color="var(--color-emerald-400)" />
            </div>
            <h4>Full Transparency</h4>
            <p>Every member can verify fund movements on-chain</p>
          </div>

          <div className="landing-feature">
            <div
              className="landing-feature-icon"
              style={{ background: 'rgba(139, 92, 246, 0.15)' }}
            >
              <Wallet size={20} color="var(--color-violet-400)" />
            </div>
            <h4>Stellar Powered</h4>
            <p>Fast, low-cost transactions on the Stellar network</p>
          </div>
        </div>

        {!showImport ? (
          <div
            className="animate-slideUp animate-delay-3"
            style={{ display: 'flex', gap: 'var(--space-md)', flexWrap: 'wrap', justifyContent: 'center' }}
          >
            <button
              className="btn btn-primary"
              onClick={onCreateTreasury}
              disabled={loading}
              id="create-treasury-btn"
              style={{ padding: '12px 32px', fontSize: '0.95rem' }}
            >
              {loading ? (
                <Loader2 size={18} className="spinner" />
              ) : (
                <Plus size={18} />
              )}
              Create New Treasury
            </button>

            <button
              className="btn btn-secondary"
              onClick={() => setShowImport(true)}
              disabled={loading}
              id="import-btn"
              style={{ padding: '12px 32px', fontSize: '0.95rem' }}
            >
              <Download size={18} />
              Import Existing
            </button>
          </div>
        ) : (
          <div
            className="animate-fadeIn"
            style={{
              display: 'flex',
              gap: 'var(--space-md)',
              maxWidth: '500px',
              width: '100%',
              flexDirection: 'column',
            }}
          >
            <input
              type="password"
              className="input-field mono"
              placeholder="Enter treasury secret key (S...)"
              value={importKey}
              onChange={(e) => setImportKey(e.target.value)}
              id="import-key-input"
            />
            <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
              <button
                className="btn btn-primary"
                onClick={handleImport}
                disabled={loading || !importKey.trim()}
                id="confirm-import-btn"
                style={{ flex: 1 }}
              >
                {loading ? <Loader2 size={16} className="spinner" /> : <Download size={16} />}
                Import Treasury
              </button>
              <button
                className="btn btn-secondary"
                onClick={() => {
                  setShowImport(false);
                  setImportKey('');
                }}
                id="cancel-import-btn"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
