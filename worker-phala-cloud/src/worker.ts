import type {
    AccountId20,
    AccountId32,
    ContractConfig,
    DrawNumber,
    Hash,
    Number,
    RegistrationContractId,
    Salt
} from './types';
import {
    type RaffleRegistrationContract,
    RaffleRegistrationStatus,
    type RequestForAction
} from "./raffle_registration_contract.ts";
import {InkClient} from "@guigou/sc-rollup-ink-v5";
import {bool, Bytes, type Codec, Enum, Struct, Tuple, u128, u16, u32, u8, Vector} from "scale-ts";
import {hexAddPrefix} from "@polkadot/util";
import {type HexString, None, Option} from "@guigou/sc-rollup-core";
import {RaffleManagerStatus} from "./raffle_manager_contract.ts";
import {Indexer} from "./indexer.ts";
import {fromHex} from "polkadot-api/utils";
import {RaffleRegistrationEvmContract} from "./evm_contract.ts";
import {RaffleRegistrationWasmContract} from "./wasm_contract.ts";
import {BLAKE256} from "@noble/hashes/blake1";
import {hasher} from "@polkadot/util-crypto/secp256k1/hasher";
import {AccountId} from "@polkadot-api/substrate-bindings";


// Constants
const DRAW_NUMBER = '0x44524157'; // assuming ink::selector_id!("DRAW_NUMBER")
const STATUS = '0x53544154'; // assuming ink::selector_id!("STATUS")

export class LottoWorker {

    private raffleManager: InkClient<LottoManagerRequestMessage, LottoManagerResponseMessage>;

    private raffleRegistrationConfigs: Map<RegistrationContractId, ContractConfig> = new Map();

    private urlIndexer : string;

    constructor(
        raffleManagerConfig: ContractConfig | null,
        raffleRegistrationConfigs: Map<RegistrationContractId, ContractConfig>,
        urlIndexer : string | null,
    ) {
        if (!raffleManagerConfig) throw new Error('RaffleManagerNotConfigured');
        if (!urlIndexer) throw new Error('IndexerNotConfigured');

        this.raffleManager = new InkClient<LottoManagerRequestMessage, LottoManagerResponseMessage>(
            raffleManagerConfig.rpc,
            raffleManagerConfig.address,
            hexAddPrefix(raffleManagerConfig.attestorKey),
            raffleManagerConfig.senderKey ? hexAddPrefix(raffleManagerConfig.senderKey) : undefined,
            lottoManagerRequestMessageCodec,
            lottoManagerResponseMessageCodec
        );
        this.raffleRegistrationConfigs = raffleRegistrationConfigs;
        this.urlIndexer = urlIndexer;
    }

    async getDrawNumber(): Promise<Option<number>> {
        try {
            return await this.raffleManager.getNumber(DRAW_NUMBER, 'u32');
        } catch (err) {
            console.error('Draw number unknown in kv store');
            throw new Error('DrawNumberUnknown');
        }
    }

    async getStatus(): Promise<Option<RaffleManagerStatus>> {
        try {
            const status = await this.raffleManager.getNumber(STATUS, 'u8');
            return status.map(decodeStatus);
        } catch (err) {
            console.error('Status unknown in kv store');
            throw new Error('StatusUnknown');
        }
    }

    async pollMessages(){
        do {
            await this.raffleManager.startSession();
            const message = (await this.raffleManager.pollMessage()).valueOf();
            if (!message){
                console.log("no message anymore");
                return;
            }
            console.log("handle message ...");
            console.log(message);
            const txs = await this.handleMessage(message);
            console.log(txs);
        } while(true);
    }

