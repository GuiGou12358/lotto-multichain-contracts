import {type ContractConfig, type DrawNumber, type Number, type RegistrationContractId, type Salt,} from './types';
import {
    type RaffleRegistrationContract,
    RaffleRegistrationStatus,
    type RequestForAction
} from "./raffle_registration_contract.ts";
import {type HexString, None, Option} from "@guigou/sc-rollup-core";
import {
    hashInputConfig,
    hashInputConfigAndSalt,
    hashInputNumbers,
    type RaffleManagerContract,
    RaffleManagerStatus,
    RaffleManagerWasmContract
} from "./raffle_manager_contract.ts";
import {Indexer} from "./indexer.ts";
import {RaffleRegistrationEvmContract} from "./raffle_registration_evm_contract.ts";
import {RaffleRegistrationWasmContract} from "./raffle_registration_wasm_contract.ts";
import {type LottoManagerRequestMessage, type LottoManagerResponseMessage} from "./wasm_codec.ts";

export class LottoWorker {

    private raffleManager: RaffleManagerContract;

    private raffleRegistrationConfigs: Map<RegistrationContractId, ContractConfig> = new Map();
    private raffleRegistrations: Map<RegistrationContractId, RaffleRegistrationContract> = new Map();

    private readonly urlIndexer : string;

    constructor(
        raffleManagerConfig: ContractConfig | null,
        raffleRegistrationConfigs: Map<RegistrationContractId, ContractConfig>,
        urlIndexer : string | null,
    ) {
        if (!raffleManagerConfig) throw new Error('RaffleManagerNotConfigured');
        if (!urlIndexer) throw new Error('IndexerNotConfigured');

        this.raffleManager = new RaffleManagerWasmContract(raffleManagerConfig);
        this.raffleRegistrationConfigs = raffleRegistrationConfigs;
        this.urlIndexer = urlIndexer;
    }

    getDrawNumber(): Promise<Option<number>> {
        return this.raffleManager.getDrawNumber();
    }

    getStatus(): Promise<Option<RaffleManagerStatus>> {
        return this.raffleManager.getStatus();
    }

    async pollMessages(){
        do {
            const message = (await this.raffleManager.pollMessage()).valueOf();
            if (!message){
                console.log("no message");
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
            // commit only if we sent a response, this way the message stay in the queue.
            const tx =  await this.raffleManager.doAction(response);
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

            let raffleRegistration = this.raffleRegistrations.get(contractId);

            if (!raffleRegistration){
                const raffleRegistrationConfig = this.raffleRegistrationConfigs.get(contractId);
                if (!raffleRegistrationConfig) throw Error("MissingRegistrationContract " + contractId);
                if (raffleRegistrationConfig.address.startsWith("0x")){
                    raffleRegistration = new RaffleRegistrationEvmContract(raffleRegistrationConfig);
                } else {
                    raffleRegistration = new RaffleRegistrationWasmContract(raffleRegistrationConfig);
                }
                this.raffleRegistrations.set(contractId, raffleRegistration);
            }

            await raffleRegistration.startSession()

            const isSynced = await raffleRegistration.isSynced(targetDrawNumber, targetStatus);

            if (isSynced){
                console.log("Registration contract " + contractId + " is synced");
                synchronizedContracts.push(contractId);
            } else {
                console.log("Do action for registration contract " + contractId);
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
