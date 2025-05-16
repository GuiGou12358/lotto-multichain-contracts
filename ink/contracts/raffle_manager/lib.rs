#![cfg_attr(not(feature = "std"), no_std, no_main)]

#[ink::contract]
pub mod lotto_registration_manager_contract {
    use ink::prelude::vec::Vec;
    use ink::scale::Encode;
    use lotto::{
        config::*, error::*, raffle_manager::*,
        AccountId20, AccountId32, DrawNumber, Number,
        RegistrationContractId, Salt,
    };
    use ink_client_lib::traits::access_control::{
        AccessControl, AccessControlData, AccessControlError, AccessControlStorage,
        BaseAccessControl, RoleType,
    };
    use ink_client_lib::traits::kv_store::{Key, KvStore, KvStoreData, KvStoreStorage, Value};
    use ink_client_lib::traits::message_queue::{MessageQueue};
    use ink_client_lib::traits::meta_transaction::{
        BaseMetaTransaction, ForwardRequest, MetaTransaction, MetaTransactionData,
        MetaTransactionStorage,
    };
    use ink_client_lib::traits::ownable::{
        BaseOwnable, Ownable, OwnableData, OwnableError, OwnableStorage,
    };
    use ink_client_lib::traits::rollup_client::{
        BaseRollupClient, HandleActionInput, RollupClient, ATTESTOR_ROLE
    };
    use ink_client_lib::traits::RollupClientError;

    
    const LOTTO_MANAGER_ROLE: RoleType = ink::selector_id!("LOTTO_MANAGER");

    /// Event emitted when the lotto is started
    #[ink(event)]
    pub struct LottoStarted {
        config: Config,
    }

    /// Event emitted when the registrations are open
    #[ink(event)]
    pub struct RegistrationsOpen {
        #[ink(topic)]
        draw_number: DrawNumber,
    }

    /// Event emitted when the registrations are closed
    #[ink(event)]
    pub struct RegistrationsClosed {
        #[ink(topic)]
        draw_number: DrawNumber,
    }

    /// Event emitted when the winning numbers are received
    #[ink(event)]
    pub struct NumbersDrawn {
        #[ink(topic)]
        draw_number: DrawNumber,
        numbers: Vec<Number>,
    }

    /// Event emitted when the winners are revealed
    #[ink(event)]
    pub struct WinnersRevealed {
        #[ink(topic)]
        draw_number: DrawNumber,
        winners: Winners,
    }

    /// Event emitted when the lotto is closed
    #[ink(event)]
    pub struct LottoClosed {}

    /// Errors occurred in the contract
    #[derive(Debug, Eq, PartialEq)]
    #[ink::scale_derive(Encode, Decode, TypeInfo)]
    #[allow(clippy::cast_possible_truncation)]
    pub enum ContractError {
        AccessControlError(AccessControlError),
        RaffleError(RaffleError),
        RollupClientError(RollupClientError),
        CannotBeClosedYet,
        NoResult,
        SaltCannotBeGenerated,
        SaltNotGenerated,
        IncorrectInputHash,
        TransferError,
    }
    /// convertor from RaffleError to ContractError
    impl From<RaffleError> for ContractError {
        fn from(error: RaffleError) -> Self {
            ContractError::RaffleError(error)
        }
    }
    /// convertor from AccessControlError to ContractError
    impl From<AccessControlError> for ContractError {
        fn from(error: AccessControlError) -> Self {
            ContractError::AccessControlError(error)
        }
    }
    /// convertor from RollupClientError to ContractError
    impl From<RollupClientError> for ContractError {
        fn from(error: RollupClientError) -> Self {
            ContractError::RollupClientError(error)
        }
    }
    /// convertor from RollupClientError to ContractError
    impl From<ContractError> for RollupClientError {
        fn from(_error: ContractError) -> Self {
            RollupClientError::RuntimeError(1)
        }
    }