    async handleMessage(
        message: LottoManagerRequestMessage
    ): Promise<Map<RegistrationContractId, Option<HexString>>> {

        const [synchronizedContracts, txs] = await this.synchronizeRegistrationContracts(message);

        let response: LottoManagerResponseMessage | undefined = undefined;

        switch (message.tag) {
            case 'PropagateConfig':
                if (synchronizedContracts.length > 0) {
                    const [config] = message.value;
                    response = {
                        tag: 'ConfigPropagated',
                        value: [synchronizedContracts, hashInputConfig(config)],
                    };
                }
                break;
            case 'OpenRegistrations':
                if (synchronizedContracts.length > 0) {
                    const [drawNumber] = message.value;
                    response = {
                        tag: 'RegistrationsOpen',
                        value: [drawNumber, synchronizedContracts],
                    };
                }
                break;
            case 'CloseRegistrations':
                if (synchronizedContracts.length > 0) {
                    const [drawNumber] = message.value;
                    response = {
                        tag: 'RegistrationsClosed',
                        value: [drawNumber, synchronizedContracts],
                    };
                }
                break;
            case 'GenerateSalt': {
                if (synchronizedContracts.length > 0) {
                    const [drawNumber] = message.value;
                    const indexer = new Indexer(this.urlIndexer);
                    const contractSalts: [RegistrationContractId, Salt][] = [];
                    for (const contractId of synchronizedContracts) {
                        const salt = (await indexer.querySalt(drawNumber, contractId)).valueOf();
                        if (salt) {
                            contractSalts.push([contractId, salt]);
                        }
                    }
                    if (contractSalts.length > 0) {
                        response = {
                            tag: 'SaltGenerated',
                            value: [drawNumber, contractSalts],
                        };
                    }
                }
                break;
            }
            case 'PropagateResults': {
                if (synchronizedContracts.length > 0) {
                    const [drawNumber, numbers] = message.value;
                    response = {
                        tag: 'ResultsPropagated',
                        value: [
                            drawNumber,
                            synchronizedContracts,
                            hashInputNumbers(numbers),
                        ],
                    };
                }
                break;
            }
            case 'DrawNumbers': {
                const [drawNumber, config, salt] =  message.value;
                const numbers = getNumbers(
                    drawNumber,
                    config.nbNumbers,
                    config.minNumber,
                    config.maxNumber,
                    salt
                );
                response = {
                    tag: 'WinningNumbers',
                    value: [drawNumber, numbers, hashInputConfigAndSalt(config, salt)],
                };
                break;
            }
            case 'CheckWinners': {
                const [drawNumber, numbers] =  message.value;
                const indexer = new Indexer(this.urlIndexer);
                const [winners1, winners2] = await indexer.queryWinners(drawNumber, numbers);
                response =
                    {
                        tag: 'Winners',
                        value: [
                            drawNumber,
                            winners1,
                            winners2,
                            hashInputNumbers(numbers),
                        ],
                    };
                break;
            }
        }

        if (response){
            this.raffleManager.addAction(response);
            // commit only if we sent a response, this way the message stay in the queue.
            const tx = await this.raffleManager.commit();
            txs.set(0n, tx);
        }
        return txs;
    }

    private async synchronizeRegistrationContracts(
        message: LottoManagerRequestMessage
    ): Promise<
        [RegistrationContractId[], Map<RegistrationContractId, Option<HexString>>]
    > {

        const synchronizedContracts: RegistrationContractId[] = [];
        const txs: Map<RegistrationContractId, Option<HexString>> = new Map();

        if (message.tag === 'DrawNumbers' || message.tag == 'CheckWinners'){
            // no synchronization
            return [synchronizedContracts, txs];
        }

        const contractIds: RegistrationContractId[] = mapToContractIds(message);
        const action = mapToRequestForAction(message);
        const [targetDrawNumber, targetStatus] = mapToTarget(message);

        for (const contractId of contractIds) {
            const raffleRegistrationConfig = this.raffleRegistrationConfigs.get(contractId);
            if (!raffleRegistrationConfig) throw Error("MissingRegistrationContract " + contractId);

            let raffleRegistration : RaffleRegistrationContract;
            if (raffleRegistrationConfig.address.startsWith("0x")){
                raffleRegistration = new RaffleRegistrationEvmContract(raffleRegistrationConfig);
            } else {
                raffleRegistration = new RaffleRegistrationWasmContract(raffleRegistrationConfig);
            }

            await raffleRegistration.startSession()

            const isSynched = await raffleRegistration.isSynched(targetDrawNumber, targetStatus);

            if (isSynched){
                console.log("Registration contract " + contractId + " is synched");
                synchronizedContracts.push(contractId);
            } else {
                console.log("Do action for registration contract " + contractId );
                const adjustedRequest: RequestForAction =
                    action.type === 'SetConfigAndStart'
                        ? {type: 'SetConfigAndStart', config: action.config, contractId}
                        : action;
                const tx = await raffleRegistration.doAction(adjustedRequest);
                txs.set(contractId, tx);
            }
        }
        return [synchronizedContracts, txs];
    }
}

