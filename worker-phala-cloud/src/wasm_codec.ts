import {
    type AccountId20,
    type AccountId32,
    type DrawNumber,
    type Hash,
    type Number,
    type RegistrationContractId,
    type Salt
} from './types';
import {bool, Bytes, type Codec, Enum, Struct, Tuple, u128, u16, u32, u8, Vector} from "scale-ts";


// Constants
export const DRAW_NUMBER = '0x6dcf72cf'; // assuming ink::selector_id!("DRAW_NUMBER")
export const STATUS = '0x370f6b87'; // assuming ink::selector_id!("STATUS")

export const saltCodec = Bytes();
export const hashCodec = Bytes(32);
export const accountId20Codec = Bytes(20);
export const accountId32Codec = Bytes(32);

export type RaffleConfigStruct = {
    nbNumbers: number;
    minNumber: Number;
    maxNumber: Number;
}

export const raffleConfigCodec : Codec<RaffleConfigStruct> = Struct({
        nbNumbers: u8,
        minNumber: u16,
        maxNumber: u16,
    }
);

/*
/// Message sent by the offchain rollup to the Raffle Registration Contracts
#[derive(scale::Encode, scale::Decode, Debug, Clone)]
pub enum RequestForAction {
    /// update the config, set the registration contract id for this contract and start the workflow
    SetConfigAndStart(RaffleConfig, RegistrationContractId),
    /// open the registrations for the given draw number
    OpenRegistrations(DrawNumber),
    /// close the registrations for the given draw number
    CloseRegistrations(DrawNumber),
    /// generate the salt used by VRF
    GenerateSalt(DrawNumber),
    /// set the results (winning numbers + true or false if we have a winner) for the given draw number
    SetResults(DrawNumber, Vec<Number>, bool),
}
 */
export type RequestForActionStruct =
    | { tag: 'SetConfigAndStart'; value: [RaffleConfigStruct, RegistrationContractId] }
    | { tag: 'OpenRegistrations'; value:[DrawNumber] }
    | { tag: 'CloseRegistrations'; value:[DrawNumber]  }
    | { tag: 'GenerateSalt'; value:[DrawNumber]  }
    | { tag: 'SetResults'; value: [DrawNumber, Number[], boolean] };

export const requestForActionCodec : Codec<RequestForActionStruct> = Enum({
    SetConfigAndStart: Tuple(raffleConfigCodec, u128),
    OpenRegistrations: Tuple(u32),
    CloseRegistrations: Tuple(u32),
    GenerateSalt: Tuple(u32),
    SetResults: Tuple(u32, Vector(u16) ,bool),
})


/*
/// Message to synchronize the contracts, to request the lotto draw and get the list of winners.
/// message pushed in the queue by this contract and read by the offchain rollup
#[derive(scale::Encode, scale::Decode, Eq, PartialEq, Clone, Debug)]
pub enum LottoManagerRequestMessage {
    /// request to propagate the config to all given contracts
    PropagateConfig(RaffleConfig, Vec<RegistrationContractId>),
    /// request to open the registrations to all given contracts
    OpenRegistrations(DrawNumber, Vec<RegistrationContractId>),
    /// request to close the registrations to all given contracts
    CloseRegistrations(DrawNumber, Vec<RegistrationContractId>),
    /// request to generate a salt by all given contracts
    GenerateSalt(DrawNumber, Vec<RegistrationContractId>),
    /// request to draw the numbers based on the config and the given salt
    DrawNumbers(DrawNumber, RaffleConfig, Salt),
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
*/
export type LottoManagerRequestMessage =
    | { tag: 'PropagateConfig'; value: [RaffleConfigStruct, RegistrationContractId[]] }
    | { tag: 'OpenRegistrations'; value:[DrawNumber, RegistrationContractId[]] }
    | { tag: 'CloseRegistrations'; value:[DrawNumber, RegistrationContractId[]] }
    | { tag: 'GenerateSalt'; value:[DrawNumber, RegistrationContractId[]] }
    | { tag: 'DrawNumbers'; value:[DrawNumber, RaffleConfigStruct, Salt]  }
    | { tag: 'CheckWinners'; value:[DrawNumber, Number[]]  }
    | { tag: 'PropagateResults'; value: [DrawNumber, Number[], boolean, RegistrationContractId[]] };

export const lottoManagerRequestMessageCodec : Codec<LottoManagerRequestMessage> = Enum({
    PropagateConfig: Tuple(raffleConfigCodec, Vector(u128)),
    OpenRegistrations: Tuple(u32, Vector(u128)),
    CloseRegistrations: Tuple(u32, Vector(u128)),
    GenerateSalt: Tuple(u32, Vector(u128)),
    DrawNumbers: Tuple(u32, raffleConfigCodec, saltCodec),
    CheckWinners: Tuple(u32, Vector(u16)),
    PropagateResults: Tuple(u32, Vector(u16) ,bool, Vector(u128)),
});

/*
/// Offchain rollup response
#[derive(scale::Encode, scale::Decode)]
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
 */

export type LottoManagerResponseMessage =
    | { tag: 'ConfigPropagated'; value: [RegistrationContractId[], Hash] }
    | { tag: 'RegistrationsOpen'; value:[DrawNumber, RegistrationContractId[]] }
    | { tag: 'RegistrationsClosed'; value:[DrawNumber, RegistrationContractId[]] }
    | { tag: 'SaltGenerated'; value:[DrawNumber, [RegistrationContractId, Salt][]] }
    | { tag: 'WinningNumbers'; value:[DrawNumber, Number[], Hash] }
    | { tag: 'Winners'; value:[DrawNumber, AccountId32[], AccountId20[], Hash]  }
    | { tag: 'ResultsPropagated'; value:[DrawNumber, RegistrationContractId[], Hash]  }
    | { tag: 'CloseRegistrations'; value: [] };

export const lottoManagerResponseMessageCodec : Codec<LottoManagerResponseMessage> = Enum({
    ConfigPropagated: Tuple(Vector(u128), hashCodec),
    RegistrationsOpen: Tuple(u32, Vector(u128)),
    RegistrationsClosed: Tuple(u32, Vector(u128)),
    SaltGenerated: Tuple(u32, Vector(Tuple(u128, saltCodec))),
    WinningNumbers: Tuple(u32, Vector(u16), hashCodec),
    Winners: Tuple(u32, Vector(accountId32Codec), Vector(accountId20Codec), hashCodec),
    ResultsPropagated: Tuple(u32, Vector(u128), hashCodec),
    CloseRegistrations: Tuple(),
});


