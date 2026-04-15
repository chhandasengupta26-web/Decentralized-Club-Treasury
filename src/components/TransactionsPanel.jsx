import { ArrowUpRight, ArrowDownLeft, History, ExternalLink } from 'lucide-react';
import { truncateAddress } from '../lib/stellar';

export default function TransactionsPanel({ payments, treasuryPublicKey }) {
  if (!payments.length) {
    return (
      <div className="empty-state glass-card">
        <div className="empty-state-icon">
          <History size={28} color="var(--color-text-muted)" />
        </div>
        <h3>No Transactions Yet</h3>
        <p>Transaction history will appear here once funds are sent or received.</p>
      </div>
    );
  }

  return (
    <div className="glass-card">
      <div className="tx-list">
        {payments.map((tx) => {
          const isCredit =
            tx.type === 'create_account'
              ? tx.account === treasuryPublicKey
              : tx.to === treasuryPublicKey;

          const amount =
            tx.type === 'create_account'
              ? tx.starting_balance
              : tx.amount || '0';

          const otherParty =
            tx.type === 'create_account'
              ? tx.funder || tx.source_account
              : isCredit
              ? tx.from
              : tx.to;

          const txType =
            tx.type === 'create_account'
              ? 'Account Created'
              : isCredit
              ? 'Received'
              : 'Sent';

          const timeStr = tx.created_at
            ? new Date(tx.created_at).toLocaleString()
            : '';

          return (
            <div key={tx.id} className="tx-item">
              <div
                className="tx-icon"
                style={{
                  background: isCredit
                    ? 'rgba(16, 185, 129, 0.15)'
                    : 'rgba(244, 63, 94, 0.15)',
                }}
              >
                {isCredit ? (
                  <ArrowDownLeft
                    size={18}
                    color="var(--color-emerald-400)"
                  />
                ) : (
                  <ArrowUpRight
                    size={18}
                    color="var(--color-rose-400)"
                  />
                )}
              </div>

              <div className="tx-details">
                <div className="tx-type">{txType}</div>
                <div className="tx-hash">
                  {otherParty ? truncateAddress(otherParty, 8, 6) : '—'}
                </div>
              </div>

              <div className={`tx-amount ${isCredit ? 'credit' : 'debit'}`}>
                {isCredit ? '+' : '-'}
                {parseFloat(amount).toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}{' '}
                XLM
              </div>

              <div className="tx-time">{timeStr}</div>

              {tx.transaction_hash && (
                <a
                  href={`https://stellar.expert/explorer/testnet/tx/${tx.transaction_hash}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="btn btn-icon"
                  style={{ padding: 4 }}
                  title="View on Explorer"
                >
                  <ExternalLink size={12} />
                </a>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
