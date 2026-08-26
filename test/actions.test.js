import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTIONS } from "../data/actions.js";

test("ACTIONSは12件定義されている", () => {
  assert.equal(ACTIONS.length, 12);
});

test("recordIndexは0〜13の範囲で重複がない", () => {
  const indices = ACTIONS.map((a) => a.recordIndex);
  const unique = new Set(indices);
  assert.equal(unique.size, indices.length, "recordIndexが重複している");
  for (const idx of indices) {
    assert.ok(idx >= 0 && idx <= 13, `recordIndex ${idx} は範囲外`);
  }
});

test("idは重複しない", () => {
  const ids = ACTIONS.map((a) => a.id);
  assert.equal(new Set(ids).size, ids.length);
});

test("orderは1から連番で重複しない", () => {
  const orders = ACTIONS.map((a) => a.order).sort((a, b) => a - b);
  const expected = ACTIONS.map((_, i) => i + 1);
  assert.deepEqual(orders, expected);
});

test("externalタイプは全てurlを持つ", () => {
  for (const a of ACTIONS.filter((a) => a.type === "external")) {
    assert.ok(a.url, `${a.id} にurlがない`);
  }
});
