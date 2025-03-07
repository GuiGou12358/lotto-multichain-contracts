extern crate alloc;

use crate::error::RaffleDrawError::{self, *};
use crate::raffle_registration_contract::{
    RaffleRegistrationContract, RaffleRegistrationStatus, RequestForAction,
};
use crate::types::*;
use alloc::vec::Vec;
use ethabi::{ParamType, Token};
use kv_session::traits::KvSession;
use phat_offchain_rollup::{clients::evm::EvmRollupClient, Action};
use pink_extension::ResultExt;
use pink_web3::keys::pink::KeyPair;

pub struct EvmContract {
    config: EvmContractConfig,
}

impl EvmContract {
    pub fn new(config: Option<EvmContractConfig>) -> Result<Self, RaffleDrawError> {
        let config = config.ok_or(EvmContractNotConfigured)?;
        Ok(Self { config })
    }

    fn connect(&self) -> Result<EvmRollupClient, RaffleDrawError> {
        let contract_id: sp_core::H160 = self.config.contract_id.into();
        let result = EvmRollupClient::new(&self.config.rpc, contract_id)
            .log_err("failed to create rollup client");

        match result {
            Ok(client) => Ok(client),
            Err(e) => {
                pink_extension::error!("Error : {:?}", e);
                ink::env::debug_println!("Error : {:?}", e);
                Err(FailedToCreateClient)
            }
        }
    }
}

impl RaffleRegistrationContract for EvmContract {
    fn do_action(
        &self,
        expected_draw_number: Option<DrawNumber>,
        expected_status: Option<RaffleRegistrationStatus>,
        action: RequestForAction,
        attest_key: &[u8; 32],
    ) -> Result<(bool, Option<Vec<u8>>), RaffleDrawError> {
        // connect to the contract
        let mut client = self.connect()?;

        let correct_status = match expected_status {
            Some(expected_status) => {
                let status = get_status(&mut client)?.ok_or(StatusUnknown)?;
                status == expected_status
            }
            None => true,
        };

        let correct_draw_number = match expected_draw_number {
            Some(expected_draw_number) => {
                let draw_number = get_draw_number(&mut client)?.ok_or(DrawNumberUnknown)?;
                draw_number == expected_draw_number
            }
            None => true,
        };

        if correct_draw_number && correct_status {
            // the contract is already synchronized
            return Ok((true, None));
        }

        // synchronize the contract =>  Attach an action to the tx
        let action = encode_request(&action)?;
        client.action(Action::Reply(action));
        // submit the transaction
        let tx = maybe_submit_tx(client, attest_key, self.config.sender_key.as_ref())?;

        Ok((false, tx))
    }
}

fn encode_request(request: &RequestForAction) -> Result<Vec<u8>, RaffleDrawError> {
    ink::env::debug_println!("Action Message: {request:?}");

    const REQUEST_SET_CONFIG: u8 = 0;
    const REQUEST_OPEN_REGISTRATIONS: u8 = 1;
    const REQUEST_CLOSE_REGISTRATIONS: u8 = 2;
    const REQUEST_GENERATE_SALT: u8 = 3;
    const REQUEST_SET_RESULTS: u8 = 4;

    let encoded = match &request {
        RequestForAction::SetConfigAndStart(config, contract_id) => {
            let nb_numbers = config.nb_numbers as u128;
            let min_number = config.min_number as u128;
            let max_number = config.max_number as u128;
            let contract_id = *contract_id as u128;
            let body = ethabi::encode(&[
                Token::Uint(nb_numbers.into()),
                Token::Uint(min_number.into()),
                Token::Uint(max_number.into()),
                Token::Uint(contract_id.into()),
            ]);
            ethabi::encode(&[Token::Uint(REQUEST_SET_CONFIG.into()), Token::Bytes(body)])
        }
        RequestForAction::OpenRegistrations(draw_number) => {
            let draw_number = *draw_number as u128;
            let body = ethabi::encode(&[Token::Uint(draw_number.into())]);
            ethabi::encode(&[
                Token::Uint(REQUEST_OPEN_REGISTRATIONS.into()),
                Token::Bytes(body),
            ])
        }
        RequestForAction::CloseRegistrations(draw_number) => {
            let draw_number = *draw_number as u128;
            let body = ethabi::encode(&[Token::Uint(draw_number.into())]);
            ethabi::encode(&[
                Token::Uint(REQUEST_CLOSE_REGISTRATIONS.into()),
                Token::Bytes(body),
            ])
        }
        RequestForAction::GenerateSalt(draw_number) => {
            let draw_number = *draw_number as u128;
            let body = ethabi::encode(&[Token::Uint(draw_number.into())]);
            ethabi::encode(&[
                Token::Uint(REQUEST_GENERATE_SALT.into()),
                Token::Bytes(body),
            ])
        }
        RequestForAction::SetResults(draw_number, ref numbers, has_winner) => {
            let draw_number = *draw_number as u128;
            let numbers: Vec<Token> = numbers
                .into_iter()
                .map(|n: &Number| Token::Uint((*n).into()))
                .collect();
            let body = ethabi::encode(&[
                Token::Uint(draw_number.into()),
                Token::Array(numbers),
                Token::Bool(*has_winner),
            ]);
            ethabi::encode(&[Token::Uint(REQUEST_SET_RESULTS.into()), Token::Bytes(body)])
        }
    };
    Ok(encoded)
}

