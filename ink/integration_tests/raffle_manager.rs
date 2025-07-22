use ink::env::DefaultEnvironment;
use ink::scale::Decode;
use ink::scale::Encode;
use ink_e2e::{ContractsBackend, E2EBackend, InstantiationResult};
use std::fmt::Debug;

use lotto::config::Config;
use lotto::raffle_manager;
use lotto::raffle_manager::RaffleManager;
use lotto::raffle_manager::Winners;
use lotto::*;

use lotto_registration_manager_contract::{lotto_registration_manager_contract, *};

use inkv5_client_lib::traits::access_control::*;
use inkv5_client_lib::traits::meta_transaction::*;
use inkv5_client_lib::traits::rollup_client::*;

type E2EResult<T> = std::result::Result<T, Box<dyn std::error::Error>>;

async fn alice_instantiates_raffle_manager<Client>(
    client: &mut Client,
) -> InstantiationResult<
    DefaultEnvironment,
    <Client as ContractsBackend<DefaultEnvironment>>::EventLog,
>
where
    Client: E2EBackend,
    <Client as ContractsBackend<DefaultEnvironment>>::Error: Debug,
{
    let mut lotto_constructor = lotto_registration_manager_contract::ContractRef::new();
    let contract = client
        .instantiate(
            "lotto_registration_manager_contract",
            &ink_e2e::alice(),
            &mut lotto_constructor,
        )
        .submit()
        .await
        .expect("instantiate failed");
    contract
}

async fn alice_configures_raffle_manager<Client>(
    client: &mut Client,
    contract: &InstantiationResult<
        DefaultEnvironment,
        <Client as ContractsBackend<DefaultEnvironment>>::EventLog,
    >,
    config: Config,
    registration_contracts: Vec<RegistrationContractId>,
) where
    Client: E2EBackend,
    <Client as ContractsBackend<DefaultEnvironment>>::Error: Debug,
{
    let set_config = contract
        .call_builder::<lotto_registration_manager_contract::Contract>()
        .set_config(config);
    client
        .call(&ink_e2e::alice(), &set_config)
        .submit()
        .await
        .expect("set config failed");

    let set_registration_contracts = contract
        .call_builder::<lotto_registration_manager_contract::Contract>()
        .set_registration_contracts(registration_contracts.clone());

    client
        .call(&ink_e2e::alice(), &set_registration_contracts)
        .submit()
        .await
        .expect("set registration contracts failed");

    let min_number_salts = registration_contracts.len() as u8;
    let set_min_number_salts = contract
        .call_builder::<lotto_registration_manager_contract::Contract>()
        .set_min_number_salts(min_number_salts);

    client
        .call(&ink_e2e::alice(), &set_min_number_salts)
        .submit()
        .await
        .expect("set minimum number of salts failed");
}

async fn alice_grants_bob_as_attestor<Client>(
    client: &mut Client,
    contract: &InstantiationResult<
        DefaultEnvironment,
        <Client as ContractsBackend<DefaultEnvironment>>::EventLog,
    >,
) where
    Client: E2EBackend,
    <Client as ContractsBackend<DefaultEnvironment>>::Error: Debug,
{
    // bob is granted as attestor
    let bob_address = ink::primitives::AccountId::from(ink_e2e::bob().public_key().0);
    let grant_role = contract
        .call_builder::<lotto_registration_manager_contract::Contract>()
        .grant_role(ATTESTOR_ROLE, bob_address);
    client
        .call(&ink_e2e::alice(), &grant_role)
        .submit()
        .await
        .expect("grant bob as attestor failed");
}

async fn alice_starts_raffle<Client>(
    client: &mut Client,
    contract: &InstantiationResult<
        DefaultEnvironment,
        <Client as ContractsBackend<DefaultEnvironment>>::EventLog,
    >,
    previous_draw_number: DrawNumber,
) where
    Client: E2EBackend,
    <Client as ContractsBackend<DefaultEnvironment>>::Error: Debug,
{
    let start_raffle = contract
        .call_builder::<lotto_registration_manager_contract::Contract>()
        .start(Some(previous_draw_number));
    client
        .call(&ink_e2e::alice(), &start_raffle)
        .submit()
        .await
        .expect("start raffle failed");

    assert_eq!(
        previous_draw_number,
        get_draw_number(client, contract).await
    );
    assert_eq!(
        raffle_manager::Status::Started,
        get_manager_status(client, contract).await
    );
}

