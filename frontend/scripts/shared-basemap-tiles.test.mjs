import { test } from "node:test";
import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import ts from "typescript";
const source = (await readFile(new URL("../src/state/sharedBasemapTiles.ts", import.meta.url), "utf8"))
  .replace('"./sceneResources"', JSON.stringify(new URL("../src/state/sceneResources.ts", import.meta.url).href));
const { outputText } = ts.transpileModule(source, { compilerOptions: { target: ts.ScriptTarget.ES2020, module: ts.ModuleKind.ESNext } });
const { SharedBasemapTiles } = await import(`data:text/javascript;base64,${Buffer.from(outputText).toString("base64")}`);

test("two views share one fetch while receiving independent transferable buffers", async () => {
  let requests = 0;
  const transport = new SharedBasemapTiles(async () => { requests++; return new Response(new Uint8Array([1, 2, 3]), { headers: { "cache-control": "max-age=60" } }); });
  const signal = new AbortController().signal;
  const [a, b] = await Promise.all([transport.read("https://tiles/1.pbf", signal), transport.read("https://tiles/1.pbf", signal)]);
  assert.equal(requests, 1); assert.notEqual(a.data, b.data);
  structuredClone(a.data, { transfer: [a.data] }); assert.equal(a.data.byteLength, 0);
  assert.deepEqual([...new Uint8Array(b.data)], [1, 2, 3]);
  assert.equal((await transport.read("https://tiles/1.pbf", signal)).data.byteLength, 3);
  assert.equal(requests, 1);
});
test("cancelling one viewport does not cancel its peer; expired or no-store tiles reload", async () => {
  let finish;
  const transport = new SharedBasemapTiles(() => new Promise(resolve => { finish = resolve; }));
  const cancelled = new AbortController(), live = new AbortController();
  const a = transport.read("https://tiles/1.png", cancelled.signal);
  const rejected = assert.rejects(a, { name: "AbortError" });
  const b = transport.read("https://tiles/1.png", live.signal);
  cancelled.abort(); await rejected;
  finish(new Response(new Uint8Array([1]))); assert.equal((await b).data.byteLength, 1);
  let now = 0, requests = 0;
  const expiring = new SharedBasemapTiles(async () => { requests++; return new Response(new Uint8Array([1]), { headers: { "cache-control": "max-age=1" } }); }, () => now);
  await expiring.read("https://tiles/1.png", live.signal); now = 2000;
  await expiring.read("https://tiles/1.png", live.signal); assert.equal(requests, 2);
  const noStore = new SharedBasemapTiles(async () => { requests++; return new Response(new Uint8Array([1]), { headers: { "cache-control": "no-store" } }); });
  await noStore.read("https://tiles/2.png", live.signal);
  await noStore.read("https://tiles/2.png", live.signal); assert.equal(requests, 4);
});
