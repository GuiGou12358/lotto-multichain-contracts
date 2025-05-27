use std::fmt::Debug;
use ink::env::DefaultEnvironment;
use ink::primitives::AccountId;
use ink_e2e::subxt::tx::Signer;
use ink_e2e::{ContractsBackend, E2EBackend, InstantiationResult, PolkadotConfig};
use ink::scale::Encode;

use lotto::config::Config;
use lotto::*;
use lotto::raffle_registration::Raffle;

use lotto_registration_contract::{lotto_registration_contract, *};

use inkv5_client_lib::traits::access_control::{AccessControl};
use inkv5_client_lib::traits::meta_transaction::{MetaTransaction};
use inkv5_client_lib::traits::rollup_client::{
    HandleActionInput, RollupClient, RollupCondEqMethodParams, ATTESTOR_ROLE
};

type E2EResult<T> = std::result::Result<T, Box<dyn std::error::Error>>;

async fn alice_instantiates_raffle_registration<Client>(
    client: &mut Client,
) -> InstantiationResult<DefaultEnvironment,  <Client as ContractsBackend<DefaultEnvironment>>::EventLog>
where
    Client: E2EBackend,
    <Client as ContractsBackend<DefaultEnvironment>>::Error: Debug,
{
    let mut lotto_constructor = lotto_registration_contract::ContractRef::new();
    let contract = client
        .instantiate(
            "lotto_registration_contract",
            &ink_e2e::alice(),
            &mut lotto_constructor,
        )
        .submit()
        .await
        .expect("instantiate failed");

    contract
}

async fn alice_grants_bob_as_attestor<Client>(
    client: &mut Client,
    contract: &InstantiationResult<DefaultEnvironment,  <Client as ContractsBackend<DefaultEnvironment>>::EventLog>,
)
where
    Client: E2EBackend,
    <Client as ContractsBackend<DefaultEnvironment>>::Error: Debug,
{
    // bob is granted as attestor
    let bob_address = ink::primitives::AccountId::from(ink_e2e::bob().public_key().0);
    let grant_role = contract.call_builder::<lotto_registration_contract::Contract>()
        .grant_role(ATTESTOR_ROLE, bob_address);
    client
        .call(&ink_e2e::alice(), &grant_role)
        .submit()
        .await
        .expect("grant bob as attestor failed");
}

async fn attestor_set_config_and_start<Client>(
    client: &mut Client,
    contract: &InstantiationResult<DefaultEnvironment,  <Client as ContractsBackend<DefaultEnvironment>>::EventLog>,
    config: Config,
    registration_contract_id: RegistrationContractId,
)
where
    Client: E2EBackend,
    <Client as ContractsBackend<DefaultEnvironment>>::Error: Debug,
{
    let payload = RequestForAction::SetConfigAndStart(config.clone(), registration_contract_id);

    let actions = vec![HandleActionInput::Reply(payload.encode())];
    let rollup_cond_eq =
        contract.call_builder::<lotto_registration_contract::Contract>()
            .rollup_cond_eq(vec![], vec![], actions.clone());

    let result = client
        .call(&ink_e2e::bob(), &rollup_cond_eq)
        .submit()
        .await
        .expect("set config failed");
    // two events : MessageProcessedTo and RaffleDone
    //assert!(result.contains_event("Contracts", "ContractEmitted"));

    // check the status
    assert_eq!(
        raffle_registration::Status::Started,
        get_status(client, contract).await
    );

    // check the registration contract id
    assert_eq!(
        registration_contract_id,
        get_registration_contract_id(client, contract).await
    );
}

async fn attestor_open_registrations<Client>(
    client: &mut Client,
    contract: &InstantiationResult<DefaultEnvironment,  <Client as ContractsBackend<DefaultEnvironment>>::EventLog>,
    draw_number: DrawNumber,
)
where
    Client: E2EBackend,
    <Client as ContractsBackend<DefaultEnvironment>>::Error: Debug,
{
    let payload = RequestForAction::OpenRegistrations(draw_number);

    let actions = vec![HandleActionInput::Reply(payload.encode())];
    let rollup_cond_eq =
        contract.call_builder::<lotto_registration_contract::Contract>()
            .rollup_cond_eq(vec![], vec![], actions.clone());

    /*
              let result = client.call_dry_run(&ink_e2e::bob(), &rollup_cond_eq, 0, None).await;
              assert_eq!(
                  result.debug_message(),
                  "Debug message"
              );
    */

    let result = client
        .call(&ink_e2e::bob(), &rollup_cond_eq)
        .submit()
        .await
        .expect("open registrations failed");
    // two events : MessageProcessedTo and RaffleDone
    //assert!(result.contains_event("Contracts", "ContractEmitted"));

    // check the draw number and the status
    assert_eq!(draw_number, get_draw_number(client, contract).await);
    assert_eq!(
        raffle_registration::Status::RegistrationsOpen,
        get_status(client, contract).await
    );
}

