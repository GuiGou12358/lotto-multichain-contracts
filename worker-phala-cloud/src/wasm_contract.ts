import type {ContractConfig} from './types';
import {
    type RaffleRegistrationContract,
    RaffleRegistrationStatus,
    type RequestForAction
} from "./raffle_registration_contract.ts";
import {InkClient} from "@guigou/sc-rollup-ink-v5";
import {bool, Bytes, Enum, Struct, Tuple, u128, u16, u32, u8, Vector} from "scale-ts";
import {hexAddPrefix} from "@polkadot/util";
import {type HexString, Option} from "@guigou/sc-rollup-core";

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

const raffleConfigCodec = Struct({
    nbNumbers: u8,
    minNumber: u16,
    maxNumber: u16,
}
);

const requestForActionCodec = Enum({
    SetConfigAndStart: Tuple(raffleConfigCodec, u128),
    OpenRegistrations: Tuple(u32),
    CloseRegistrations: Tuple(u32),
    GenerateSalt: Tuple(u32),
    SetResults: Tuple(u32, Vector(u16) ,bool),
})

// Constants
const DRAW_NUMBER = '0x44524157'; // assuming ink::selector_id!("DRAW_NUMBER")
const STATUS = '0x53544154'; // assuming ink::selector_id!("STATUS")

export class RaffleRegistrationWasmContract implements RaffleRegistrationContract {
    private client: InkClient<any, any>;

    constructor(config: ContractConfig | null) {
        if (!config) throw new Error('WasmContractNotConfigured');

        this.client = new InkClient<any, any>(
            config.rpc,
            config.contractId,
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
            return status.map(this.decodeStatus);
        } catch (err) {
            console.error('Status unknown in kv store');
            throw new Error('StatusUnknown');
        }
    }

    decodeStatus(status: number): RaffleRegistrationStatus {
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


    async doAction(
        targetDrawNumber: Option<number>,
        targetStatus: Option<RaffleRegistrationStatus>,
        action: RequestForAction,
    ): Promise<[boolean, Option<HexString> | null]> {

        const status = await this.getStatus();
        const drawNumber = await this.getDrawNumber();

        if (drawNumber === targetDrawNumber && status === targetStatus) {
            return [true, null]; // Already synchronized
        }

        const encodedAction = this.encodeRequest(action);
        this.client.addAction(encodedAction);

        const tx = await this.client.commit();
        return [false, tx];
    }

    encodeRequest(request: RequestForAction): {} {
        const tag = request.tag;
        switch (request.tag) {
            case 'SetConfigAndStart': {
                const config = request.config;
                const nbNumbers = config.nbNumbers;
                const minNumber = config.minNumber;
                const maxNumber = config.maxNumber;
                return {
                    tag,
                    value: [{nbNumbers, minNumber, maxNumber}, request.contractId],
                };
            }
            case 'OpenRegistrations':
            case 'CloseRegistrations':
            case 'GenerateSalt': {
                const drawNumber = request.drawNumber;
                return {
                    tag,
                    value: drawNumber,
                };
            }
            case 'SetResults': {
                const drawNumber = request.drawNumber;
                const numbers = request.numbers;
                const hasWinner = request.hasWinner;
                return {
                    tag,
                    value: [drawNumber, numbers, hasWinner],
                };
            }
        }
    }
}





