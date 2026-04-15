import { useState } from 'react';
import { X, Send, FileText } from 'lucide-react';
import { isValidPublicKey } from '../lib/stellar';

export default function CreateProposalModal({ onClose, onCreate }) {
  const [title, setTitle] = useState('');
  const [destination, setDestination] = useState('');
  const [amount, setAmount] = useState('');
  const [memo, setMemo] = useState('');

  const handleSubmit = () => {
    if (!title.trim()) {
      alert('Please enter a proposal title.');
      return;
    }
    if (!isValidPublicKey(destination.trim())) {
      alert('Invalid destination address.');
      return;
    }
    if (!amount || parseFloat(amount) <= 0) {
      alert('Enter a valid amount.');
      return;
    }

    onCreate({
      title: title.trim(),
      destination: destination.trim(),
      amount: parseFloat(amount).toFixed(7),
      memo: memo.trim(),
    });
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div
        className="modal-content"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <h3 className="modal-title">
            <FileText size={18} style={{ marginRight: 8 }} />
            New Spending Proposal
          </h3>
          <button className="btn btn-icon" onClick={onClose} id="close-proposal-modal">
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          <div className="form-group" style={{ marginBottom: 'var(--space-md)' }}>
            <label className="label">Proposal Title</label>
            <input
              className="input-field"
              placeholder="e.g., Club event catering expenses"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              id="proposal-title-input"
            />
          </div>

          <div className="form-group" style={{ marginBottom: 'var(--space-md)' }}>
            <label className="label">Destination Address</label>
            <input
              className="input-field mono"
              placeholder="G... (Stellar public key)"
              value={destination}
              onChange={(e) => setDestination(e.target.value)}
              id="proposal-destination-input"
            />
          </div>

          <div className="form-grid" style={{ marginBottom: 'var(--space-md)' }}>
            <div className="form-group">
              <label className="label">Amount (XLM)</label>
              <input
                className="input-field mono"
                type="number"
                placeholder="0.00"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                min="0"
                step="0.01"
                id="proposal-amount-input"
              />
            </div>
            <div className="form-group">
              <label className="label">Memo (Optional)</label>
              <input
                className="input-field"
                placeholder="Short description"
                value={memo}
                onChange={(e) => setMemo(e.target.value)}
                maxLength={28}
                id="proposal-memo-input"
              />
            </div>
          </div>

          {/* Preview */}
          {title && amount && destination && (
            <div
              style={{
                background: 'var(--color-bg-glass)',
                border: '1px solid var(--color-border)',
                borderRadius: 'var(--radius-md)',
                padding: 'var(--space-md)',
                fontSize: '0.8rem',
              }}
            >
              <div
                style={{
                  color: 'var(--color-text-muted)',
                  fontSize: '0.7rem',
                  marginBottom: 'var(--space-sm)',
                  textTransform: 'uppercase',
                  letterSpacing: '0.05em',
                }}
              >
                Preview
              </div>
              <div style={{ color: 'var(--color-text-primary)', fontWeight: 600 }}>
                {title}
              </div>
              <div
                style={{
                  fontFamily: 'var(--font-mono)',
                  color: 'var(--color-violet-400)',
                  margin: '4px 0',
                }}
              >
                {parseFloat(amount || 0).toFixed(2)} XLM → {destination.slice(0, 12)}...
              </div>
              {memo && (
                <div style={{ color: 'var(--color-text-muted)', fontStyle: 'italic' }}>
                  "{memo}"
                </div>
              )}
            </div>
          )}
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={!title || !destination || !amount}
            id="submit-proposal-btn"
          >
            <Send size={14} />
            Submit Proposal
          </button>
        </div>
      </div>
    </div>
  );
}
