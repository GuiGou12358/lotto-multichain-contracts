import { expect, test } from "bun:test";
import {Indexer} from "../src/indexer.ts";
import {toHex} from "viem";

const indexer = new Indexer("https://query.substrate.fi/lotto-multichain-subquery-mainnet");

test("query no salt", async () => {

    const oSalt = await indexer.querySalt(1, 11n);
    expect(oSalt.isNone()).toBe(true);
    expect(oSalt.isSome()).toBe(false);
    expect(oSalt.valueOf()).toBeUndefined();

});

test("query salt 21", async () => {

    const oSalt = await indexer.querySalt(2, 21n);
    expect(oSalt.isSome()).toBe(true);
    const salt = oSalt.valueOf();
    //expect(toHex(salt)).toBe("0x9f6347e074d4de531e362e8997149a5d2bc4a134131cf079b3a1706cdbf86631");
    expect(toHex(salt)).toBe("0x5ff3eb7edb36326d7a427b225311db461484faecd37252003729f0e98f84f495");

});

test("query salt 20", async () => {

    const oSalt = await indexer.querySalt(2, 20n);
    expect(oSalt.isSome()).toBe(true);
    const salt = oSalt.valueOf();
    //expect(toHex(salt)).toBe("0x17d2210004729856cb80dae2fd31fd6523b8a9382da03059f68dcf2719aae4e9");
    expect(toHex(salt)).toBe("0x741fa67cbf3b6c4c14e35352f6961fa7280b44a4e12c993f03c10eecb05171f2");

});


test("query no winner", async () => {

    const [winners1, winners2] = await indexer.queryWinners(11, [1,2,3,4,5]);
    expect(winners1.length).toBe(0);
    expect(winners2.length).toBe(0);

});


test("query evm winner", async () => {

    const [winners1, winners2] = await indexer.queryWinners(11, [27,30,32,42,47]);
    expect(winners1.length).toBe(0);
    expect(winners2.length).toBe(1);
    expect(toHex(winners2[0])).toBe("0x57f8ef4079a3303602e8cbbc96bd75e998bc611b");

});

test("query substrate winner", async () => {
    const [winners1, winners2] = await indexer.queryWinners(11, [12,19,26,30,38]);
    expect(winners1.length).toBe(1);
    expect(winners2.length).toBe(0);
    expect(toHex(winners1[0])).toBe("0xcc30c85c00b81358a3f3ce815914450a62667e54223f1a1928b6cc8aa03b8657");
});