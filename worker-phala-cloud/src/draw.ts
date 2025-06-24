// TypeScript port of the Rust ink! Draw logic
// ⚠️ Requires WASM-compatible random VRF provider and Blake2 hashing (subtle crypto or custom implementation)

import { blake2b } from "@noble/hashes/blake2b";

// Types (aliases)
type WasmContractId = Uint8Array; // [u8; 32]
type Salt = Uint8Array;           // Vec<u8>
type DrawNumber = number;         // u64
type Number = number;             // u64 or u8 depending on context

export type RaffleDrawError =
    | "RaffleConfigInvalid"
    | "MinGreaterThanMax"
    | "AddOverFlow"
    | "SubOverFlow"
    | "DivByZero"
    | "UnknownError";

interface SaltVrf {
    contract_id: WasmContractId;
    salt: Salt;
    draw_number: DrawNumber;
    number: number;
}

export class Draw {
    nb_numbers: number;
    smallest_number: Number;
    biggest_number: Number;

    constructor(nb_numbers: number, smallest_number: Number, biggest_number: Number) {
        if (nb_numbers === 0) throw "RaffleConfigInvalid";
        if (smallest_number > biggest_number) throw "MinGreaterThanMax";

        this.nb_numbers = nb_numbers;
        this.smallest_number = smallest_number;
        this.biggest_number = biggest_number;
    }

    async verify_numbers(
        contract_id: WasmContractId,
        draw_number: DrawNumber,
        salt: Salt,
        numbers: Number[]
    ): Promise<boolean> {
        const winning_numbers = await this.get_numbers(contract_id, draw_number, salt);
        if (winning_numbers.length !== numbers.length) return false;
        return numbers.every(n => winning_numbers.includes(n));
    }

    async get_numbers(
        contract_id: WasmContractId,
        draw_number: DrawNumber,
        salt: Salt
    ): Promise<Number[]> {
        const numbers: Number[] = [];
        let i = 0;

        while (numbers.length < this.nb_numbers) {
            const saltVrf: SaltVrf = {
                contract_id,
                salt,
                draw_number,
                number: i,
            };

            const encoded = this.encode_salt_vrf(saltVrf);
            const hash = blake2b(encoded, { dkLen: 32 });
            const num = this.get_number(hash, this.smallest_number, this.biggest_number);

            if (!numbers.includes(num)) numbers.push(num);
            if (i >= 255) throw "AddOverFlow";
            i++;
        }

        return numbers;
    }

    encode_salt_vrf(saltVrf: SaltVrf): Uint8Array {
        const draw_number_bytes = new Uint8Array(new BigUint64Array([BigInt(saltVrf.draw_number)]).buffer);
        return new Uint8Array([
            ...saltVrf.contract_id,
            ...saltVrf.salt,
            ...draw_number_bytes,
            saltVrf.number,
        ]);
    }

    get_number(salt: Uint8Array, min: Number, max: Number): Number {
        // Simulate a VRF output by using the salt directly
        const rand_u64 = Number(BigInt(`0x${Buffer.from(salt.slice(0, 8)).toString("hex")}`));

        const a = BigInt(max) - BigInt(min) + 1n;
        if (a <= 0n) throw "SubOverFlow";

        const b = BigInt(rand_u64) % a;
        const r = b + BigInt(min);

        return Number(r);
    }
}

