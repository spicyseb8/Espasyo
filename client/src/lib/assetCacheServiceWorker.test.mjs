import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import vm from "node:vm";
import test from "node:test";

async function loadFetchHandler(path) {
  const source = await readFile(new URL(path, import.meta.url), "utf8");
  let fetchHandler;
  const self = {
    location: { origin: "http://localhost:1000" },
    addEventListener(type, handler) {
      if (type === "fetch") fetchHandler = handler;
    },
  };
  const cache = {
    async match() { return undefined; },
    async keys() { return []; },
    async put() {},
    async delete() { return true; },
  };
  const context = {
    self,
    URL,
    TextEncoder,
    Uint8Array,
    crypto: {
      subtle: {
        async digest() { return new Uint8Array(32).buffer; },
      },
    },
    caches: { async open() { return cache; } },
    fetch: async () => new Response("asset"),
    console: { debug() {}, error() {}, warn() {} },
  };
  vm.runInNewContext(source, context);
  assert.equal(typeof fetchHandler, "function");
  return fetchHandler;
}

for (const workerPath of [
  "../../public/asset-cache-sw.js",
  "../../../admin/public/asset-cache-sw.js",
]) {
  test(`${workerPath} leaves authenticated workflow API requests to the browser network`, async () => {
    const fetchHandler = await loadFetchHandler(workerPath);
    let responsePromise;
    fetchHandler({
      request: new Request(
        "http://localhost:5000/api/projects/PRJ-04626/workflow",
        {
          headers: { Authorization: "Bearer client-token" },
        },
      ),
      respondWith(value) {
        responsePromise = value;
      },
    });
    assert.equal(responsePromise, undefined);
  });

  test(`${workerPath} continues handling unauthenticated static asset requests`, async () => {
    const fetchHandler = await loadFetchHandler(workerPath);
    let responsePromise;
    fetchHandler({
      request: new Request("https://firebasestorage.googleapis.com/v0/b/test/o/asset.png"),
      respondWith(value) {
        responsePromise = value;
      },
    });
    assert.ok(responsePromise);
    assert.equal((await responsePromise).status, 200);
  });
}
