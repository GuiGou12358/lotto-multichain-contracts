#![cfg_attr(not(feature = "std"), no_std, no_main)]

#[ink::contract]
pub mod lotto_contract {
    use crate::{config::*, raffle_manager::{BaseRaffleManager, RaffleManagerData}, error::RaffleError, DrawNumber};

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
        BaseRollupClient, HandleActionInput, RollupClient
    };
    use inkv5_client_lib::traits::RollupClientError;

    // Contract storage
    #[derive(Default)]
    #[ink(storage)]
    pub struct Contract {
        ownable: OwnableData,
        access_control: AccessControlData,
        kv_store: KvStoreData,
        meta_transaction: MetaTransactionData,
        config: ConfigData,
        raffle_manager: RaffleManagerData,
    }

    impl Contract {
        #[ink(constructor)]
        pub fn new() -> Self {
            Self::default()
        }
    }


    /// Implement the business logic for the Rollup Client in the 'on_message_received' method
    impl BaseRollupClient for Contract {
        fn on_message_received(&mut self, _action: Vec<u8>) -> Result<(), RollupClientError> {
            Ok(())
        }
    }


    /// Boilerplate code to manage the RaffleConfig
    impl crate::config::RaffleConfigStorage for Contract {
        fn get_storage(&self) -> &crate::config::ConfigData {
            &self.config
        }

        fn get_mut_storage(&mut self) -> &mut crate::config::ConfigData {
            &mut self.config
        }
    }

    impl crate::config::BaseRaffleConfig for Contract {}

    impl crate::config::RaffleConfig for Contract {
        #[ink(message)]
        fn get_config(&self) -> Option<Config> {
            self.inner_get_config()
        }
    }

    /// Boilerplate code to manage the Raffle

    impl crate::raffle_registration::BaseRaffle for Contract {}

    impl crate::raffle_registration::Raffle for Contract {

        #[ink(message)]
        fn can_participate(&self) -> bool {
            crate::raffle_registration::BaseRaffle::inner_can_participate(self)
        }

        #[ink(message)]
        fn get_draw_number(&self) -> Result<DrawNumber, RaffleError> {
            crate::raffle_registration::BaseRaffle::inner_get_draw_number(self)
        }

        #[ink(message)]
        fn get_status(&self) -> Result<crate::raffle_registration::Status, RaffleError> {
            crate::raffle_registration::BaseRaffle::inner_get_status(self)
        }

    }

    /// Boilerplate code to manage the RaffleManager
    impl crate::raffle_manager::RaffleManagerStorage for Contract {
        fn get_storage(&self) -> &crate::raffle_manager::RaffleManagerData {
            &self.raffle_manager
        }

        fn get_mut_storage(&mut self) -> &mut crate::raffle_manager::RaffleManagerData {
            &mut self.raffle_manager
        }
    }

    impl crate::raffle_manager::BaseRaffleManager for Contract {}

    impl crate::raffle_manager::RaffleManager for Contract {

        #[ink(message)]
        fn get_min_number_salts(&self) -> u8 {
            self.inner_get_min_number_salts()
        }

        #[ink(message)]
        fn get_draw_number(&self) -> Result<crate::DrawNumber, RaffleError> {
            crate::raffle_manager::BaseRaffleManager::inner_get_draw_number(self)
        }

        #[ink(message)]
        fn get_status(&self) -> Result<crate::raffle_manager::Status, RaffleError>  {
            crate::raffle_manager::BaseRaffleManager::inner_get_status(self)
        }

        #[ink(message)]
        fn get_registration_contracts(&self) -> Vec<crate::RegistrationContractId> {
            self.inner_get_registration_contracts()
        }

        #[ink(message)]
        fn get_registration_contract_status(
            &self,
            registration_contract: crate::RegistrationContractId,
        ) -> Option<crate::raffle_manager::Status> {
            self.inner_get_registration_contract_status(registration_contract)
        }

        #[ink(message)]
        fn get_generated_salt(&self, draw_number: crate::DrawNumber) -> Option<crate::Salt>  {
            self.inner_get_generated_salt(draw_number)
        }

        #[ink(message)]
        fn get_results(&self, draw_number: crate::DrawNumber) -> Option<Vec<crate::Number>> {
            self.inner_get_results(draw_number)
        }

        #[ink(message)]
        fn get_winners(&self, draw_number: crate::DrawNumber) -> Option<crate::raffle_manager::Winners> {
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

}
