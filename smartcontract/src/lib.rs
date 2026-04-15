#![no_std]

use soroban_sdk::{
    contract, contractimpl, contracttype, symbol_short, token, Address, Env, Map, String, Vec,
};

// ─── Data Types ──────────────────────────────────────────────────────────────

/// Status of a spending proposal
#[derive(Clone, Debug, PartialEq)]
#[contracttype]
pub enum ProposalStatus {
    Pending,
    Approved,
    Rejected,
    Executed,
}

/// A spending proposal submitted to the treasury
#[derive(Clone, Debug)]
#[contracttype]
pub struct Proposal {
    pub id: u32,
    pub creator: Address,
    pub title: String,
    pub destination: Address,
    pub amount: i128,
    pub memo: String,
    pub status: ProposalStatus,
    pub signatures: Vec<Address>,
    pub created_at: u64,
}

/// Storage keys for the contract
#[derive(Clone)]
#[contracttype]
pub enum DataKey {
    Admin,
    Threshold,
    ProposalCount,
    Proposal(u32),
    Signers,
    TokenId,
}

// ─── Contract ────────────────────────────────────────────────────────────────

#[contract]
pub struct ClubTreasuryContract;

#[contractimpl]
impl ClubTreasuryContract {
    /// Initialize the treasury contract
    ///
    /// # Arguments
    /// * `admin` - The address that administers the treasury
    /// * `threshold` - Minimum number of signatures required to approve a proposal
    /// * `token_id` - The token contract address (use Stellar Asset Contract for native XLM)
    /// * `signers` - Initial list of authorized signer addresses
    pub fn initialize(
        env: Env,
        admin: Address,
        threshold: u32,
        token_id: Address,
        signers: Vec<Address>,
    ) {
        // Ensure contract is not already initialized
        if env.storage().instance().has(&DataKey::Admin) {
            panic!("Contract already initialized");
        }

        admin.require_auth();

        env.storage().instance().set(&DataKey::Admin, &admin);
        env.storage().instance().set(&DataKey::Threshold, &threshold);
        env.storage().instance().set(&DataKey::TokenId, &token_id);
        env.storage().instance().set(&DataKey::ProposalCount, &0u32);
        env.storage().instance().set(&DataKey::Signers, &signers);

        // Extend TTL for instance storage (30 days ≈ 518400 ledgers at 5s/ledger)
        env.storage()
            .instance()
            .extend_ttl(518_400, 518_400);
    }

    // ─── Proposal Lifecycle ──────────────────────────────────────────────────

    /// Create a new spending proposal
    ///
    /// # Arguments
    /// * `creator` - Address of the proposal creator (must be an authorized signer)
    /// * `title` - Short description of the proposal
    /// * `destination` - Recipient address for the funds
    /// * `amount` - Amount of tokens to send (in stroops for XLM)
    /// * `memo` - Optional memo text
    ///
    /// # Returns
    /// The ID of the newly created proposal
    pub fn create_proposal(
        env: Env,
        creator: Address,
        title: String,
        destination: Address,
        amount: i128,
        memo: String,
    ) -> u32 {
        creator.require_auth();
        Self::require_signer(&env, &creator);

        if amount <= 0 {
            panic!("Amount must be positive");
        }

        let mut count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::ProposalCount)
            .unwrap_or(0);

        count += 1;

        let proposal = Proposal {
            id: count,
            creator: creator.clone(),
            title,
            destination,
            amount,
            memo,
            status: ProposalStatus::Pending,
            signatures: Vec::new(&env),
            created_at: env.ledger().timestamp(),
        };

        env.storage()
            .persistent()
            .set(&DataKey::Proposal(count), &proposal);
        env.storage()
            .instance()
            .set(&DataKey::ProposalCount, &count);

