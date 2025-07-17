import {expect, test} from "bun:test";
import {getRandomNumber} from "../src/vrf.ts";
import {Keyring} from "@polkadot/keyring";
import {hexToU8a} from "@polkadot/util";


test("same input = same output", async () => {

    const seed = hexToU8a('0xd7ec36ea08b186d2ec906a2bb8849e3cea31cc677ba1c0109cda39829e2f3c00');
    const pair = new Keyring({type: 'sr25519'}).addFromSeed(seed);

    expect(getRandomNumber(pair, hexToU8a('0x00'), 0, 1000)).toBe(getRandomNumber(pair, hexToU8a('0x00'), 0, 1000));
    expect(getRandomNumber(pair, hexToU8a('0x01'), 0, 1000)).toBe(getRandomNumber(pair, hexToU8a('0x01'), 0, 1000));
    expect(getRandomNumber(pair, hexToU8a('0x02'), 0, 1000)).toBe(getRandomNumber(pair, hexToU8a('0x02'), 0, 1000));

});

test("test preconditions", async () => {

    const seed = hexToU8a('0xd7ec36ea08b186d2ec906a2bb8849e3cea31cc677ba1c0109cda39829e2f3c00');
    const pair = new Keyring({type: 'sr25519'}).addFromSeed(seed);

    expect(() => getRandomNumber(pair, hexToU8a('0x00'), 0, 0)).toThrowError();
    expect(() => getRandomNumber(pair, hexToU8a('0x00'), -1, 1)).toThrowError();
    expect(() => getRandomNumber(pair, hexToU8a('0x00'), 0, 4294967297)).toThrowError();
    expect(getRandomNumber(pair, hexToU8a('0x00'), 0, 4294967296)).toBeNumber();

});


test("test distribution", async () => {

    const seed = hexToU8a('0xd7ec36ea08b186d2ec906a2bb8849e3cea31cc677ba1c0109cda39829e2f3c00');
    const pair = new Keyring({type: 'sr25519'}).addFromSeed(seed);

    console.log(pair.address);

    const times = [0, 0, 0, 0, 0, 0, 0, 0, 0 ,0 ,0, 0, 0];

    for (let i= 0; i < 10000; i++){
        const r = getRandomNumber(pair, hexToU8a(i.toString(16)), 1, 10);
        expect(r >= 1);
        expect(r < 10);
        times[r] = times[r] + 1;
    }
    console.log(times);

    for (let i= 1; i <= 10; i++){
        expect(times[i] >= 950);
        expect(times[i] <= 1050);
    }
    expect(times[0]).toBe(0);
    expect(times[11]).toBe(0);

});