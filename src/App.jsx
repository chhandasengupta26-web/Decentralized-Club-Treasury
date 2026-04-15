import { useState, useEffect, useCallback } from 'react';
import './App.css';
import Header from './components/Header';
import Landing from './components/Landing';
import Dashboard from './components/Dashboard';
import Toast from './components/Toast';
import {
  generateKeypair,
  fundAccount,
  loadAccount,
  getXLMBalance,
  getSigners,
  getThresholds,
  fetchPayments,
  configureMultiSig,
  publicKeyFromSecret,
} from './lib/stellar';
import {
  createProposal as contractCreateProposal,
  signProposal as contractSignProposal,
  rejectProposal as contractRejectProposal,
  executeProposal as contractExecuteProposal,
  fetchProposals as contractFetchProposals,
  CONTRACT_ID,
} from './lib/contractClient';
import * as StellarSdk from '@stellar/stellar-sdk';

export default function App() {
  // Treasury state
  const [treasuryKeys, setTreasuryKeys] = useState(null);
  const [account, setAccount] = useState(null);
  const [balance, setBalance] = useState(0);
  const [signers, setSigners] = useState([]);
  const [thresholds, setThresholds] = useState({ low: 0, med: 0, high: 0 });
  const [payments, setPayments] = useState([]);

  // Proposal system (contract-backed + local fallback)
  const [proposals, setProposals] = useState([]);
  const [useContractProposals, setUseContractProposals] = useState(false);

  // UI state
  const [loading, setLoading] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [connected, setConnected] = useState(false);

  const addToast = useCallback((message, type = 'info') => {
    const id = Date.now();
    setToasts((prev) => [...prev, { id, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 4000);
  }, []);

  /**
   * Refresh on-chain proposals from the deployed contract.
   * Falls back to local state if the contract is not yet deployed.
   */
  const refreshProposals = useCallback(async () => {
    try {
      const onChainProposals = await contractFetchProposals();
      if (onChainProposals.length > 0 || useContractProposals) {
        setProposals(onChainProposals);
        setUseContractProposals(true);
      }
    } catch (err) {
      console.warn('Contract proposals unavailable, using local state:', err.message);
    }
  }, [useContractProposals]);

  const refreshAccount = useCallback(async (publicKey) => {
    try {
      const acc = await loadAccount(publicKey);
      setAccount(acc);
      setBalance(getXLMBalance(acc));
      setSigners(getSigners(acc));
      setThresholds(getThresholds(acc));
      const pays = await fetchPayments(publicKey, 25);
      setPayments(pays);
    } catch (err) {
      console.error('Failed to refresh account:', err);
    }
  }, []);

  // Auto-refresh every 30s
  useEffect(() => {
    if (!treasuryKeys) return;
    const interval = setInterval(() => {
      refreshAccount(treasuryKeys.publicKey);
      refreshProposals();
    }, 30000);
    return () => clearInterval(interval);
  }, [treasuryKeys, refreshAccount, refreshProposals]);

  /**
   * Create & fund a new treasury account
   */
  const handleCreateTreasury = async () => {
    setLoading(true);
    try {
      const keys = generateKeypair();
      addToast('Creating treasury account...', 'info');

      await fundAccount(keys.publicKey);
      addToast('Account funded with 10,000 XLM (testnet)', 'success');

      setTreasuryKeys(keys);
      await refreshAccount(keys.publicKey);
      await refreshProposals();
      setConnected(true);
      addToast('Treasury wallet created successfully!', 'success');
    } catch (err) {
      addToast(`Error: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Import an existing treasury account
   */
  const handleImportTreasury = async (secretKey) => {
    setLoading(true);
    try {
      const publicKey = publicKeyFromSecret(secretKey);
      setTreasuryKeys({ publicKey, secretKey });
      await refreshAccount(publicKey);
      await refreshProposals();
      setConnected(true);
      addToast('Treasury account imported successfully!', 'success');
    } catch (err) {
      addToast(`Error: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Setup multi-sig on the treasury
   */
  const handleSetupMultiSig = async (signerKeys, weights, thresholdConfig) => {
    if (!treasuryKeys) return;
    setLoading(true);
    try {
      addToast('Configuring multi-signature...', 'info');
      await configureMultiSig(
        treasuryKeys.secretKey,
        signerKeys,
        weights,
        thresholdConfig
      );
      await refreshAccount(treasuryKeys.publicKey);
      addToast('Multi-signature configured successfully!', 'success');
    } catch (err) {
      addToast(`Multi-sig error: ${err.message}`, 'error');
    } finally {
      setLoading(false);
    }
  };

  /**
   * Create a spending proposal.
   * Attempts to submit on-chain via contract; falls back to local state.
   */
  const handleCreateProposal = async (proposal) => {
    if (treasuryKeys?.secretKey) {
      setLoading(true);
      try {
        addToast('Submitting proposal to contract...', 'info');
        const keypair = StellarSdk.Keypair.fromSecret(treasuryKeys.secretKey);
        const proposalId = await contractCreateProposal(
          keypair,
          proposal.title,
          proposal.destination,
          proposal.amount,
          proposal.memo || ''
        );
        addToast(`Proposal #${proposalId} created on-chain!`, 'success');
        setUseContractProposals(true);
        await refreshProposals();
      } catch (err) {
        console.warn('Contract call failed, creating local proposal:', err.message);
        addToast('Contract unavailable — proposal saved locally', 'info');
        createLocalProposal(proposal);
      } finally {
        setLoading(false);
      }
    } else {
      createLocalProposal(proposal);
    }
  };

  /**
   * Local-state proposal creation (fallback when contract is not deployed)
   */
  const createLocalProposal = (proposal) => {
    const newProposal = {
      id: `P-${Date.now()}`,
      ...proposal,
      status: 'pending',
      signatures: [],
      createdAt: new Date().toISOString(),
      txXDR: null,
    };
    setProposals((prev) => [newProposal, ...prev]);
    addToast('Proposal created! Awaiting signatures.', 'success');
  };

  /**
   * Sign a proposal.
   * Attempts on-chain signing; falls back to local.
   */
  const handleSignProposal = async (proposalId, signerKey) => {
    // Check if we have a contract-based proposal
    const proposal = proposals.find((p) => p.id === proposalId);
    if (proposal?.contractId && treasuryKeys?.secretKey) {
      setLoading(true);
      try {
        addToast('Signing proposal on-chain...', 'info');
        const keypair = StellarSdk.Keypair.fromSecret(treasuryKeys.secretKey);
        await contractSignProposal(keypair, proposal.contractId);
        addToast('Proposal signed on-chain!', 'success');
        await refreshProposals();
      } catch (err) {
        console.warn('Contract sign failed, signing locally:', err.message);
        addToast('Contract unavailable — signed locally', 'info');
        signLocalProposal(proposalId, signerKey);
      } finally {
        setLoading(false);
      }
    } else {
      signLocalProposal(proposalId, signerKey);
    }
  };

  /**
   * Local-state proposal signing (fallback)
   */
  const signLocalProposal = (proposalId, signerKey) => {
    setProposals((prev) =>
      prev.map((p) => {
        if (p.id !== proposalId) return p;
        if (p.signatures.includes(signerKey)) return p;
        const newSigs = [...p.signatures, signerKey];
        const requiredSigs = thresholds.med || 2;
        const totalWeight = newSigs.reduce((sum, sk) => {
          const signer = signers.find((s) => s.key === sk);
          return sum + (signer ? signer.weight : 1);
        }, 0);
        const newStatus = totalWeight >= requiredSigs ? 'approved' : 'pending';
        return { ...p, signatures: newSigs, status: newStatus };
      })
    );
    addToast('Proposal signed!', 'success');
  };

  /**
   * Reject a proposal
   */
  const handleRejectProposal = async (proposalId) => {
    const proposal = proposals.find((p) => p.id === proposalId);
    if (proposal?.contractId && treasuryKeys?.secretKey) {
      setLoading(true);
      try {
        addToast('Rejecting proposal on-chain...', 'info');
        const keypair = StellarSdk.Keypair.fromSecret(treasuryKeys.secretKey);
        await contractRejectProposal(keypair, proposal.contractId);
        addToast('Proposal rejected on-chain.', 'success');
        await refreshProposals();
      } catch (err) {
        console.warn('Contract reject failed, rejecting locally:', err.message);
        rejectLocalProposal(proposalId);
      } finally {
        setLoading(false);
      }
    } else {
      rejectLocalProposal(proposalId);
    }
  };

  const rejectLocalProposal = (proposalId) => {
    setProposals((prev) =>
      prev.map((p) =>
        p.id === proposalId ? { ...p, status: 'rejected' } : p
      )
    );
    addToast('Proposal rejected.', 'info');
  };

  /**
   * Execute an approved proposal on-chain
   */
  const handleExecuteProposal = async (proposalId) => {
    const proposal = proposals.find((p) => p.id === proposalId);
    if (!proposal) return;

    if (proposal.contractId && treasuryKeys?.secretKey) {
      setLoading(true);
      try {
        addToast('Executing proposal on-chain...', 'info');
        const keypair = StellarSdk.Keypair.fromSecret(treasuryKeys.secretKey);
        await contractExecuteProposal(keypair, proposal.contractId);
        addToast('Proposal executed! Funds transferred.', 'success');
        await refreshProposals();
        await refreshAccount(treasuryKeys.publicKey);
      } catch (err) {
        addToast(`Execution failed: ${err.message}`, 'error');
      } finally {
        setLoading(false);
      }
    } else {
      addToast('Contract not available. Deploy the contract to execute proposals.', 'error');
    }
  };

  /**
   * Disconnect wallet
   */
  const handleDisconnect = () => {
    setTreasuryKeys(null);
    setAccount(null);
    setBalance(0);
    setSigners([]);
    setThresholds({ low: 0, med: 0, high: 0 });
    setPayments([]);
    setProposals([]);
    setConnected(false);
    setUseContractProposals(false);
    addToast('Wallet disconnected.', 'info');
  };

  return (
    <div className="app">
      <Header
        connected={connected}
        publicKey={treasuryKeys?.publicKey}
        onDisconnect={handleDisconnect}
      />

      <main className="main-content">
        {!connected ? (
          <Landing
            onCreateTreasury={handleCreateTreasury}
            onImportTreasury={handleImportTreasury}
            loading={loading}
          />
        ) : (
          <Dashboard
            treasuryKeys={treasuryKeys}
            balance={balance}
            account={account}
            signers={signers}
            thresholds={thresholds}
            payments={payments}
            proposals={proposals}
            loading={loading}
            onRefresh={() => {
              refreshAccount(treasuryKeys.publicKey);
              refreshProposals();
            }}
            onSetupMultiSig={handleSetupMultiSig}
            onCreateProposal={handleCreateProposal}
            onSignProposal={handleSignProposal}
            onRejectProposal={handleRejectProposal}
            onExecuteProposal={handleExecuteProposal}
            addToast={addToast}
            contractId={CONTRACT_ID}
          />
        )}
      </main>

      <Toast toasts={toasts} />
    </div>
  );
}
