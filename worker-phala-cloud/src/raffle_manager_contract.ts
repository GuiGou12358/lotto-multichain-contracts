import {type ContractConfig, type Hash, type Number, type Salt} from "./types.ts";
import {type HexString, Option} from "@guigou/sc-rollup-core";
import {hexAddPrefix} from "@polkadot/util";
import {InkClient} from "@guigou/sc-rollup-ink-v5";
import {
    DRAW_NUMBER,
    type LottoManagerRequestMessage,
    lottoManagerRequestMessageCodec,
    type LottoManagerResponseMessage,
    lottoManagerResponseMessageCodec,
    raffleConfigCodec,
    type RaffleConfigStruct,
    saltCodec,
    STATUS
} from "./wasm_codec.ts";
import {hasher} from "@polkadot/util-crypto/secp256k1/hasher";
import {Tuple, u16, Vector} from "scale-ts";
import {astar} from "@polkadot-api/descriptors";
import {createClient, type PolkadotClient} from "polkadot-api";
import {withPolkadotSdkCompat} from "polkadot-api/polkadot-sdk-compat";
import {getWsProvider} from "polkadot-api/ws-provider/web";


export const NEXT_CLOSING_REGISTRATIONS = '0xc2ec951c'; // assuming ink::selector_id!("NEXT_CLOSING_REGISTRATIONS")

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

export function decodeStatus(status: number): RaffleManagerStatus {
    switch (status) {
        case 0: return RaffleManagerStatus.NotStarted;
        case 1: return RaffleManagerStatus.Started;
        case 2: return RaffleManagerStatus.RegistrationsOpen;
        case 3: return RaffleManagerStatus.RegistrationsClosed;
        case 4: return RaffleManagerStatus.WaitingSalt;
        case 5: return RaffleManagerStatus.WaitingResult;
        case 6: return RaffleManagerStatus.WaitingSalt;
        case 7: return RaffleManagerStatus.WaitingWinner;
        case 8: return RaffleManagerStatus.DrawFinished;
        default: throw new Error('FailedToDecodeStatus');
    }

}

export interface RaffleManagerContract {
    pollMessage(): Promise<Option<LottoManagerRequestMessage>>;
    doAction(action: LottoManagerResponseMessage): Promise<Option<HexString>>;
    getDrawNumber(): Promise<Option<number>>;
    getStatus(): Promise<Option<RaffleManagerStatus>>;
    closeRegistrationsIfNecessary(): Promise<void>;
}


export class RaffleManagerWasmContract implements RaffleManagerContract {
    private client: InkClient<LottoManagerRequestMessage, LottoManagerResponseMessage>;
    private polkadotClient : PolkadotClient;

    constructor(config: ContractConfig | null) {
        if (!config) throw new Error('WasmContractNotConfigured');

        this.client = new InkClient<LottoManagerRequestMessage, LottoManagerResponseMessage>(
            config.rpc,
            config.address,
            hexAddPrefix(config.attestorKey),
            config.senderKey ? hexAddPrefix(config.senderKey) : undefined,
            lottoManagerRequestMessageCodec,
            lottoManagerResponseMessageCodec
        );
        this.polkadotClient = createClient(withPolkadotSdkCompat(getWsProvider(config.rpc)));

    }

    async getDrawNumber(): Promise<Option<number>> {
        try {
            return await this.client.getNumber(DRAW_NUMBER, 'u32');
        } catch (err) {
            console.error('Draw number unknown in kv store');
            throw new Error('DrawNumberUnknown');
        }
    }

    async getStatus(): Promise<Option<RaffleManagerStatus>> {
        try {
            const status = await this.client.getNumber(STATUS, 'u8');
            return status.map(decodeStatus);
        } catch (err) {
            console.error('Status unknown in kv store');
            throw new Error('StatusUnknown');
        }
    }

    async pollMessage() : Promise<Option<LottoManagerRequestMessage>> {
        await this.client.startSession();
        return this.client.pollMessage();
    }

    doAction(action: LottoManagerResponseMessage): Promise<Option<HexString>> {
        this.client.addAction(action);
        // commit only if we sent a response, this way the message stay in the queue.
        return this.client.commit();
    }

    async closeRegistrationsIfNecessary() {

        await this.client.startSession();

        const oNextClosingRegistrations = await this.client.getNumber(NEXT_CLOSING_REGISTRATIONS, 'u32');
        const nextClosingRegistrations = oNextClosingRegistrations.valueOf();
        if (!nextClosingRegistrations){
            console.warn('Next closing registration number unknown in kv store');
            return;
        }
        console.warn('Closing registration at block : %s ', nextClosingRegistrations);
        const blockNumber = await this.polkadotClient.getTypedApi(astar).query.System.Number.getValue();
        console.warn('Current block number : %s ', blockNumber);
        if (blockNumber >= nextClosingRegistrations) {
            this.client.addAction({ tag: 'CloseRegistrations', value: [] });
            const tx = await this.client.commit();
            console.log('Registrations closed : ' + tx);
        }
    }

}

export function hashInputConfig(config: RaffleConfigStruct): Hash {
    const encoded = raffleConfigCodec.enc(config);
    return hasher('blake2', encoded);
}

export function hashInputNumbers(numbers: Number[]): Hash {
    const codec = Vector(u16);
    const encoded = codec.enc(numbers);
    return hasher('blake2', encoded);
}

export function hashInputConfigAndSalt(config: RaffleConfigStruct, salt: Salt): Hash {
    const codec = Tuple(raffleConfigCodec, saltCodec);
    const encoded = codec.enc([config, salt]);
    return hasher('blake2', encoded);
}