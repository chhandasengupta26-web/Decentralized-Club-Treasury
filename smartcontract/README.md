# Club Treasury — Soroban Smart Contract

A Soroban smart contract for decentralized treasury governance on the Stellar blockchain. It enables multi-signature approval of spending proposals with on-chain vote tracking and automated fund disbursement.

## Contract Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                  ClubTreasuryContract                        │
├─────────────────────────────────────────────────────────────┤
│  Storage (Instance)                                          │
│  ├── Admin          → Address (treasury administrator)       │
│  ├── Threshold      → u32 (required signatures)             │
│  ├── Signers        → Vec<Address> (authorized voters)       │
│  ├── TokenId        → Address (SAC for native XLM)           │
│  └── ProposalCount  → u32 (auto-incrementing counter)        │
│                                                              │
│  Storage (Persistent, per proposal)                          │
│  └── Proposal(id)   → Proposal struct                        │
├─────────────────────────────────────────────────────────────┤
│  Entry Points                                                │
│  ├── initialize(admin, threshold, token_id, signers)         │
│  ├── create_proposal(creator, title, dest, amount, memo)     │
│  ├── sign_proposal(signer, proposal_id)                      │
│  ├── reject_proposal(caller, proposal_id)                    │
│  ├── execute_proposal(caller, proposal_id)                   │
│  ├── get_proposal(proposal_id) → Proposal                    │
│  ├── get_proposals() → Vec<Proposal>                         │
│  ├── get_proposal_count() → u32                              │
│  ├── get_signers() → Vec<Address>                            │
│  ├── get_threshold() → u32                                   │
│  ├── set_threshold(admin, new_threshold)                     │
│  ├── add_signer(admin, new_signer)                           │
│  └── remove_signer(admin, signer_to_remove)                  │
└─────────────────────────────────────────────────────────────┘
```

## Proposal Lifecycle

```
Created (Pending) → Signed by voters → Approved (threshold met) → Executed (funds transferred)
                  ↘ Rejected (by any signer)
```

1. **Create** — Any authorized signer creates a proposal with a title, destination address, amount, and optional memo.
2. **Sign** — Authorized signers approve the proposal. Once the number of signatures meets the threshold, the proposal status changes to `Approved`.
3. **Execute** — Any signer can execute an approved proposal. Tokens are transferred from the contract to the destination via the Stellar Asset Contract.
4. **Reject** — Any signer can reject a pending proposal.

## Prerequisites

- [Rust](https://rustup.rs/) (latest stable)
- [Soroban CLI](https://soroban.stellar.org/docs/getting-started/setup)
  ```bash
  cargo install --locked soroban-cli
  ```
- [Stellar CLI](https://developers.stellar.org/docs/tools/developer-tools/cli) (optional, for deployment)

## Build

```bash
cd smartcontract

# Build the WASM binary
soroban contract build

# The output will be at:
# target/wasm32-unknown-unknown/release/club_treasury_contract.wasm
```

## Test

```bash
cargo test
```

## Deploy to Testnet

```bash
# 1. Configure Testnet identity
soroban keys generate --global deployer --network testnet

# 2. Deploy the contract
soroban contract deploy \
  --wasm target/wasm32-unknown-unknown/release/club_treasury_contract.wasm \
  --source deployer \
  --network testnet

# This outputs the CONTRACT_ID — save it!

# 3. Initialize the contract
soroban contract invoke \
  --id <CONTRACT_ID> \
  --source deployer \
  --network testnet \
  -- \
  initialize \
  --admin <ADMIN_ADDRESS> \
  --threshold 2 \
  --token_id <XLM_SAC_ADDRESS> \
  --signers '["<SIGNER_1>", "<SIGNER_2>"]'
```

> **Note:** The `token_id` should be the Stellar Asset Contract (SAC) address for native XLM on Testnet. You can wrap native XLM using:
> ```bash
> soroban lab token wrap --asset native --network testnet --source deployer
> ```

## Contract Invocation Examples

```bash
# Create a proposal
soroban contract invoke --id <CONTRACT_ID> --source deployer --network testnet \
  -- create_proposal \
  --creator <CREATOR_ADDRESS> \
  --title "Club event catering" \
  --destination <DEST_ADDRESS> \
  --amount 10000000 \
  --memo "Spring party"

# Sign a proposal
soroban contract invoke --id <CONTRACT_ID> --source signer1 --network testnet \
  -- sign_proposal \
  --signer <SIGNER_ADDRESS> \
  --proposal_id 1

# Execute an approved proposal
soroban contract invoke --id <CONTRACT_ID> --source deployer --network testnet \
  -- execute_proposal \
  --caller <CALLER_ADDRESS> \
  --proposal_id 1

# Query all proposals
soroban contract invoke --id <CONTRACT_ID> --network testnet \
  -- get_proposals
```

## File Structure

```
smartcontract/
├── Cargo.toml          # Rust dependencies and build config
├── README.md           # This file
└── src/
    └── lib.rs          # Contract implementation + tests
```
