import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fetchInputItems,
  fetchEnergyCodes,
  fetchEnergyCostCodes,
  INPUT_JSON_URL,
  ENERGY_JSON_URL,
  ENERGYCOST_JSON_URL,
} from "../js/api.js";

function makeFetchFn(map) {
  return async (url) => ({ ok: true, json: async () => map[url] });
}

function makeFailingFetchFn(status) {
  return async () => ({ ok: false, status, json: async () => ({}) });
}

test("fetchInputItems: INPUT_JSON_URLをfetchしパースして返す", async () => {
  const fetchFn = makeFetchFn({ [INPUT_JSON_URL]: [{ id: "i010" }] });
  const result = await fetchInputItems(fetchFn);
  assert.deepEqual(result, [{ id: "i010" }]);
});

test("fetchEnergyCodes: ENERGY_JSON_URLをfetchしパースして返す", async () => {
  const fetchFn = makeFetchFn({ [ENERGY_JSON_URL]: [{ code: "elect", name: "購入電力", unit: "kWh" }] });
  const result = await fetchEnergyCodes(fetchFn);
  assert.deepEqual(result, [{ code: "elect", name: "購入電力", unit: "kWh" }]);
});

test("fetchEnergyCostCodes: ENERGYCOST_JSON_URLをfetchしパースして返す", async () => {
  const fetchFn = makeFetchFn({ [ENERGYCOST_JSON_URL]: [{ code: "electp", name: "購入電力料金" }] });
  const result = await fetchEnergyCostCodes(fetchFn);
  assert.deepEqual(result, [{ code: "electp", name: "購入電力料金" }]);
});

test("fetchInputItems: response.okがfalseの場合はエラーがthrowされる", async () => {
  const fetchFn = makeFailingFetchFn(404);
  await assert.rejects(() => fetchInputItems(fetchFn), /HTTP 404/);
});
