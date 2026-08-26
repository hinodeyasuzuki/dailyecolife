import { test } from "node:test";
import assert from "node:assert/strict";
import { getMonthReading, saveMonthReading, awardMeterReadingPoint } from "../js/meterreading.js";
import { isActionRecorded } from "../js/records.js";

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

test("awardMeterReadingPoint: completed=falseなら何もせずfalseを返す", () => {
  const store = createMockStore();
  const result = awardMeterReadingPoint(store, "202608", "20260826", 11, false);
  assert.equal(result, false);
  assert.equal(isActionRecorded(store, "20260826", 11), false);
});

test("awardMeterReadingPoint: completed=trueかつ当月未加点なら加点してtrueを返す", () => {
  const store = createMockStore();
  const result = awardMeterReadingPoint(store, "202608", "20260826", 11, true);
  assert.equal(result, true);
  assert.equal(isActionRecorded(store, "20260826", 11), true);
});

test("awardMeterReadingPoint: 当月既に加点済みなら加点せずfalseを返す", () => {
  const store = createMockStore();
  awardMeterReadingPoint(store, "202608", "20260810", 11, true);
  const result = awardMeterReadingPoint(store, "202608", "20260826", 11, true);
  assert.equal(result, false);
  assert.equal(isActionRecorded(store, "20260826", 11), false);
  assert.equal(isActionRecorded(store, "20260810", 11), true);
});

test("awardMeterReadingPoint: 翌月になれば再度加点できる", () => {
  const store = createMockStore();
  awardMeterReadingPoint(store, "202608", "20260810", 11, true);
  const result = awardMeterReadingPoint(store, "202609", "20260905", 11, true);
  assert.equal(result, true);
  assert.equal(isActionRecorded(store, "20260905", 11), true);
});
