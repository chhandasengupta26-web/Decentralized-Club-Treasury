import {
  FileText,
  ArrowUpRight,
  Clock,
  User,
  Check,
  X,
  AlertCircle,
  Play,
} from 'lucide-react';
import { truncateAddress } from '../lib/stellar';

const STATUS_CONFIG = {
  pending: { badge: 'badge-amber', label: 'Pending', icon: Clock },
  approved: { badge: 'badge-emerald', label: 'Approved', icon: Check },
  rejected: { badge: 'badge-rose', label: 'Rejected', icon: X },
  executed: { badge: 'badge-cyan', label: 'Executed', icon: ArrowUpRight },
};

export default function ProposalsPanel({
  proposals,
  signers,
  thresholds,
  treasuryPublicKey,
  onSign,
  onReject,
  onExecute,
  signerColors,
}) {
  if (!proposals.length) {
    return (
      <div className="empty-state glass-card">
        <div className="empty-state-icon">
          <FileText size={28} color="var(--color-text-muted)" />
        </div>
        <h3>No Proposals Yet</h3>
        <p>Create a spending proposal to request funds from the treasury.</p>
      </div>
    );
  }

  const requiredWeight = thresholds.med || 2;

  return (
    <div className="proposals-list">
      {proposals.map((proposal) => {
        const config = STATUS_CONFIG[proposal.status] || STATUS_CONFIG.pending;
        const StatusIcon = config.icon;

        // For contract-based proposals, signatures are addresses
        // For local proposals, signatures are public keys
        const currentWeight = proposal.signatures.reduce((sum, sk) => {
          const signer = signers.find((s) => s.key === sk);
          return sum + (signer ? signer.weight : 1);
        }, 0);

        const progressPercent = Math.min(
          (currentWeight / requiredWeight) * 100,
          100
        );

        const isOnChain = !!proposal.contractId;

        return (
          <div key={proposal.id} className="glass-card proposal-card">
            <div className="proposal-header">
              <div
                className="proposal-type-icon"
                style={{ background: 'rgba(139, 92, 246, 0.15)' }}
              >
                <ArrowUpRight size={20} color="var(--color-violet-400)" />
              </div>
              <div className="proposal-info">
                <div className="proposal-title">
                  {proposal.title}
                  {isOnChain && (
                    <span
                      className="badge badge-indigo"
                      style={{ marginLeft: 8, fontSize: '0.6rem' }}
                      title="This proposal is stored on-chain"
                    >
                      On-Chain
                    </span>
                  )}
                </div>
                <div className="proposal-amount">{proposal.amount} XLM</div>
              </div>
              <span className={`badge ${config.badge}`}>
                <StatusIcon size={10} />
                {config.label}
              </span>
            </div>

            <div className="proposal-meta">
              <span className="proposal-meta-item">
                <User size={12} />
                To: {truncateAddress(proposal.destination, 8, 6)}
              </span>
              <span className="proposal-meta-item">
                <Clock size={12} />
                {new Date(proposal.createdAt).toLocaleDateString()}
              </span>
              {proposal.memo && (
                <span className="proposal-meta-item">
                  <FileText size={12} />
                  {proposal.memo}
                </span>
              )}
              {isOnChain && (
                <span className="proposal-meta-item" style={{ color: 'var(--color-indigo-400)' }}>
                  ID: #{proposal.contractId}
                </span>
              )}
            </div>

            <div className="proposal-progress">
              <div className="progress-header">
                <span>
                  Signatures: {proposal.signatures.length}{' '}
                  {!isOnChain && `(${currentWeight} / ${requiredWeight} weight)`}
                </span>
                <span>{Math.round(progressPercent)}%</span>
              </div>
              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
            </div>

            {/* Signer avatars */}
            <div className="proposal-signers">
              {signers.map((signer, i) => {
                const color = signerColors[i % signerColors.length];
                const hasSigned = proposal.signatures.includes(signer.key);
                const isMaster = signer.key === treasuryPublicKey;
                return (
                  <div
                    key={signer.key}
                    className={`proposal-signer-avatar ${hasSigned ? 'signed' : ''}`}
                    style={{
                      background: hasSigned ? color.bg : 'var(--color-bg-glass)',
                      color: hasSigned ? color.color : 'var(--color-text-muted)',
                    }}
                    title={`${isMaster ? 'Master' : `Signer ${i}`}: ${
                      hasSigned ? 'Signed ✓' : 'Awaiting'
                    }`}
                  >
                    {isMaster ? 'M' : `S${i}`}
                  </div>
                );
              })}
            </div>

            {/* Actions for Pending proposals */}
            {proposal.status === 'pending' && (
              <div className="proposal-actions">
                {signers.map((signer) => {
                  if (proposal.signatures.includes(signer.key)) return null;
                  return (
                    <button
                      key={signer.key}
                      className="btn btn-success"
                      onClick={() => onSign(proposal.id, signer.key)}
                      id={`sign-${proposal.id}-${signer.key.slice(0, 6)}`}
                      style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                    >
                      <Check size={12} />
                      Sign as {truncateAddress(signer.key, 4, 4)}
                    </button>
                  );
                })}
                <button
                  className="btn btn-danger"
                  onClick={() => onReject(proposal.id)}
                  id={`reject-${proposal.id}`}
                  style={{ fontSize: '0.75rem', padding: '6px 12px' }}
                >
                  <X size={12} />
                  Reject
                </button>
              </div>
            )}

            {/* Execute button for Approved proposals */}
            {proposal.status === 'approved' && onExecute && (
              <div className="proposal-actions">
                <button
                  className="btn btn-primary"
                  onClick={() => onExecute(proposal.id)}
                  id={`execute-${proposal.id}`}
                  style={{ fontSize: '0.75rem', padding: '8px 16px' }}
                >
                  <Play size={12} />
                  Execute Proposal
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
