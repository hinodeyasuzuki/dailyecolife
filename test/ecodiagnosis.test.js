import { test } from "node:test";
import assert from "node:assert/strict";
import { getTodayDiagnosisItem, answerDiagnosis } from "../js/ecodiagnosis.js";
import { EXTERNAL_RECORDS_KEY } from "../js/external-records.js";

function createMockStore(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, value),
  };
}

const items = [
  { id: "i010", title: "対策視点", options: [{ disp: "A", val: 1 }] },
  { id: "i001", title: "家族人数", options: [{ disp: "B", val: 2 }] },
  { id: "i002", title: "住居形態", options: [{ disp: "C", val: 3 }] },
];

test("getTodayDiagnosisItem: 未キャッシュ時はrandomFnでitemsから1件選ぶ", () => {
  const store = createMockStore();
  const result = getTodayDiagnosisItem(store, "20260826", items, () => 0.5); // index 1 -> i001
  assert.equal(result.item.id, "i001");
  assert.equal(result.answerVal, null);
});

test("getTodayDiagnosisItem: キャッシュ済みなら同じitemを返す", () => {
  const store = createMockStore();
  const first = getTodayDiagnosisItem(store, "20260826", items, () => 0.5);
  const second = getTodayDiagnosisItem(store, "20260826", items, () => 0.99);
  assert.equal(second.item.id, first.item.id);
});

test("answerDiagnosis: 回答値を保存する", () => {
  const store = createMockStore();
  getTodayDiagnosisItem(store, "20260826", items, () => 0.5);
  answerDiagnosis(store, "20260826", 2);
  const result = getTodayDiagnosisItem(store, "20260826", items, () => 0.5);
  assert.equal(result.answerVal, 2);
  assert.deepEqual(JSON.parse(store.getItem(EXTERNAL_RECORDS_KEY)), {
    input: { i001: 2 },
  });
});

test("answerDiagnosis: 回答済みでも値を変更できる", () => {
  const store = createMockStore();
  getTodayDiagnosisItem(store, "20260826", items, () => 0.5);
  answerDiagnosis(store, "20260826", 2);
  answerDiagnosis(store, "20260826", 3);
  const result = getTodayDiagnosisItem(store, "20260826", items, () => 0.5);
  assert.equal(result.answerVal, 3);
});

test("getTodayDiagnosisItem: キャッシュ済みitemIdがallItemsに存在せず未回答なら再選出する", () => {
  const store = createMockStore();
  // i001をキャッシュした後、allItemsからi001が無くなった状態を再現
  getTodayDiagnosisItem(store, "20260826", items, () => 0.5); // caches i001
  const reducedItems = items.filter((i) => i.id !== "i001"); // i010, i002
  const result = getTodayDiagnosisItem(store, "20260826", reducedItems, () => 0.9); // index -> i002
  assert.equal(result.item.id, "i002");
  assert.equal(result.answerVal, null);
});

test("getTodayDiagnosisItem: キャッシュ済みitemIdがallItemsに存在せず回答済みならitem:nullを返す", () => {
  const store = createMockStore();
  getTodayDiagnosisItem(store, "20260826", items, () => 0.5); // caches i001
  answerDiagnosis(store, "20260826", 2);
  const reducedItems = items.filter((i) => i.id !== "i001");
  const result = getTodayDiagnosisItem(store, "20260826", reducedItems, () => 0.9);
  assert.equal(result.item, null);
  assert.equal(result.answerVal, 2);
});