async fn attestor_sends_config_propagated<Client>(
    client: &mut Client,
    contract: &InstantiationResult<
        DefaultEnvironment,
        <Client as ContractsBackend<DefaultEnvironment>>::EventLog,
    >,
    registration_contracts: Vec<RegistrationContractId>,
    queue_head: u32,
) where
    Client: E2EBackend,
    <Client as ContractsBackend<DefaultEnvironment>>::Error: Debug,
{
    let config_hash: [u8; 32] =
        hex::decode("1af688b7e4ccbd51529a15d28753270a04adf361d4eb1cbd9553ef19d353c656")
            .expect("hex decode failed")
            .try_into()
            .expect("incorrect length");
    let payload = LottoManagerResponseMessage::ConfigPropagated(
        registration_contracts.clone(),
        config_hash.into(),
    );

    let actions = vec![
        HandleActionInput::Reply(payload.encode()),
        HandleActionInput::SetQueueHead(queue_head),
    ];
    let rollup_cond_eq = contract
        .call_builder::<lotto_registration_manager_contract::Contract>()
        .rollup_cond_eq(vec![], vec![], actions.clone());

    /*
           let result = client.call_dry_run(&ink_e2e::bob(), &rollup_cond_eq, 0, None).await;
           assert_eq!(
               result.debug_message(),
               "only attestor should be able to send messages"
           );
    */

    let _result = client
        .call(&ink_e2e::bob(), &rollup_cond_eq)
        .submit()
        .await
        .expect("send config propagated failed");
    // two events : MessageProcessedTo and RaffleDone
    //assert!(result.contains_event("Contracts", "ContractEmitted"));
}

async fn attestor_sends_all_registrations_open<Client>(
    client: &mut Client,
    contract: &InstantiationResult<
        DefaultEnvironment,
        <Client as ContractsBackend<DefaultEnvironment>>::EventLog,
    >,
    draw_number: DrawNumber,
    registration_contracts: Vec<RegistrationContractId>,
    queue_head: u32,
) where
    Client: E2EBackend,
    <Client as ContractsBackend<DefaultEnvironment>>::Error: Debug,
{
    let payload =
        LottoManagerResponseMessage::RegistrationsOpen(draw_number, registration_contracts.clone());

    let actions = vec![
        HandleActionInput::Reply(payload.encode()),
        HandleActionInput::SetQueueHead(queue_head),
    ];
    let rollup_cond_eq = contract
        .call_builder::<lotto_registration_manager_contract::Contract>()
        .rollup_cond_eq(vec![], vec![], actions.clone());

    let _result = client
        .call(&ink_e2e::bob(), &rollup_cond_eq)
        .submit()
        .await
        .expect("send config propagated failed");
    // two events : MessageProcessedTo and RaffleDone
    //assert!(result.contains_event("Contracts", "ContractEmitted"));
}

async fn alice_close_registrations<Client>(
    client: &mut Client,
    contract: &InstantiationResult<
        DefaultEnvironment,
        <Client as ContractsBackend<DefaultEnvironment>>::EventLog,
    >,
) where
    Client: E2EBackend,
    <Client as ContractsBackend<DefaultEnvironment>>::Error: Debug,
{
    let stop_raffle = contract
        .call_builder::<lotto_registration_manager_contract::Contract>()
        .close_registrations();
    client
        .call(&ink_e2e::alice(), &stop_raffle)
        .submit()
        .await
        .expect("stop raffle failed");
}

async fn attestor_sends_all_registrations_closed<Client>(
    client: &mut Client,
    contract: &InstantiationResult<
        DefaultEnvironment,
        <Client as ContractsBackend<DefaultEnvironment>>::EventLog,
    >,
    draw_number: DrawNumber,
    registration_contracts: Vec<RegistrationContractId>,
    queue_head: u32,
) where
    Client: E2EBackend,
    <Client as ContractsBackend<DefaultEnvironment>>::Error: Debug,
{
    let payload = LottoManagerResponseMessage::RegistrationsClosed(
        draw_number,
        registration_contracts.clone(),
    );

    let actions = vec![
        HandleActionInput::Reply(payload.encode()),
        HandleActionInput::SetQueueHead(queue_head),
    ];
    let rollup_cond_eq = contract
        .call_builder::<lotto_registration_manager_contract::Contract>()
        .rollup_cond_eq(vec![], vec![], actions.clone());

    let _result = client
        .call(&ink_e2e::bob(), &rollup_cond_eq)
        .submit()
        .await
        .expect("send registration closed failed");
    // two events : MessageProcessedTo and RaffleDone
    //assert!(result.contains_event("Contracts", "ContractEmitted"));
}

async fn attestor_sends_salts<Client>(
    client: &mut Client,
    contract: &InstantiationResult<
        DefaultEnvironment,
        <Client as ContractsBackend<DefaultEnvironment>>::EventLog,
    >,
    draw_number: DrawNumber,
    contract_salts: Vec<(RegistrationContractId, Salt)>,
    queue_head: u32,
) where
    Client: E2EBackend,
    <Client as ContractsBackend<DefaultEnvironment>>::Error: Debug,
{
    let payload = LottoManagerResponseMessage::SaltGenerated(draw_number, contract_salts.clone());

    let actions = vec![
        HandleActionInput::Reply(payload.encode()),
        HandleActionInput::SetQueueHead(queue_head),
    ];
    let rollup_cond_eq = contract
        .call_builder::<lotto_registration_manager_contract::Contract>()
        .rollup_cond_eq(vec![], vec![], actions.clone());

    let _result = client
        .call(&ink_e2e::bob(), &rollup_cond_eq)
        .submit()
        .await
        .expect("save salts failed");
    // two events : MessageProcessedTo and RaffleDone
    //assert!(result.contains_event("Contracts", "ContractEmitted"));
}

