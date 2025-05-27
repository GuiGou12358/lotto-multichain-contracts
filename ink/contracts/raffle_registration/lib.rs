#![cfg_attr(not(feature = "std"), no_std, no_main)]

#[ink::contract]
pub mod lotto_registration_contract {
    use ink::prelude::vec::Vec;
    use lotto::{config::*, error::*, raffle_registration::*, DrawNumber, Number, RegistrationContractId};

    use inkv5_client_lib::traits::access_control::{
        AccessControl, AccessControlData, AccessControlError, AccessControlStorage,
        BaseAccessControl, RoleType,
    };
    use inkv5_client_lib::traits::kv_store::{Key, KvStore, KvStoreData, KvStoreStorage, Value};
    use inkv5_client_lib::traits::message_queue::{MessageQueue};
    use inkv5_client_lib::traits::meta_transaction::{
        BaseMetaTransaction, ForwardRequest, MetaTransaction, MetaTransactionData,
        MetaTransactionStorage,
    };
    use inkv5_client_lib::traits::ownable::{
        BaseOwnable, Ownable, OwnableData, OwnableError, OwnableStorage,
    };
    use inkv5_client_lib::traits::rollup_client::{
        BaseRollupClient, HandleActionInput, RollupClient, ATTESTOR_ROLE
    };
    use inkv5_client_lib::traits::RollupClientError;

    /// Event emitted when the config is updated
    #[ink(event)]
    pub struct ConfigUpdated {
        config: Config,
    }

    /// Event emitted when the workflow starts
    #[ink(event)]
    pub struct Started {
        #[ink(topic)]
        registration_contract_id: RegistrationContractId,
    }

    /// Event emitted when the registrations are open
    #[ink(event)]
    pub struct RegistrationsOpen {
        #[ink(topic)]
        registration_contract_id: RegistrationContractId,
        #[ink(topic)]
        draw_number: DrawNumber,
    }

    /// Event emitted when the registrations are closed
    #[ink(event)]
    pub struct RegistrationsClosed {
        #[ink(topic)]
        registration_contract_id: RegistrationContractId,
        #[ink(topic)]
        draw_number: DrawNumber,
    }

    /// Event emitted when the salt is generated
    #[ink(event)]
    pub struct SaltGenerated {
        #[ink(topic)]
        registration_contract_id: RegistrationContractId,
        #[ink(topic)]
        draw_number: DrawNumber,
    }

    /// Event emitted when the results are received
    #[ink(event)]
    pub struct ResultsReceived {
        #[ink(topic)]
        registration_contract_id: RegistrationContractId,
        #[ink(topic)]
        draw_number: DrawNumber,
        numbers: Vec<Number>,
        has_winner: bool,
    }

    /// Event emitted when the participation is registered
    #[ink(event)]
    pub struct ParticipationRegistered {
        #[ink(topic)]
        registration_contract_id: RegistrationContractId,
        #[ink(topic)]
        draw_number: DrawNumber,
        #[ink(topic)]
        participant: AccountId,
        numbers: Vec<Number>,
    }

    /// Errors occurred in the contract
    #[derive(Debug, Eq, PartialEq)]
    #[ink::scale_derive(Encode, Decode, TypeInfo)]
    #[allow(clippy::cast_possible_truncation)]
    pub enum ContractError {
        AccessControlError(AccessControlError),
        RaffleError(RaffleError),
        RollupClientError(RollupClientError),
        TransferError,
    }

    /// convertor from AccessControlError to ContractError
    impl From<AccessControlError> for ContractError {
        fn from(error: AccessControlError) -> Self {
            ContractError::AccessControlError(error)
        }
    }

    /// convertor from RaffleError to ContractError
    impl From<RaffleError> for ContractError {
        fn from(error: RaffleError) -> Self {
            ContractError::RaffleError(error)
        }
    }

    /// convertor from RaffleError to ContractError
    impl From<RollupClientError> for ContractError {
        fn from(error: RollupClientError) -> Self {
            ContractError::RollupClientError(error)
        }
    }

    /// convertor from ContractError to RollupClientError
    impl From<ContractError> for RollupClientError {
        fn from(error: ContractError) -> Self {
            ink::env::debug_println!("Error: {:?}", error);
            RollupClientError::UnsupportedAction
        }
    }

    /// Message to request for action
    /// Message sent by the offchain rollup to the Ink! smart contract
    #[derive(Eq, PartialEq, Clone, Debug)]
    #[ink::scale_derive(Encode, Decode)]
    #[allow(clippy::cast_possible_truncation)]
    pub enum RequestForAction {
        /// update the config, set the registration contract id for this contract and start the workflow
        SetConfigAndStart(Config, RegistrationContractId),
        /// open the registrations for the given draw number
        OpenRegistrations(DrawNumber),
        /// close the registrations for the given draw number
        CloseRegistrations(DrawNumber),
        /// generate the salt used by VRF
        GenerateSalt(DrawNumber),
        /// set the results (winning numbers + true or false if we have a winner) for the given draw number
        SetResults(DrawNumber, Vec<Number>, bool),
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
        registration_contract_id: RegistrationContractId,
    }

    impl Contract {
        #[ink(constructor)]
        pub fn new() -> Self {
            let mut instance = Self::default();
            let caller = instance.env().caller();
            // set the owner of this contract
            BaseOwnable::init_with_owner(&mut instance, caller);
            BaseAccessControl::init_with_admin(&mut instance, caller);
            instance
        }

