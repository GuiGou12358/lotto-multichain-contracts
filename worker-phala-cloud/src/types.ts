export type DrawNumber = number;
export type Number = number;
export type RegistrationContractId = bigint;
export type Salt = Uint8Array;
export type AccountId = AccountId32 | AccountId20; // 32 bytes
export type AccountId32 = Uint8Array; // 32 bytes
export type AccountId20 = Uint8Array; // 20 bytes
export type ContractId = string;
export type Hash = Uint8Array;

export interface ContractConfig {
    rpc: string;
    contractId: ContractId;
    attestorKey: string;
    senderKey?: string;
}

export type TypedContractConfig =
    | { type: "Wasm"; config: ContractConfig }
    | { type: "Evm"; config: ContractConfig };

export interface RaffleConfig {
    nbNumbers: number;
    minNumber: Number;
    maxNumber: Number;
}