async fn attestor_sends_winning_numbers<Client>(
    client: &mut Client,
    contract: &InstantiationResult<
        DefaultEnvironment,
        <Client as ContractsBackend<DefaultEnvironment>>::EventLog,
    >,
    draw_number: DrawNumber,
    numbers: Vec<Number>,
    config_salt_hash: [u8; 32],
    queue_head: u32,
) where
    Client: E2EBackend,
    <Client as ContractsBackend<DefaultEnvironment>>::Error: Debug,
{
    let payload = LottoManagerResponseMessage::WinningNumbers(
        draw_number,
        numbers.clone(),
        config_salt_hash.into(),
    );

    let actions = vec![
        HandleActionInput::Reply(payload.encode()),
        HandleActionInput::SetQueueHead(queue_head),
    ];
    let rollup_cond_eq = contract
        .call_builder::<lotto_registration_manager_contract::Contract>()
        .rollup_cond_eq(vec![], vec![], actions.clone());

    let _result = client
        .call(&ink_e2e::bob(), &rollup_cond_eq)
        .submit()
        .await
        .expect("send result failed");
    // two events : MessageProcessedTo and RaffleDone
    //assert!(result.contains_event("Contracts", "ContractEmitted"));
}

async fn attestor_sends_winners<Client>(
    client: &mut Client,
    contract: &InstantiationResult<
        DefaultEnvironment,
        <Client as ContractsBackend<DefaultEnvironment>>::EventLog,
    >,
    draw_number: DrawNumber,
    winners: Winners,
    numbers_hash: [u8; 32],
    queue_head: u32,
) where
    Client: E2EBackend,
    <Client as ContractsBackend<DefaultEnvironment>>::Error: Debug,
{
    let payload = LottoManagerResponseMessage::Winners(
        draw_number,
        winners.0.clone(),
        winners.1.clone(),
        numbers_hash.into(),
    );

    let actions = vec![
        HandleActionInput::Reply(payload.encode()),
        HandleActionInput::SetQueueHead(queue_head),
    ];
    let rollup_cond_eq = contract
        .call_builder::<lotto_registration_manager_contract::Contract>()
        .rollup_cond_eq(vec![], vec![], actions.clone());

    let _result = client
        .call(&ink_e2e::bob(), &rollup_cond_eq)
        .submit()
        .await
        .expect("send winners failed");
    // two events : MessageProcessedTo and RaffleDone
    //assert!(result.contains_event("Contracts", "ContractEmitted"));
}

async fn attestor_sends_results_propagated<Client>(
    client: &mut Client,
    contract: &InstantiationResult<
        DefaultEnvironment,
        <Client as ContractsBackend<DefaultEnvironment>>::EventLog,
    >,
    draw_number: DrawNumber,
    registration_contracts: Vec<RegistrationContractId>,
    numbers_hash: [u8; 32],
    queue_head: u32,
) where
    Client: E2EBackend,
    <Client as ContractsBackend<DefaultEnvironment>>::Error: Debug,
{
    let payload = LottoManagerResponseMessage::ResultsPropagated(
        draw_number,
        registration_contracts.clone(),
        numbers_hash.into(),
    );

    let actions = vec![
        HandleActionInput::Reply(payload.encode()),
        HandleActionInput::SetQueueHead(queue_head),
    ];
    let rollup_cond_eq = contract
        .call_builder::<lotto_registration_manager_contract::Contract>()
        .rollup_cond_eq(vec![], vec![], actions.clone());

    /*
    let result = client
        .call_dry_run(&ink_e2e::bob(), &rollup_cond_eq, 0, None)
        .await;
    assert_eq!(
        result.debug_message(),
        "only attestor should be able to send messages"
    );
     */
    let _result = client
        .call(&ink_e2e::bob(), &rollup_cond_eq)
        .submit()
        .await
        .expect("send results propagated failed");
    // two events : MessageProcessedTo and RaffleDone
    //assert!(result.contains_event("Contracts", "ContractEmitted"));
}

async fn get_draw_number<Client>(
    client: &mut Client,
    contract: &InstantiationResult<
        DefaultEnvironment,
        <Client as ContractsBackend<DefaultEnvironment>>::EventLog,
    >,
) -> DrawNumber
where
    Client: E2EBackend,
    <Client as ContractsBackend<DefaultEnvironment>>::Error: Debug,
{
    let get_draw_number = contract
        .call_builder::<lotto_registration_manager_contract::Contract>()
        .get_draw_number();

    client
        .call(&ink_e2e::alice(), &get_draw_number)
        .dry_run()
        .await
        .expect("fail to get the draw number")
        .return_value()
        .expect("fail to get the draw number")
}