async fn attestor_close_registrations<Client>(
    client: &mut Client,
    contract: &InstantiationResult<DefaultEnvironment,  <Client as ContractsBackend<DefaultEnvironment>>::EventLog>,
    draw_number: DrawNumber,
)
where
    Client: E2EBackend,
    <Client as ContractsBackend<DefaultEnvironment>>::Error: Debug,
{
    let payload = RequestForAction::CloseRegistrations(draw_number);

    let actions = vec![HandleActionInput::Reply(payload.encode())];
    let rollup_cond_eq =
        contract.call_builder::<lotto_registration_contract::Contract>()
            .rollup_cond_eq(vec![], vec![], actions.clone());

    let result = client
        .call(&ink_e2e::bob(), &rollup_cond_eq)
        .submit()
        .await
        .expect("close registrations failed");
    // two events : MessageProcessedTo and RaffleDone
    //assert!(result.contains_event("Contracts", "ContractEmitted"));

    // check the draw number and the status
    assert_eq!(draw_number, get_draw_number(client, contract).await);
    assert_eq!(
        raffle_registration::Status::RegistrationsClosed,
        get_status(client, contract).await
    );
}

async fn attestor_set_results<Client>(
    client: &mut Client,
    contract: &InstantiationResult<DefaultEnvironment,  <Client as ContractsBackend<DefaultEnvironment>>::EventLog>,
    draw_number: DrawNumber,
    numbers: Vec<Number>,
    winners: Vec<AccountId>,
)
where
    Client: E2EBackend,
    <Client as ContractsBackend<DefaultEnvironment>>::Error: Debug,
{
    let payload = RequestForAction::SetResults(draw_number, numbers.clone(), winners.len() > 0);

    let actions = vec![HandleActionInput::Reply(payload.encode())];
    let rollup_cond_eq =
        contract.call_builder::<lotto_registration_contract::Contract>()
            .rollup_cond_eq(vec![], vec![], actions.clone());

    let result = client
        .call(&ink_e2e::bob(), &rollup_cond_eq)
        .submit()
        .await
        .expect("Set results failed");
    // two events : MessageProcessedTo and RaffleDone
    //assert!(result.contains_event("Contracts", "ContractEmitted"));

    // check the draw number and the status
    assert_eq!(draw_number, get_draw_number(client, contract).await);
    assert_eq!(
        raffle_registration::Status::ResultsReceived,
        get_status(client, contract).await
    );
}

async fn participates<Client>(
    client: &mut Client,
    contract: &InstantiationResult<DefaultEnvironment,  <Client as ContractsBackend<DefaultEnvironment>>::EventLog>,
    signer: &ink_e2e::Keypair,
    numbers: Vec<Number>,
)
where
    Client: E2EBackend,
    <Client as ContractsBackend<DefaultEnvironment>>::Error: Debug,
{
    let participate =
        contract.call_builder::<lotto_registration_contract::Contract>()
            .participate(numbers.clone());
    client
        .call(signer, &participate)
        .submit()
        .await
        .expect("Participate failed");
}

async fn can_participate<Client>(
    client: &mut Client,
    contract: &InstantiationResult<DefaultEnvironment,  <Client as ContractsBackend<DefaultEnvironment>>::EventLog>,
) -> bool
where
    Client: E2EBackend,
    <Client as ContractsBackend<DefaultEnvironment>>::Error: Debug,
{
    let can_participate =
        contract.call_builder::<lotto_registration_contract::Contract>()
            .can_participate();

    let result = client
        .call(&ink_e2e::alice(), &can_participate)
        .dry_run()
        .await
        .expect("fail to query can_participate")
        .return_value();

    result
}

async fn get_draw_number<Client>(
    client: &mut Client,
    contract: &InstantiationResult<DefaultEnvironment,  <Client as ContractsBackend<DefaultEnvironment>>::EventLog>,
) -> DrawNumber
where
    Client: E2EBackend,
    <Client as ContractsBackend<DefaultEnvironment>>::Error: Debug,
{
    let get_draw_number =
        contract.call_builder::<lotto_registration_contract::Contract>()
            .get_draw_number();

    client
        .call(&ink_e2e::alice(), &get_draw_number)
        .dry_run()
        .await
        .expect("Query the draw number failed")
        .return_value()
        .expect("Query the draw number failed")
}

