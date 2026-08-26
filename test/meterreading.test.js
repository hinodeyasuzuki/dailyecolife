import { test } from "node:test";
import assert from "node:assert/strict";
import { getMonthReading, saveMonthReading } from "../js/meterreading.js";

function createMockStore(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, value),
  };
}

const energyCodes = ["elect", "nagas", "water"];
const energyCostCodes = ["electp", "nagasp"];

test("getMonthReading: 未設定月は空オブジェクト", () => {
  const store = createMockStore();
  assert.deepEqual(getMonthReading(store, "202608"), {});
});

test("saveMonthReading: 消費量のみだとcompleted=false", () => {
  const store = createMockStore();
  const result = saveMonthReading(store, "202608", { elect: 120 }, energyCodes, energyCostCodes);
  assert.equal(result.completed, false);
});

test("saveMonthReading: 消費量・料金が両方揃うとcompleted=true", () => {
  const store = createMockStore();
  saveMonthReading(store, "202608", { elect: 120 }, energyCodes, energyCostCodes);
  const result = saveMonthReading(store, "202608", { electp: 3500 }, energyCodes, energyCostCodes);
  assert.equal(result.completed, true);
  assert.deepEqual(getMonthReading(store, "202608"), { elect: 120, electp: 3500 });
});

test("saveMonthReadingは既存値を上書きせずマージする", () => {
  const store = createMockStore();
  saveMonthReading(store, "202608", { elect: 120, nagas: 30 }, energyCodes, energyCostCodes);
  saveMonthReading(store, "202608", { water: 5 }, energyCodes, energyCostCodes);
  assert.deepEqual(getMonthReading(store, "202608"), { elect: 120, nagas: 30, water: 5 });
});
