export type DrawNumber = number;
export type Number = number;
export type RegistrationContractId = bigint;
export type Salt = Uint8Array; // n bytes
export type AccountId = AccountId32 | AccountId20; // 32 bytes
export type AccountId32 = Uint8Array; // 32 bytes
export type AccountId20 = Uint8Array; // 20 bytes
export type Hash = Uint8Array; // 32 bytes

export interface ContractConfig {
    rpc: string;
    address: string;
    attestorKey: string;
    senderKey?: string;
}

export interface RaffleConfig {
    nbNumbers: number;
    minNumber: Number;
    maxNumber: Number;
}