import { test } from "node:test";
import assert from "node:assert/strict";
import { EXTERNAL_RECORDS_KEY, externalActionCount } from "../js/external-records.js";

function createMockStore(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, value),
  };
}

test("externalActionCount: 修理ログの件数を返す", () => {
  const store = createMockStore({
    [EXTERNAL_RECORDS_KEY]: JSON.stringify({ repairlog: { l1: {}, l2: {} } }),
  });
  assert.equal(externalActionCount(store, "repair"), 2);
});

test("externalActionCount: 中古品のmethod 3、4、5だけを数える", () => {
  const store = createMockStore({
    [EXTERNAL_RECORDS_KEY]: JSON.stringify({
      products: {
        e1: { method: 3 },
        e2: { method: "4" },
        e3: { method: 5 },
        e4: { method: 1 },
      },
    }),
  });
  assert.equal(externalActionCount(store, "secondhand"), 3);
});

test("externalActionCount: 未保存の外部記録は0件とする", () => {
  assert.equal(externalActionCount(createMockStore(), "repair"), 0);
  assert.equal(externalActionCount(createMockStore(), "secondhand"), 0);
});