fn maybe_submit_tx(
    client: EvmRollupClient,
    attest_key: &[u8; 32],
    sender_key: Option<&[u8; 32]>,
) -> Result<Option<Vec<u8>>, RaffleDrawError> {
    let maybe_submittable = client
        .commit()
        .log_err("failed to commit")
        .map_err(|_| FailedToCommitTx)?;

    if let Some(submittable) = maybe_submittable {
        let attest_pair = KeyPair::from(*attest_key);
        let tx_id = if let Some(sender_key) = sender_key {
            // Prefer to meta-tx
            let sender_pair = KeyPair::from(*sender_key);
            submittable
                .submit_meta_tx(&attest_pair, &sender_pair)
                .log_err("failed to submit rollup meta-tx")?
        } else {
            // Fallback to account-based authentication
            submittable
                .submit(attest_pair)
                .log_err("failed to submit rollup tx")?
        };
        return Ok(Some(tx_id));
    }
    Ok(None)
}

fn get_draw_number(client: &mut EvmRollupClient) -> Result<Option<DrawNumber>, RaffleDrawError> {

    let key  = hex::decode("5f647261774e756d626572")
        .map_err(|_| FailedToDecodeDrawNumber)?;

    let raw_value = client
        .session()
        .get(key.as_slice())
        .log_err("Draw number unknown in kv store")
        .map_err(|_| DrawNumberUnknown)?;

    let result = match raw_value {
        Some(raw) => Some(decode_draw_number(raw.as_slice())?),
        None => None,
    };

    Ok(result)
}

fn decode_draw_number(raw: &[u8]) -> Result<DrawNumber, RaffleDrawError> {
    let tokens = ethabi::decode(&[ParamType::Uint(32)], raw)
        .log_err("Fail to decode draw number in kv store")
        .map_err(|_| FailedToDecodeDrawNumber)?;
    let [Token::Uint(draw_number)] = tokens.as_slice() else {
        return Err(FailedToDecodeDrawNumber);
    };
    Ok(draw_number.as_u32())
}

fn get_status(
    client: &mut EvmRollupClient,
) -> Result<Option<RaffleRegistrationStatus>, RaffleDrawError> {

    let key  = hex::decode("5f737461747573")
        .map_err(|_| FailedToDecodeStatus)?;

    let raw_value = client
        .session()
        .get(key.as_slice())
        .log_err("Status unknown in kv store")
        .map_err(|_| StatusUnknown)?;

    let result = match raw_value {
        Some(raw) => Some(decode_status(raw.as_slice())?),
        None => None,
    };
    Ok(result)
}

