import { test } from "node:test";
import assert from "node:assert/strict";
import { REPAIRER_OPTIONS, repairerLabel } from "../js/repairer-options.js";

test("REPAIRER_OPTIONS: 4件定義されている", () => {
  assert.equal(REPAIRER_OPTIONS.length, 4);
});

test("repairerLabel: valからラベルを引ける", () => {
  assert.equal(repairerLabel(1), "自分");
  assert.equal(repairerLabel(3), "修理施設");
  assert.equal(repairerLabel("4"), "修理業者");
});

test("repairerLabel: 未設定や不正な値は空文字を返す", () => {
  assert.equal(repairerLabel(""), "");
  assert.equal(repairerLabel(null), "");
  assert.equal(repairerLabel(undefined), "");
  assert.equal(repairerLabel(99), "");
});