    /// Message to synchronize the contracts, to request the lotto draw and get the list of winners.
    /// message pushed in the queue by this contract and read by the offchain rollup
    #[derive(Eq, PartialEq, Clone, Debug)]
    #[ink::scale_derive(Encode, Decode)]
    #[allow(clippy::cast_possible_truncation)]
    pub enum LottoManagerRequestMessage {
        /// request to propagate the config to all given contracts
        PropagateConfig(Config, Vec<RegistrationContractId>),
        /// request to open the registrations to all given contracts
        OpenRegistrations(DrawNumber, Vec<RegistrationContractId>),
        /// request to close the registrations to all given contracts
        CloseRegistrations(DrawNumber, Vec<RegistrationContractId>),
        /// request to generate a salt by all given contracts
        GenerateSalt(DrawNumber, Vec<RegistrationContractId>),
        /// request to draw the numbers based on the config and the given salt
        DrawNumbers(DrawNumber, Config, Salt),
        /// request to check if there is a winner for the given numbers
        CheckWinners(DrawNumber, Vec<Number>),
        /// request to propagate the results to all given contracts
        PropagateResults(
            DrawNumber,
            Vec<Number>,
            bool,
            Vec<RegistrationContractId>,
        ),
    }

    /// Offchain rollup response
    #[ink::scale_derive(Encode, Decode)]
    #[allow(clippy::cast_possible_truncation)]
    pub enum LottoManagerResponseMessage {
        /// The config is propagated to the given contract ids.
        /// arg2: list of contracts where the config is propagated
        /// Arg2 : Hash of config
        ConfigPropagated(Vec<RegistrationContractId>, Hash),
        /// The registration is open for the given contract ids.
        /// arg1: draw number
        /// arg2: list of contracts where the registration is open
        RegistrationsOpen(DrawNumber, Vec<RegistrationContractId>),
        /// The registration is closed for the given contract ids.
        /// arg1: draw number
        /// arg2: list of contracts where the registration is closed
        RegistrationsClosed(DrawNumber, Vec<RegistrationContractId>),
        /// The salt is generated for the given contract ids.
        /// arg1: draw number
        /// arg2: list of contracts where the salt is generated
        SaltGenerated(DrawNumber, Vec<(RegistrationContractId, Salt)>),
        /// Return the winning numbers
        /// arg1: draw number
        /// arg2: winning numbers
        /// arg3: hash of salt used for vrf
        WinningNumbers(DrawNumber, Vec<Number>, Hash),
        /// Return the list of winners
        /// arg1: draw number
        /// arg2: winners substrate
        /// arg3: winners evm
        /// arg4: hash of winning numbers
        Winners(DrawNumber, Vec<AccountId32>, Vec<AccountId20>, Hash),
        /// The results are propagated to the given contract ids.
        /// arg1: draw number
        /// arg2: list of contracts where the results are propagated
        /// arg3: hash of results
        ResultsPropagated(DrawNumber, Vec<RegistrationContractId>, Hash),
        /// Request to close the registrations
        CloseRegistrations(),
    }

    // Contract storage
    #[derive(Default, Debug)]
    #[ink(storage)]
    pub struct Contract {
        ownable: OwnableData,
        access_control: AccessControlData,
        kv_store: KvStoreData,
        meta_transaction: MetaTransactionData,        
        config: ConfigData,
        raffle_manager: RaffleManagerData,
        number_of_blocks_for_participation: BlockNumber,
        next_closing_registrations: BlockNumber,
    }

    impl Contract {
        #[ink(constructor)]
        pub fn new() -> Self {
            let mut instance = Self::default();
            let caller = instance.env().caller();
            // set the owner of this contract
            BaseOwnable::init_with_owner(&mut instance, caller);
            BaseAccessControl::init_with_admin(&mut instance, caller);
            // grant the role manager
            BaseAccessControl::inner_grant_role(&mut instance, LOTTO_MANAGER_ROLE, caller)
                .expect("Should grant the role LOTTO_MANAGER_ROLE");
            instance
        }

        #[ink(message)]
        //#[openbrush::modifiers(access_control::only_role(LOTTO_MANAGER_ROLE))]
        pub fn set_config(&mut self, config: Config) -> Result<(), ContractError> {
            // check the status, we can set the config only when the raffle is not started yet
            let status = RaffleManager::get_status(self)?;
            if status != Status::NotStarted {
                return Err(ContractError::RaffleError(RaffleError::IncorrectStatus));
            }

            // update the config
            BaseRaffleConfig::set_config(self, config)?;

            Ok(())
        }

