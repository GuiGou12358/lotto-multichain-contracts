import type {LottoManagerRequestMessage, LottoManagerResponseMessage} from "./raffle_manager_contract.ts";
import type {
    ContractConfig,
    ContractId,
    DrawNumber,
    RegistrationContractId,
    Salt,
    TypedContractConfig
} from "./types.ts";
import {Indexer} from "./indexer.ts";
import {
    type RaffleRegistrationContract,
    RaffleRegistrationStatus,
    type RequestForAction
} from "./raffle_registration_contract.ts";
import {type HexString, None, Option} from "@guigou/sc-rollup-core";
import {RaffleRegistrationEvmContract} from "./evm_contract.ts";
import {RaffleRegistrationWasmContract} from "./wasm_contract.ts";

class Worker {

    raffleManager?: ContractConfig;
    raffleRegistrations: Map<RegistrationContractId, TypedContractConfig>;
    indexerUrl?: string;
    attestKey: Uint8Array;

    constructor(
        attestKey: Uint8Array,
        raffleManager?: ContractConfig,
        indexerUrl?: string
    ) {
        this.raffleManager = raffleManager;
        this.raffleRegistrations = new Map();
        this.indexerUrl = indexerUrl;
        this.attestKey = attestKey;
    }

    getIndexerUrl(): string {
        if (!this.indexerUrl) throw new Error("Indexer URL not configured");
        return this.indexerUrl;
    }

    // méthode d'accès simulée comme Mapping de ink!
    getRegistrationConfig(id: RegistrationContractId): TypedContractConfig {
        const config = this.raffleRegistrations.get(id);
        if (!config) throw new Error("MissingRegistrationContract");
        return config;
    }

    async handleRequest(
        message: LottoManagerRequestMessage,
        managerContractId: ContractId
    ): Promise<[LottoManagerResponseMessage | null, Array<[RegistrationContractId, Option<HexString> | null]>]> {
        switch (message.type) {
            case 'PropagateConfig': {
                const config = message.config;
                const [synchronizedContracts, txs] = await this.innerDoAction(
                    { type: 'SetConfigAndStart', config, contractId: 0n }, // contractId remplacé plus tard dans innerDoAction
                    message.contracts
                );

                const response : LottoManagerResponseMessage | null = synchronizedContracts.length > 0
                    ? {
                        type: 'ConfigPropagated',
                        contracts: synchronizedContracts,
                        hash: hashInput(config),
                    }
                    : null;

                return [response, txs];
            }

            case 'OpenRegistrations': {
                const drawNumber = message.drawNumber;
                const [synchronizedContracts, txs] = await this.innerDoAction(
                    { type: 'OpenRegistrations', drawNumber },
                    message.contracts
                );
                const response : LottoManagerResponseMessage | null = synchronizedContracts.length > 0
                    ? {
                        type: 'RegistrationsOpen',
                        drawNumber,
                        contracts: synchronizedContracts,
                }
                    : null;
                return [response, txs];
            }

            case 'CloseRegistrations': {
                const drawNumber = message.drawNumber;
                const [synchronizedContracts, txs] = await this.innerDoAction(
                    { type: 'CloseRegistrations', drawNumber },
                    message.contracts
                );
                const response : LottoManagerResponseMessage | null = synchronizedContracts.length > 0
                    ? {
                        type: 'RegistrationsClosed',
                        drawNumber,
                        contracts: synchronizedContracts,
                    }
                    : null;
                return [response, txs];
            }

            case 'GenerateSalt': {
                const drawNumber = message.drawNumber;
                const [synchronizedContracts, txs] = await this.innerDoAction(
                    { type: 'GenerateSalt', drawNumber },
                    message.contracts
                );
                if (synchronizedContracts.length === 0) return [null, txs];

                const indexer = new Indexer(this.getIndexerUrl());
                const salts: Map<RegistrationContractId, Salt> = new Map();

                for (const contractId of synchronizedContracts) {
                    try {
                        const salt = await indexer.querySalt(drawNumber, contractId);
                        salts.set(contractId, salt);
                    } catch (_) {
                        // handle error if needed
                    }
                }

                const response : LottoManagerResponseMessage | null  = salts.size > 0
                    ? {
                        type: 'SaltGenerated',
                        drawNumber,
                        salts,
                    }
                    : null;

                return [response, txs];
            }

            case 'DrawNumbers': {
                const drawNumber = message.drawNumber;
                const config = message.config;
                const salt = message.salt;
                const numbers = await this.innerGetNumbers(
                    managerContractId,
                    drawNumber,
                    config.nbNumbers,
                    config.minNumber,
                    config.maxNumber,
                    salt
                );
                const hash = hashInput([config, salt]);
                return [{
                    type: 'WinningNumbers',
                    drawNumber,
                    numbers,
                    hash
                }, []];
            }

            case 'CheckWinners': {
                const drawNumber = message.drawNumber;
                const numbers = message.numbers;
                const indexer = new Indexer(this.getIndexerUrl());
                const [winners1, winners2] = await indexer.queryWinners(drawNumber, numbers);
                const hash = hashInput(numbers);
                return [{
                    type: 'Winners',
                    drawNumber,
                    winners1,
                    winners2,
                    hash
                }, []];
            }

            case 'PropagateResults': {
                const drawNumber = message.drawNumber;
                const numbers = message.numbers;
                const hasWinner = message.hasWinner;
                const contractIds = message.contracts;
                const [synchronizedContracts, txs] = await this.innerDoAction(
                    { type: 'SetResults', drawNumber, numbers, hasWinner },
                    contractIds
                );
                const response = synchronizedContracts.length > 0
                    ? {
                        type: 'ResultsPropagated',
                        drawNumber,
                        synchronizedContracts,
                        hash: hashInput(numbers),
                    }
                    : null;
                return [response, txs];
            }

            default:
                throw new Error("Unknown message type");
        }
    }

