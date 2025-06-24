// TypeScript translation of the Rust `Indexer` struct and its methods

import axios from "axios";
import type {AccountId20, AccountId32, DrawNumber, RegistrationContractId, Salt} from "./types.ts";

interface ParticipationNode {
    accountId: string;
}

interface IndexerParticipationsResponse {
    data: {
        participations: {
            nodes: ParticipationNode[];
        };
    };
}

interface RaffleNode {
    salt: string;
}

interface IndexerRafflesResponse {
    data: {
        raffles: {
            nodes: RaffleNode[];
        };
    };
}

export class Indexer {
    endpoint: string;

    constructor(url?: string) {
        if (!url) throw "IndexerNotConfigured";
        this.endpoint = url;
    }

    async queryWinners(
        draw_number: DrawNumber,
        numbers: Number[]
    ): Promise<[AccountId32[], AccountId20[]]> {
        if (numbers.length === 0) throw new Error("NoNumber");

        const filterParts = [`{drawNumber:{equalTo:\"${draw_number}\"}}`];
        for (const n of numbers) {
            filterParts.push(`{numbers:{contains:\"${n}\"}}`);
        }
        const filter = `filter:{and:[${filterParts.join(",")}]}`;

        const body = {
            query: `{participations(${filter}){ nodes { accountId } }}`,
        };

        const response = await axios.post<IndexerParticipationsResponse>(this.endpoint, body, {
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
            },
        }).catch(() => { throw new Error("HttpRequestFailed"); });

        const nodes = response.data?.data?.participations?.nodes;
        if (!nodes) throw new Error("InvalidResponseBody");

        const winners_substrate: AccountId32[] = [];
        const winners_evm: AccountId20[] = [];

        for (const { accountId } of nodes) {
            if (accountId.length === 48) {
                try {
                    const raw = fromSs58(accountId);
                    if (raw.length !== 32) throw "InvalidKeyLength";
                    winners_substrate.push(new Uint8Array(raw));
                } catch {
                    throw new Error("InvalidSs58Address");
                }
            } else if (accountId.length === 42 && accountId.startsWith("0x")) {
                try {
                    const bytes = hexToBytes(accountId.slice(2));
                    if (bytes.length !== 20) throw "InvalidKeyLength";
                    winners_evm.push(bytes);
                } catch {
                    throw new Error("InvalidKeyLength");
                }
            } else {
                throw new Error("InvalidKeyLength");
            }
        }

        return [winners_substrate, winners_evm];
    }

    async querySalt(
        draw_number: DrawNumber,
        registration_contract_id: RegistrationContractId
    ): Promise<Salt> {
        const filter = `filter:{and:[{drawNumber:{equalTo:\"${draw_number}\"}},{registrationContractId:{equalTo:\"${registration_contract_id}\"}}]}`;

        const body = {
            query: `{raffles(${filter}){ nodes { salt } }}`,
        };

        const response = await axios.post<IndexerRafflesResponse>(this.endpoint, body, {
            headers: {
                "Content-Type": "application/json",
                Accept: "application/json",
            },
        }).catch(() => { throw "HttpRequestFailed"; });

        const nodes = response.data?.data?.raffles?.nodes;
        if (!nodes || nodes.length === 0) throw "NoSalt";

        const saltHex = nodes[0].salt;
        if (!saltHex.startsWith("0x")) throw new Error("InvalidResponseBody");

        return hexToBytes(saltHex.slice(2));
    }
}

// Helper functions
function fromSs58(ss58: string): Uint8Array {
    // Placeholder: use a proper SS58 decoding lib (e.g. @polkadot/util-crypto)
    throw new Error("SS58 decoding not implemented.");
}

function hexToBytes(hex: string): Uint8Array {
    if (hex.length % 2 !== 0) throw new Error("Invalid hex string");
    const bytes = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
        bytes[i / 2] = parseInt(hex.substr(i, 2), 16);
    }
    return bytes;
}