        #[ink(message)]
        //#[openbrush::modifiers(access_control::only_role(LOTTO_MANAGER_ROLE))]
        pub fn set_registration_contracts(
            &mut self,
            registration_contracts: Vec<RegistrationContractId>,
        ) -> Result<(), ContractError> {
            // add registration contract
            BaseRaffleManager::set_registration_contracts(self, registration_contracts)?;
            Ok(())
        }

        #[ink(message)]
        //#[openbrush::modifiers(access_control::only_role(LOTTO_MANAGER_ROLE))]
        pub fn set_min_number_salts(
            &mut self,
            min_number_salts: u8,
        ) -> Result<(), ContractError> {
            // set the minimum number of salts
            BaseRaffleManager::set_min_number_salts(self, min_number_salts)?;
            Ok(())
        }

        /// get the number of blocks to wait before closing the participation
        #[ink(message)]
        pub fn get_number_of_blocks_for_participation(&self) -> BlockNumber {
            self.number_of_blocks_for_participation
        }

        /// set the number of blocks to wait before closing the participation
        #[ink(message)]
        //#[openbrush::modifiers(access_control::only_role(LOTTO_MANAGER_ROLE))]
        pub fn set_number_of_blocks_for_participation(
            &mut self,
            number_of_blocks_for_participation: BlockNumber,
        ) -> Result<(), ContractError> {
            // set the number of blocks to wait before closing the participation
            self.number_of_blocks_for_participation = number_of_blocks_for_participation;
            Ok(())
        }

        #[ink(message)]
        //#[openbrush::modifiers(access_control::only_role(LOTTO_MANAGER_ROLE))]
        pub fn start(
            &mut self,
            previous_draw_number: Option<DrawNumber>,
        ) -> Result<(), ContractError> {
            // start
            BaseRaffleManager::start(self, previous_draw_number.unwrap_or_default())?;
            // propagate the config in all given contracts
            let config = BaseRaffleConfig::ensure_config(self)?;

            // emmit the event
            self.env().emit_event(LottoStarted { config });

            let registration_contracts = RaffleManager::get_registration_contracts(self);
            let message =
                LottoManagerRequestMessage::PropagateConfig(config, registration_contracts);
            MessageQueue::push_message(self, &message)?;

            Ok(())
        }

        #[ink(message)]
        pub fn can_close_registrations(&self) -> bool {
            // check the status of all contracts
            if !BaseRaffleManager::can_close_registrations(self) {
                return false;
            }

            // check the block number
            let block_number = self.env().block_number();
            block_number >= self.next_closing_registrations
        }

        #[ink(message)]
        pub fn get_next_closing_registrations(&self) -> BlockNumber {
            self.next_closing_registrations
        }

        #[ink(message)]
        pub fn close_registrations(&mut self) -> Result<(), ContractError> {
            // check if we can close the registrations
            if !self.can_close_registrations() {
                return Err(ContractError::CannotBeClosedYet);
            }
            // close the registrations in the manager
            let draw_number = BaseRaffleManager::close_registrations(self)?;

            // emmit the event
            self.env().emit_event(RegistrationsClosed { draw_number });

            // close the registrations in all contracts
            let registration_contracts = RaffleManager::get_registration_contracts(self);
            let message =
                LottoManagerRequestMessage::CloseRegistrations(draw_number, registration_contracts);
            MessageQueue::push_message(self, &message)?;

            Ok(())
        }

        #[ink(message)]
        pub fn has_pending_message(&self) -> bool {
            let tail = MessageQueue::get_queue_tail(self).unwrap_or_default();
            let head = MessageQueue::get_queue_head(self).unwrap_or_default();
            tail > head
        }

