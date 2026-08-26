import { test } from "node:test";
import assert from "node:assert/strict";
import { loadJSON, saveJSON } from "../js/storage.js";

function createMockStore() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, value),
  };
}

test("loadJSON: 未設定キーはfallbackを返す", () => {
  const store = createMockStore();
  assert.deepEqual(loadJSON(store, "missing", { foo: 1 }), { foo: 1 });
});

test("saveJSON→loadJSONで値が往復する", () => {
  const store = createMockStore();
  saveJSON(store, "key1", { a: 1, b: [1, 2] });
  assert.deepEqual(loadJSON(store, "key1", null), { a: 1, b: [1, 2] });
});

test("loadJSON: 壊れたJSONはfallbackにフォールバックする", () => {
  const store = createMockStore();
  store.setItem("broken", "{not valid json");
  assert.deepEqual(loadJSON(store, "broken", {}), {});
});
