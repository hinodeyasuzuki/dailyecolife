import { test } from "node:test";
import assert from "node:assert/strict";
import {
  RECORDS_KEY,
  getDayRecord,
  isActionRecorded,
  setActionRecorded,
  isActionRecordedInMonth,
  countPointsForDay,
  countPointsForRange,
} from "../js/records.js";

function createMockStore(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, value),
  };
}

test("getDayRecord: 未記録日は14桁の0埋め文字列", () => {
  const store = createMockStore();
  assert.equal(getDayRecord(store, "20260826"), "00000000000000");
});

test("setActionRecorded → isActionRecorded で該当桁がtrueになる", () => {
  const store = createMockStore();
  setActionRecorded(store, "20260826", 0);
  assert.equal(isActionRecorded(store, "20260826", 0), true);
  assert.equal(isActionRecorded(store, "20260826", 1), false);
  assert.equal(getDayRecord(store, "20260826"), "10000000000000");
});

test("setActionRecordedは他の日・他の桁を壊さない", () => {
  const store = createMockStore();
  setActionRecorded(store, "20260825", 2);
  setActionRecorded(store, "20260826", 0);
  setActionRecorded(store, "20260826", 5);
  assert.equal(getDayRecord(store, "20260825"), "00100000000000");
  assert.equal(getDayRecord(store, "20260826"), "10000100000000");
});

test("isActionRecordedInMonth: 月内のいずれかの日で立っていればtrue", () => {
  const store = createMockStore();
  setActionRecorded(store, "20260805", 11);
  assert.equal(isActionRecordedInMonth(store, "202608", 11), true);
  assert.equal(isActionRecordedInMonth(store, "202609", 11), false);
  assert.equal(isActionRecordedInMonth(store, "202608", 10), false);
});

test("countPointsForDay: 立っている桁数を返す", () => {
  const store = createMockStore();
  setActionRecorded(store, "20260826", 0);
  setActionRecorded(store, "20260826", 3);
  setActionRecorded(store, "20260826", 7);
  assert.equal(countPointsForDay(store, "20260826"), 3);
  assert.equal(countPointsForDay(store, "20260827"), 0);
});

test("countPointsForRange: 範囲内の日の合計(両端含む)", () => {
  const store = createMockStore();
  setActionRecorded(store, "20260701", 0);
  setActionRecorded(store, "20260815", 1);
  setActionRecorded(store, "20260815", 2);
  setActionRecorded(store, "20260901", 0);
  assert.equal(countPointsForRange(store, "20260701", "20260831"), 3);
  assert.equal(countPointsForRange(store, "20260801", "20260831"), 2);
});