        fn handle_started(
            &mut self,
            registration_contracts: Vec<RegistrationContractId>,
            config_hash: &[u8],
        ) -> Result<(), ContractError> {

            // check the config propagated to other contracts
            let config = BaseRaffleConfig::ensure_config(self)?;
            verify_hash(&config, config_hash)?;

            let not_synchronized_contracts = BaseRaffleManager::save_registration_contracts_status(
                self,
                RaffleManager::get_draw_number(self)?,
                Status::Started,
                registration_contracts,
            )?;

            if !not_synchronized_contracts.is_empty() {
                // synchronized missing contracts and wait
                let message =
                    LottoManagerRequestMessage::PropagateConfig(config, not_synchronized_contracts);
                MessageQueue::push_message(self, &message)?;
                return Ok(());
            }

            // open the registration
            self.inner_open_registrations()?;

            Ok(())
        }

        fn inner_open_registrations(&mut self) -> Result<(), ContractError> {
            // open the registrations in the manager
            let draw_number = BaseRaffleManager::open_registrations(self)?;

            // emmit the event
            self.env().emit_event(RegistrationsOpen { draw_number });

            // open the registrations in all given contracts
            let registration_contracts = RaffleManager::get_registration_contracts(self);
            let message =
                LottoManagerRequestMessage::OpenRegistrations(draw_number, registration_contracts);
            MessageQueue::push_message(self, &message)?;

            Ok(())
        }

        fn handle_registrations_open(
            &mut self,
            draw_number: DrawNumber,
            registration_contracts: Vec<RegistrationContractId>,
        ) -> Result<(), ContractError> {
            let not_synchronized_contracts = BaseRaffleManager::save_registration_contracts_status(
                self,
                draw_number,
                Status::RegistrationsOpen,
                registration_contracts,
            )?;

            if !not_synchronized_contracts.is_empty() {
                // synchronized missing contracts and wait
                let message = LottoManagerRequestMessage::OpenRegistrations(
                    draw_number,
                    not_synchronized_contracts,
                );
                MessageQueue::push_message(self, &message)?;
                return Ok(());
            }

            // all contracts are synchronized
            // we can close the registration in X block
            let block_number = self.env().block_number();
            self.next_closing_registrations = block_number
                .checked_add(self.number_of_blocks_for_participation)
                .ok_or(RaffleError::AddOverFlow)?;

            Ok(())
        }

        fn handle_registrations_closed(
            &mut self,
            draw_number: DrawNumber,
            registration_contracts: Vec<RegistrationContractId>,
        ) -> Result<(), ContractError> {
            let not_synchronized_contracts = BaseRaffleManager::save_registration_contracts_status(
                self,
                draw_number,
                Status::RegistrationsClosed,
                registration_contracts,
            )?;

            if !not_synchronized_contracts.is_empty() {
                // synchronized missing contracts and wait
                let message = LottoManagerRequestMessage::CloseRegistrations(
                    draw_number,
                    not_synchronized_contracts,
                );
                MessageQueue::push_message(self, &message)?;
                return Ok(());
            }

            // if all contracts are synchronized, we can start the draw - generate salt in first
            self.inner_try_to_generate_salt(draw_number)?;

            Ok(())
        }

        fn inner_try_to_generate_salt(
            &mut self,
            draw_number: DrawNumber,
        ) -> Result<(), ContractError> {
            // generate the salt in the manager
            match BaseRaffleManager::try_to_generate_salt(self)? {
                (None, missing_contracts) => {
                    // the salt is not generated
                    if missing_contracts.is_empty() {
                        // no missing contract => error
                        return Err(ContractError::SaltCannotBeGenerated) ;//
                    }
                    // synchronized missing contracts and wait
                    let message = LottoManagerRequestMessage::GenerateSalt(
                        draw_number,
                        missing_contracts,
                    );
                    MessageQueue::push_message(self, &message)?;
                    Ok(())
                }
                (Some(salt), _) => {
                    // the salt is generated, request the draw numbers
                    let config = BaseRaffleConfig::ensure_config(self)?;
                    let message = LottoManagerRequestMessage::DrawNumbers(draw_number, config, salt);
                    MessageQueue::push_message(self, &message)?;
                    Ok(())
                }
            }
        }


        fn handle_salt_generated(
            &mut self,
            draw_number: DrawNumber,
            contracts_salts: Vec<(RegistrationContractId, Salt)>,
        ) -> Result<(), ContractError> {

            BaseRaffleManager::save_salts(
                self,
                draw_number,
                contracts_salts
            )?;

            self.inner_try_to_generate_salt(draw_number)?;

            Ok(())
        }