async fn get_status<Client>(
    client: &mut Client,
    contract: &InstantiationResult<DefaultEnvironment,  <Client as ContractsBackend<DefaultEnvironment>>::EventLog>,
) -> raffle_registration::Status
where
    Client: E2EBackend,
    <Client as ContractsBackend<DefaultEnvironment>>::Error: Debug,
{
    let get_status = contract.call_builder::<lotto_registration_contract::Contract>()
        .get_status();

    client
        .call(&ink_e2e::alice(), &get_status)
        .dry_run()
        .await
        .expect("Query the status failed")
        .return_value()
        .expect("Query the status failed")
}

async fn get_registration_contract_id<Client>(
    client: &mut Client,
    contract: &InstantiationResult<DefaultEnvironment,  <Client as ContractsBackend<DefaultEnvironment>>::EventLog>,
) -> RegistrationContractId
where
    Client: E2EBackend,
    <Client as ContractsBackend<DefaultEnvironment>>::Error: Debug,
{
    let get_registration_contract_id =
        contract.call_builder::<lotto_registration_contract::Contract>()
            .get_registration_contract_id();

    client
        .call(&ink_e2e::alice(), &get_registration_contract_id)
        .dry_run()
        .await
        .expect("Query get_registration_contract_id failed")
        .return_value()
}

/*
#[ink_e2e::test(
    additional_contracts = "contracts/raffle_registration/Cargo.toml"
)]
 */
#[ink_e2e::test]
async fn test_raffles<Client: E2EBackend>(mut client: Client) -> E2EResult<()> {
    // given
    let contract_id = alice_instantiates_raffle_registration(&mut client).await;

    let config = Config {
        nb_numbers: 4,
        min_number: 1,
        max_number: 50,
    };
    let registration_contract_id = 33;

    // bob is granted as attestor
    alice_grants_bob_as_attestor(&mut client, &contract_id).await;

    assert_eq!(0, get_draw_number(&mut client, &contract_id).await);
    assert_eq!(
        raffle_registration::Status::NotStarted,
        get_status(&mut client, &contract_id).await
    );

    // configure the raffle and start the workflow
    attestor_set_config_and_start(
        &mut client,
        &contract_id,
        config.clone(),
        registration_contract_id,
    )
    .await;

    // check if the user can participate
    assert_eq!(false, can_participate(&mut client, &contract_id).await);

    // Open the registrations
    attestor_open_registrations(&mut client, &contract_id, 10).await;

    // check if the user can participate
    assert_eq!(true, can_participate(&mut client, &contract_id).await);

    // dave participates
    participates(
        &mut client,
        &contract_id,
        &ink_e2e::dave(),
        vec![5, 40, 8, 2],
    )
    .await;

    participates(
        &mut client,
        &contract_id,
        &ink_e2e::dave(),
        vec![3, 6, 7, 5],
    )
    .await;

    participates(
        &mut client,
        &contract_id,
        &ink_e2e::dave(),
        vec![12, 4, 6, 2],
    )
    .await;

    participates(
        &mut client,
        &contract_id,
        &ink_e2e::dave(),
        vec![15, 44, 4, 1],
    )
    .await;

    // charlie participates
    participates(
        &mut client,
        &contract_id,
        &ink_e2e::charlie(),
        vec![50, 3, 8, 2],
    )
    .await;

    participates(
        &mut client,
        &contract_id,
        &ink_e2e::charlie(),
        vec![34, 6, 2, 5],
    )
    .await;

    participates(
        &mut client,
        &contract_id,
        &ink_e2e::charlie(),
        vec![12, 4, 6, 4],
    )
    .await;

    // Close the registrations
    attestor_close_registrations(&mut client, &contract_id, 10).await;

    // check if the user can participate
    assert_eq!(false, can_participate(&mut client, &contract_id).await);

    // Set the results
    let numbers = vec![5, 6, 7, 8];
    let winners = vec![];
    attestor_set_results(&mut client, &contract_id, 10, numbers, winners).await;

    // check if the user can participate
    assert_eq!(false, can_participate(&mut client, &contract_id).await);

    // Open again the registrations
    attestor_open_registrations(&mut client, &contract_id, 11).await;

    // check if the user can participate
    assert_eq!(true, can_participate(&mut client, &contract_id).await);

    // dave participates
    participates(
        &mut client,
        &contract_id,
        &ink_e2e::dave(),
        vec![5, 40, 8, 2],
    )
    .await;

    participates(
        &mut client,
        &contract_id,
        &ink_e2e::dave(),
        vec![3, 6, 7, 5],
    )
    .await;

    participates(
        &mut client,
        &contract_id,
        &ink_e2e::dave(),
        vec![12, 4, 6, 2],
    )
    .await;

    participates(
        &mut client,
        &contract_id,
        &ink_e2e::dave(),
        vec![15, 44, 4, 1],
    )
    .await;

    // charlie participates
    participates(
        &mut client,
        &contract_id,
        &ink_e2e::charlie(),
        vec![50, 3, 8, 2],
    )
    .await;

    participates(
        &mut client,
        &contract_id,
        &ink_e2e::charlie(),
        vec![34, 6, 2, 5],
    )
    .await;

    participates(
        &mut client,
        &contract_id,
        &ink_e2e::charlie(),
        vec![12, 4, 6, 4],
    )
    .await;

    // Close the registrations
    attestor_close_registrations(&mut client, &contract_id, 11).await;

    // Set the results with a winner
    let numbers = vec![12, 4, 6, 4];
    let charlie_address = ink::primitives::AccountId::from(ink_e2e::charlie().public_key().0);
    let winners = vec![charlie_address];
    attestor_set_results(&mut client, &contract_id, 11, numbers, winners).await;

    Ok(())
}
/*
#[ink_e2e::test(
    additional_contracts = "contracts/raffle_registration/Cargo.toml"
)]
 */