async fn get_manager_status<Client: E2EBackend>(
    client: &mut Client,
    contract: &InstantiationResult<
        DefaultEnvironment,
        <Client as ContractsBackend<DefaultEnvironment>>::EventLog,
    >,
) -> raffle_manager::Status
where
    Client: E2EBackend,
    <Client as ContractsBackend<DefaultEnvironment>>::Error: Debug,
{
    let get_status = contract
        .call_builder::<lotto_registration_manager_contract::Contract>()
        .get_status();

    client
        .call(&ink_e2e::alice(), &get_status)
        .dry_run()
        .await
        .expect("fail to get the status")
        .return_value()
        .expect("fail to get the status")
}

async fn can_close_registrations<Client: E2EBackend>(
    client: &mut Client,
    contract: &InstantiationResult<
        DefaultEnvironment,
        <Client as ContractsBackend<DefaultEnvironment>>::EventLog,
    >,
) -> bool
where
    Client: E2EBackend,
    <Client as ContractsBackend<DefaultEnvironment>>::Error: Debug,
{
    let can_close_registrations = contract
        .call_builder::<lotto_registration_manager_contract::Contract>()
        .can_close_registrations();

    client
        .call(&ink_e2e::alice(), &can_close_registrations)
        .dry_run()
        .await
        .expect("fail to query can_close_registrations")
        .return_value()
        .expect("fail to query can_close_registrations")
}

async fn has_pending_message<Client: E2EBackend>(
    client: &mut Client,
    contract: &InstantiationResult<
        DefaultEnvironment,
        <Client as ContractsBackend<DefaultEnvironment>>::EventLog,
    >,
) -> bool
where
    Client: E2EBackend,
    <Client as ContractsBackend<DefaultEnvironment>>::Error: Debug,
{
    let has_pending_message = contract
        .call_builder::<lotto_registration_manager_contract::Contract>()
        .has_pending_message();

    client
        .call(&ink_e2e::alice(), &has_pending_message)
        .dry_run()
        .await
        .expect("fail to query has_pending_message")
        .return_value()
}

async fn get_results<Client: E2EBackend>(
    client: &mut Client,
    contract: &InstantiationResult<
        DefaultEnvironment,
        <Client as ContractsBackend<DefaultEnvironment>>::EventLog,
    >,
    draw_number: DrawNumber,
) -> Option<Vec<Number>>
where
    Client: E2EBackend,
    <Client as ContractsBackend<DefaultEnvironment>>::Error: Debug,
{
    let get_results = contract
        .call_builder::<lotto_registration_manager_contract::Contract>()
        .get_results(draw_number);

    client
        .call(&ink_e2e::alice(), &get_results)
        .dry_run()
        .await
        .expect("fail to query get_results")
        .return_value()
}

async fn get_winners<Client: E2EBackend>(
    client: &mut Client,
    contract: &InstantiationResult<
        DefaultEnvironment,
        <Client as ContractsBackend<DefaultEnvironment>>::EventLog,
    >,
    draw_number: DrawNumber,
) -> Option<Winners>
where
    Client: E2EBackend,
    <Client as ContractsBackend<DefaultEnvironment>>::Error: Debug,
{
    let get_winners = contract
        .call_builder::<lotto_registration_manager_contract::Contract>()
        .get_winners(draw_number);

    client
        .call(&ink_e2e::alice(), &get_winners)
        .dry_run()
        .await
        .expect("fail to query get_winners")
        .return_value()
}

async fn get_messages_in_queue<Client: E2EBackend>(
    client: &mut Client,
    contract: &InstantiationResult<
        DefaultEnvironment,
        <Client as ContractsBackend<DefaultEnvironment>>::EventLog,
    >,
) -> Vec<LottoManagerRequestMessage>
where
    Client: E2EBackend,
    <Client as ContractsBackend<DefaultEnvironment>>::Error: Debug,
{
    const QUEUE_PREFIX: &[u8] = b"q/";
    const QUEUE_HEAD_KEY: &[u8] = b"_head";
    const QUEUE_TAIL_KEY: &[u8] = b"_tail";

    let get_queue_head = contract
        .call_builder::<lotto_registration_manager_contract::Contract>()
        .get_value([QUEUE_PREFIX, QUEUE_HEAD_KEY].concat());

    let queue_head: Option<Vec<u8>> = client
        .call(&ink_e2e::alice(), &get_queue_head)
        .dry_run()
        .await
        .expect("fail to query get_queue_head")
        .return_value();

    let queue_head = match queue_head {
        Some(v) => u32::decode(&mut v.as_slice()).ok().unwrap_or_default(),
        None => 0,
    };

    let get_queue_tail = contract
        .call_builder::<lotto_registration_manager_contract::Contract>()
        .get_value([QUEUE_PREFIX, QUEUE_TAIL_KEY].concat());

    let queue_tail: Option<Vec<u8>> = client
        .call(&ink_e2e::alice(), &get_queue_tail)
        .dry_run()
        .await
        .expect("fail to query get_queue_tail")
        .return_value();

    let queue_tail = match queue_tail {
        Some(v) => u32::decode(&mut v.as_slice()).ok().unwrap_or_default(),
        None => 0,
    };

    let mut messages = Vec::new();
    for i in queue_head..queue_tail {
        let get_message = contract
            .call_builder::<lotto_registration_manager_contract::Contract>()
            .get_value([QUEUE_PREFIX, &i.encode()].concat());

        let message: Option<Vec<u8>> = client
            .call(&ink_e2e::alice(), &get_message)
            .dry_run()
            .await
            .expect("fail to query get_queue_tail")
            .return_value();

        if let Some(v) = message {
            if let Some(m) = LottoManagerRequestMessage::decode(&mut v.as_slice()).ok() {
                messages.push(m);
            }
        };
    }
    messages
}