        fn handle_winning_numbers(
            &mut self,
            draw_number: DrawNumber,
            numbers: Vec<Number>,
            config_hash: &[u8],
        ) -> Result<(), ContractError> {

            // check the config used is correct
            let config = BaseRaffleConfig::ensure_config(self)?;
            // check the salt used by the VRF
            let generated_salt = RaffleManager::get_generated_salt(self, draw_number).ok_or(ContractError::SaltNotGenerated)?;
            // check the config and salt used are correct
            verify_hash(&(config, generated_salt), config_hash)?;

            // check if the numbers are correct
            BaseRaffleConfig::check_numbers(self, &numbers)?;

            // set the result
            BaseRaffleManager::set_results(self, draw_number, numbers.clone())?;

            // save in the kv store the last raffle id used for verification
            const LAST_RAFFLE: u32 = ink::selector_id!("LAST_RAFFLE_FOR_VERIF");
            KvStore::inner_set_value(self, &LAST_RAFFLE.encode(), Some(&draw_number.encode()));

            // emmit the event
            self.env().emit_event(NumbersDrawn {
                draw_number,
                numbers: numbers.clone(),
            });

            // request to check the winners
            let message = LottoManagerRequestMessage::CheckWinners(draw_number, numbers);
            MessageQueue::push_message(self, &message)?;

            Ok(())
        }

        fn handle_winners(
            &mut self,
            draw_number: DrawNumber,
            winners_substrate: Vec<AccountId32>,
            winners_evm: Vec<AccountId20>,
            results_hash: &[u8],
        ) -> Result<(), ContractError> {

            // check if the winners were selected based on the correct numbers
            let results = RaffleManager::get_results(self, draw_number).ok_or(ContractError::NoResult)?;
            verify_hash(&results, results_hash)?;

            // set the winners in the raffle
            BaseRaffleManager::set_winners(self, draw_number, (winners_substrate.clone(), winners_evm.clone()))?;

            // emmit the event
            self.env().emit_event(WinnersRevealed {
                draw_number,
                winners: (winners_substrate.clone(), winners_evm.clone()),
            });

            // propagate the results in all contracts
            let numbers =
                RaffleManager::get_results(self, draw_number).ok_or(ContractError::NoResult)?;
            let registration_contracts = RaffleManager::get_registration_contracts(self);
            let message = LottoManagerRequestMessage::PropagateResults(
                draw_number,
                numbers,
                !winners_substrate.is_empty() || !winners_evm.is_empty(),
                registration_contracts,
            );
            MessageQueue::push_message(self, &message)?;

            Ok(())
        }

        fn handle_results_propagated(
            &mut self,
            draw_number: DrawNumber,
            registration_contracts: Vec<RegistrationContractId>,
            results_hash: &[u8],
        ) -> Result<(), ContractError> {

            // check if the results propagated are correct
            let results = RaffleManager::get_results(self, draw_number).ok_or(ContractError::NoResult)?;
            verify_hash(&results, results_hash)?;

            let not_synchronized_contracts = BaseRaffleManager::save_registration_contracts_status(
                self,
                draw_number,
                Status::DrawFinished,
                registration_contracts,
            )?;

            let has_winner = if let Some(winners) = RaffleManager::get_winners(self, draw_number) {
                !winners.0.is_empty() || !winners.1.is_empty()
            } else {
                false
            };

            if !not_synchronized_contracts.is_empty() {
                // synchronized missing contracts and wait
                let numbers =
                    RaffleManager::get_results(self, draw_number).ok_or(ContractError::NoResult)?;
                let message = LottoManagerRequestMessage::PropagateResults(
                    draw_number,
                    numbers,
                    has_winner,
                    not_synchronized_contracts,
                );
                MessageQueue::push_message(self, &message)?;
                return Ok(());
            }

            // if all contracts are synchronized, we can continue
            if !has_winner {
                // if there is no winner, we can open the registrations for the next draw number
                self.inner_open_registrations()?;
            }

            Ok(())
        }

