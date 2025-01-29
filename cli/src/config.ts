const poc6LottoDrawAddress = '0x269bdbdef7285a1bdba7f68c79c1165705f20508e5e7c545b4fd10a6f345523e';
const shibuyaLottoManagerAddress = 'acKRTkuTsGESFmsy3wcvWTyfRW6xL4QY1gMhjNVtD5yUB7d';
const shibuyaRegistrationContractAddress = 'bSm4f7WjbxFMbo4fRUGw7oHvva65P8m8jCqedFsXAwUJx7V';
const moonbaseRegistrationContractAddress = '0x987461a5eF325f9f217D2b777CeDCf3b9c4D62d5';
const minatoRegistrationContractAddress = '0x04d884675E5790721cb5F24D41D460E921C08f17';

// poc6
const phalaLottoDrawAddress = '0xa41292a45bb4103c72796409d557416cc259ffb420a94fb433ae4c942fdc1218';
const astarLottoManagerAddress = 'Y4j9j5EsehgPAjL6HHMMjHU9EhCdwrADazXEQdhFciG4uR9';
const astarRegistrationContractAddress = 'ZsaaL58Adg7k1xT1EumK575H6GymJ214kvRk8NxKouTWqnC';
const soneiumRegistrationContractAddress = '0xB2196C9B95BD3cdC799eb89f856895aEDbd649bB';


export interface RaffleConfig {
    readonly nbNumbers: number;
    readonly minNumber: number;
    readonly maxNumber: number;
    readonly numberOfBlocksForParticipation: number;
    readonly minNumberSalts: number;
}

export interface WasmContractCallConfig {
    readonly wssRpc: string;
    readonly httpsRpc: string;
    readonly palletId: number;
    readonly callId: number;
}

export interface EvmContractCallConfig {
    readonly rpc: string;
}

export type ContractCallConfig = WasmContractCallConfig | EvmContractCallConfig;

export interface SmartContractConfig {
    readonly call: ContractCallConfig;
    address: string;
}

export interface PhalaConfig {
    readonly wssRpc: string;
    readonly address: string;
}

export interface RegistrationContractConfig {
    readonly registrationContractId: number;
    readonly contractConfig: SmartContractConfig;
}

export interface Config {
    readonly raffleConfig : RaffleConfig;
    readonly lottoManager : SmartContractConfig;
    readonly lottoDraw : PhalaConfig;
    readonly lottoRegistrations : RegistrationContractConfig[];
    readonly indexer : string;
}

const shibuyaConfig = new class implements WasmContractCallConfig {
    wssRpc = 'wss://rpc.shibuya.astar.network';
    httpsRpc = 'https://rpc.shibuya.astar.network';
    palletId = 70;
    callId = 6;
}

const astarConfig = new class implements WasmContractCallConfig {
    wssRpc = 'wss://rpc.astar.network';
    httpsRpc = 'https://rpc.astar.network';
    palletId = 70;
    callId = 6;
}

const minatoConfig = new class implements EvmContractCallConfig {
    rpc = 'https://rpc.minato.soneium.org';
}

const soneiumConfig = new class implements EvmContractCallConfig {
    rpc = 'https://rpc.soneium.org';
}

const moonbaseConfig = new class implements EvmContractCallConfig {
    rpc = 'https://rpc.api.moonbase.moonbeam.network';
}

const registrationContractShibuya = new class implements RegistrationContractConfig {
    registrationContractId = 10;
    contractConfig = new class implements SmartContractConfig {
        address = shibuyaRegistrationContractAddress;
        call = shibuyaConfig;
    }
}
const registrationContractAstar = new class implements RegistrationContractConfig {
    registrationContractId = 20;
    contractConfig = new class implements SmartContractConfig {
        address = astarRegistrationContractAddress;
        call = astarConfig;
    }
}
const registrationContractMinato = new class implements RegistrationContractConfig {
    registrationContractId = 11;
    contractConfig = new class implements SmartContractConfig {
        address = minatoRegistrationContractAddress;
        call = minatoConfig;
    }
}
const registrationContractSoneium = new class implements RegistrationContractConfig {
    registrationContractId = 21;
    contractConfig = new class implements SmartContractConfig {
        address = soneiumRegistrationContractAddress;
        call = soneiumConfig;
    }
}

const registrationContractMoonbase = new class implements RegistrationContractConfig {
    registrationContractId = 12;
    contractConfig = new class implements SmartContractConfig {
        address = moonbaseRegistrationContractAddress;
        call = moonbaseConfig;
    }
}

class TestnetConfig implements Config {
    raffleConfig = new class implements RaffleConfig {
        nbNumbers = 4;
        minNumber = 1;
        maxNumber = 50;
        numberOfBlocksForParticipation = 50000; // 6s/block - 100 000 blocks = 7 jours
        minNumberSalts = 2;
    };
    lottoManager = new class implements SmartContractConfig {
        address = shibuyaLottoManagerAddress;
        call = shibuyaConfig;
    };
    lottoDraw = new class implements  PhalaConfig {
        wssRpc = 'wss://poc6.phala.network/ws';
        address = poc6LottoDrawAddress;
    };
    lottoRegistrations = [registrationContractShibuya, registrationContractMinato, registrationContractMoonbase];
    indexer = "https://query.substrate.fi/lotto-multichain-subquery-testnet";
}

class MainnetConfig implements Config {
    raffleConfig = new class implements RaffleConfig {
        nbNumbers = 5;
        minNumber = 1;
        maxNumber = 50;
        numberOfBlocksForParticipation = 100000; // 6s/block - 100 000 blocks = 7 jours
        minNumberSalts = 2;
    };
    lottoManager = new class implements SmartContractConfig {
        address = astarLottoManagerAddress;
        call = astarConfig;
    };
    lottoDraw = new class implements  PhalaConfig {
        wssRpc = 'wss://poc6.phala.network/ws';
        address = phalaLottoDrawAddress;
    };
    lottoRegistrations = [registrationContractAstar, registrationContractSoneium];
    indexer = "https://query.substrate.fi/lotto-multichain-subquery";
}


export let config : Config;

export function initConfiguration(network: string) {
    if (network == 'testnet'){
        config = new TestnetConfig();
    } else if (network == 'mainnet'){
        config = new MainnetConfig();
    } else {
        throw new Error("No config for this Network");
    }
    console.log('Use configuration for %s', network);
}

function displayRegistrationContractConfig(registrationContractConfig : RegistrationContractConfig){
    console.log('RegistrationContractConfig %s : %s %s ',
      registrationContractConfig.registrationContractId,
      registrationContractConfig.contractConfig.address,
      registrationContractConfig.contractConfig.call
    );
}

export function displayConfiguration(){
    console.log('Lotto Config: %s', config.raffleConfig);
    console.log('Lotto Manager: %s %s', config.lottoManager.address, config.lottoManager.call);
    console.log('Lotto Draw: %s  { %s }', config.lottoDraw.address, config.lottoDraw.wssRpc);
    config.lottoRegistrations.forEach( (c) => displayRegistrationContractConfig(c));
}

export function isWasmContract(config: ContractCallConfig) : boolean {
    return (config as WasmContractCallConfig).palletId !== undefined;
}