import yargs from 'yargs/yargs';
import {config, displayConfiguration, initConfiguration, isWasmContract} from './config';
import {readSeed, seed_payer} from "./seed";
import {RaffleManager} from './lottoManager';
import {LottoDraw} from './lottoDraw';
import {RaffleRegistrationWasm} from "./lottoRegistrationWasm";
import {RaffleRegistrationEvm} from "./lottoRegistrationEvm";

const argv = yargs(process.argv.slice(2)).options({
    dc: {alias: 'displayConfiguration', desc: 'Display the configuration (contract and http addresses)'},
    di: {alias: 'display', desc: 'Display Status and Draw Number of all contracts'},
    ca: {alias: 'checkAttestors', desc: 'Check if the attestor is granted in all contracts'},
    i: {alias: 'instantiate', desc: 'Instantiate the smart contract Manager'},
    cm: {alias: 'configureManager', desc: 'Configure the smart contract Manager'},
    cc: {alias: 'configureCommunicator', desc: 'Configure the smart contract Communicator'},
    g: {alias: 'grantAttestors', desc: 'Grant the attestor in all contracts'},
    st:  {alias: 'start', desc: 'Start the raffle'},
    sy:  {alias: 'synchronize', desc: 'Synchronize the status between smart contracts and automatically close the registrations'},
    p:  {alias: 'participate', desc: 'Participate to the lottery - Synchronize is required'},
    net: {alias: 'network', choices:['testnet', 'mainnet'], type:'string', desc: 'Specify the network', requiresArg: true},
    metaTx: {alias: 'metaTransactions', desc: 'Enable meta transactions (separate attestor and sender addresses)', type: "boolean", default: false},
}).version('0.1').parseSync();