        // Extend TTL for the proposal (30 days)
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Proposal(count), 518_400, 518_400);
        env.storage()
            .instance()
            .extend_ttl(518_400, 518_400);

        env.events()
            .publish((symbol_short!("proposal"), symbol_short!("created")), count);

        count
    }

    /// Sign (approve) a proposal
    ///
    /// If the total number of signatures meets the threshold, the proposal
    /// status automatically changes to `Approved`.
    ///
    /// # Arguments
    /// * `signer` - Address of the signer (must be an authorized signer)
    /// * `proposal_id` - ID of the proposal to sign
    pub fn sign_proposal(env: Env, signer: Address, proposal_id: u32) {
        signer.require_auth();
        Self::require_signer(&env, &signer);

        let mut proposal = Self::get_proposal_internal(&env, proposal_id);

        if proposal.status != ProposalStatus::Pending {
            panic!("Proposal is not pending");
        }

        // Check if already signed
        for i in 0..proposal.signatures.len() {
            if proposal.signatures.get(i).unwrap() == signer {
                panic!("Already signed");
            }
        }

        proposal.signatures.push_back(signer.clone());

        // Check if threshold is met
        let threshold: u32 = env
            .storage()
            .instance()
            .get(&DataKey::Threshold)
            .unwrap_or(2);

        if proposal.signatures.len() >= threshold {
            proposal.status = ProposalStatus::Approved;
            env.events().publish(
                (symbol_short!("proposal"), symbol_short!("approved")),
                proposal_id,
            );
        }

        env.storage()
            .persistent()
            .set(&DataKey::Proposal(proposal_id), &proposal);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Proposal(proposal_id), 518_400, 518_400);

        env.events().publish(
            (symbol_short!("proposal"), symbol_short!("signed")),
            (proposal_id, signer),
        );
    }

    /// Reject a proposal
    ///
    /// Only the admin can reject proposals.
    ///
    /// # Arguments
    /// * `caller` - Address of the caller (must be admin)
    /// * `proposal_id` - ID of the proposal to reject
    pub fn reject_proposal(env: Env, caller: Address, proposal_id: u32) {
        caller.require_auth();

        // Allow any signer to reject
        Self::require_signer(&env, &caller);

        let mut proposal = Self::get_proposal_internal(&env, proposal_id);

        if proposal.status != ProposalStatus::Pending {
            panic!("Proposal is not pending");
        }

        proposal.status = ProposalStatus::Rejected;

        env.storage()
            .persistent()
            .set(&DataKey::Proposal(proposal_id), &proposal);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Proposal(proposal_id), 518_400, 518_400);

        env.events().publish(
            (symbol_short!("proposal"), symbol_short!("rejected")),
            proposal_id,
        );
    }

    /// Execute an approved proposal — transfers tokens to the destination
    ///
    /// # Arguments
    /// * `caller` - Address of the caller (must be an authorized signer)
    /// * `proposal_id` - ID of the proposal to execute
    pub fn execute_proposal(env: Env, caller: Address, proposal_id: u32) {
        caller.require_auth();
        Self::require_signer(&env, &caller);

        let mut proposal = Self::get_proposal_internal(&env, proposal_id);

        if proposal.status != ProposalStatus::Approved {
            panic!("Proposal is not approved");
        }

        // Transfer tokens from the contract to the destination
        let token_id: Address = env
            .storage()
            .instance()
            .get(&DataKey::TokenId)
            .unwrap();
        let token_client = token::Client::new(&env, &token_id);

        token_client.transfer(
            &env.current_contract_address(),
            &proposal.destination,
            &proposal.amount,
        );

        proposal.status = ProposalStatus::Executed;

        env.storage()
            .persistent()
            .set(&DataKey::Proposal(proposal_id), &proposal);
        env.storage()
            .persistent()
            .extend_ttl(&DataKey::Proposal(proposal_id), 518_400, 518_400);

        env.events().publish(
            (symbol_short!("proposal"), symbol_short!("executed")),
            proposal_id,
        );
    }

    // ─── Read-Only Queries ───────────────────────────────────────────────────

    /// Get a single proposal by ID
    pub fn get_proposal(env: Env, proposal_id: u32) -> Proposal {
        Self::get_proposal_internal(&env, proposal_id)
    }

    /// Get all proposals (returns a vector)
    pub fn get_proposals(env: Env) -> Vec<Proposal> {
        let count: u32 = env
            .storage()
            .instance()
            .get(&DataKey::ProposalCount)
            .unwrap_or(0);

        let mut proposals = Vec::new(&env);

        for i in 1..=count {
            if let Some(p) = env
                .storage()
                .persistent()
                .get::<DataKey, Proposal>(&DataKey::Proposal(i))
            {
                proposals.push_back(p);
            }
        }

        proposals
    }

    /// Get the total number of proposals
    pub fn get_proposal_count(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::ProposalCount)
            .unwrap_or(0)
    }

    /// Get authorized signers
    pub fn get_signers(env: Env) -> Vec<Address> {
        env.storage()
            .instance()
            .get(&DataKey::Signers)
            .unwrap_or(Vec::new(&env))
    }

    /// Get the approval threshold
    pub fn get_threshold(env: Env) -> u32 {
        env.storage()
            .instance()
            .get(&DataKey::Threshold)
            .unwrap_or(2)
    }

    /// Get the admin address
    pub fn get_admin(env: Env) -> Address {
        env.storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap()
    }

    // ─── Admin Functions ─────────────────────────────────────────────────────

    /// Update the approval threshold
    pub fn set_threshold(env: Env, admin: Address, new_threshold: u32) {
        admin.require_auth();
        Self::require_admin(&env, &admin);

        if new_threshold == 0 {
            panic!("Threshold must be > 0");
        }

        env.storage()
            .instance()
            .set(&DataKey::Threshold, &new_threshold);
        env.storage()
            .instance()
            .extend_ttl(518_400, 518_400);
    }

    /// Add a new signer
    pub fn add_signer(env: Env, admin: Address, new_signer: Address) {
        admin.require_auth();
        Self::require_admin(&env, &admin);

        let mut signers: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::Signers)
            .unwrap_or(Vec::new(&env));

        // Check for duplicates
        for i in 0..signers.len() {
            if signers.get(i).unwrap() == new_signer {
                panic!("Signer already exists");
            }
        }

        signers.push_back(new_signer);
        env.storage().instance().set(&DataKey::Signers, &signers);
        env.storage()
            .instance()
            .extend_ttl(518_400, 518_400);
    }

    /// Remove a signer
    pub fn remove_signer(env: Env, admin: Address, signer_to_remove: Address) {
        admin.require_auth();
        Self::require_admin(&env, &admin);

        let signers: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::Signers)
            .unwrap_or(Vec::new(&env));

        let mut new_signers = Vec::new(&env);
        let mut found = false;

        for i in 0..signers.len() {
            let s = signers.get(i).unwrap();
            if s == signer_to_remove {
                found = true;
            } else {
                new_signers.push_back(s);
            }
        }

        if !found {
            panic!("Signer not found");
        }

        env.storage()
            .instance()
            .set(&DataKey::Signers, &new_signers);
        env.storage()
            .instance()
            .extend_ttl(518_400, 518_400);
    }

    // ─── Internal Helpers ────────────────────────────────────────────────────

    fn get_proposal_internal(env: &Env, proposal_id: u32) -> Proposal {
        env.storage()
            .persistent()
            .get(&DataKey::Proposal(proposal_id))
            .unwrap_or_else(|| panic!("Proposal not found"))
    }

    fn require_admin(env: &Env, address: &Address) {
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap();
        if *address != admin {
            panic!("Not authorized: admin only");
        }
    }

    fn require_signer(env: &Env, address: &Address) {
        let signers: Vec<Address> = env
            .storage()
            .instance()
            .get(&DataKey::Signers)
            .unwrap_or(Vec::new(env));

        // Admin is always an authorized signer
        let admin: Address = env
            .storage()
            .instance()
            .get(&DataKey::Admin)
            .unwrap();
        if *address == admin {
            return;
        }

        for i in 0..signers.len() {
            if signers.get(i).unwrap() == *address {
                return;
            }
        }

        panic!("Not authorized: signer only");
    }
}