    async innerDoAction(
        request: RequestForAction,
        contractIds: RegistrationContractId[]
    ): Promise<[RegistrationContractId[], Array<[RegistrationContractId, Option<HexString> | null]>]> {
        const synchronizedContracts: RegistrationContractId[] = [];
        const txs: Array<[RegistrationContractId, Option<HexString> | null]> = [];

        let targetDrawNumber: Option<DrawNumber>;
        let targetStatus: Option<RaffleRegistrationStatus>;

        switch (request.type) {
            case 'SetConfigAndStart':
                targetDrawNumber = new None();
                targetStatus = Option.of(RaffleRegistrationStatus.Started);
                break;
            case 'OpenRegistrations':
                targetDrawNumber = Option.of(request.drawNumber);
                targetStatus = Option.of(RaffleRegistrationStatus.RegistrationsOpen);
                break;
            case 'CloseRegistrations':
                targetDrawNumber = Option.of(request.drawNumber);
                targetStatus = Option.of(RaffleRegistrationStatus.RegistrationsClosed);
                break;
            case 'GenerateSalt':
                targetDrawNumber = Option.of(request.drawNumber);
                targetStatus = Option.of(RaffleRegistrationStatus.SaltGenerated);
                break;
            case 'SetResults':
                targetDrawNumber = Option.of(request.drawNumber);
                targetStatus = Option.of(RaffleRegistrationStatus.ResultsReceived);
                break;
        }

        for (const contractId of contractIds) {
            const contractConfig = this.raffleRegistrations.get(contractId);
            if (!contractConfig) throw new Error("MissingRegistrationContract");

            const contract: RaffleRegistrationContract = contractConfig.type === "Evm" ?
                new RaffleRegistrationEvmContract(contractConfig.config) :
                new RaffleRegistrationWasmContract(contractConfig.config)

            const actualRequest: RequestForAction = request.type === 'SetConfigAndStart'
                ? { ...request, contractId }
                : request;

            const [isSynced, tx] = await contract.doAction(
                targetDrawNumber,
                targetStatus,
                actualRequest,
            );

            if (isSynced) synchronizedContracts.push(contractId);
            txs.push([contractId, tx]);
        }

        return [synchronizedContracts, txs];
    }


}