import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import type { AddressInfo } from "node:net";
import { after, before, describe, it } from "node:test";
import { Wallet, keccak256, type JsonRpcProvider } from "ethers";

/** A JSON-RPC node on a local port; `answer` returns a result, or undefined for an HTTP 429. */
async function fakeNode(answer: (method: string, params: unknown[]) => unknown) {
  const methods: string[] = [];
  const server = createServer((req, res) => {
    let body = "";
    req.on("data", (chunk) => (body += chunk));
    req.on("end", () => {
      const { id, method, params } = JSON.parse(body) as { id: number; method: string; params: unknown[] };
      methods.push(method);
      const result = answer(method, params);
      if (result === undefined) {
        res.writeHead(429).end("Too Many Requests");
        return;
      }
      res.writeHead(200, { "content-type": "application/json" }).end(JSON.stringify({ jsonrpc: "2.0", id, result }));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
  return { url, methods, server };
}

describe("signingProvider (relayer and keeper transactions)", () => {
  let busy: Awaited<ReturnType<typeof fakeNode>>;
  let spare: Awaited<ReturnType<typeof fakeNode>>;
  const broadcast: string[] = [];
  let provider: JsonRpcProvider;

  before(async () => {
    busy = await fakeNode(() => undefined);
    spare = await fakeNode((method, params) => {
      if (method === "eth_chainId") return "0xaa36a7";
      if (method === "eth_blockNumber") return "0x10";
      if (method === "eth_sendRawTransaction") {
        broadcast.push(params[0] as string);
        return keccak256(params[0] as string);
      }
      return null;
    });
    // config.ts reads these once, when chain.ts first imports it.
    process.env.RPC_URL = busy.url;
    process.env.RPC_FALLBACK_URLS = spare.url;
    const { signingProvider } = await import("./utils/chain.js");
    provider = signingProvider();
  });

  after(() => {
    provider.destroy();
    busy.server.close();
    spare.server.close();
  });

  it("moves on to the next node when RPC_URL answers 429", async () => {
    assert.equal(await provider.getBlockNumber(), 16);
    assert.ok(busy.methods.length > 0, "RPC_URL was tried first");
    assert.ok(spare.methods.includes("eth_blockNumber"));
  });

  it("broadcasts a signed transaction through the node that answers", async () => {
    const signed = await Wallet.createRandom().signTransaction({
      chainId: 11155111,
      nonce: 0,
      to: "0x000000000000000000000000000000000000dEaD",
      gasLimit: 21_000,
      maxFeePerGas: 1_000_000_000n,
      maxPriorityFeePerGas: 1_000_000n,
    });
    const tx = await provider.broadcastTransaction(signed);
    assert.equal(tx.hash, keccak256(signed));
    assert.deepEqual(broadcast, [signed]);
  });
});