export function hashInputConfig(config: RaffleConfigStruct): Hash {
    const encoded = raffleConfigCodec.enc(config);
    return hasher('blake2', encoded);
}

function hashInputNumbers(numbers: Number[]): Hash {
    const codec = Vector(u16);
    const encoded = codec.enc(numbers);
    return hasher('blake2', encoded);
}

function hashInputConfigAndSalt(config: RaffleConfigStruct, salt: Salt): Hash {
    const codec = Tuple(raffleConfigCodec, saltCodec);
    const encoded = codec.enc([config, salt]);
    return hasher('blake2', encoded);
}


function getNumbers(drawNumber: number, nbNumbers: number, minNumber: Number, maxNumber: Number, salt: Salt): Number[] {
    // TODO
    return [1, 2, 3, 4];
}

function mapToRequestForAction(message: LottoManagerRequestMessage): RequestForAction {
    switch (message.tag) {
        case 'PropagateConfig':
            return { type: 'SetConfigAndStart', config: message.value[0], contractId: 0n };
        case 'OpenRegistrations':
            return { type: 'OpenRegistrations', drawNumber: message.value[0] };
        case 'CloseRegistrations':
            return { type: 'CloseRegistrations', drawNumber: message.value[0] };
        case 'GenerateSalt':
            return { type: 'GenerateSalt', drawNumber: message.value[0] };
        case 'PropagateResults':
            return {
                type: 'SetResults', drawNumber: message.value[0], numbers: message.value[1], hasWinner: message.value[2]
            };
        default:
            throw new Error('Unsupported type');
    }
}

function mapToContractIds(message: LottoManagerRequestMessage): RegistrationContractId[] {
    switch (message.tag) {
        case 'PropagateConfig':
        case 'OpenRegistrations':
        case 'CloseRegistrations':
        case 'GenerateSalt':
            return message.value[1];
        case 'PropagateResults':
            return message.value[3];
        default:
            throw new Error('Unsupported type');
    }
}

function mapToTarget(message: LottoManagerRequestMessage): [Option<DrawNumber>, Option<RaffleRegistrationStatus>] {
        switch (message.tag) {
        case 'PropagateConfig':
            return [new None(), Option.of(RaffleRegistrationStatus.Started)];
        case 'OpenRegistrations':
            return [Option.of(message.value[0]), Option.of(RaffleRegistrationStatus.RegistrationsOpen)];
        case 'CloseRegistrations':
            return [Option.of(message.value[0]), Option.of(RaffleRegistrationStatus.RegistrationsClosed)];
        case 'GenerateSalt':
            return [Option.of(message.value[0]), Option.of(RaffleRegistrationStatus.SaltGenerated)];
        case 'PropagateResults':
            return [Option.of(message.value[0]), Option.of(RaffleRegistrationStatus.ResultsReceived)];
        default:
            throw new Error('Unsupported type');
    }
}



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

type RaffleConfigStruct = {
    nbNumbers: Number;
    minNumber: Number;
    maxNumber: Number;
}