        #[ink(message)]
        //#[modifiers(only_role(DEFAULT_ADMIN_ROLE))]
        pub fn register_attestor(
            &mut self,
            account_id: AccountId,
        ) -> Result<(), AccessControlError> {
            AccessControl::grant_role(self, ATTESTOR_ROLE, account_id)?;
            Ok(())
        }

        #[ink(message)]
        pub fn get_attestor_role(&self) -> RoleType {
            ATTESTOR_ROLE
        }

        #[ink(message)]
        pub fn get_manager_role(&self) -> RoleType {
            LOTTO_MANAGER_ROLE
        }

        #[ink(message)]
        //#[modifiers(only_role(DEFAULT_ADMIN_ROLE))]
        pub fn terminate_me(&mut self) -> Result<(), ContractError> {
            self.env().terminate_contract(self.env().caller());
        }

        #[ink(message)]
        //#[openbrush::modifiers(only_role(DEFAULT_ADMIN_ROLE))]
        pub fn withdraw(&mut self, value: Balance) -> Result<(), ContractError> {
            let caller = Self::env().caller();
            self.env()
                .transfer(caller, value)
                .map_err(|_| ContractError::TransferError)?;
            Ok(())
        }

    }

    fn verify_hash<T: ink::scale::Encode>(
        input_data: &T,
        expected_hash: &[u8],
    ) -> Result<(), ContractError> {
        use ink::env::hash;
        // encode and hash the input for verification by the manager
        let encoded_input_data = input_data.encode();
        let mut hash_encoded_input = <hash::Blake2x256 as hash::HashOutput>::Type::default();
        ink::env::hash_bytes::<hash::Blake2x256>(&encoded_input_data, &mut hash_encoded_input);

        ink::env::debug_println!("hash_encoded_input: {hash_encoded_input:02x?}");
        if hash_encoded_input != *expected_hash {
            return Err(ContractError::IncorrectInputHash);
        }
        Ok(())
    }


    /// Implement the business logic for the Rollup Client in the 'on_message_received' method
    impl BaseRollupClient for Contract {
        fn on_message_received(&mut self, action: Vec<u8>) -> Result<(), RollupClientError> {
            let response: LottoManagerResponseMessage = ink::scale::Decode::decode(&mut &action[..])
                .or(Err(RollupClientError::FailedToDecode))?;

            match response {
                LottoManagerResponseMessage::ConfigPropagated(contract_ids, ref hash) => {
                    self.handle_started(contract_ids, hash.as_ref())?
                }
                LottoManagerResponseMessage::RegistrationsOpen(draw_number, contract_ids) => {
                    self.handle_registrations_open(draw_number, contract_ids)?
                }
                LottoManagerResponseMessage::RegistrationsClosed(draw_number, contract_ids) => {
                    self.handle_registrations_closed(draw_number, contract_ids)?
                }
                LottoManagerResponseMessage::SaltGenerated(draw_number, contracts_salts) => {
                    self.handle_salt_generated(draw_number, contracts_salts)?
                }
                LottoManagerResponseMessage::ResultsPropagated(
                    draw_number,
                    contract_ids,
                    ref hash,
                ) => self.handle_results_propagated(draw_number, contract_ids, hash.as_ref())?,
                LottoManagerResponseMessage::WinningNumbers(draw_number, numbers, ref hash) => {
                    self.handle_winning_numbers(draw_number, numbers, hash.as_ref())?
                }
                LottoManagerResponseMessage::Winners(draw_number, winners_substrate, winners_evm , ref hash) => {
                    self.handle_winners(draw_number, winners_substrate, winners_evm, hash.as_ref())?
                }
                LottoManagerResponseMessage::CloseRegistrations() => {
                    if self.can_close_registrations() {
                        self.close_registrations()?
                    }
                }
            }

            Ok(())
        }
    }


    /// Boilerplate code to manage the RaffleConfig
    impl RaffleConfigStorage for Contract {
        fn get_storage(&self) -> &ConfigData {
            &self.config
        }

        fn get_mut_storage(&mut self) -> &mut ConfigData {
            &mut self.config
        }
    }

    impl BaseRaffleConfig for Contract {}