        #[ink(message)]
        pub fn participate(&mut self, numbers: Vec<Number>) -> Result<(), ContractError> {
            // check if the numbers are correct
            BaseRaffleConfig::check_numbers(self, &numbers)?;
            // check if the user can participate (raffle is open)
            BaseRaffle::check_can_participate(self)?;
            // save the participation with an event
            let participant = Self::env().caller();
            let registration_contract_id = self.registration_contract_id;
            let draw_number = Raffle::get_draw_number(self)?;
            self.env().emit_event(ParticipationRegistered {
                registration_contract_id,
                draw_number,
                participant,
                numbers,
            });
            Ok(())
        }

        #[ink(message)]
        pub fn participate_batch(
            &mut self,
            numbers: Vec<Vec<Number>>,
        ) -> Result<(), ContractError> {
            // check if the numbers are correct
            for n in numbers {
                self.participate(n)?;
            }

            Ok(())
        }

        #[ink(message)]
        pub fn get_registration_contract_id(&self) -> RegistrationContractId {
            self.registration_contract_id
        }

        fn inner_set_config_and_start(
            &mut self,
            config: Config,
            registration_contract_id: RegistrationContractId,
        ) -> Result<(), ContractError> {
            // check the status, we can set the config only when the raffle is not started yet
            let status = Raffle::get_status(self)?;
            if status != Status::NotStarted {
                return Err(ContractError::RaffleError(RaffleError::IncorrectStatus));
            }
            // set the registration contract id
            self.registration_contract_id = registration_contract_id;

            // update the config
            BaseRaffleConfig::set_config(self, config)?;

            // emit the event
            self.env().emit_event(ConfigUpdated {
                config,
            });

            // start the workflow
            BaseRaffle::start(self)?;

            // emit the event
            self.env().emit_event(Started {
                registration_contract_id,
            });

            Ok(())
        }

        fn inner_open_registrations(
            &mut self,
            draw_number: DrawNumber,
        ) -> Result<(), ContractError> {
            // Open the registrations
            BaseRaffle::open_registrations(self, draw_number)?;

            // emit the event
            let registration_contract_id = self.registration_contract_id;
            self.env().emit_event(RegistrationsOpen {
                registration_contract_id,
                draw_number,
            });

            Ok(())
        }

        fn inner_close_registrations(
            &mut self,
            draw_number: DrawNumber,
        ) -> Result<(), ContractError> {
            // Close the registrations
            BaseRaffle::close_registrations(self, draw_number)?;

            // emit the event
            let registration_contract_id = self.registration_contract_id;
            self.env().emit_event(RegistrationsClosed {
                registration_contract_id,
                draw_number,
            });

            Ok(())
        }

        fn inner_generate_salt(
            &mut self,
            draw_number: DrawNumber,
        ) -> Result<(), ContractError> {
            // Generate the salt
            BaseRaffle::generate_salt(self, draw_number)?;

            // emit the event
            let registration_contract_id = self.registration_contract_id;
            self.env().emit_event(SaltGenerated {
                registration_contract_id,
                draw_number,
            });

            Ok(())
        }

        fn inner_set_results(
            &mut self,
            draw_number: DrawNumber,
            numbers: Vec<Number>,
            has_winner: bool,
        ) -> Result<(), ContractError> {
            // check if the numbers satisfies the config
            BaseRaffleConfig::check_numbers(self, &numbers)?;

            // save the results
            BaseRaffle::save_results(self, draw_number, numbers.clone(), has_winner)?;

            // emmit the event
            let registration_contract_id = self.registration_contract_id;
            self.env().emit_event(ResultsReceived {
                registration_contract_id,
                draw_number,
                numbers: numbers.clone(),
                has_winner,
            });

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

    /// Implement the business logic for the Rollup Client in the 'on_message_received' method
    impl BaseRollupClient for Contract {
        fn on_message_received(&mut self, action: Vec<u8>) -> Result<(), RollupClientError> {
            // parse the response
            let request: RequestForAction = ink::scale::Decode::decode(&mut &action[..])
                .or(Err(RollupClientError::FailedToDecode))?;

            match request {
                RequestForAction::SetConfigAndStart(config, registration_contract_id) => {
                    self.inner_set_config_and_start(config, registration_contract_id)?;
                }
                RequestForAction::OpenRegistrations(draw_number) => {
                    self.inner_open_registrations(draw_number)?;
                }
                RequestForAction::CloseRegistrations(draw_number) => {
                    self.inner_close_registrations(draw_number)?;
                }
                RequestForAction::GenerateSalt(draw_number) => {
                    self.inner_generate_salt(draw_number)?;
                }
                RequestForAction::SetResults(draw_number, numbers, has_winner) => {
                    self.inner_set_results(draw_number, numbers, has_winner)?
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

    /// Boilerplate code to manage the Raffle

    impl BaseRaffle for Contract {}

    impl Raffle for Contract {

        #[ink(message)]
        fn can_participate(&self) -> bool {
            self.inner_can_participate()
        }

        #[ink(message)]
        fn get_draw_number(&self) -> Result<DrawNumber, RaffleError> {
            self.inner_get_draw_number()
        }

        #[ink(message)]
        fn get_status(&self) -> Result<Status, RaffleError> {
            self.inner_get_status()
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


}
