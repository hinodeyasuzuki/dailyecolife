import { test } from "node:test";
import assert from "node:assert/strict";
import { computeScaledDimensions } from "../js/image.js";

test("computeScaledDimensions: 横長画像は幅を640に合わせて高さを縮小する", () => {
  const result = computeScaledDimensions(1280, 960, 640);
  assert.deepEqual(result, { width: 640, height: 480 });
});

test("computeScaledDimensions: 縦長画像は高さを640に合わせて幅を縮小する", () => {
  const result = computeScaledDimensions(960, 1280, 640);
  assert.deepEqual(result, { width: 480, height: 640 });
});

test("computeScaledDimensions: 長辺が既にmaxDimension以下ならそのまま返す", () => {
  const result = computeScaledDimensions(300, 200, 640);
  assert.deepEqual(result, { width: 300, height: 200 });
});