#[ink_e2e::test]
async fn test_bad_attestor(mut client: ink_e2e::Client<C, E>) -> E2EResult<()> {
    // given
    let contract = alice_instantiates_raffle_registration(&mut client).await;

    // bob is not granted as attestor => it should not be able to send a message
    let rollup_cond_eq =
        contract.call_builder::<lotto_registration_contract::Contract>()
            .rollup_cond_eq(vec![], vec![], vec![]);
    let result = client.call(&ink_e2e::bob(), &rollup_cond_eq)
        .submit()
        .await;
    assert!(
        result.is_err(),
        "only attestor should be able to send messages"
    );

    // bob is granted as attestor
    alice_grants_bob_as_attestor(&mut client, &contract).await;

    // then bob is able to send a message
    let result = client
        .call(&ink_e2e::bob(), &rollup_cond_eq)
        .submit()
        .await
        .expect("rollup cond eq failed");
    // no event
    assert!(!result.contains_event("Contracts", "ContractEmitted"));

    Ok(())
}
/*
#[ink_e2e::test(
    additional_contracts = "contracts/raffle_registration/Cargo.toml"
)]
 */
#[ink_e2e::test]
async fn test_bad_messages(mut client: ink_e2e::Client<C, E>) -> E2EResult<()> {
    // given
    let contract = alice_instantiates_raffle_registration(&mut client).await;

    // bob is granted as attestor
    alice_grants_bob_as_attestor(&mut client, &contract).await;

    let actions = vec![HandleActionInput::Reply(58u128.encode())];
    let rollup_cond_eq =
        contract.call_builder::<lotto_registration_contract::Contract>()
            .rollup_cond_eq(vec![], vec![], actions.clone());
    let result = client.call(&ink_e2e::bob(), &rollup_cond_eq)
        .submit()
        .await;
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
///
/*
#[ink_e2e::test(
    additional_contracts = "contracts/raffle_registration/Cargo.toml"
)]
 */
#[ink_e2e::test]
async fn test_meta_tx_rollup_cond_eq(mut client: ink_e2e::Client<C, E>) -> E2EResult<()> {
    let contract = alice_instantiates_raffle_registration(&mut client).await;

    // Bob is the attestor
    // use the ecsda account because we are not able to verify the sr25519 signature
    let from = ink::primitives::AccountId::from(
        Signer::<PolkadotConfig>::account_id(&ink_e2e::subxt_signer::ecdsa::dev::bob()).0,
    );

    // add the role => it should be succeed
    let grant_role = contract.call_builder::<lotto_registration_contract::Contract>()
        .grant_role(ATTESTOR_ROLE, from);
    client
        .call(&ink_e2e::alice(), &grant_role)
        .submit()
        .await
        .expect("grant the attestor failed");

    // prepare the meta transaction
    let data = RollupCondEqMethodParams::encode(&(vec![], vec![], vec![]));
    let prepare_meta_tx =
        contract.call_builder::<lotto_registration_contract::Contract>()
            .prepare(from, data.clone());
    let result = client
        .call(&ink_e2e::bob(), &prepare_meta_tx)
        .dry_run()
        .await
        .expect("We should be able to prepare the meta tx");

    let (request, _hash) = result
        .return_value()
        .expect("Expected value when preparing meta tx");

    assert_eq!(0, request.nonce);
    assert_eq!(from, request.from);
    //assert_eq!(contract_id, request.to);
    assert_eq!(&data, &request.data);

    // Bob signs the message
    let keypair = subxt_signer::ecdsa::dev::bob();
    let signature = keypair.sign(&ink::scale::Encode::encode(&request)).0;

    // do the meta tx: charlie sends the message
    let meta_tx_rollup_cond_eq =
        contract.call_builder::<lotto_registration_contract::Contract>()
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
