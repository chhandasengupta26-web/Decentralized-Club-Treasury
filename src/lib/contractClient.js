/**
 * Soroban Contract Client — Club Treasury
 *
 * Provides helper functions to interact with the deployed
 * ClubTreasuryContract on Stellar Testnet via Soroban RPC.
 */
import * as StellarSdk from '@stellar/stellar-sdk';

// ─── Configuration ───────────────────────────────────────────────────────────

const SOROBAN_RPC_URL = 'https://soroban-testnet.stellar.org';
const NETWORK_PASSPHRASE = StellarSdk.Networks.TESTNET;

/**
 * Deployed contract ID on Stellar Testnet.
 * Replace this with your actual contract ID after deployment.
 * See smartcontract/README.md for deployment instructions.
 */
export const CONTRACT_ID = 'CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA';

const rpcServer = new StellarSdk.rpc.Server(SOROBAN_RPC_URL);

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Build, simulate, prepare, sign, and submit a Soroban contract invocation.
 */
async function invokeContract(sourceKeypair, method, ...args) {
  const account = await rpcServer.getAccount(sourceKeypair.publicKey());
  const contract = new StellarSdk.Contract(CONTRACT_ID);

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(60)
    .build();

  // Simulate the transaction to get the prepared version
  const simulated = await rpcServer.simulateTransaction(tx);

  if (StellarSdk.rpc.Api.isSimulationError(simulated)) {
    throw new Error(`Simulation failed: ${simulated.error}`);
  }

  const preparedTx = StellarSdk.rpc.assembleTransaction(tx, simulated).build();
  preparedTx.sign(sourceKeypair);

  const sendResponse = await rpcServer.sendTransaction(preparedTx);

  if (sendResponse.status === 'ERROR') {
    throw new Error(`Transaction submission failed: ${sendResponse.errorResult}`);
  }

  // Poll for completion
  let getResponse;
  let attempts = 0;
  const maxAttempts = 30;

  do {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    getResponse = await rpcServer.getTransaction(sendResponse.hash);
    attempts++;
  } while (getResponse.status === 'NOT_FOUND' && attempts < maxAttempts);

  if (getResponse.status === 'SUCCESS') {
    return getResponse;
  } else {
    throw new Error(`Transaction failed: ${getResponse.status}`);
  }
}

/**
 * Read-only contract call (no signing needed).
 */
async function queryContract(method, ...args) {
  // Use a dummy source for read-only calls
  const dummyKeypair = StellarSdk.Keypair.random();
  const contract = new StellarSdk.Contract(CONTRACT_ID);

  // For read-only, we just simulate
  const account = new StellarSdk.Account(dummyKeypair.publicKey(), '0');

  const tx = new StellarSdk.TransactionBuilder(account, {
    fee: '100',
    networkPassphrase: NETWORK_PASSPHRASE,
  })
    .addOperation(contract.call(method, ...args))
    .setTimeout(30)
    .build();

  const simulated = await rpcServer.simulateTransaction(tx);

  if (StellarSdk.rpc.Api.isSimulationError(simulated)) {
    throw new Error(`Query failed: ${simulated.error}`);
  }

  return simulated.result?.retval;
}

// ─── Public API ──────────────────────────────────────────────────────────────

/**
 * Create a new spending proposal on-chain
 *
 * @param {StellarSdk.Keypair} sourceKeypair - Keypair of the proposal creator
 * @param {string} title - Proposal title
 * @param {string} destination - Destination Stellar address
 * @param {string} amount - Amount in XLM (will be converted to stroops)
 * @param {string} memo - Optional memo text
 * @returns {Promise<number>} Proposal ID
 */
export async function createProposal(sourceKeypair, title, destination, amount, memo = '') {
  const amountStroops = BigInt(Math.round(parseFloat(amount) * 10_000_000));

  const response = await invokeContract(
    sourceKeypair,
    'create_proposal',
    StellarSdk.nativeToScVal(sourceKeypair.publicKey(), { type: 'address' }),
    StellarSdk.nativeToScVal(title, { type: 'string' }),
    StellarSdk.nativeToScVal(destination, { type: 'address' }),
    StellarSdk.nativeToScVal(amountStroops, { type: 'i128' }),
    StellarSdk.nativeToScVal(memo, { type: 'string' })
  );

  // Extract the proposal ID from return value
  if (response.returnValue) {
    return StellarSdk.scValToNative(response.returnValue);
  }
  return null;
}

