import { test } from "node:test";
import assert from "node:assert/strict";
import { putPhoto, deletePhoto, listServerPhotoIds } from "../js/photoApi.js";

function makeFetchFn(handler) {
  return async (url, options) => handler(url, options);
}

test("putPhoto: PUT ?resource=photo&id=xxx にdataUrlを送信する", async () => {
  let seenUrl, seenOptions;
  const fetchFn = makeFetchFn(async (url, options) => {
    seenUrl = url;
    seenOptions = options;
    return { ok: true, json: async () => ({ ok: true }) };
  });
  const result = await putPhoto("p001", "data:image/jpeg;base64,AAAA", { apiUrl: "https://example.test/api", fetchFn });
  assert.equal(seenUrl, "https://example.test/api?resource=photo&id=p001");
  assert.equal(seenOptions.method, "PUT");
  assert.deepEqual(JSON.parse(seenOptions.body), { dataUrl: "data:image/jpeg;base64,AAAA" });
  assert.deepEqual(result, { ok: true });
});

test("putPhoto: response.okがfalseならエラーがthrowされる", async () => {
  const fetchFn = makeFetchFn(async () => ({ ok: false, status: 413, json: async () => ({}) }));
  await assert.rejects(
    () => putPhoto("p001", "data:image/jpeg;base64,AAAA", { apiUrl: "https://example.test/api", fetchFn }),
    /413/
  );
});

test("deletePhoto: DELETE ?resource=photo&id=xxx を呼ぶ", async () => {
  let seenUrl, seenOptions;
  const fetchFn = makeFetchFn(async (url, options) => {
    seenUrl = url;
    seenOptions = options;
    return { ok: true, json: async () => ({ ok: true }) };
  });
  await deletePhoto("p001", { apiUrl: "https://example.test/api", fetchFn });
  assert.equal(seenUrl, "https://example.test/api?resource=photo&id=p001");
  assert.equal(seenOptions.method, "DELETE");
});

test("listServerPhotoIds: meta=1のphotos配列からphoto_idを抽出する", async () => {
  let seenUrl;
  const fetchFn = makeFetchFn(async (url) => {
    seenUrl = url;
    return { ok: true, json: async () => ({ photos: [{ photo_id: "p001" }, { photo_id: "p002" }] }) };
  });
  const ids = await listServerPhotoIds({ apiUrl: "https://example.test/api", fetchFn });
  assert.equal(seenUrl, "https://example.test/api?resource=photo&meta=1");
  assert.deepEqual(ids, ["p001", "p002"]);
});

test("listServerPhotoIds: photosが無ければ空配列を返す", async () => {
  const fetchFn = makeFetchFn(async () => ({ ok: true, json: async () => ({}) }));
  const ids = await listServerPhotoIds({ apiUrl: "https://example.test/api", fetchFn });
  assert.deepEqual(ids, []);
});
