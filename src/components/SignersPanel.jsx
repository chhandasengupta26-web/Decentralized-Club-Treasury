import { Users } from 'lucide-react';
import { truncateAddress } from '../lib/stellar';

export default function SignersPanel({ signers, signerColors, treasuryPublicKey }) {
  if (!signers.length) {
    return (
      <div className="empty-state glass-card">
        <div className="empty-state-icon">
          <Users size={28} color="var(--color-text-muted)" />
        </div>
        <h3>No Additional Signers</h3>
        <p>Configure multi-signature to add cosigners to this treasury wallet.</p>
      </div>
    );
  }

  const maxWeight = Math.max(...signers.map((s) => s.weight), 1);

  return (
    <div className="signers-list">
      {signers.map((signer, i) => {
        const color = signerColors[i % signerColors.length];
        const isMaster = signer.key === treasuryPublicKey;
        const initials = isMaster ? 'M' : `S${i}`;

        return (
          <div key={signer.key} className="glass-card signer-card">
            <div
              className="signer-avatar"
              style={{ background: color.bg, color: color.color }}
            >
              {initials}
            </div>
            <div className="signer-details">
              <div className="signer-name">
                {isMaster ? 'Master Key' : `Signer ${i}`}
                {isMaster && (
                  <span className="badge badge-indigo" style={{ marginLeft: 8 }}>
                    Master
                  </span>
                )}
              </div>
              <div className="signer-key">{truncateAddress(signer.key, 12, 8)}</div>
            </div>
            <div className="signer-weight">
              <div className="weight-bar">
                <div
                  className="weight-fill"
                  style={{
                    width: `${(signer.weight / maxWeight) * 100}%`,
                    background: color.color,
                  }}
                />
              </div>
              <span
                className="mono"
                style={{ fontSize: '0.75rem', color: color.color, fontWeight: 600, minWidth: 16, textAlign: 'right' }}
              >
                {signer.weight}
              </span>
            </div>
          </div>
        );
      })}
    </div>
  );
}
