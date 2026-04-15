# Decentralized Club Treasury

A multi-signature treasury wallet for student organizations, powered by a **Soroban smart contract** on the **Stellar blockchain**. Proposals, votes, and fund disbursements are managed on-chain for full transparency and auditability.

## Features

- **On-Chain Governance** — Spending proposals are created, voted on, and executed via a Soroban smart contract
- **Multi-Signature Wallet** — Configure multiple signers with custom weights and thresholds
- **Spending Proposals** — Create, review, and approve proposals with on-chain signature tracking
- **Automated Execution** — Approved proposals trigger token transfers directly from the contract
- **Real Blockchain Integration** — Uses Stellar SDK with Horizon + Soroban RPC (Testnet)
- **Transaction History** — View all payments with on-chain explorer links
- **Security Thresholds** — Set Low/Medium/High thresholds for different operation types
- **Account Import** — Import existing treasury accounts using secret keys
- **Testnet Friendbot** — Automatically fund new accounts with 10,000 XLM for testing

## Smart Contract

The treasury is governed by a Soroban smart contract written in Rust. The contract handles the full proposal lifecycle:

| Function | Description |
|---|---|
| `initialize` | Set admin, threshold, token contract, and initial signers |
| `create_proposal` | Create a new spending proposal (stored on-chain) |
| `sign_proposal` | Add a vote/signature to a proposal |
| `reject_proposal` | Reject a pending proposal |
| `execute_proposal` | Execute an approved proposal (triggers XLM transfer) |
| `get_proposals` | Query all proposals from contract storage |
| `get_proposal` | Query a single proposal by ID |
| `add_signer` | Admin: add a new authorized signer |
| `remove_signer` | Admin: remove a signer |
| `set_threshold` | Admin: update the approval threshold |

### Proposal Lifecycle

```
Created (Pending) → Signed by voters → Approved (threshold met) → Executed (funds transferred)
                  ↘ Rejected
```

## Deployed Contract

| Detail | Value |
|---|---|
| **Network** | Stellar Testnet |
| **Contract ID** | `CAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA` |
| **Soroban RPC** | `https://soroban-testnet.stellar.org` |
| **Horizon API** | `https://horizon-testnet.stellar.org` |

> **Note:** Replace the placeholder Contract ID above with your actual deployed contract ID. See [Deploy to Testnet](#deploy-to-testnet) below for instructions.

## Tech Stack

- **Frontend:** React 19 + Vite
- **Smart Contract:** Rust + Soroban SDK 22
- **Blockchain:** Stellar SDK (`@stellar/stellar-sdk`) + Soroban RPC
- **Wallet API:** Freighter API (`@stellar/freighter-api`)
- **Icons:** Lucide React
- **Styling:** Vanilla CSS with custom design system

## Project Structure

```
Decentralized Club Treasury/
├── smartcontract/               # Soroban smart contract (Rust)
│   ├── Cargo.toml               # Rust dependencies
│   ├── README.md                # Contract-specific docs
│   └── src/
│       └── lib.rs               # Contract implementation + tests
├── src/
│   ├── App.jsx                  # Main app — wires contract calls
│   ├── main.jsx                 # React entry point
│   ├── lib/
│   │   ├── stellar.js           # Horizon SDK helpers (accounts, payments)
│   │   └── contractClient.js    # Soroban contract client (proposals)
│   ├── components/
│   │   ├── Header.jsx           # Navigation header
│   │   ├── Landing.jsx          # Landing / connect page
│   │   ├── Dashboard.jsx        # Main dashboard layout
│   │   ├── ProposalsPanel.jsx   # Proposal list + sign/execute actions
│   │   ├── SignersPanel.jsx     # Signer list with weights
│   │   ├── TransactionsPanel.jsx# Payment history
│   │   ├── SetupMultiSigModal.jsx # Multi-sig configuration modal
│   │   ├── CreateProposalModal.jsx# New proposal form
│   │   └── Toast.jsx            # Notification toasts
│   ├── App.css                  # Component styles
│   └── index.css                # Design system & global styles
├── index.html                   # HTML entry point
├── vite.config.js               # Vite configuration
└── package.json                 # npm dependencies
```

## Getting Started

### Frontend

```bash
# Install dependencies
npm install

# Start development server
npm run dev

# Build for production
npm run build
```

### Smart Contract

```bash
cd smartcontract

# Build the WASM binary
soroban contract build

# Run tests
cargo test
```

## Deploy to Testnet

### Prerequisites
- [Rust](https://rustup.rs/) (latest stable)
- [Soroban CLI](https://soroban.stellar.org/docs/getting-started/setup)

### Steps

```bash
# 1. Install Soroban CLI
cargo install --locked soroban-cli

# 2. Configure a deployer identity
soroban keys generate --global deployer --network testnet

# 3. Build the contract
cd smartcontract
soroban contract build

# 4. Deploy to Testnet
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/club_treasury_contract.wasm \
  --source deployer \
  --network testnet
# → Save the output CONTRACT_ID

# 5. Wrap native XLM to get the SAC address
soroban lab token wrap --asset native --network testnet --source deployer
# → Save the output TOKEN_ID

# 6. Initialize the contract
soroban contract invoke \
  --id <CONTRACT_ID> \
  --source deployer \
  --network testnet \
  -- \
  initialize \
  --admin <ADMIN_ADDRESS> \
  --threshold 2 \
  --token_id <TOKEN_ID> \
  --signers '["<SIGNER_1>", "<SIGNER_2>"]'

# 7. Update CONTRACT_ID in src/lib/contractClient.js
```

## Contract Interaction Flow

The frontend communicates with the smart contract through `src/lib/contractClient.js`:

```
┌──────────────────┐     Soroban RPC      ┌─────────────────────────┐
│   React Frontend │ ──────────────────→   │  ClubTreasuryContract   │
│                  │                       │  (Soroban / Stellar)    │
│  contractClient  │  create_proposal()    │                         │
│  .js             │  sign_proposal()      │  On-chain storage:      │
│                  │  reject_proposal()    │  - Proposals            │
│  stellar.js      │  execute_proposal()   │  - Signers              │
│                  │  get_proposals()      │  - Thresholds           │
└──────────────────┘                       └─────────────────────────┘
        │                                           │
        │       Horizon API                         │
        └──────────────────────────────────────────→│
           loadAccount(), fetchPayments()           │
           configureMultiSig()                      │
```

- **Write Operations** — Proposal CRUD goes through Soroban RPC (simulate → prepare → sign → submit → poll)
- **Read Operations** — Queries use simulated transactions (no signing required)
- **Fallback** — If the contract is not deployed, proposals are stored in local React state

## Multi-Signature Flow

1. **Create Treasury** — Generate a new Stellar testnet account
2. **Add Signers** — Configure co-signers with custom weights
3. **Set Thresholds** — Define approval requirements for operations
4. **Create Proposals** — Submit spending proposals on-chain via the contract
5. **Collect Signatures** — Each signer approves proposals on-chain
6. **Execute** — Once threshold is met, execute the proposal to disburse funds

## Network

This application runs on **Stellar Testnet** by default. All accounts are funded via Friendbot.

## License

MIT
