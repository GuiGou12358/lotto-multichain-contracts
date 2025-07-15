// TypeScript migration of the provided Rust code

// TypeScript migration of the provided Rust code
import {type BytesLike, ethers} from "ethers";
import type {ContractConfig, DrawNumber} from './types';
import {
    type RaffleRegistrationContract,
    RaffleRegistrationStatus,
    type RequestForAction
} from './raffle_registration_contract';
import {type Coder, type HexString, Option} from "@guigou/sc-rollup-core";
import {hexAddPrefix} from "@polkadot/util";
import {EvmClient} from "@guigou/sc-rollup-evm";

// Constants
const DRAW_NUMBER = '0x5f647261774e756d626572'; // assuming bytes public constant DRAW_NUMBER = "_drawNumber";
const STATUS = '0x5f737461747573'; // assuming bytes public constant STATUS = "_status";

export class RawMessageCoder implements Coder<BytesLike> {
    decode(raw: HexString): BytesLike {
        return raw
    }
    encode(message: BytesLike): HexString {
        return hexAddPrefix(message.toString())
    }
}

const abiCoder = ethers.AbiCoder.defaultAbiCoder()

function abiEncode(type: string, value: any) {
    return abiCoder.encode([type], [value])
}


export class RequestForActionCoder implements Coder<RequestForAction> {
    decode(raw: HexString): RequestForAction {
        throw new Error("Not Implemented");
    }
    encode(message: RequestForAction): HexString {

        const codes = {
            SetConfigAndStart: 0,
            OpenRegistrations: 1,
            CloseRegistrations: 2,
            GenerateSalt: 3,
            SetResults: 4,
        };
        const tag = codes[message.type];

        let body: string;

        switch (message.type) {
            case 'SetConfigAndStart': {
                const config = message.config;
                body = abiCoder.encode(['uint8', 'uint', 'uint', 'uint'], [config.nbNumbers, config.minNumber, config.maxNumber, message.contractId]);
                break;
            }
            case 'OpenRegistrations':
            case 'CloseRegistrations':
            case 'GenerateSalt': {
                body = abiCoder.encode(['uint'], [message.drawNumber]);
                break;
            }
            case 'SetResults': {
                body = abiCoder.encode(['uint', 'uint[]', 'bool'], [message.drawNumber, message.numbers, message.hasWinner]);
                break;
            }
        }
        const encoded = abiCoder.encode(['uint8', 'bytes'], [tag, body]);
        return hexAddPrefix(encoded)
    }
}

export class RaffleRegistrationEvmContract implements RaffleRegistrationContract {
    private client: EvmClient<BytesLike, RequestForAction>;

    constructor(config: ContractConfig | null) {
        if (!config) throw new Error('EvmContractNotConfigured');

        this.client = new EvmClient<BytesLike, RequestForAction>(
            config.rpc,
            config.address,
            hexAddPrefix(config.attestorKey),
            config.senderKey ? hexAddPrefix(config.senderKey) : undefined,
            new RawMessageCoder(),
            new RequestForActionCoder(),
        );
    }

    async getDrawNumber(): Promise<Option<number>> {
        try {
            return await this.client.getNumber(DRAW_NUMBER, 'u32');
        } catch (err) {
            console.error('Draw number unknown in kv store');
            throw new Error('DrawNumberUnknown');
        }
    }

    async getStatus(): Promise<Option<RaffleRegistrationStatus>> {
        try {
            const status = await this.client.getNumber(STATUS, 'u8');
            return status.map(decodeStatus);
        } catch (err) {
            console.error('Status unknown in kv store');
            throw new Error('StatusUnknown');
        }
    }

    startSession(): Promise<void> {
        return this.client.startSession();
    }

    public async isSynced(
        expectedDrawNumber: Option<DrawNumber>,
        expectedStatus: Option<RaffleRegistrationStatus>
    ): Promise<boolean> {
        const correctStatus = expectedStatus.isNone() || (await this.getStatus()).valueOf() === expectedStatus.valueOf();
        const correctDrawNumber = expectedDrawNumber.isNone() || (await this.getDrawNumber()).valueOf() === expectedDrawNumber.valueOf();
        return correctStatus && correctDrawNumber;
    }

    public doAction(
        action: RequestForAction
    ): Promise<Option<HexString>> {
        this.client.addAction(action);
        return this.client.commit();
    }
}

function decodeStatus(status: number): RaffleRegistrationStatus {
    switch (status) {
        case 0: return RaffleRegistrationStatus.NotStarted;
        case 1: return RaffleRegistrationStatus.Started;
        case 2: return RaffleRegistrationStatus.RegistrationsOpen;
        case 3: return RaffleRegistrationStatus.RegistrationsClosed;
        case 4: return RaffleRegistrationStatus.SaltGenerated;
        case 5: return RaffleRegistrationStatus.ResultsReceived;
        default: throw new Error('FailedToDecodeStatus');
    }
}