#[ink_e2e::test]
async fn test_raffles<Client: E2EBackend>(mut client: Client) -> E2EResult<()> {
    // given
    let contract = alice_instantiates_raffle_manager(&mut client).await;

    let registration_contracts = vec![101, 102, 103];

    let config = Config {
        nb_numbers: 4,
        min_number: 1,
        max_number: 50,
    };

    // configure the raffle
    alice_configures_raffle_manager(
        &mut client,
        &contract,
        config.clone(),
        registration_contracts.clone(),
    )
    .await;

    // bob is granted as attestor
    alice_grants_bob_as_attestor(&mut client, &contract).await;

    assert_eq!(0, get_draw_number(&mut client, &contract).await);
    assert_eq!(
        raffle_manager::Status::NotStarted,
        get_manager_status(&mut client, &contract).await
    );

    // check the message queue
    assert_eq!(false, has_pending_message(&mut client, &contract).await);

    // start the raffle
    alice_starts_raffle(&mut client, &contract, 10).await;

    // check the message queue
    assert_eq!(true, has_pending_message(&mut client, &contract).await);
    let messages = get_messages_in_queue(&mut client, &contract).await;
    assert_eq!(messages.len(), 1);
    assert_eq!(
        messages[0],
        LottoManagerRequestMessage::PropagateConfig(config.clone(), vec![101, 102, 103])
    );

    let mut queue_head = 1;

    // propagate the config
    attestor_sends_config_propagated(&mut client, &contract, vec![], queue_head).await;
    queue_head += 1;

    // the registrations are not open because all contracts are not synched
    assert_eq!(10, get_draw_number(&mut client, &contract).await);
    assert_eq!(
        raffle_manager::Status::Started,
        get_manager_status(&mut client, &contract).await
    );

    // check the message in the queue
    let messages = get_messages_in_queue(&mut client, &contract).await;
    assert_eq!(messages.len(), 1);
    assert_eq!(
        messages[0],
        LottoManagerRequestMessage::PropagateConfig(config.clone(), vec![101, 102, 103])
    );

    // propagate the missing config
    attestor_sends_config_propagated(&mut client, &contract, vec![101, 103], queue_head).await;
    queue_head += 1;

    // the registrations are not open because all contracts are not synched
    assert_eq!(10, get_draw_number(&mut client, &contract).await);
    assert_eq!(
        raffle_manager::Status::Started,
        get_manager_status(&mut client, &contract).await
    );

    // check the message in the queue
    let messages = get_messages_in_queue(&mut client, &contract).await;
    assert_eq!(messages.len(), 1);
    assert_eq!(
        messages[0],
        LottoManagerRequestMessage::PropagateConfig(config.clone(), vec![102])
    );

    // propagate the missing config
    attestor_sends_config_propagated(&mut client, &contract, vec![102], queue_head).await;
    queue_head += 1;

    // the registrations are now open
    let draw_number = get_draw_number(&mut client, &contract).await;
    assert_eq!(draw_number, 11);
    assert_eq!(
        raffle_manager::Status::RegistrationsOpen,
        get_manager_status(&mut client, &contract).await
    );

    // check the messages in the queue
    let messages = get_messages_in_queue(&mut client, &contract).await;
    assert_eq!(messages.len(), 1);
    assert_eq!(
        messages[0],
        LottoManagerRequestMessage::OpenRegistrations(draw_number, vec![101, 102, 103])
    );

    // propagate registrations are open
    attestor_sends_all_registrations_open(&mut client, &contract, draw_number, vec![], queue_head)
        .await;
    queue_head += 1;

    // all contracts are not synched
    // check the messages in the queue
    let messages = get_messages_in_queue(&mut client, &contract).await;
    assert_eq!(messages.len(), 1);
    assert_eq!(
        messages[0],
        LottoManagerRequestMessage::OpenRegistrations(draw_number, vec![101, 102, 103])
    );

    // propagate all registrations are open
    attestor_sends_all_registrations_open(
        &mut client,
        &contract,
        draw_number,
        vec![101, 102, 103],
        queue_head,
    )
    .await;
    queue_head += 1;

    // all contracts are synched
    // check the messages in the queue
    assert_eq!(false, has_pending_message(&mut client, &contract).await);
    let messages = get_messages_in_queue(&mut client, &contract).await;
    assert_eq!(messages.len(), 0);

    assert_eq!(
        raffle_manager::Status::RegistrationsOpen,
        get_manager_status(&mut client, &contract).await
    );

    // stop the registrations
    assert_eq!(true, can_close_registrations(&mut client, &contract).await);
    alice_close_registrations(&mut client, &contract).await;
    assert_eq!(
        raffle_manager::Status::RegistrationsClosed,
        get_manager_status(&mut client, &contract).await
    );

    // propagate registrations are closed
    attestor_sends_all_registrations_closed(
        &mut client,
        &contract,
        draw_number,
        vec![103],
        queue_head,
    )
    .await;
    queue_head += 1;

    // all contracts are not synched
    // check the message in the queue
    assert_eq!(true, has_pending_message(&mut client, &contract).await);
    let messages = get_messages_in_queue(&mut client, &contract).await;
    assert_eq!(messages.len(), 1);
    assert_eq!(
        messages[0],
        LottoManagerRequestMessage::CloseRegistrations(draw_number, vec![101, 102])
    );

    // propagate registrations are closed
    attestor_sends_all_registrations_closed(
        &mut client,
        &contract,
        draw_number,
        vec![101, 102],
        queue_head,
    )
    .await;
    queue_head += 1;

    // all contracts are synched, generate the salts
    // check the message in the queue
    let messages = get_messages_in_queue(&mut client, &contract).await;
    assert_eq!(messages.len(), 1);
    assert_eq!(
        messages[0],
        LottoManagerRequestMessage::GenerateSalt(draw_number, vec![101, 102, 103])
    );
    // send the salts
    attestor_sends_salts(
        &mut client,
        &contract,
        draw_number,
        vec![(103, [3u8; 32].to_vec())],
        queue_head,
    )
    .await;
    queue_head += 1;

    // all contracts are not synched
    // check the message in the queue
    assert_eq!(true, has_pending_message(&mut client, &contract).await);
    let messages = get_messages_in_queue(&mut client, &contract).await;
    assert_eq!(messages.len(), 1);
    assert_eq!(
        messages[0],
        LottoManagerRequestMessage::GenerateSalt(draw_number, vec![101, 102])
    );
    // send the salts
    attestor_sends_salts(
        &mut client,
        &contract,
        draw_number,
        vec![(101, [1u8; 32].to_vec()), (102, [2u8; 32].to_vec())],
        queue_head,
    )
    .await;
    queue_head += 1;

    // all contracts are synched, send the results
    // check the message in the queue
    let generated_salt: [u8; 32] = [
        101, 183, 131, 128, 194, 210, 6, 186, 135, 158, 6, 247, 69, 144, 120, 98, 45, 169, 95, 8,
        91, 222, 225, 175, 72, 14, 187, 148, 7, 210, 251, 70,
    ];
    let messages = get_messages_in_queue(&mut client, &contract).await;
    assert_eq!(messages.len(), 1);
    assert_eq!(
        messages[0],
        LottoManagerRequestMessage::DrawNumbers(draw_number, config, generated_salt.to_vec())
    );

    let config_salt_hash: [u8; 32] =
        hex::decode("94e1fa775bc259340a60dda2a2f10e911b6343e6ab0932726c738097c8fc3521")
            .expect("hex decode failed")
            .try_into()
            .expect("incorrect length");

    let numbers: Vec<Number> = vec![5, 40, 8, 2];
    let numbers_hash: [u8; 32] =
        hex::decode("0c70b0cb9b2d87768d1efacd6ca6a89be08a4c8c70855b54455f7f46caeeb155")
            .expect("hex decode failed")
            .try_into()
            .expect("incorrect length");

    // send the winning numbers
    attestor_sends_winning_numbers(
        &mut client,
        &contract,
        draw_number,
        numbers.clone(),
        config_salt_hash,
        queue_head,
    )
    .await;
    queue_head += 1;

    assert_eq!(
        raffle_manager::Status::WaitingWinner,
        get_manager_status(&mut client, &contract).await
    );

    // check the message in the queue
    let messages = get_messages_in_queue(&mut client, &contract).await;
    assert_eq!(messages.len(), 1);
    assert_eq!(
        messages[0],
        LottoManagerRequestMessage::CheckWinners(draw_number, numbers.clone())
    );

    // send no winner
    let winners: Winners = (vec![], vec![]);
    attestor_sends_winners(
        &mut client,
        &contract,
        draw_number,
        winners,
        numbers_hash.clone(),
        queue_head,
    )
    .await;
    queue_head += 1;

    // check the status
    assert_eq!(
        raffle_manager::Status::DrawFinished,
        get_manager_status(&mut client, &contract).await
    );

    // check the results
    assert_eq!(
        Some(numbers.clone()),
        get_results(&mut client, &contract, draw_number).await
    );

    // check the winners
    assert_eq!(None, get_winners(&mut client, &contract, draw_number).await);

    // check the message in the queue
    let messages = get_messages_in_queue(&mut client, &contract).await;
    assert_eq!(messages.len(), 1);
    assert_eq!(
        messages[0],
        LottoManagerRequestMessage::PropagateResults(
            draw_number,
            numbers.clone(),
            false,
            vec![101, 102, 103]
        )
    );

    // propagate the results
    attestor_sends_results_propagated(
        &mut client,
        &contract,
        draw_number,
        vec![],
        numbers_hash.clone(),
        queue_head,
    )
    .await;
    queue_head += 1;

    // all contracts are not synched
    // check the message in the queue
    let messages = get_messages_in_queue(&mut client, &contract).await;
    assert_eq!(messages.len(), 1);
    assert_eq!(
        messages[0],
        LottoManagerRequestMessage::PropagateResults(
            draw_number,
            numbers.clone(),
            false,
            vec![101, 102, 103]
        )
    );

    // propagate the results
    attestor_sends_results_propagated(
        &mut client,
        &contract,
        draw_number,
        vec![101, 102, 103],
        numbers_hash.clone(),
        queue_head,
    )
    .await;
    queue_head += 1;

    // all contracts are synched
    // new draw number
    let draw_number = get_draw_number(&mut client, &contract).await;
    assert_eq!(draw_number, 12);
    assert_eq!(
        raffle_manager::Status::RegistrationsOpen,
        get_manager_status(&mut client, &contract).await
    );

    // check the message in the queue
    // the registrations are opened again
    let messages = get_messages_in_queue(&mut client, &contract).await;
    assert_eq!(messages.len(), 1);
    assert_eq!(
        messages[0],
        LottoManagerRequestMessage::OpenRegistrations(draw_number, vec![101, 102, 103])
    );

    // propagate all registrations are open
    attestor_sends_all_registrations_open(
        &mut client,
        &contract,
        draw_number,
        vec![101, 102, 103],
        queue_head,
    )
    .await;
    queue_head += 1;

    // stop the registrations
    assert_eq!(true, can_close_registrations(&mut client, &contract).await);
    alice_close_registrations(&mut client, &contract).await;

    // propagate all registrations are closed
    attestor_sends_all_registrations_closed(
        &mut client,
        &contract,
        draw_number,
        vec![101, 102, 103],
        queue_head,
    )
    .await;
    queue_head += 1;

    // send the salts
    attestor_sends_salts(
        &mut client,
        &contract,
        draw_number,
        vec![
            (101, [1u8; 32].to_vec()),
            (102, [2u8; 32].to_vec()),
            (103, [3u8; 32].to_vec()),
        ],
        queue_head,
    )
    .await;
    queue_head += 1;

    // all contracts are synched, send the results
    // check the message in the queue
    let generated_salt: [u8; 32] = [
        94, 193, 212, 179, 22, 80, 18, 236, 194, 56, 99, 20, 16, 125, 123, 20, 14, 26, 212, 42, 96,
        187, 51, 110, 129, 113, 120, 162, 223, 50, 36, 79,
    ];
    let messages = get_messages_in_queue(&mut client, &contract).await;
    assert_eq!(messages.len(), 1);
    assert_eq!(
        messages[0],
        LottoManagerRequestMessage::DrawNumbers(draw_number, config, generated_salt.to_vec())
    );

    let config_salt_hash: [u8; 32] =
        hex::decode("c6aac4e20883f260241bbae6963be7ae78d9cc0136f0a2409aa40e0fdef11cb1")
            .expect("hex decode failed")
            .try_into()
            .expect("incorrect length");

    let numbers: Vec<Number> = vec![15, 20, 1, 31];
    let numbers_hash: [u8; 32] =
        hex::decode("2a8b8764a606b81095017886e6e46482bf2f248969279ea3c063265b060794ae")
            .expect("hex decode failed")
            .try_into()
            .expect("incorrect length");

    // send the winning numbers
    attestor_sends_winning_numbers(
        &mut client,
        &contract,
        draw_number,
        numbers.clone(),
        config_salt_hash,
        queue_head,
    )
    .await;
    queue_head += 1;

    // send a winner
    let dave_address = ink_e2e::dave().public_key().0;
    let winners: Winners = (vec![dave_address], vec![]);
    attestor_sends_winners(
        &mut client,
        &contract,
        draw_number,
        winners,
        numbers_hash.clone(),
        queue_head,
    )
    .await;
    queue_head += 1;

    // check the status
    assert_eq!(
        raffle_manager::Status::DrawFinished,
        get_manager_status(&mut client, &contract).await
    );

    // check the results
    assert_eq!(
        Some(numbers.clone()),
        get_results(&mut client, &contract, draw_number).await
    );

    // check the winners
    assert_eq!(
        Some((vec![dave_address], vec![])),
        get_winners(&mut client, &contract, draw_number).await
    );

    // propagate the results
    attestor_sends_results_propagated(
        &mut client,
        &contract,
        draw_number,
        vec![101, 102, 103],
        numbers_hash.clone(),
        queue_head,
    )
    .await;

    // all contracts are synched
    // There is a winner the lotto is stopped

    let draw_number = get_draw_number(&mut client, &contract).await;
    assert_eq!(draw_number, 12);
    assert_eq!(
        raffle_manager::Status::DrawFinished,
        get_manager_status(&mut client, &contract).await
    );

    // check no message in the queue
    let messages = get_messages_in_queue(&mut client, &contract).await;
    assert_eq!(messages.len(), 0);

    Ok(())
}

