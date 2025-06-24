import type {AccountId20, AccountId32, DrawNumber, Hash, RaffleConfig, RegistrationContractId, Salt} from "./types.ts";

export enum RaffleManagerStatus {
    NotStarted = 'NotStarted',
    Started = 'Started',
    RegistrationsOpen = 'RegistrationsOpen',
    RegistrationsClosed = 'RegistrationsClosed',
    WaitingSalt = 'WaitingSalt',
    WaitingResult = 'WaitingResult',
    WaitingWinner = 'WaitingWinner',
    DrawFinished = 'DrawFinished'
}

export type LottoManagerRequestMessage =
    | { type: 'PropagateConfig'; config: RaffleConfig; contracts: RegistrationContractId[] }
    | { type: 'OpenRegistrations'; drawNumber: DrawNumber; contracts: RegistrationContractId[] }
    | { type: 'CloseRegistrations'; drawNumber: DrawNumber; contracts: RegistrationContractId[] }
    | { type: 'GenerateSalt'; drawNumber: DrawNumber; contracts: RegistrationContractId[] }
    | { type: 'DrawNumbers'; drawNumber: DrawNumber; config: RaffleConfig; salt: Salt }
    | { type: 'CheckWinners'; drawNumber: DrawNumber; numbers: Number[] }
    | { type: 'PropagateResults'; drawNumber: DrawNumber; numbers: Number[]; hasWinner: boolean; contracts: RegistrationContractId[] };

// Message du rollup côté manager
export type LottoManagerResponseMessage =
    | { type: 'ConfigPropagated'; contracts: RegistrationContractId[]; hash: Hash }
    | { type: 'RegistrationsOpen'; drawNumber: DrawNumber; contracts: RegistrationContractId[] }
    | { type: 'RegistrationsClosed'; drawNumber: DrawNumber; contracts: RegistrationContractId[] }
    | { type: 'SaltGenerated'; drawNumber: DrawNumber; salts: Map<RegistrationContractId, Salt> }
    | { type: 'WinningNumbers'; drawNumber: DrawNumber; numbers: Number[]; hash: Hash }
    | { type: 'Winners'; drawNumber: DrawNumber; winners1: AccountId32[]; winners2: AccountId20[]; hash: Hash }
    | { type: 'ResultsPropagated'; drawNumber: DrawNumber; contracts: RegistrationContractId[]; hash: Hash }
    | { type: 'CloseRegistrations' };