const raffleConfigCodec : Codec<RaffleConfigStruct> = Struct({
        nbNumbers: u8,
        minNumber: u16,
        maxNumber: u16,
    }
);
const saltCodec = Bytes();
const hashCodec = Bytes(32);
const accountId20Codec = Bytes(20);
const accountId32Codec = Bytes(32);

type LottoManagerRequestMessage =
    | { tag: 'PropagateConfig'; value: [RaffleConfigStruct, RegistrationContractId[]] }
    | { tag: 'OpenRegistrations'; value:[DrawNumber, RegistrationContractId[]] }
    | { tag: 'CloseRegistrations'; value:[DrawNumber, RegistrationContractId[]] }
    | { tag: 'GenerateSalt'; value:[DrawNumber, RegistrationContractId[]] }
    | { tag: 'DrawNumbers'; value:[DrawNumber, RaffleConfigStruct, Salt]  }
    | { tag: 'CheckWinners'; value:[DrawNumber, Number[]]  }
    | { tag: 'PropagateResults'; value: [DrawNumber, Number[], boolean, RegistrationContractId[]] };

const lottoManagerRequestMessageCodec : Codec<LottoManagerRequestMessage> = Enum({
    PropagateConfig: Tuple(raffleConfigCodec, Vector(u128)),
    OpenRegistrations: Tuple(u32, Vector(u128)),
    CloseRegistrations: Tuple(u32, Vector(u128)),
    GenerateSalt: Tuple(u32, Vector(u128)),
    DrawNumbers: Tuple(u32, raffleConfigCodec, saltCodec),
    CheckWinners: Tuple(u32, Vector(u16)),
    PropagateResults: Tuple(u32, Vector(u16) ,bool, Vector(u128)),
})

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

type LottoManagerResponseMessage =
    | { tag: 'ConfigPropagated'; value: [RegistrationContractId[], Hash] }
    | { tag: 'RegistrationsOpen'; value:[DrawNumber, RegistrationContractId[]] }
    | { tag: 'RegistrationsClosed'; value:[DrawNumber, RegistrationContractId[]] }
    | { tag: 'SaltGenerated'; value:[DrawNumber, [RegistrationContractId, Salt][]] }
    | { tag: 'WinningNumbers'; value:[DrawNumber, Number[], Hash] }
    | { tag: 'Winners'; value:[DrawNumber, AccountId32[], AccountId20[], Hash]  }
    | { tag: 'ResultsPropagated'; value:[DrawNumber, RegistrationContractId[], Hash]  }
    | { tag: 'CloseRegistrations'; value: [] };

const lottoManagerResponseMessageCodec : Codec<LottoManagerResponseMessage> = Enum({
    ConfigPropagated: Tuple(Vector(u128), hashCodec),
    RegistrationsOpen: Tuple(u32, Vector(u128)),
    RegistrationsClosed: Tuple(u32, Vector(u128)),
    SaltGenerated: Tuple(u32, Vector(Tuple(u128, saltCodec))),
    WinningNumbers: Tuple(u32, Vector(u16), hashCodec),
    Winners: Tuple(u32, Vector(accountId32Codec), Vector(accountId20Codec), hashCodec),
    ResultsPropagated: Tuple(u32, Vector(u128), hashCodec),
    CloseRegistrations: Tuple(),
})


function decodeStatus(status: number): RaffleManagerStatus {
    switch (status) {
        case 0: return RaffleManagerStatus.NotStarted;
        case 1: return RaffleManagerStatus.Started;
        case 2: return RaffleManagerStatus.RegistrationsOpen;
        case 3: return RaffleManagerStatus.RegistrationsClosed;
        case 4: return RaffleManagerStatus.WaitingSalt;
        case 5: return RaffleManagerStatus.WaitingResult;
        case 6: return RaffleManagerStatus.WaitingSalt;
        case 7: return RaffleManagerStatus.WaitingWinner;
        case 8: return RaffleManagerStatus.DrawFinished;
        default: throw new Error('FailedToDecodeStatus');
    }

}