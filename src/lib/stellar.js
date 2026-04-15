/**
 * Stellar SDK — Treasury Wallet Helpers
 * Multi-signature account management on Stellar Testnet
 */
import * as StellarSdk from '@stellar/stellar-sdk';

const HORIZON_URL = 'https://horizon-testnet.stellar.org';
const NETWORK_PASSPHRASE = StellarSdk.Networks.TESTNET;
const FRIENDBOT_URL = 'https://friendbot.stellar.org';

const server = new StellarSdk.Horizon.Server(HORIZON_URL);

export { server, NETWORK_PASSPHRASE, HORIZON_URL };

/**
 * Generate a new Stellar keypair
 */
export function generateKeypair() {
  const pair = StellarSdk.Keypair.random();
  return {
    publicKey: pair.publicKey(),
    secretKey: pair.secret(),
  };
}

/**
 * Fund account via Friendbot (testnet)
 */
export async function fundAccount(publicKey) {
  const response = await fetch(`${FRIENDBOT_URL}?addr=${publicKey}`);
  if (!response.ok) {
    const err = await response.json().catch(() => ({}));
    throw new Error(err.detail || 'Failed to fund account via Friendbot');
  }
  return response.json();
}

/**
 * Load Stellar account details
 */
export async function loadAccount(publicKey) {
  try {
    const account = await server.loadAccount(publicKey);
    return account;
  } catch (err) {
    if (err.response && err.response.status === 404) {
      throw new Error('Account not found. Please fund the account first.');
    }
    throw err;
  }
}

/**
 * Get account balance (XLM)
 */
export function getXLMBalance(account) {
  const native = account.balances.find((b) => b.asset_type === 'native');
  return native ? parseFloat(native.balance) : 0;
}

/**
 * Get account signers with their weights
 */
export function getSigners(account) {
  return account.signers.map((s) => ({
    key: s.key,
    weight: s.weight,
    type: s.type,
  }));
}

/**
 * Get account thresholds 
 */
export function getThresholds(account) {
  return {
    low: account.thresholds.low_threshold,
    med: account.thresholds.med_threshold,
    high: account.thresholds.high_threshold,
  };
}

/**
 * Configure multi-sig: add signers and set thresholds
 */
export async function configureMultiSig(
  treasurySecret,
  signerPublicKeys,
  signerWeights,
  thresholds
) {
  const treasuryKeypair = StellarSdk.Keypair.fromSecret(treasurySecret);
  const account = await server.loadAccount(treasuryKeypair.publicKey());
  const fee = await server.fetchBaseFee();

  let builder = new StellarSdk.TransactionBuilder(account, {
    fee: String(fee),
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  // Add each signer
  for (let i = 0; i < signerPublicKeys.length; i++) {
    builder = builder.addOperation(
      StellarSdk.Operation.setOptions({
        signer: {
          ed25519PublicKey: signerPublicKeys[i],
          weight: signerWeights[i] || 1,
        },
      })
    );
  }

  // Set thresholds and master weight
  builder = builder.addOperation(
    StellarSdk.Operation.setOptions({
      masterWeight: thresholds.masterWeight ?? 1,
      lowThreshold: thresholds.low ?? 1,
      medThreshold: thresholds.med ?? 2,
      highThreshold: thresholds.high ?? 3,
    })
  );

  const tx = builder.setTimeout(180).build();
  tx.sign(treasuryKeypair);

  const result = await server.submitTransaction(tx);
  return result;
}

/**
 * Build a payment transaction from treasury (returns XDR for multi-sig signing)
 */
export async function buildPaymentTx(
  treasuryPublicKey,
  destinationPublicKey,
  amount,
  memo = ''
) {
  const account = await server.loadAccount(treasuryPublicKey);
  const fee = await server.fetchBaseFee();

  let builder = new StellarSdk.TransactionBuilder(account, {
    fee: String(fee),
    networkPassphrase: NETWORK_PASSPHRASE,
  });

  builder = builder.addOperation(
    StellarSdk.Operation.payment({
      destination: destinationPublicKey,
      asset: StellarSdk.Asset.native(),
      amount: String(amount),
    })
  );

  if (memo) {
    builder = builder.addMemo(StellarSdk.Memo.text(memo));
  }

  const tx = builder.setTimeout(600).build();
  return tx;
}

/**
 * Sign a transaction XDR with a keypair
 */
export function signTransaction(txXDR, secretKey) {
  const keypair = StellarSdk.Keypair.fromSecret(secretKey);
  const tx = StellarSdk.TransactionBuilder.fromXDR(txXDR, NETWORK_PASSPHRASE);
  tx.sign(keypair);
  return tx;
}

/**
 * Add a signature to a transaction
 */
export function addSignatureToTransaction(txXDR, secretKey) {
  const keypair = StellarSdk.Keypair.fromSecret(secretKey);
  const tx = StellarSdk.TransactionBuilder.fromXDR(txXDR, NETWORK_PASSPHRASE);
  tx.sign(keypair);
  return tx.toXDR();
}

/**
 * Submit a fully signed transaction
 */
export async function submitTransaction(txXDR) {
  const tx = StellarSdk.TransactionBuilder.fromXDR(txXDR, NETWORK_PASSPHRASE);
  const result = await server.submitTransaction(tx);
  return result;
}

/**
 * Fetch transaction history
 */
export async function fetchTransactions(publicKey, limit = 20) {
  try {
    const txs = await server
      .transactions()
      .forAccount(publicKey)
      .order('desc')
      .limit(limit)
      .call();
    return txs.records;
  } catch {
    return [];
  }
}

/**
 * Fetch payment operations for history
 */
export async function fetchPayments(publicKey, limit = 20) {
  try {
    const payments = await server
      .payments()
      .forAccount(publicKey)
      .order('desc')
      .limit(limit)
      .call();
    return payments.records;
  } catch {
    return [];
  }
}

/**
 * Validate Stellar public key
 */
export function isValidPublicKey(key) {
  try {
    StellarSdk.Keypair.fromPublicKey(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * Validate Stellar secret key
 */
export function isValidSecretKey(key) {
  try {
    StellarSdk.Keypair.fromSecret(key);
    return true;
  } catch {
    return false;
  }
}

/**
 * Get public key from secret key
 */
export function publicKeyFromSecret(secretKey) {
  return StellarSdk.Keypair.fromSecret(secretKey).publicKey();
}

/**
 * Truncate address for display
 */
export function truncateAddress(address, start = 6, end = 4) {
  if (!address) return '';
  return `${address.slice(0, start)}...${address.slice(-end)}`;
}
