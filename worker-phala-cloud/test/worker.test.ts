import {expect, test} from "bun:test";
import {hashInputConfig, LottoWorker} from "../src/worker.ts";
import type {ContractConfig, RegistrationContractId} from "../src/types.ts";
import {toHex} from "viem";

function getRaffleManagerConfig() : ContractConfig {

    const address = process.env.MANAGER_ADDRESS;
    const rpc = process.env.MANAGER_RPC;
    const attestorKey = process.env.ATTESTOR_PK;

    if (!address){
        throw new Error("Manager address is missing!");
    }
    if (!rpc){
        throw new Error("Manager rpc is missing!");
    }
    if (!attestorKey){
        throw new Error("Manager attestor key is missing!");
    }
    return {
        address,
        rpc,
        attestorKey,
        senderKey: undefined,
    };
}


function getRaffleRegistrationConfigs() : Map<RegistrationContractId, ContractConfig> {

    let raffleRegistrationConfigs: Map<RegistrationContractId, ContractConfig> = new Map();
    const registration1Id = process.env.REGISTRATION_1_ID;
    const registration1rpc = process.env.REGISTRATION_1_RPC;
    const registration1address = process.env.REGISTRATION_1_ADDRESS;

    const attestorKey = process.env.ATTESTOR_PK;

    if (!registration1Id || !registration1rpc || !registration1address || !attestorKey){
        throw new Error("The config for the registration 1 is missing!");
    }
    raffleRegistrationConfigs.set(BigInt(registration1Id),
        {
            address: registration1address,
            rpc: registration1rpc,
            attestorKey,
            senderKey: undefined,
        }
    );

    const registration2Id = process.env.REGISTRATION_2_ID;
    const registration2rpc = process.env.REGISTRATION_2_RPC;
    const registration2address = process.env.REGISTRATION_2_ADDRESS;


    if (!registration2Id || !registration2rpc || !registration2address || !attestorKey){
        throw new Error("The config for the registration 2 is missing!");
    }
    raffleRegistrationConfigs.set(BigInt(registration2Id),
        {
            address: registration2address,
            rpc: registration2rpc,
            attestorKey,
            senderKey: undefined,
        }
    );

    return raffleRegistrationConfigs;
}


function getLottoWorker() : LottoWorker {

    const indexerUrl = process.env.INDEXER_URL;

    if (!indexerUrl){
        throw new Error("Indexer url is missing!");
    }
    return new LottoWorker(
        getRaffleManagerConfig(),
        getRaffleRegistrationConfigs(),
        indexerUrl,
    )
}

const worker = getLottoWorker();

test("hash config", async () => {
    const hash = hashInputConfig({
        nbNumbers: 4,
        minNumber: 1,
        maxNumber: 50,
    })
    expect(toHex(hash)).toBe("0x1af688b7e4ccbd51529a15d28753270a04adf361d4eb1cbd9553ef19d353c656");
});

test("pollMessages", async () => {
    await worker.pollMessages();
}, {timeout: 1200000});
