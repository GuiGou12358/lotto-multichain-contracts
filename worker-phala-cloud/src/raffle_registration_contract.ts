import type {DrawNumber, Number, RaffleConfig, RegistrationContractId} from './types';
import {type HexString, Option} from "@guigou/sc-rollup-core";

export enum RaffleRegistrationStatus {
    NotStarted,
    Started,
    RegistrationsOpen,
    RegistrationsClosed,
    SaltGenerated,
    ResultsReceived
}

export type RequestForAction =
    | { type: 'SetConfigAndStart'; config: RaffleConfig; contractId: RegistrationContractId }
    | { type: 'OpenRegistrations'; drawNumber: DrawNumber }
    | { type: 'CloseRegistrations'; drawNumber: DrawNumber }
    | { type: 'GenerateSalt'; drawNumber: DrawNumber }
    | { type: 'SetResults'; drawNumber: DrawNumber; numbers: Number[], hasWinner: boolean };

export interface RaffleRegistrationContract {
    doAction(
        targetDrawNumber: Option<number>,
        targetStatus: Option<RaffleRegistrationStatus>,
        action: RequestForAction
    ): Promise<[boolean, Option<HexString> | null]>;
}