// ─── Tests ───────────────────────────────────────────────────────────────────

#[cfg(test)]
mod test {
    use super::*;
    use soroban_sdk::testutils::{Address as _, Ledger};
    use soroban_sdk::{vec, Env, String};

    fn setup_contract() -> (Env, Address, Address, Vec<Address>) {
        let env = Env::default();
        env.mock_all_auths();

        let contract_id = env.register(ClubTreasuryContract, ());
        let client = ClubTreasuryContractClient::new(&env, &contract_id);

        let admin = Address::generate(&env);
        let signer1 = Address::generate(&env);
        let signer2 = Address::generate(&env);
        let signers = vec![&env, signer1.clone(), signer2.clone()];

        // Use a mock token address for testing
        let token_id = Address::generate(&env);

        client.initialize(&admin, &2, &token_id, &signers);

        (env, contract_id, admin, signers)
    }

    #[test]
    fn test_initialize() {
        let (env, contract_id, admin, signers) = setup_contract();
        let client = ClubTreasuryContractClient::new(&env, &contract_id);

        assert_eq!(client.get_admin(), admin);
        assert_eq!(client.get_threshold(), 2);
        assert_eq!(client.get_signers().len(), 2);
        assert_eq!(client.get_proposal_count(), 0);
    }

    #[test]
    fn test_create_proposal() {
        let (env, contract_id, admin, _signers) = setup_contract();
        let client = ClubTreasuryContractClient::new(&env, &contract_id);

        let destination = Address::generate(&env);
        let id = client.create_proposal(
            &admin,
            &String::from_str(&env, "Buy snacks"),
            &destination,
            &1000_i128,
            &String::from_str(&env, "Party supplies"),
        );

        assert_eq!(id, 1);
        assert_eq!(client.get_proposal_count(), 1);

        let proposal = client.get_proposal(&1);
        assert_eq!(proposal.title, String::from_str(&env, "Buy snacks"));
        assert_eq!(proposal.amount, 1000_i128);
        assert_eq!(proposal.status, ProposalStatus::Pending);
        assert_eq!(proposal.signatures.len(), 0);
    }