fn decode_status(raw: &[u8]) -> Result<RaffleRegistrationStatus, RaffleDrawError> {
    let tokens = ethabi::decode(&[ParamType::Uint(32)], raw)
        .log_err("Fail to decode status in kv store")
        .map_err(|_| FailedToDecodeStatus)?;
    let [Token::Uint(status)] = tokens.as_slice() else {
        return Err(FailedToDecodeStatus);
    };
    let status = match status.as_u32() {
        0 => RaffleRegistrationStatus::NotStarted,
        1 => RaffleRegistrationStatus::Started,
        2 => RaffleRegistrationStatus::RegistrationsOpen,
        3 => RaffleRegistrationStatus::RegistrationsClosed,
        4 => RaffleRegistrationStatus::SaltGenerated,
        5 => RaffleRegistrationStatus::ResultsReceived,
        _ => return Err(FailedToDecodeStatus),
    };

    Ok(status)
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::raffle_registration_contract::RaffleRegistrationStatus::Started;
    use alloc::boxed::Box;

    #[ink::test]
    fn encode_request_set_config_and_start() {
        let nb_numbers: u8 = 4;
        let min_number: Number = 1;
        let max_number: Number = 50;
        let config = RaffleConfig {
            nb_numbers,
            min_number,
            max_number,
        };

        let registration_id = 33;

        let request = RequestForAction::SetConfigAndStart(config, registration_id);

        let encoded_request = encode_request(&request).expect("Failed to encode request");
        ink::env::debug_println!("Encoded request: {encoded_request:02x?}");

        let expected : Vec<u8> = hex::decode("0000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000800000000000000000000000000000000000000000000000000000000000000004000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000320000000000000000000000000000000000000000000000000000000000000021")
            .expect("hex decode failed");
        assert_eq!(expected, encoded_request);
    }

    #[ink::test]
    fn encode_request_open_registrations() {
        let draw_number = 11;

        let request = RequestForAction::OpenRegistrations(draw_number);

        let encoded_request = encode_request(&request).expect("Failed to encode request");
        ink::env::debug_println!("Encoded request: {encoded_request:02x?}");

        let expected : Vec<u8> = hex::decode("000000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000b")
            .expect("hex decode failed");
        assert_eq!(expected, encoded_request);
    }

    #[ink::test]
    fn encode_request_close_registrations() {
        let draw_number = 11;

        let request = RequestForAction::CloseRegistrations(draw_number);

        let encoded_request = encode_request(&request).expect("Failed to encode request");
        ink::env::debug_println!("Encoded request: {encoded_request:02x?}");

        let expected : Vec<u8> = hex::decode("000000000000000000000000000000000000000000000000000000000000000200000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000b")
            .expect("hex decode failed");
        assert_eq!(expected, encoded_request);
    }

    #[ink::test]
    fn encode_request_generate_salt() {
        let draw_number = 11;

        let request = RequestForAction::GenerateSalt(draw_number);

        let encoded_request = encode_request(&request).expect("Failed to encode request");
        ink::env::debug_println!("Encoded request: {encoded_request:02x?}");

        let expected : Vec<u8> = hex::decode("000000000000000000000000000000000000000000000000000000000000000300000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000020000000000000000000000000000000000000000000000000000000000000000b")
            .expect("hex decode failed");
        assert_eq!(expected, encoded_request);
    }

    #[ink::test]
    fn encode_request_set_results() {
        let draw_number = 11;
        let numbers = vec![33, 47, 5, 6];

        let request = RequestForAction::SetResults(draw_number, numbers, false);

        let encoded_request = encode_request(&request).expect("Failed to encode request");
        ink::env::debug_println!("Encoded request: {encoded_request:02x?}");

        let expected : Vec<u8> = hex::decode("000000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000400000000000000000000000000000000000000000000000000000000000000100000000000000000000000000000000000000000000000000000000000000000b0000000000000000000000000000000000000000000000000000000000000060000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000021000000000000000000000000000000000000000000000000000000000000002f00000000000000000000000000000000000000000000000000000000000000050000000000000000000000000000000000000000000000000000000000000006")
            .expect("hex decode failed");
        assert_eq!(expected, encoded_request);
    }

    #[ink::test]
    fn decode_status() {
        let raw: Vec<u8> =
            hex::decode("0000000000000000000000000000000000000000000000000000000000000000")
                .expect("hex decode failed");
        let status = super::decode_status(raw.as_slice()).expect("Fail to decode status");
        assert_eq!(status, RaffleRegistrationStatus::NotStarted);

        let raw: Vec<u8> =
            hex::decode("0000000000000000000000000000000000000000000000000000000000000001")
                .expect("hex decode failed");
        let status = super::decode_status(raw.as_slice()).expect("Fail to decode status");
        assert_eq!(status, RaffleRegistrationStatus::Started);

        let raw: Vec<u8> =
            hex::decode("0000000000000000000000000000000000000000000000000000000000000002")
                .expect("hex decode failed");
        let status = super::decode_status(raw.as_slice()).expect("Fail to decode status");
        assert_eq!(status, RaffleRegistrationStatus::RegistrationsOpen);

        let raw: Vec<u8> =
            hex::decode("0000000000000000000000000000000000000000000000000000000000000003")
                .expect("hex decode failed");
        let status = super::decode_status(raw.as_slice()).expect("Fail to decode status");
        assert_eq!(status, RaffleRegistrationStatus::RegistrationsClosed);

        let raw: Vec<u8> =
            hex::decode("0000000000000000000000000000000000000000000000000000000000000004")
                .expect("hex decode failed");
        let status = super::decode_status(raw.as_slice()).expect("Fail to decode status");
        assert_eq!(status, RaffleRegistrationStatus::SaltGenerated);

        let raw: Vec<u8> =
            hex::decode("0000000000000000000000000000000000000000000000000000000000000005")
                .expect("hex decode failed");
        let status = super::decode_status(raw.as_slice()).expect("Fail to decode status");
        assert_eq!(status, RaffleRegistrationStatus::ResultsReceived);
    }

    #[ink::test]
    fn decode_draw_number() {
        let raw: Vec<u8> =
            hex::decode("000000000000000000000000000000000000000000000000000000000000000b")
                .expect("hex decode failed");
        let draw_number =
            super::decode_draw_number(raw.as_slice()).expect("Fail to decode draw number");
        assert_eq!(draw_number, 11);
    }

    #[ink::test]
    fn decode_array() {
        let raw : Vec<u8> = hex::decode("000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000021000000000000000000000000000000000000000000000000000000000000002f00000000000000000000000000000000000000000000000000000000000000050000000000000000000000000000000000000000000000000000000000000006").expect("hex decode failed");
        let request_decoded =
            ethabi::decode(&[ParamType::Array(Box::new(ParamType::Uint(32)))], &raw)
                .expect("Error 1 to decode message");

        let [Token::Array(ref numbers)] = request_decoded.as_slice() else {
            assert!(false, "Error 2 to decode message");
            return Ok(());
        };
        let numbers: Vec<u32> = numbers
            .into_iter()
            .map(|n: &ethabi::Token| {
                if let ethabi::Token::Uint(v) = n {
                    v.as_u32()
                } else {
                    0
                }
            })
            .collect();

        assert_eq!(vec![33u32, 47, 5, 6], numbers);
    }

    #[ink::test]
    fn encode_array() {
        let mut numbers = Vec::new();
        numbers.push(Token::Uint(33u32.into()));
        numbers.push(Token::Uint(47u32.into()));
        numbers.push(Token::Uint(5u32.into()));
        numbers.push(Token::Uint(6u32.into()));

        let array_encoded = ethabi::encode(&[Token::Array(numbers)]);

        let expected : Vec<u8> = hex::decode("000000000000000000000000000000000000000000000000000000000000002000000000000000000000000000000000000000000000000000000000000000040000000000000000000000000000000000000000000000000000000000000021000000000000000000000000000000000000000000000000000000000000002f00000000000000000000000000000000000000000000000000000000000000050000000000000000000000000000000000000000000000000000000000000006").expect("hex decode failed");
        assert_eq!(expected, array_encoded);
    }


    struct EnvVars {
        evm_config: EvmContractConfig,
        attestor_key: [u8; 32],
    }

    fn config() -> EnvVars {

        let rpc = "https://rpc.minato.soneium.org";
        let contract_id: EvmContractId = hex::decode("6D80a3964360bd8b733449fcc69f2a91A3b70354")
            .expect("hex decode failed")
            .try_into()
            .expect("incorrect length");
        let sender_key : [u8; 32] = hex::decode("ea31cc677ba1c0109cda39829e2f3c00d7ec36ea08b186d2ec906a2bb8849e3c")
            .expect("hex decode failed")
            .try_into()
            .expect("incorrect length");

        let evm_config = EvmContractConfig {
            rpc: rpc.to_string(),
            contract_id,
            sender_key : Some(sender_key),
        };

        let attestor_key : [u8; 32] = hex::decode("e032eb4ee274db3bae0c41e17f376f6243ec1f05c142fc803521665e05528e2f")
            .expect("hex decode failed")
            .try_into()
            .expect("incorrect length");

        EnvVars {
            evm_config,
            attestor_key,
        }
    }

    #[ink::test]
    #[ignore = "The contract must be deployed on the EVM node"]
    fn display_info() {
        pink_extension_runtime::mock_ext::mock_all_ext();

        let config = config();
        let contract = EvmContract::new(Some(config.evm_config)).expect("Fail to init contract");

        let mut client = contract.connect().expect("Fail to connect");

        let status = get_status(&mut client).expect("Fail to get status");
        ink::env::debug_println!("status: {status:?}");
        let draw_number = get_status(&mut client).expect("Fail to get draw number");
        ink::env::debug_println!("draw_number: {draw_number:?}");
    }

    fn test_do_action(
        expected_draw_number: Option<DrawNumber>,
        expected_status: Option<RaffleRegistrationStatus>,
        action: RequestForAction,
    ) {

        let config = config();
        let contract = EvmContract::new(Some(config.evm_config)).expect("Fail to init contract");

        contract.do_action(
            expected_draw_number,
            expected_status,
            action,
            &config.attestor_key,
        ).expect("Fail to do action");
    }

    #[ink::test]
    #[ignore = "The contract must be deployed on the EVM node"]
    fn test_set_config_and_start() {
        pink_extension_runtime::mock_ext::mock_all_ext();

        let expected_draw_number = None;
        let expected_status = Some(Started);
        let config = crate::types::RaffleConfig {
            nb_numbers: 4,
            min_number: 1,
            max_number: 5,
        };
        let action = RequestForAction::SetConfigAndStart(config, 33);

        test_do_action(
            expected_draw_number,
            expected_status,
            action,
        );
    }

    #[ink::test]
    #[ignore = "The contract must be deployed on the EVM node"]
    fn test_open_registrations() {
        pink_extension_runtime::mock_ext::mock_all_ext();

        let expected_draw_number = Some(1);
        let expected_status = Some(RaffleRegistrationStatus::RegistrationsOpen);
        let action = RequestForAction::OpenRegistrations(1);

        test_do_action(
            expected_draw_number,
            expected_status,
            action,
        );
    }

    #[ink::test]
    #[ignore = "The contract must be deployed on the EVM node"]
    fn test_close_registrations() {
        pink_extension_runtime::mock_ext::mock_all_ext();

        let expected_draw_number = Some(1);
        let expected_status = Some(RaffleRegistrationStatus::RegistrationsClosed);
        let action = RequestForAction::CloseRegistrations(1);

        test_do_action(
            expected_draw_number,
            expected_status,
            action,
        );
    }

    #[ink::test]
    #[ignore = "The contract must be deployed on the EVM node"]
    fn test_generate_salt() {
        pink_extension_runtime::mock_ext::mock_all_ext();

        let expected_draw_number = Some(1);
        let expected_status = Some(RaffleRegistrationStatus::RegistrationsClosed);
        let action = RequestForAction::GenerateSalt(1);

        test_do_action(
            expected_draw_number,
            expected_status,
            action,
        );
    }

    #[ink::test]
    #[ignore = "The contract must be deployed on the EVM node"]
    fn test_set_results() {
        pink_extension_runtime::mock_ext::mock_all_ext();

        let expected_draw_number = Some(1);
        let expected_status = Some(RaffleRegistrationStatus::ResultsReceived);
        let action = RequestForAction::SetResults(1, vec![1, 2, 3, 4], false);

        test_do_action(
            expected_draw_number,
            expected_status,
            action,
        );
    }

}
