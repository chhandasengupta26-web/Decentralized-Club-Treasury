import { useState } from 'react';
import { X, Plus, Trash2, Settings, Loader2, AlertCircle } from 'lucide-react';
import { isValidPublicKey, generateKeypair } from '../lib/stellar';

export default function SetupMultiSigModal({ onClose, onSetup, loading }) {
  const [signerEntries, setSignerEntries] = useState([
    { publicKey: '', weight: 1, label: '' },
  ]);
  const [masterWeight, setMasterWeight] = useState(1);
  const [lowThreshold, setLowThreshold] = useState(1);
  const [medThreshold, setMedThreshold] = useState(2);
  const [highThreshold, setHighThreshold] = useState(3);

  const addSigner = () => {
    setSignerEntries((prev) => [
      ...prev,
      { publicKey: '', weight: 1, label: '' },
    ]);
  };

  const removeSigner = (index) => {
    setSignerEntries((prev) => prev.filter((_, i) => i !== index));
  };

  const updateSigner = (index, field, value) => {
    setSignerEntries((prev) =>
      prev.map((s, i) => (i === index ? { ...s, [field]: value } : s))
    );
  };

  const generateForSigner = (index) => {
    const kp = generateKeypair();
    updateSigner(index, 'publicKey', kp.publicKey);
    // Show secret key alert
    alert(
      `⚠️ SAVE THIS SECRET KEY for Signer ${index + 1}!\n\n` +
        `Public: ${kp.publicKey}\n\n` +
        `Secret: ${kp.secretKey}\n\n` +
        `This will NOT be shown again.`
    );
  };

  const handleSubmit = () => {
    const validSigners = signerEntries.filter((s) => s.publicKey.trim());

    for (const s of validSigners) {
      if (!isValidPublicKey(s.publicKey.trim())) {
        alert(`Invalid public key: ${s.publicKey.slice(0, 20)}...`);
        return;
      }
    }

    if (validSigners.length === 0) {
      alert('Add at least one signer.');
      return;
    }

    onSetup(
      validSigners.map((s) => s.publicKey.trim()),
      validSigners.map((s) => parseInt(s.weight) || 1),
      {
        masterWeight: parseInt(masterWeight) || 1,
        low: parseInt(lowThreshold) || 1,
        med: parseInt(medThreshold) || 2,
        high: parseInt(highThreshold) || 3,
      }
    );
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
            <Settings size={18} style={{ marginRight: 8 }} />
            Configure Multi-Signature
          </h3>
          <button className="btn btn-icon" onClick={onClose} id="close-multisig-modal">
            <X size={16} />
          </button>
        </div>

        <div className="modal-body">
          {/* Warning */}
          <div
            style={{
              background: 'rgba(245, 158, 11, 0.1)',
              border: '1px solid rgba(245, 158, 11, 0.2)',
              borderRadius: 'var(--radius-md)',
              padding: 'var(--space-md)',
              marginBottom: 'var(--space-lg)',
              display: 'flex',
              gap: 'var(--space-sm)',
              fontSize: '0.8rem',
              color: 'var(--color-amber-400)',
            }}
          >
            <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              This operation modifies account authority. Ensure threshold
              values allow management of the account. Incorrect settings
              can permanently lock the account.
            </span>
          </div>

          {/* Signers */}
          <div style={{ marginBottom: 'var(--space-lg)' }}>
            <label className="label">Co-Signers</label>
            {signerEntries.map((entry, i) => (
              <div
                key={i}
                style={{
                  display: 'flex',
                  gap: 'var(--space-sm)',
                  marginBottom: 'var(--space-sm)',
                  alignItems: 'center',
                }}
              >
                <input
                  className="input-field mono"
                  placeholder={`Signer ${i + 1} public key (G...)`}
                  value={entry.publicKey}
                  onChange={(e) =>
                    updateSigner(i, 'publicKey', e.target.value)
                  }
                  style={{ flex: 1 }}
                />
                <input
                  className="input-field"
                  type="number"
                  placeholder="Wt"
                  value={entry.weight}
                  onChange={(e) =>
                    updateSigner(i, 'weight', e.target.value)
                  }
                  style={{ width: 60 }}
                  min="1"
                  max="255"
                />
                <button
                  className="btn btn-secondary"
                  onClick={() => generateForSigner(i)}
                  title="Generate keypair"
                  style={{ padding: '8px', fontSize: '0.7rem' }}
                >
                  Gen
                </button>
                {signerEntries.length > 1 && (
                  <button
                    className="btn btn-icon"
                    onClick={() => removeSigner(i)}
                    style={{ padding: 6 }}
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>
            ))}
            <button
              className="btn btn-secondary"
              onClick={addSigner}
              style={{ marginTop: 'var(--space-sm)' }}
              id="add-signer-btn"
            >
              <Plus size={14} />
              Add Signer
            </button>
          </div>

          {/* Thresholds */}
          <div>
            <label className="label">Thresholds & Master Weight</label>
            <div className="form-grid">
              <div className="form-group">
                <label className="label" style={{ fontSize: '0.7rem' }}>
                  Master Weight
                </label>
                <input
                  className="input-field"
                  type="number"
                  value={masterWeight}
                  onChange={(e) => setMasterWeight(e.target.value)}
                  min="0"
                  max="255"
                />
              </div>
              <div className="form-group">
                <label className="label" style={{ fontSize: '0.7rem' }}>
                  Low Threshold
                </label>
                <input
                  className="input-field"
                  type="number"
                  value={lowThreshold}
                  onChange={(e) => setLowThreshold(e.target.value)}
                  min="0"
                  max="255"
                />
              </div>
              <div className="form-group">
                <label className="label" style={{ fontSize: '0.7rem' }}>
                  Medium Threshold
                </label>
                <input
                  className="input-field"
                  type="number"
                  value={medThreshold}
                  onChange={(e) => setMedThreshold(e.target.value)}
                  min="0"
                  max="255"
                />
              </div>
              <div className="form-group">
                <label className="label" style={{ fontSize: '0.7rem' }}>
                  High Threshold
                </label>
                <input
                  className="input-field"
                  type="number"
                  value={highThreshold}
                  onChange={(e) => setHighThreshold(e.target.value)}
                  min="0"
                  max="255"
                />
              </div>
            </div>
          </div>
        </div>

        <div className="modal-footer">
          <button className="btn btn-secondary" onClick={onClose}>
            Cancel
          </button>
          <button
            className="btn btn-primary"
            onClick={handleSubmit}
            disabled={loading}
            id="confirm-multisig-btn"
          >
            {loading ? (
              <Loader2 size={14} className="spinner" />
            ) : (
              <Settings size={14} />
            )}
            Apply Configuration
          </button>
        </div>
      </div>
    </div>
  );
}
