import type {ContractConfig, DrawNumber, Number, RegistrationContractId} from './types';
import {
    type RaffleRegistrationContract,
    RaffleRegistrationStatus,
    type RequestForAction
} from "./raffle_registration_contract.ts";
import {InkClient} from "@guigou/sc-rollup-ink-v5";
import {bool, Bytes, type Codec, Enum, Struct, Tuple, u128, u16, u32, u8, Vector} from "scale-ts";
import {hexAddPrefix} from "@polkadot/util";
import {type HexString, Option} from "@guigou/sc-rollup-core";


// Constants
const DRAW_NUMBER = '0x6dcf72cf'; // assuming ink::selector_id!("DRAW_NUMBER")
const STATUS = '0x370f6b87'; // assuming ink::selector_id!("STATUS")


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

    public async isSynched(
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

type RaffleConfigStruct = {
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

type RequestForActionStruct =
    | { tag: 'SetConfigAndStart'; value: [RaffleConfigStruct, RegistrationContractId] }
    | { tag: 'OpenRegistrations'; value:[DrawNumber] }
    | { tag: 'CloseRegistrations'; value:[DrawNumber]  }
    | { tag: 'GenerateSalt'; value:[DrawNumber]  }
    | { tag: 'SetResults'; value: [DrawNumber, Number[], boolean] };

const requestForActionCodec : Codec<RequestForActionStruct> = Enum({
    SetConfigAndStart: Tuple(raffleConfigCodec, u128),
    OpenRegistrations: Tuple(u32),
    CloseRegistrations: Tuple(u32),
    GenerateSalt: Tuple(u32),
    SetResults: Tuple(u32, Vector(u16) ,bool),
})

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





