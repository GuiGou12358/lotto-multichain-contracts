import LottoRegistrationMetadata from "./metadata/lotto_registration_contract.json";
import LottoManagerMetadataWasm from "./metadata/lotto_registration_manager_contract.json";
import {Keyring} from '@polkadot/api';
import {ContractPromise} from "@polkadot/api-contract";
import {getApi, query, tx} from "./wasmContractHelper";
import {KeyringPair} from "@polkadot/keyring/types";

export class RaffleManagerWasm {

  private readonly rpc: string;
  private readonly address: string;
  private signer : KeyringPair;
  private contract: ContractPromise;

  public constructor(rpc: string, address: string) {
    this.rpc = rpc;
    this.address = address;
  }

  public async init() {

    if (this.contract) {
      return;
    }
    const api = await getApi(this.rpc);
    this.signer = new Keyring({ type: 'sr25519' }).addFromUri('venture risk wrong bitter job tube lake regular creek spice chalk menu');
    this.contract = new ContractPromise(api, LottoManagerMetadataWasm, this.address);
  }

  public async getStatus(): Promise<string> {
    const status = await query(this.contract, 'raffleManager::getStatus');
    console.log('Status for manager %s (%s): %s', this.address, this.rpc, status);
    return status;
  }

  public async getDrawNumber(): Promise<string> {
    const drawNumber = await query(this.contract, 'raffleManager::getDrawNumber');
    console.log('Draw Number for manager %s (%s): %s', this.address, this.rpc, drawNumber);
    return drawNumber;
  }

  public async canCloseRegistrations(): Promise<boolean> {
    const result = await query(this.contract, 'canCloseRegistrations');
    console.log('Manager %s can close the registrations: %s', this.address, result);
    return result;
  }

  public async closeRegistrations(): Promise<void> {
    console.log('Raffle Manager - Close the registrations');
    return await tx(this.contract, this.signer, 'closeRegistrations');
  }

  public async hasPendingMessage(): Promise<boolean> {
    const result = await query(this.contract, 'hasPendingMessage');
    console.log('Manager %s has pending message : %s', this.address, result);
    return result;
  }

}


export class RaffleRegistrationWasm {

  private readonly rpc: string;
  private readonly address: string;
  private contract: ContractPromise;

  public constructor(rpc: string, address: string) {
    this.rpc = rpc;
    this.address = address;
  }

  public async init() {

    if (this.contract) {
      return;
    }

    const api = await getApi(this.rpc);
    this.contract = new ContractPromise(api, LottoRegistrationMetadata, this.address);
  }

  public async getStatus(): Promise<string> {
    const json = await query(this.contract, 'raffle::getStatus');
    console.log('Status for %s (%s): %s', this.address, this.rpc, json);
    return json.ok;
  }

  public async getDrawNumber(): Promise<string> {
    const json = await query(this.contract, 'raffle::getDrawNumber');
    console.log('Draw Number for %s (%s): %s', this.address, this.rpc, json);
    return json.ok;
  }
}