#[ink_e2e::test]
async fn test_bad_attestor(mut client: ink_e2e::Client<C, E>) -> E2EResult<()> {
    // given
    let contract = alice_instantiates_raffle_manager(&mut client).await;

    // bob is not granted as attestor => it should not be able to send a message
    let rollup_cond_eq = contract
        .call_builder::<lotto_registration_manager_contract::Contract>()
        .rollup_cond_eq(vec![], vec![], vec![]);
    let result = client.call(&ink_e2e::bob(), &rollup_cond_eq).submit().await;
    assert!(
        result.is_err(),
        "only attestor should be able to send messages"
    );

    // bob is granted as attestor
    alice_grants_bob_as_attestor(&mut client, &contract).await;

    // then bob is able to send a message
    let _result = client
        .call(&ink_e2e::bob(), &rollup_cond_eq)
        .submit()
        .await
        .expect("rollup cond eq failed");
    // no event
    //assert!(!result.contains_event("Contracts", "ContractEmitted"));

    Ok(())
}

#[ink_e2e::test]
async fn test_bad_messages(mut client: ink_e2e::Client<C, E>) -> E2EResult<()> {
    // given
    let contract = alice_instantiates_raffle_manager(&mut client).await;

    // bob is granted as attestor
    alice_grants_bob_as_attestor(&mut client, &contract).await;

    let actions = vec![HandleActionInput::Reply(58u128.encode())];
    let rollup_cond_eq = contract
        .call_builder::<lotto_registration_manager_contract::Contract>()
        .rollup_cond_eq(vec![], vec![], actions.clone());
    let result = client.call(&ink_e2e::bob(), &rollup_cond_eq).submit().await;
    assert!(
        result.is_err(),
        "we should not be able to proceed bad messages"
    );

    Ok(())
}

