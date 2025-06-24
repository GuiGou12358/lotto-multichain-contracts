// TypeScript migration of the provided Rust code

import {decode, encode, ParamType, Token} from 'ethabi';
import type {ContractConfig, DrawNumber} from './types';
import {
    type RaffleRegistrationContract,
    RaffleRegistrationStatus,
    type RequestForAction
} from './raffle_registration_contract';
import {type HexString, Option} from "@guigou/sc-rollup-core";
import {hexAddPrefix} from "@polkadot/util";
import {EvmClient} from "@guigou/sc-rollup-evm";


export class RaffleRegistrationEvmContract implements RaffleRegistrationContract {
    private client: EvmClient<any>;

    constructor(config: ContractConfig | null) {
        if (!config) throw new Error('EvmContractNotConfigured');

        this.client = new EvmClient<any>(
            config.rpc,
            config.contractId,
            hexAddPrefix(config.attestorKey),
            config.senderKey ? hexAddPrefix(config.senderKey) : undefined,
        );
    }

    public async doAction(
        expectedDrawNumber: Option<DrawNumber>,
        expectedStatus: Option<RaffleRegistrationStatus>,
        action: RequestForAction
    ): Promise<[boolean, Option<HexString> | null]> {

        const correctStatus = expectedStatus === null || (await getStatus(client)) === expectedStatus;
        const correctDrawNumber = expectedDrawNumber === null || (await getDrawNumber(client)) === expectedDrawNumber;

        if (correctStatus && correctDrawNumber) {
            return [true, null];
        }

        const encodedAction = encodeRequest(action);
        this.client.addAction(encodedAction);
        const tx = await this.client.commit();
        return [false, tx];
    }
}

function encodeRequest(request: RequestForAction): Uint8Array {
    const codes = {
        SetConfigAndStart: 0,
        OpenRegistrations: 1,
        CloseRegistrations: 2,
        GenerateSalt: 3,
        SetResults: 4,
    };

    let body: Uint8Array;
    let tag: number;

    switch (request.tag) {
        case 'SetConfigAndStart': {
            tag = codes.SetConfigAndStart;
            const config = request.config;
            const contractId = request.contractId;
            body = encode([
                Token.Uint(BigInt(config.nbNumbers)),
                Token.Uint(BigInt(config.minNumber)),
                Token.Uint(BigInt(config.maxNumber)),
                Token.Uint(BigInt(contractId)),
            ]);
            break;
        }
        case 'OpenRegistrations':
        case 'CloseRegistrations':
        case 'GenerateSalt': {
            tag = codes[request.tag];
            const drawNumber = BigInt(request.drawNumber);
            body = encode([Token.Uint(drawNumber)]);
            break;
        }
        case 'SetResults': {
            tag = codes.SetResults;
            const drawNumber = request.drawNumber;
            const numbers = request.numbers;
            const hasWinner = request.hasWinner;
            body = encode([
                Token.Uint(BigInt(drawNumber)),
                Token.Array(numbers.map(n => Token.Uint(BigInt(n)))),
                Token.Bool(hasWinner),
            ]);
            break;
        }
    }

    return encode([Token.Uint(BigInt(tag)), Token.Bytes(body)]);
}

async function getDrawNumber(client: EvmClient): Promise<DrawNumber | null> {
    const key = Buffer.from('5f647261774e756d626572', 'hex');
    const raw = await client.get(key).catch(() => null);
    return raw ? decodeDrawNumber(raw) : null;
}

function decodeDrawNumber(raw: Uint8Array): DrawNumber {
    const tokens = decode([ParamType.Uint(32)], raw);
    const value = tokens[0] as Token.Uint;
    return Number(value.value.toString());
}

async function getStatus(client: EvmRollupClient): Promise<RaffleRegistrationStatus | null> {
    const key = Buffer.from('5f737461747573', 'hex');
    const raw = await client.session().get(key).catch(() => null);
    return raw ? decodeStatus(raw) : null;
}

function decodeStatus(raw: Uint8Array): RaffleRegistrationStatus {
    const tokens = decode([ParamType.Uint(32)], raw);
    const status = Number((tokens[0] as Token.Uint).value);
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