    impl RaffleConfig for Contract {
        #[ink(message)]
        fn get_config(&self) -> Option<Config> {
            self.inner_get_config()
        }
    }

    /// Boilerplate code to manage the RaffleManager
    impl RaffleManagerStorage for Contract {
        fn get_storage(&self) -> &RaffleManagerData {
            &self.raffle_manager
        }

        fn get_mut_storage(&mut self) -> &mut RaffleManagerData {
            &mut self.raffle_manager
        }
    }

    impl BaseRaffleManager for Contract {}

    impl RaffleManager for Contract {

        #[ink(message)]
        fn get_min_number_salts(&self) -> u8 {
            self.inner_get_min_number_salts()
        }

        #[ink(message)]
        fn get_draw_number(&self) -> Result<DrawNumber, RaffleError> {
            self.inner_get_draw_number()
        }

        #[ink(message)]
        fn get_status(&self) -> Result<Status, RaffleError>  {
            self.inner_get_status()
        }

        #[ink(message)]
        fn get_registration_contracts(&self) -> Vec<RegistrationContractId> {
            self.inner_get_registration_contracts()
        }

        #[ink(message)]
        fn get_registration_contract_status(
            &self,
            registration_contract: RegistrationContractId,
        ) -> Option<Status> {
            self.inner_get_registration_contract_status(registration_contract)
        }

        #[ink(message)]
        fn get_generated_salt(&self, draw_number: DrawNumber) -> Option<Salt>  {
            self.inner_get_generated_salt(draw_number)
        }

        #[ink(message)]
        fn get_results(&self, draw_number: DrawNumber) -> Option<Vec<Number>> {
            self.inner_get_results(draw_number)
        }

        #[ink(message)]
        fn get_winners(&self, draw_number: DrawNumber) -> Option<Winners> {
            self.inner_get_winners(draw_number)
        }
    }

    /// Boilerplate code to manage the ownership
    impl OwnableStorage for Contract {
        fn get_storage(&self) -> &OwnableData {
            &self.ownable
        }

        fn get_mut_storage(&mut self) -> &mut OwnableData {
            &mut self.ownable
        }
    }

    impl BaseOwnable for Contract {}

    impl Ownable for Contract {
        #[ink(message)]
        fn get_owner(&self) -> Option<AccountId> {
            self.inner_get_owner()
        }

        #[ink(message)]
        fn renounce_ownership(&mut self) -> Result<(), OwnableError> {
            self.inner_renounce_ownership()
        }

        #[ink(message)]
        fn transfer_ownership(&mut self, new_owner: Option<AccountId>) -> Result<(), OwnableError> {
            self.inner_transfer_ownership(new_owner)
        }
    }

    /// Boilerplate code to implement the access control
    impl AccessControlStorage for Contract {
        fn get_storage(&self) -> &AccessControlData {
            &self.access_control
        }

        fn get_mut_storage(&mut self) -> &mut AccessControlData {
            &mut self.access_control
        }
    }

    impl BaseAccessControl for Contract {}

    impl AccessControl for Contract {
        #[ink(message)]
        fn has_role(&self, role: RoleType, account: AccountId) -> bool {
            self.inner_has_role(role, account)
        }

        #[ink(message)]
        fn grant_role(
            &mut self,
            role: RoleType,
            account: AccountId,
        ) -> Result<(), AccessControlError> {
            self.inner_grant_role(role, account)
        }

        #[ink(message)]
        fn revoke_role(
            &mut self,
            role: RoleType,
            account: AccountId,
        ) -> Result<(), AccessControlError> {
            self.inner_revoke_role(role, account)
        }

        #[ink(message)]
        fn renounce_role(&mut self, role: RoleType) -> Result<(), AccessControlError> {
            self.inner_renounce_role(role)
        }
    }

    /// Boilerplate code to implement the Key Value Store
    impl KvStoreStorage for Contract {
        fn get_storage(&self) -> &KvStoreData {
            &self.kv_store
        }

        fn get_mut_storage(&mut self) -> &mut KvStoreData {
            &mut self.kv_store
        }
    }

    impl KvStore for Contract {}

    /// Boilerplate code to implement the Message Queue
    impl MessageQueue for Contract {}

