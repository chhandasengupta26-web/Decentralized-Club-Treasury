import { useState } from 'react';
import {
  RefreshCw,
  Users,
  FileText,
  History,
  Shield,
  Settings,
  Wallet,
  ArrowUpRight,
  ArrowDownLeft,
  Copy,
  Check,
  Plus,
} from 'lucide-react';
import { truncateAddress } from '../lib/stellar';
import SignersPanel from './SignersPanel';
import ProposalsPanel from './ProposalsPanel';
import TransactionsPanel from './TransactionsPanel';
import SetupMultiSigModal from './SetupMultiSigModal';
import CreateProposalModal from './CreateProposalModal';

const SIGNER_COLORS = [
  { bg: 'rgba(99, 102, 241, 0.15)', color: '#818cf8' },
  { bg: 'rgba(139, 92, 246, 0.15)', color: '#a78bfa' },
  { bg: 'rgba(6, 182, 212, 0.15)', color: '#22d3ee' },
  { bg: 'rgba(16, 185, 129, 0.15)', color: '#34d399' },
  { bg: 'rgba(245, 158, 11, 0.15)', color: '#fbbf24' },
  { bg: 'rgba(244, 63, 94, 0.15)', color: '#fb7185' },
];

export default function Dashboard({
  treasuryKeys,
  balance,
  account,
  signers,
  thresholds,
  payments,
  proposals,
  loading,
  onRefresh,
  onSetupMultiSig,
  onCreateProposal,
  onSignProposal,
  onRejectProposal,
  onExecuteProposal,
  addToast,
  contractId,
}) {
  const [activeTab, setActiveTab] = useState('proposals');
  const [showMultiSigModal, setShowMultiSigModal] = useState(false);
  const [showProposalModal, setShowProposalModal] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  const pendingCount = proposals.filter((p) => p.status === 'pending').length;
  const approvedCount = proposals.filter((p) => p.status === 'approved').length;

  const copyToClipboard = (text) => {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    addToast('Address copied to clipboard', 'info');
    setTimeout(() => setCopiedKey(false), 2000);
  };

  return (
    <div className="dashboard">
      {/* ── Treasury Summary ──────────────────── */}
      <div className="treasury-header animate-fadeIn">
        <div className="glass-card treasury-balance-card">
          <div className="balance-label">Treasury Balance</div>
          <div className="balance-amount gradient-text">
            {balance.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{' '}
            <span style={{ fontSize: '1.2rem', opacity: 0.7 }}>XLM</span>
          </div>
          <div className="balance-usd">
            ≈ ${(balance * 0.09).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })} USD
          </div>
        </div>

        <div className="glass-card treasury-account-card">
          <div className="account-info-row">
            <span className="account-info-label">Account Address</span>
            <span className="account-info-value">
              <span className="account-address">
                {truncateAddress(treasuryKeys?.publicKey, 10, 8)}
              </span>
              <button
                className="btn btn-icon"
                onClick={() => copyToClipboard(treasuryKeys?.publicKey)}
                title="Copy address"
                id="copy-address-btn"
                style={{ padding: 4 }}
              >
                {copiedKey ? <Check size={14} /> : <Copy size={14} />}
              </button>
            </span>
          </div>
          <div className="account-info-row">
            <span className="account-info-label">Signers</span>
            <span className="account-info-value">
              <Users size={14} />
              {signers.length}
            </span>
          </div>
          <div className="account-info-row">
            <span className="account-info-label">Med Threshold</span>
            <span className="account-info-value mono">
              {thresholds.med}
            </span>
          </div>
          <div className="account-info-row">
            <span className="account-info-label">Sequence</span>
            <span className="account-info-value mono" style={{ fontSize: '0.7rem' }}>
              {account?.sequence ? account.sequence.toString() : '—'}
            </span>
          </div>
          {contractId && (
            <div className="account-info-row">
              <span className="account-info-label">Contract</span>
              <span className="account-info-value mono" style={{ fontSize: '0.65rem' }}>
                {contractId.slice(0, 8)}...{contractId.slice(-6)}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* ── Stats Row ─────────────────────────── */}
      <div className="stats-row animate-fadeIn animate-delay-1">
        <div className="glass-card stat-card">
          <div className="stat-icon" style={{ background: 'rgba(99, 102, 241, 0.15)' }}>
            <Users size={22} color="var(--color-indigo-400)" />
          </div>
          <div>
            <div className="stat-value">{signers.length}</div>
            <div className="stat-label">Signers</div>
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-icon" style={{ background: 'rgba(245, 158, 11, 0.15)' }}>
            <FileText size={22} color="var(--color-amber-400)" />
          </div>
          <div>
            <div className="stat-value">{pendingCount}</div>
            <div className="stat-label">Pending</div>
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-icon" style={{ background: 'rgba(16, 185, 129, 0.15)' }}>
            <Check size={22} color="var(--color-emerald-400)" />
          </div>
          <div>
            <div className="stat-value">{approvedCount}</div>
            <div className="stat-label">Approved</div>
          </div>
        </div>

        <div className="glass-card stat-card">
          <div className="stat-icon" style={{ background: 'rgba(6, 182, 212, 0.15)' }}>
            <History size={22} color="var(--color-cyan-400)" />
          </div>
          <div>
            <div className="stat-value">{payments.length}</div>
            <div className="stat-label">Transactions</div>
          </div>
        </div>
      </div>

      {/* ── Threshold Display ─────────────────── */}
      <div className="animate-fadeIn animate-delay-2">
        <div className="section-header">
          <h2 className="section-title">
            <Shield size={18} />
            Security Thresholds
          </h2>
          <button
            className="btn btn-secondary"
            onClick={onRefresh}
            disabled={loading}
            id="refresh-btn"
          >
            <RefreshCw size={14} />
            Refresh
          </button>
        </div>
        <div className="threshold-display">
          <div className="threshold-item">
            <div className="threshold-label">Low Threshold</div>
            <div className="threshold-value" style={{ color: 'var(--color-emerald-400)' }}>
              {thresholds.low}
            </div>
          </div>
          <div className="threshold-item">
            <div className="threshold-label">Medium Threshold</div>
            <div className="threshold-value" style={{ color: 'var(--color-amber-400)' }}>
              {thresholds.med}
            </div>
          </div>
          <div className="threshold-item">
            <div className="threshold-label">High Threshold</div>
            <div className="threshold-value" style={{ color: 'var(--color-rose-400)' }}>
              {thresholds.high}
            </div>
          </div>
        </div>
      </div>

      {/* ── Tab Navigation ────────────────────── */}
      <div className="animate-fadeIn animate-delay-3">
        <div className="tab-nav">
          <button
            className={`tab-btn ${activeTab === 'proposals' ? 'active' : ''}`}
            onClick={() => setActiveTab('proposals')}
            id="tab-proposals"
          >
            <FileText size={14} />
            Proposals
            {pendingCount > 0 && <span className="tab-count">{pendingCount}</span>}
          </button>
          <button
            className={`tab-btn ${activeTab === 'signers' ? 'active' : ''}`}
            onClick={() => setActiveTab('signers')}
            id="tab-signers"
          >
            <Users size={14} />
            Signers
            <span className="tab-count">{signers.length}</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'transactions' ? 'active' : ''}`}
            onClick={() => setActiveTab('transactions')}
            id="tab-transactions"
          >
            <History size={14} />
            Transactions
          </button>
        </div>

        {/* Tab Actions */}
        <div className="section-header">
          <h2 className="section-title">
            {activeTab === 'proposals' && (
              <>
                <FileText size={18} />
                Spending Proposals
              </>
            )}
            {activeTab === 'signers' && (
              <>
                <Users size={18} />
                Account Signers
              </>
            )}
            {activeTab === 'transactions' && (
              <>
                <History size={18} />
                Transaction History
              </>
            )}
          </h2>
          <div style={{ display: 'flex', gap: 'var(--space-sm)' }}>
            {activeTab === 'proposals' && (
              <button
                className="btn btn-primary"
                onClick={() => setShowProposalModal(true)}
                id="create-proposal-btn"
              >
                <Plus size={14} />
                New Proposal
              </button>
            )}
            {activeTab === 'signers' && (
              <button
                className="btn btn-primary"
                onClick={() => setShowMultiSigModal(true)}
                id="setup-multisig-btn"
              >
                <Settings size={14} />
                Configure Multi-Sig
              </button>
            )}
          </div>
        </div>

        {/* Tab Content */}
        {activeTab === 'proposals' && (
          <ProposalsPanel
            proposals={proposals}
            signers={signers}
            thresholds={thresholds}
            treasuryPublicKey={treasuryKeys?.publicKey}
            onSign={onSignProposal}
            onReject={onRejectProposal}
            onExecute={onExecuteProposal}
            signerColors={SIGNER_COLORS}
          />
        )}
        {activeTab === 'signers' && (
          <SignersPanel
            signers={signers}
            signerColors={SIGNER_COLORS}
            treasuryPublicKey={treasuryKeys?.publicKey}
          />
        )}
        {activeTab === 'transactions' && (
          <TransactionsPanel
            payments={payments}
            treasuryPublicKey={treasuryKeys?.publicKey}
          />
        )}
      </div>

      {/* ── Modals ────────────────────────────── */}
      {showMultiSigModal && (
        <SetupMultiSigModal
          onClose={() => setShowMultiSigModal(false)}
          onSetup={onSetupMultiSig}
          loading={loading}
        />
      )}

      {showProposalModal && (
        <CreateProposalModal
          onClose={() => setShowProposalModal(false)}
          onCreate={onCreateProposal}
        />
      )}
    </div>
  );
}
