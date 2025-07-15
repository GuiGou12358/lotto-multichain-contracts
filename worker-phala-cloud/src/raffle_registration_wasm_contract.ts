import type {ContractConfig, DrawNumber} from './types';
import {
    type RaffleRegistrationContract,
    RaffleRegistrationStatus,
    type RequestForAction
} from "./raffle_registration_contract.ts";
import {InkClient} from "@guigou/sc-rollup-ink-v5";
import {Bytes} from "scale-ts";
import {hexAddPrefix} from "@polkadot/util";
import {type HexString, Option} from "@guigou/sc-rollup-core";
import {DRAW_NUMBER, requestForActionCodec, type RequestForActionStruct, STATUS} from "./wasm_codec.ts";

export class RaffleRegistrationWasmContract implements RaffleRegistrationContract {
    private client: InkClient<any, RequestForActionStruct>;

    constructor(config: ContractConfig | null) {
        if (!config) throw new Error('WasmContractNotConfigured');

        this.client = new InkClient<any, RequestForActionStruct>(
            config.rpc,
            config.address,
            hexAddPrefix(config.attestorKey),
            config.senderKey ? hexAddPrefix(config.senderKey) : undefined,
            Bytes(),
            requestForActionCodec
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

    doAction(action: RequestForAction): Promise<Option<HexString>> {
        this.client.addAction(encodeStruct(action));
        return this.client.commit();
    }

}


function encodeStruct(request: RequestForAction): RequestForActionStruct {
    switch (request.type) {
        case 'SetConfigAndStart': {
            const config = request.config;
            const nbNumbers = config.nbNumbers;
            const minNumber = config.minNumber;
            const maxNumber = config.maxNumber;
            return {
                tag : request.type,
                value: [{nbNumbers, minNumber, maxNumber}, request.contractId],
            };
        }
        case 'OpenRegistrations':
        case 'CloseRegistrations':
        case 'GenerateSalt': {
            return {
                tag : request.type,
                value: [request.drawNumber],
            };
        }
        case 'SetResults': {
            return {
                tag : request.type,
                value: [request.drawNumber, request.numbers, request.hasWinner],
            };
        }
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