///
/// Test the meta transactions
/// Alice is the owner
/// Bob is the attestor
/// Charlie is the sender (ie the payer)
///
#[ink_e2e::test]
async fn test_meta_tx_rollup_cond_eq(mut client: ink_e2e::Client<C, E>) -> E2EResult<()> {
    let contract = alice_instantiates_raffle_manager(&mut client).await;

    // Bob is the attestor
    // use the ecsda account because we are not able to verify the sr25519 signature
    let bob_keypair = subxt_signer::ecdsa::dev::bob();
    let from = ink::primitives::AccountId::from(bob_keypair.public_key().to_account_id().0);

    // add the role => it should succeed
    let grant_role = contract
        .call_builder::<lotto_registration_manager_contract::Contract>()
        .grant_role(ATTESTOR_ROLE, from);
    client
        .call(&ink_e2e::alice(), &grant_role)
        .submit()
        .await
        .expect("grant the attestor failed");

    // prepare the meta transaction
    let data = RollupCondEqMethodParams::encode(&(vec![], vec![], vec![]));
    let prepare_meta_tx = contract
        .call_builder::<lotto_registration_manager_contract::Contract>()
        .prepare(from, data.clone());
    let result = client
        .call(&ink_e2e::charlie(), &prepare_meta_tx)
        .dry_run()
        .await
        .expect("We should be able to prepare the meta tx");

    let (request, _hash) = result
        .return_value()
        .expect("Expected value when preparing meta tx");

    assert_eq!(0, request.nonce);
    assert_eq!(from, request.from);
    assert_eq!(&data, &request.data);

    // Bob signs the message
    let signature = bob_keypair.sign(&ink::scale::Encode::encode(&request)).0;

    // do the meta tx: charlie sends the message
    let meta_tx_rollup_cond_eq = contract
        .call_builder::<lotto_registration_manager_contract::Contract>()
        .meta_tx_rollup_cond_eq(request.clone(), signature);
    client
        .call(&ink_e2e::charlie(), &meta_tx_rollup_cond_eq)
        .submit()
        .await
        .expect("meta tx rollup cond eq should not failed");

    // do it again => it must fail
    let result = client
        .call(&ink_e2e::charlie(), &meta_tx_rollup_cond_eq)
        .submit()
        .await;
    assert!(
        result.is_err(),
        "This message should not be proceed because the nonce is obsolete"
    );

    Ok(())
}