async function run() : Promise<void>{

    async function displayStatuses() : Promise<void>{
        await raffleManager.display();

        for (const raffleRegistrationConfig of config.lottoRegistrations){
            if (isWasmContract(raffleRegistrationConfig.contractConfig.call)) {
                // wasm contract
                const raffleRegistration = new RaffleRegistrationWasm(raffleRegistrationConfig);
                await raffleRegistration.connect();
                await raffleRegistration.display();
            } else {
                //evm contract
                const raffleRegistration = new RaffleRegistrationEvm(raffleRegistrationConfig);
                await raffleRegistration.connect();
                await raffleRegistration.display();
            }
        }
    }

    async function participate() : Promise<void>{

        let numbers : Number[] = [];
        for (let i = 0; i < config.raffleConfig.nbNumbers; i++){
            numbers.push(config.raffleConfig.minNumber + i);
        }

        for (const raffleRegistrationConfig of config.lottoRegistrations){
            if (isWasmContract(raffleRegistrationConfig.contractConfig.call)) {
                // wasm contract
                const raffleRegistration = new RaffleRegistrationWasm(raffleRegistrationConfig);
                await raffleRegistration.connect();
                if (await raffleRegistration.canParticipate()){
                    await raffleRegistration.participate(numbers)
                }
            } else {
                //evm contract
                const raffleRegistration = new RaffleRegistrationEvm(raffleRegistrationConfig);
                await raffleRegistration.connect();
                if (await raffleRegistration.canParticipate()){
                    await raffleRegistration.participate(numbers)
                }
            }
        }
    }

    if (!argv.displayConfiguration && !argv.display
      && !argv.checkAttestors
      && !argv.instantiate && !argv.start
      && !argv.configureManager && !argv.configureCommunicator && !argv.grantAttestors
      && !argv.synchronize
    ) {
        return Promise.reject('At least one option is required. Use --help for more information');
    }

    if (argv.net == undefined) {
        return Promise.reject('The network is mandatory');
    } else {
        initConfiguration(argv.net);
    }

    if (argv.displayConfiguration) {
        displayConfiguration();
    }

    readSeed(argv.net);

    const instantiate = argv.instantiate;


    const raffleManager = new RaffleManager(config.lottoManager);

    if (instantiate){
        // instantiate the raffle manager
        await raffleManager.instantiate();

        // instantiate the raffle registrations
        for (const raffleRegistrationConfig of config.lottoRegistrations){
            if (isWasmContract(raffleRegistrationConfig.contractConfig.call)) {
                // wasm contract
                const raffleRegistration = new RaffleRegistrationWasm(raffleRegistrationConfig);
                await raffleRegistration.instantiate();
            } else {
                //evm contract
                const raffleRegistration = new RaffleRegistrationEvm(raffleRegistrationConfig);
                //await raffleRegistration.instantiate();
            }
        }

    }
    // connect the raffle manager
    await raffleManager.connect();

    const lottoDraw = new LottoDraw(config.lottoDraw);
    await lottoDraw.connect();

    // get the attestor addresses
    const attestorSubstrateAddress =
      argv.metaTx ? await lottoDraw.getAttestEcdsaAddressSubstrate() : await lottoDraw.getAttestAddressSubstrate();
    console.error("Attestor address for substrate contract : %s", attestorSubstrateAddress);
    const attestorEvmAddress = await lottoDraw.getAttestAddressEvm();
    console.error("Attestor address for evm contract : " + attestorEvmAddress);

    // configure the raffle manager
    if (argv.configureManager) {

        // Raffle manager - set the config
        await raffleManager.setConfig(config.raffleConfig);

        // Raffle manager - set the registration contract ids
        const registrationContractIds: Number[] = [];
        for (const raffleRegistrationConfig of config.lottoRegistrations) {
            registrationContractIds.push(raffleRegistrationConfig.registrationContractId);
        }
        await raffleManager.setRegistrationContracts(registrationContractIds);
    }

    // configure the phat contract
    if (argv.configureCommunicator) {

        const senderKey = argv.metaTx ? seed_payer : null;

        // lotto draw - set the raffle manager
        await lottoDraw.setRaffleManager(config.lottoManager, senderKey);
        // lotto draw - set indexer
        await lottoDraw.configIndexer(config.indexer);

        // lotto draw - set the registration contracts
        for (const raffleRegistrationConfig of config.lottoRegistrations){
            await lottoDraw.setRaffleRegistration(raffleRegistrationConfig, senderKey);
        }
    }

    // grant the attestors
    if (argv.grantAttestors) {

        // Raffle manager - grant the attestor
        if (! await raffleManager.hasAttestorRole(attestorSubstrateAddress) ) {
            await raffleManager.registerAttestor(attestorSubstrateAddress);
        }

        // Raffle registrations - grant the attestor
        for (const raffleRegistrationConfig of config.lottoRegistrations){
            if (isWasmContract(raffleRegistrationConfig.contractConfig.call)) {
                // wasm contract
                const raffleRegistration = new RaffleRegistrationWasm(raffleRegistrationConfig);
                await raffleRegistration.connect();
                if (! await raffleRegistration.hasAttestorRole(attestorSubstrateAddress) ) {
                    await raffleRegistration.registerAttestor(attestorSubstrateAddress);
                }
            } else {
                //evm contract
                const raffleRegistration = new RaffleRegistrationEvm(raffleRegistrationConfig);
                await raffleRegistration.connect();
                if (! await raffleRegistration.hasAttestorRole(attestorEvmAddress) ) {
                    await raffleRegistration.registerAttestor(attestorEvmAddress);
                }
            }
        }
    }

    // check if all attestors are granted
    if (argv.checkAttestors) {

        // check the attestor role
        if (await raffleManager.hasAttestorRole(attestorSubstrateAddress) ) {
            console.info("Attestor is granted in the raffle manager");
        } else {
            console.error("Attestor is not granted in the raffle manager");
        }

        for (const raffleRegistrationConfig of config.lottoRegistrations){
            let isGranted = false;
            if (isWasmContract(raffleRegistrationConfig.contractConfig.call)) {
                // wasm contract
                const raffleRegistration = new RaffleRegistrationWasm(raffleRegistrationConfig);
                await raffleRegistration.connect();
                isGranted = await raffleRegistration.hasAttestorRole(attestorSubstrateAddress);
            } else {
                //evm contract
                const raffleRegistration = new RaffleRegistrationEvm(raffleRegistrationConfig);
                await raffleRegistration.connect();
                isGranted = await raffleRegistration.hasAttestorRole(attestorEvmAddress);
            }
            if (isGranted) {
                console.info("Attestor is granted in the registration contract %s", raffleRegistrationConfig.registrationContractId);
            }else {
                console.error("Attestor is not granted in the registration contract %s", raffleRegistrationConfig.registrationContractId);
            }
        }
    }

    if (argv.display) {
        await displayStatuses();
    }


    // start the raffle
    if (argv.start) {
        await raffleManager.start();
    }

    // synchronize the contracts
    if (argv.synchronize) {
        let nbErrors = 0;

        while (true) {

            // do the synchronization when there are pending messages
            while (await raffleManager.hasPendingMessage()) {
                if (nbErrors > 10) {
                    return Promise.reject("Stop the synchronization - two many errors");
                }
                try {
                    // display the statuses
                    await displayStatuses();
                    // synchronise
                    await lottoDraw.synchronize();
                    // wait 20 seconds
                    await new Promise(f => setTimeout(f, 20000));
                    nbErrors = 0;
                } catch (e) {
                    nbErrors += 1;
                    // wait 20 seconds
                    await new Promise(f => setTimeout(f, 20000));
                }
            }

            if (argv.participate) {
                // participate via the different contracts
                await participate();
            }

            // close the registrations
            while (await raffleManager.canCloseRegistrations()) {
                if (nbErrors > 10) {
                    return Promise.reject("Stop the synchronization - two many errors when closing the registrations");
                }
                try {
                    // display the statuses
                    await displayStatuses();
                    // close the registrations
                    await lottoDraw.closeRegistrations();
                    // wait 20 seconds
                    await new Promise(f => setTimeout(f, 20000));
                    nbErrors = 0;
                } catch (e) {
                    nbErrors += 1;
                    // wait 20 seconds
                    await new Promise(f => setTimeout(f, 20000));
                }
            }

            // display the statuses
            await displayStatuses();

            // wait 20 seconds
            await new Promise(f => setTimeout(f, 20000));
        }
    }
}

run().catch(console.error).finally(() => process.exit());
