import { readFile } from "node:fs/promises";
import { expect } from "chai";
import { Interface } from "ethers";
import { network } from "hardhat";

const { ethers } = await network.create();

// The frontend keeps a hand-written subset of each ABI; if a contract changes
// underneath it, this fails here instead of at runtime in the browser.
const frontendAbi: Record<string, string[]> = JSON.parse(
  await readFile(new URL("../../frontend/src/chain/abi.json", import.meta.url), "utf8"),
);
async function expectSubset(contractName: string, abi: string[]) {
  const compiled = (await ethers.getContractFactory(contractName)).interface;
  const subset = new Interface(abi);

  subset.forEachFunction((fn) => {
    const actual = compiled.getFunction(fn.selector);
    expect(actual, `${contractName}.${fn.format()} is missing`).to.not.equal(null);
    expect(actual!.outputs.map((o) => o.type), `${fn.name} outputs`).to.deep.equal(fn.outputs.map((o) => o.type));
    expect(actual!.stateMutability, `${fn.name} mutability`).to.equal(fn.stateMutability);
  });
  subset.forEachEvent((ev) => {
    const actual = compiled.getEvent(ev.topicHash);
    expect(actual, `${contractName} event ${ev.format()} is missing`).to.not.equal(null);
    expect(actual!.inputs.map((i) => Boolean(i.indexed)), `${ev.name} indexed params`).to.deep.equal(
      ev.inputs.map((i) => Boolean(i.indexed)),
    );
  });
}

describe("Frontend ABI (frontend/src/chain/abi.json)", function () {
  it("matches the compiled WeatherIndexInsurance", async function () {
    await expectSubset("WeatherIndexInsurance", frontendAbi.WeatherIndexInsurance);
  });

  it("matches the compiled OracleAggregator", async function () {
    await expectSubset("OracleAggregator", frontendAbi.OracleAggregator);
  });
});