/**
 * Sign (approve) a proposal on-chain
 *
 * @param {StellarSdk.Keypair} sourceKeypair - Keypair of the signer
 * @param {number} proposalId - ID of the proposal
 */
export async function signProposal(sourceKeypair, proposalId) {
  await invokeContract(
    sourceKeypair,
    'sign_proposal',
    StellarSdk.nativeToScVal(sourceKeypair.publicKey(), { type: 'address' }),
    StellarSdk.nativeToScVal(proposalId, { type: 'u32' })
  );
}

/**
 * Reject a proposal on-chain
 *
 * @param {StellarSdk.Keypair} sourceKeypair - Keypair of the caller
 * @param {number} proposalId - ID of the proposal
 */
export async function rejectProposal(sourceKeypair, proposalId) {
  await invokeContract(
    sourceKeypair,
    'reject_proposal',
    StellarSdk.nativeToScVal(sourceKeypair.publicKey(), { type: 'address' }),
    StellarSdk.nativeToScVal(proposalId, { type: 'u32' })
  );
}

/**
 * Execute an approved proposal (triggers token transfer)
 *
 * @param {StellarSdk.Keypair} sourceKeypair - Keypair of the caller
 * @param {number} proposalId - ID of the proposal
 */
export async function executeProposal(sourceKeypair, proposalId) {
  await invokeContract(
    sourceKeypair,
    'execute_proposal',
    StellarSdk.nativeToScVal(sourceKeypair.publicKey(), { type: 'address' }),
    StellarSdk.nativeToScVal(proposalId, { type: 'u32' })
  );
}

/**
 * Fetch all proposals from the contract (read-only)
 *
 * @returns {Promise<Array>} Array of proposal objects
 */
export async function fetchProposals() {
  try {
    const result = await queryContract('get_proposals');
    if (!result) return [];

    const proposals = StellarSdk.scValToNative(result);

    // Normalize proposal data for frontend consumption
    return proposals.map((p) => ({
      id: `P-${p.id}`,
      contractId: Number(p.id),
      title: p.title,
      destination: p.destination,
      amount: (Number(p.amount) / 10_000_000).toFixed(7),
      memo: p.memo || '',
      status: parseStatus(p.status),
      signatures: p.signatures || [],
      createdAt: new Date(Number(p.created_at) * 1000).toISOString(),
    }));
  } catch (err) {
    console.warn('Failed to fetch proposals from contract:', err.message);
    return [];
  }
}

/**
 * Fetch a single proposal from the contract (read-only)
 *
 * @param {number} proposalId - ID of the proposal
 * @returns {Promise<Object|null>} Proposal object or null
 */
export async function fetchProposal(proposalId) {
  try {
    const result = await queryContract(
      'get_proposal',
      StellarSdk.nativeToScVal(proposalId, { type: 'u32' })
    );
    if (!result) return null;

    const p = StellarSdk.scValToNative(result);
    return {
      id: `P-${p.id}`,
      contractId: Number(p.id),
      title: p.title,
      destination: p.destination,
      amount: (Number(p.amount) / 10_000_000).toFixed(7),
      memo: p.memo || '',
      status: parseStatus(p.status),
      signatures: p.signatures || [],
      createdAt: new Date(Number(p.created_at) * 1000).toISOString(),
    };
  } catch (err) {
    console.warn('Failed to fetch proposal:', err.message);
    return null;
  }
}

/**
 * Get the proposal count from the contract (read-only)
 */
export async function fetchProposalCount() {
  try {
    const result = await queryContract('get_proposal_count');
    if (!result) return 0;
    return StellarSdk.scValToNative(result);
  } catch {
    return 0;
  }
}

// ─── Internal ────────────────────────────────────────────────────────────────

/**
 * Map Soroban enum variant to frontend status string
 */
function parseStatus(status) {
  if (typeof status === 'string') return status.toLowerCase();
  // Soroban enums come back as objects like { "Pending": [] }
  const key = Object.keys(status)[0];
  return key ? key.toLowerCase() : 'pending';
}
