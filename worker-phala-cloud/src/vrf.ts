import type {KeyringPair} from "@polkadot/keyring/types";
import {to_hex} from "@phala/dstack-sdk";
import {toHex} from "viem";

function vrf(pair: KeyringPair, salt: Uint8Array) : Uint8Array {
    return pair.derive("/"+to_hex(salt)).addressRaw;
}

const MAX_U32 = Math.pow(2, 32);

export function getRandomNumber(pair: KeyringPair, salt: Uint8Array, min: number, max: number) : number {
    if (min >= max){
        throw new Error("max must be greater than min");
    }
    if (min < 0 || max < 0){
        throw new Error("min maw must be greater than 0");
    }
    if (min > MAX_U32 || max > MAX_U32){
        throw new Error("min maw must be lower than 2^32");
    }

    const output = vrf(pair, salt);
    // keep only 4 bytes to compute the random u32
    const u32 = output.slice(0, 4);
    const random = parseInt(toHex(u32), 16);
    return random % (max - min + 1) + min;
}

export function verify(pair: KeyringPair, salt: Uint8Array, min: number, max: number, n: number) : boolean {
    return n === getRandomNumber(pair, salt, min, max);
}