    #[test]
    fn test_sign_and_approve() {
        let (env, contract_id, admin, signers) = setup_contract();
        let client = ClubTreasuryContractClient::new(&env, &contract_id);

        let destination = Address::generate(&env);
        client.create_proposal(
            &admin,
            &String::from_str(&env, "Club T-shirts"),
            &destination,
            &5000_i128,
            &String::from_str(&env, ""),
        );

        // First signature
        client.sign_proposal(&signers.get(0).unwrap(), &1);
        let p = client.get_proposal(&1);
        assert_eq!(p.status, ProposalStatus::Pending);
        assert_eq!(p.signatures.len(), 1);

        // Second signature (meets threshold of 2)
        client.sign_proposal(&signers.get(1).unwrap(), &1);
        let p = client.get_proposal(&1);
        assert_eq!(p.status, ProposalStatus::Approved);
        assert_eq!(p.signatures.len(), 2);
    }

    #[test]
    fn test_reject_proposal() {
        let (env, contract_id, admin, _signers) = setup_contract();
        let client = ClubTreasuryContractClient::new(&env, &contract_id);

        let destination = Address::generate(&env);
        client.create_proposal(
            &admin,
            &String::from_str(&env, "Rejected item"),
            &destination,
            &100_i128,
            &String::from_str(&env, ""),
        );

        client.reject_proposal(&admin, &1);
        let p = client.get_proposal(&1);
        assert_eq!(p.status, ProposalStatus::Rejected);
    }

    #[test]
    fn test_get_proposals() {
        let (env, contract_id, admin, _signers) = setup_contract();
        let client = ClubTreasuryContractClient::new(&env, &contract_id);

        let dest = Address::generate(&env);
        client.create_proposal(
            &admin,
            &String::from_str(&env, "Proposal A"),
            &dest,
            &100_i128,
            &String::from_str(&env, ""),
        );
        client.create_proposal(
            &admin,
            &String::from_str(&env, "Proposal B"),
            &dest,
            &200_i128,
            &String::from_str(&env, ""),
        );

        let all = client.get_proposals();
        assert_eq!(all.len(), 2);
    }

    #[test]
    fn test_add_remove_signer() {
        let (env, contract_id, admin, _signers) = setup_contract();
        let client = ClubTreasuryContractClient::new(&env, &contract_id);

        let new_signer = Address::generate(&env);
        client.add_signer(&admin, &new_signer);
        assert_eq!(client.get_signers().len(), 3);

        client.remove_signer(&admin, &new_signer);
        assert_eq!(client.get_signers().len(), 2);
    }

    #[test]
    fn test_set_threshold() {
        let (env, contract_id, admin, _signers) = setup_contract();
        let client = ClubTreasuryContractClient::new(&env, &contract_id);

        client.set_threshold(&admin, &3);
        assert_eq!(client.get_threshold(), 3);
    }

    #[test]
    #[should_panic(expected = "Already signed")]
    fn test_double_sign() {
        let (env, contract_id, admin, signers) = setup_contract();
        let client = ClubTreasuryContractClient::new(&env, &contract_id);

        let dest = Address::generate(&env);
        client.create_proposal(
            &admin,
            &String::from_str(&env, "Test"),
            &dest,
            &100_i128,
            &String::from_str(&env, ""),
        );

        let signer = signers.get(0).unwrap();
        client.sign_proposal(&signer, &1);
        client.sign_proposal(&signer, &1); // Should panic
    }
}
