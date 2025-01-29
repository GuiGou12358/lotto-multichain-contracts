import {readFileSync} from "fs";

export let seed_wasm : string;
export let seed_evm : string;
export let seed_payer : string;

export function readSeed(network: string) {
    if (network == 'testnet'){
        seed_wasm = readFileSync('.secret-testnet-wasm').toString().trim();
        seed_evm = readFileSync('.secret-testnet-evm').toString().trim();
        seed_payer = readFileSync('.secret-testnet-payer').toString().trim();
    } else if (network == 'mainnet'){
        seed_wasm = readFileSync('.secret-mainnet-wasm').toString().trim();
        seed_evm = readFileSync('.secret-mainnet-evm').toString().trim();
        seed_payer = readFileSync('.secret-mainnet-payer').toString().trim();
    } else {
        throw new Error("No config for this Network");
    }
}