    /// Boilerplate code to implement the Rollup Client
    impl RollupClient for Contract {
        #[ink(message)]
        fn get_value(&self, key: Key) -> Option<Value> {
            self.inner_get_value(&key)
        }

        #[ink(message)]
        fn has_message(&self) -> Result<bool, RollupClientError> {
            MessageQueue::has_message(self)
        }

        #[ink(message)]
        fn rollup_cond_eq(
            &mut self,
            conditions: Vec<(Key, Option<Value>)>,
            updates: Vec<(Key, Option<Value>)>,
            actions: Vec<HandleActionInput>,
        ) -> Result<(), RollupClientError> {
            self.inner_rollup_cond_eq(conditions, updates, actions)
        }
    }

    /// Boilerplate code to implement the Meta Transaction
    impl MetaTransactionStorage for Contract {
        fn get_storage(&self) -> &MetaTransactionData {
            &self.meta_transaction
        }

        fn get_mut_storage(&mut self) -> &mut MetaTransactionData {
            &mut self.meta_transaction
        }
    }

    impl BaseMetaTransaction for Contract {}

    impl MetaTransaction for Contract {
        #[ink(message)]
        fn prepare(
            &self,
            from: AccountId,
            data: Vec<u8>,
        ) -> Result<(ForwardRequest, Hash), RollupClientError> {
            self.inner_prepare(from, data)
        }

        #[ink(message)]
        fn meta_tx_rollup_cond_eq(
            &mut self,
            request: ForwardRequest,
            signature: [u8; 65],
        ) -> Result<(), RollupClientError> {
            self.inner_meta_tx_rollup_cond_eq(request, signature)
        }
    }
    

    #[cfg(test)]
    mod tests {
        use super::*;

        #[ink::test]
        fn test_verify_config_hash() {
            let config = Config {
                nb_numbers: 4,
                min_number: 1,
                max_number: 50,
            };
            let hash: Vec<u8> = hex::decode("1af688b7e4ccbd51529a15d28753270a04adf361d4eb1cbd9553ef19d353c656").expect("hex decode failed");
            assert_eq!(verify_hash(&config, &hash), Ok(()));
        }

        #[ink::test]
        fn test_verify_config_salt_hash() {
            let config = Config {
                nb_numbers: 4,
                min_number: 1,
                max_number: 50,
            };

            let salt : Salt = [101, 183, 131, 128, 194, 210, 6, 186, 135, 158, 6, 247, 69, 144, 120, 98, 45, 169, 95, 8, 91, 222, 225, 175, 72, 14, 187, 148, 7, 210, 251, 70].to_vec();
            let hash: Vec<u8> = hex::decode("94e1fa775bc259340a60dda2a2f10e911b6343e6ab0932726c738097c8fc3521").expect("hex decode failed");
            assert_eq!(verify_hash(&(config, salt), &hash), Ok(()));

            let salt : Salt = [94, 193, 212, 179, 22, 80, 18, 236, 194, 56, 99, 20, 16, 125, 123, 20, 14, 26, 212, 42, 96, 187, 51, 110, 129, 113, 120, 162, 223, 50, 36, 79].to_vec();
            let hash: Vec<u8> = hex::decode("c6aac4e20883f260241bbae6963be7ae78d9cc0136f0a2409aa40e0fdef11cb1").expect("hex decode failed");
            assert_eq!(verify_hash(&(config, salt), &hash), Ok(()));

        }

        #[ink::test]
        fn test_verify_numbers_hash() {

            let numbers: Vec<Number> = vec![5, 40, 8, 2];
            let hash: Vec<u8> = hex::decode("0c70b0cb9b2d87768d1efacd6ca6a89be08a4c8c70855b54455f7f46caeeb155").expect("hex decode failed");
            assert_eq!(verify_hash(&numbers, &hash), Ok(()));

            let numbers: Vec<Number> = vec![15, 20, 1, 31];
            let hash: Vec<u8> = hex::decode("2a8b8764a606b81095017886e6e46482bf2f248969279ea3c063265b060794ae").expect("hex decode failed");
            assert_eq!(verify_hash(&numbers, &hash), Ok(()));

        }

    }
}
