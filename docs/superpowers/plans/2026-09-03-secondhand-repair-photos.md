# 中古・修理記録への写真登録 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 中古・修理の記録フォームから写真を撮影/選択して登録できるようにする。写真は長辺640pxに縮小してIndexedDBに即保存し、サーバーの`photos`テーブルにも登録する。あわせて中古・修理データ本体もはじめてサーバー同期の対象にする。

**Architecture:** 既存の`myecoliferecords`/削除済み`homeenergycodes`にある実装パターン(画像圧縮・IndexedDBラッパー・photo API・`resource=ecolife`同期)をdailyecolife用に移植し、`action-menu-page.js`の既存フォームに配線する。新規モジュールは`js/image.js`(圧縮)・`js/pictureStore.js`(IndexedDB)・`js/photoApi.js`(サーバー通信)の3つで、いずれも既存の`js/api.js`のDI(`fetchFn`引数)パターンに合わせてテスト可能にする。

**Tech Stack:** Vue 3(グローバル`Vue`、ビルドなし)、Node.js組み込み`node:test`、IndexedDB、PHP側は`api/mysql-api.php`の`resource=photo`(既存・変更なし)。

**Spec:** `docs/superpowers/specs/2026-09-03-secondhand-repair-photos-design.md`

## Global Constraints

- 画像は長辺640px、JPEG quality 0.6 に縮小する(`compressImageFile`のデフォルト値をそのまま使う)。
- 1件の中古品/修理記録につき写真は最大5枚。
- サーバーAPIの`photo_id`は正規表現 `^p[a-zA-Z0-9_-]{1,63}$` を満たす必要がある。
- 画像バイナリ(data URL)はEXTERNAL_RECORDS_KEYのJSONには含めない(`data.picture[pid]`はメタデータのみ)。
- サーバーアップロード失敗時にUIをブロックしない(IndexedDBに残っていれば記録は失われない)。
- Node実行環境にはIndexedDB/FileReader/Canvasが無く、`package.json`もこのリポジトリには存在しない(npm依存を追加しない)。ブラウザAPIに依存するコード(IndexedDB CRUD、`compressImageFile`本体、`fetchPhotoAsDataUrl`のFileReader部分)は自動テストの対象外とし、手動確認手順で担保する。

---

## ファイル構成

- 新規 `js/image.js`: `computeScaledDimensions` / `compressImageFile`
- 新規 `js/pictureStore.js`: `generatePictureId` / IndexedDB CRUD(`getPictureBlob`/`putPictureBlob`/`deletePictureBlob`/`getAllPictureBlobs`)
- 新規 `js/photoApi.js`: サーバー`resource=photo` APIクライアント(`putPhoto`/`deletePhoto`/`fetchPhotoAsDataUrl`/`listServerPhotoIds`)
- 修正 `js/external-input.js`: `attachPicturesToProduct` / `attachPicturesToRepairLog` を追加
- 修正 `app.js`: `resource="ecolife"`の`createSyncStore`を追加
- 修正 `js/pages/action-menu-page.js`: フォームへの写真UI配線、既存記録へのサムネイル表示、起動時の未送信写真リトライ
- 修正 `style.css`: 写真ピッカー/サムネイルのスタイル追加

---

### Task 1: 画像圧縮モジュール `js/image.js`

**Files:**
- Create: `js/image.js`
- Test: `test/image.test.js`

**Interfaces:**
- Produces: `computeScaledDimensions(width: number, height: number, maxDimension: number): {width: number, height: number}`
- Produces: `compressImageFile(file: File, options?: {maxDimension?: number, quality?: number}): Promise<string>`(data URL文字列を返す。ブラウザ専用、Node自動テスト対象外)

- [ ] **Step 1: 失敗するテストを書く**

`test/image.test.js`:

```js
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
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `node --test test/image.test.js`
Expected: FAIL(`../js/image.js` が存在しない)

- [ ] **Step 3: 実装する**

`js/image.js`:

```js
export function computeScaledDimensions(width, height, maxDimension) {
  const scale = Math.min(1, maxDimension / Math.max(width, height));
  return {
    width: Math.round(width * scale),
    height: Math.round(height * scale),
  };
}

export function compressImageFile(file, { maxDimension = 640, quality = 0.6 } = {}) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error || new Error("ファイルの読み込みに失敗しました"));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error("画像の読み込みに失敗しました"));
      img.onload = () => {
        const { width, height } = computeScaledDimensions(img.naturalWidth, img.naturalHeight, maxDimension);
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `node --test test/image.test.js`
Expected: PASS(3件)

- [ ] **Step 5: コミット**

```bash
git add js/image.js test/image.test.js
git commit -m "feat: 画像縮小ユーティリティ(js/image.js)を追加"
```

---

### Task 2: IndexedDBラッパー `js/pictureStore.js`

**Files:**
- Create: `js/pictureStore.js`

**Interfaces:**
- Consumes: なし
- Produces: `generatePictureId(): string`(`^p[a-zA-Z0-9_-]{1,63}$`を満たすID)
- Produces: `getPictureBlob(pid: string): Promise<string|undefined>`
- Produces: `putPictureBlob(pid: string, dataUrl: string): Promise<void>`
- Produces: `deletePictureBlob(pid: string): Promise<void>`
- Produces: `getAllPictureBlobs(): Promise<Record<string, string>>`

このモジュールはIndexedDBに依存し、Node.jsにはIndexedDBが無い(このリポジトリに`package.json`が無くnpm依存も追加しない方針のため`fake-indexeddb`は使わない)。よって自動テストは書かず、Step 3でブラウザ手動確認する。

- [ ] **Step 1: 実装する**

`js/pictureStore.js`:

```js
const DB_NAME = "dailyecolife-pictures";
const DB_VERSION = 1;
const STORE_NAME = "pictures";

export function generatePictureId() {
  const random = Math.random().toString(36).slice(2, 10);
  return `p${Date.now().toString(36)}${random}`;
}

function openDb() {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, DB_VERSION);
    req.onupgradeneeded = () => {
      if (!req.result.objectStoreNames.contains(STORE_NAME)) {
        req.result.createObjectStore(STORE_NAME);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error || new Error("IndexedDBを開けませんでした"));
  });
}

async function withStore(mode, fn) {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, mode);
    const store = tx.objectStore(STORE_NAME);
    const result = fn(store);
    tx.oncomplete = () => resolve(result && result.result !== undefined ? result.result : undefined);
    tx.onerror = () => reject(tx.error || new Error("IndexedDBの操作に失敗しました"));
  });
}

export function getPictureBlob(pid) {
  return withStore("readonly", (store) => store.get(pid));
}

export function putPictureBlob(pid, dataUrl) {
  return withStore("readwrite", (store) => store.put(dataUrl, pid));
}

export function deletePictureBlob(pid) {
  return withStore("readwrite", (store) => store.delete(pid));
}

export async function getAllPictureBlobs() {
  const db = await openDb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const store = tx.objectStore(STORE_NAME);
    const keysReq = store.getAllKeys();
    const valuesReq = store.getAll();
    tx.oncomplete = () => {
      const result = {};
      keysReq.result.forEach((key, i) => {
        result[key] = valuesReq.result[i];
      });
      resolve(result);
    };
    tx.onerror = () => reject(tx.error || new Error("IndexedDBの読み取りに失敗しました"));
  });
}
```

- [ ] **Step 2: `generatePictureId`の形式だけNodeで確認する**

自動テストファイルは作らず、実装直後にその場でNodeのREPLで確認する:

Run: `node -e "import('./js/pictureStore.js').then(m => { const a = m.generatePictureId(); const b = m.generatePictureId(); console.log(a, b, /^p[a-zA-Z0-9_-]{1,63}$/.test(a), a !== b); })"`
Expected: 2つの異なるID文字列が出力され、正規表現チェックが `true`、`a !== b` も `true`

- [ ] **Step 3: ブラウザで手動確認する(この時点ではUI未接続なのでDevToolsコンソールで直接呼ぶ)**

ローカルサーバーで`index.html`を開き、DevToolsコンソールで:

```js
const m = await import("./js/pictureStore.js");
const pid = m.generatePictureId();
await m.putPictureBlob(pid, "data:image/jpeg;base64,AAAA");
console.log(await m.getPictureBlob(pid)); // "data:image/jpeg;base64,AAAA" が出力されること
console.log(await m.getAllPictureBlobs()); // { [pid]: "data:image/jpeg;base64,AAAA" }
await m.deletePictureBlob(pid);
console.log(await m.getPictureBlob(pid)); // undefined
```

DevToolsのApplicationタブでIndexedDB `dailyecolife-pictures` > `pictures` ストアが作成されていることも確認する。

- [ ] **Step 4: コミット**

```bash
git add js/pictureStore.js
git commit -m "feat: 写真のIndexedDB保存ラッパー(js/pictureStore.js)を追加"
```

---

### Task 3: サーバーphoto APIクライアント `js/photoApi.js`

**Files:**
- Create: `js/photoApi.js`
- Test: `test/photoApi.test.js`

**Interfaces:**
- Consumes: なし(`fetch`をDIで受け取る、`js/api.js`と同じパターン)
- Produces: `putPhoto(pid: string, dataUrl: string, opts?: {apiUrl?: string, fetchFn?: Function}): Promise<object>`
- Produces: `deletePhoto(pid: string, opts?: {apiUrl?: string, fetchFn?: Function}): Promise<object>`
- Produces: `listServerPhotoIds(opts?: {apiUrl?: string, fetchFn?: Function}): Promise<string[]>`
- Produces: `fetchPhotoAsDataUrl(pid: string, opts?: {apiUrl?: string, fetchFn?: Function}): Promise<string>`(内部でFileReaderを使うためブラウザ専用、自動テスト対象外)

- [ ] **Step 1: 失敗するテストを書く**

`test/photoApi.test.js`:

```js
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
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `node --test test/photoApi.test.js`
Expected: FAIL(`../js/photoApi.js` が存在しない)

- [ ] **Step 3: 実装する**

`js/photoApi.js`:

```js
const DEFAULT_API_URL = new URL("../../api/mysql-api.php", import.meta.url).href;

function photoUrl(apiUrl, id) {
  const query = id ? `&id=${encodeURIComponent(id)}` : "&meta=1";
  return `${apiUrl}?resource=photo${query}`;
}

async function requireOk(response) {
  if (!response.ok) throw new Error(`写真API ${response.status}`);
  return response;
}

export async function putPhoto(pid, dataUrl, { apiUrl = DEFAULT_API_URL, fetchFn = fetch } = {}) {
  const response = await fetchFn(photoUrl(apiUrl, pid), {
    method: "PUT",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataUrl }),
  });
  await requireOk(response);
  return response.json();
}

export async function deletePhoto(pid, { apiUrl = DEFAULT_API_URL, fetchFn = fetch } = {}) {
  const response = await fetchFn(photoUrl(apiUrl, pid), { method: "DELETE", credentials: "same-origin" });
  await requireOk(response);
  return response.json();
}

export async function listServerPhotoIds({ apiUrl = DEFAULT_API_URL, fetchFn = fetch } = {}) {
  const response = await fetchFn(photoUrl(apiUrl, null), { credentials: "same-origin" });
  await requireOk(response);
  const data = await response.json();
  return (data.photos || []).map((p) => p.photo_id);
}

export async function fetchPhotoAsDataUrl(pid, { apiUrl = DEFAULT_API_URL, fetchFn = fetch } = {}) {
  const response = await fetchFn(photoUrl(apiUrl, pid), { credentials: "same-origin" });
  await requireOk(response);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("写真の読み込みに失敗しました"));
    reader.readAsDataURL(blob);
  });
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `node --test test/photoApi.test.js`
Expected: PASS(5件)

- [ ] **Step 5: コミット**

```bash
git add js/photoApi.js test/photoApi.test.js
git commit -m "feat: 写真サーバーAPIクライアント(js/photoApi.js)を追加"
```

---

### Task 4: `external-input.js` に写真紐付け関数を追加

**Files:**
- Modify: `js/external-input.js`
- Test: `test/external-input.test.js`(追記)

**Interfaces:**
- Consumes: なし(既存の`loadAll`/`saveJSON`/`EXTERNAL_RECORDS_KEY`を使う)
- Produces: `attachPicturesToProduct(store, productId: string, pids: string[]): void`
- Produces: `attachPicturesToRepairLog(store, logId: string, pids: string[]): void`

- [ ] **Step 1: 失敗するテストを書く**

`test/external-input.test.js` の末尾に追記:

```js
import { attachPicturesToProduct, attachPicturesToRepairLog } from "../js/external-input.js";

test("attachPicturesToProduct: productのpicture_idsに追加しdata.pictureにメタデータを作る", () => {
  const store = createMockStore();
  const id = addSecondhandProduct(store, { name: "冷蔵庫", equipId: "", purchaseyear: null, purchasemonth: -1, memory: "" });
  attachPicturesToProduct(store, id, ["p001", "p002"]);
  const saved = readSaved(store);
  assert.deepEqual(saved.products[id].picture_ids, ["p001", "p002"]);
  assert.ok(saved.picture.p001.created_at);
  assert.equal(saved.picture.p001.memo, "");
  assert.equal(saved.picture.p001.sourceUrl, "");
  assert.ok(saved.picture.p002.created_at);
});

test("attachPicturesToProduct: 既存のpicture_idsを保持したまま追加する", () => {
  const store = createMockStore();
  const id = addSecondhandProduct(store, { name: "冷蔵庫", equipId: "", purchaseyear: null, purchasemonth: -1, memory: "" });
  attachPicturesToProduct(store, id, ["p001"]);
  attachPicturesToProduct(store, id, ["p002"]);
  const saved = readSaved(store);
  assert.deepEqual(saved.products[id].picture_ids, ["p001", "p002"]);
});

test("attachPicturesToRepairLog: repairlogのpicture_idsに追加しdata.pictureにメタデータを作る", () => {
  const store = createMockStore();
  const logId = addRepairLog(store, { productName: "扇風機", equipId: "", year: null, repairer: "", about: "" });
  attachPicturesToRepairLog(store, logId, ["p010"]);
  const saved = readSaved(store);
  assert.deepEqual(saved.repairlog[logId].picture_ids, ["p010"]);
  assert.ok(saved.picture.p010.created_at);
});

test("attachPicturesToProduct: 存在しないproductIdを渡しても例外を投げずpictureメタデータだけ作る", () => {
  const store = createMockStore();
  attachPicturesToProduct(store, "e999", ["p001"]);
  const saved = readSaved(store);
  assert.equal(saved.products.e999, undefined);
  assert.ok(saved.picture.p001.created_at);
});
```

- [ ] **Step 2: テストが失敗することを確認する**

Run: `node --test test/external-input.test.js`
Expected: FAIL(`attachPicturesToProduct`が存在しない)

- [ ] **Step 3: 実装する**

`js/external-input.js` の末尾に追記:

```js
function mergePictureMetadata(all, pids) {
  const picture = { ...(all.picture ?? {}) };
  const now = new Date().toISOString();
  for (const pid of pids) {
    picture[pid] = { memo: "", created_at: now, sourceUrl: "" };
  }
  return picture;
}

export function attachPicturesToProduct(store, productId, pids) {
  if (!pids.length) return;
  const all = loadAll(store);
  const picture = mergePictureMetadata(all, pids);
  const products = { ...(all.products ?? {}) };
  const target = products[productId];
  if (target) {
    products[productId] = { ...target, picture_ids: [...(target.picture_ids ?? []), ...pids] };
  }
  saveJSON(store, EXTERNAL_RECORDS_KEY, { ...all, picture, products });
}

export function attachPicturesToRepairLog(store, logId, pids) {
  if (!pids.length) return;
  const all = loadAll(store);
  const picture = mergePictureMetadata(all, pids);
  const repairlog = { ...(all.repairlog ?? {}) };
  const target = repairlog[logId];
  if (target) {
    repairlog[logId] = { ...target, picture_ids: [...(target.picture_ids ?? []), ...pids] };
  }
  saveJSON(store, EXTERNAL_RECORDS_KEY, { ...all, picture, repairlog });
}
```

- [ ] **Step 4: テストが通ることを確認する**

Run: `node --test test/external-input.test.js`
Expected: PASS(全件)

- [ ] **Step 5: コミット**

```bash
git add js/external-input.js test/external-input.test.js
git commit -m "feat: 中古/修理記録への写真紐付け関数を追加"
```

---

### Task 5: `app.js` に `resource="ecolife"` の同期ストアを追加

**Files:**
- Modify: `app.js:11-33`

**Interfaces:**
- Consumes: `createSyncStore`(`../ehome/sync.js`、既存)、`EXTERNAL_RECORDS_KEY`(`js/external-records.js`、既存)
- Produces: `window.externalRecordsStore`(`getItem`/`setItem`を持つlocalStorage互換オブジェクト。以降のタスクで`action-menu-page.js`から使う)

このタスクに自動テストは無い(`createSyncStore`自体は`ehome`側の既存モジュールで変更しない。ここでは呼び出し追加のみ)。Step 2でブラウザ手動確認する。

- [ ] **Step 1: `app.js`を修正する**

`app.js`冒頭のimportに追記(1行目付近、既存の`import { RECORDS_KEY, ...} from "./js/records.js";`の下あたり):

```js
import { EXTERNAL_RECORDS_KEY } from "./js/external-records.js";
```

既存の以下のブロック:

```js
window.ecolifeStore = await createSyncStore({
  resource: "daily",
  entries: [
    { key: "dailyecolife_records", field: "records", fallback: {} },
    { key: "dailyecolife_quiz", field: "quiz", fallback: {} },
    { key: "dailyecolife_ecodiagnosis", field: "diagnosis", fallback: {} },
    { key: "dailyecolife_meterreading", field: "meter", fallback: {} },
    { key: "dailyecolife_actionnotes", field: "actionNotes", fallback: {} },
  ],
});
```

の直後に追加する:

```js
window.externalRecordsStore = await createSyncStore({
  resource: "ecolife",
  entries: [{ key: EXTERNAL_RECORDS_KEY, field: null, fallback: {} }],
});
```

- [ ] **Step 2: ブラウザで手動確認する**

ローカルサーバーで`index.html`を開き、DevToolsコンソールで `window.externalRecordsStore` が `{getItem, setItem, removeItem, sync, initialize, isDirty}` を持つオブジェクトとして存在することを確認する。ネットワークタブで `mysql-api.php?resource=ecolife&meta=1` へのGETリクエストが発生していることを確認する。

- [ ] **Step 3: コミット**

```bash
git add app.js
git commit -m "feat: 中古/修理データ(resource=ecolife)のサーバー同期を追加"
```

---

### Task 6: `action-menu-page.js` — 写真の撮影/選択とローカル保存の配線

**Files:**
- Modify: `js/pages/action-menu-page.js`

**Interfaces:**
- Consumes: `generatePictureId`, `putPictureBlob`, `getPictureBlob`(Task 2) / `compressImageFile`(Task 1) / `putPhoto`, `fetchPhotoAsDataUrl`, `listServerPhotoIds`(Task 3) / `attachPicturesToProduct`, `attachPicturesToRepairLog`(Task 4) / `window.externalRecordsStore`(Task 5)
- Produces: `forms[actionId].pictures: {pid: string, dataUrl: string}[]`、`forms[actionId].photoError: string`、`onPhotoInput(actionId, event)`、`pictureThumbs: Record<string, string>`(既存記録のサムネイル表示用reactiveオブジェクト)

このタスクはVueのUI配線でありNode自動テスト対象外。Task 7でテンプレートと合わせてブラウザ手動確認する。

- [ ] **Step 1: import を追加する**

既存の9行目を置き換える:

```js
import {
  listSecondhandProducts,
  listRepairLogs,
  addSecondhandProduct,
  addRepairLog,
  attachPicturesToProduct,
  attachPicturesToRepairLog,
} from "../external-input.js";
```

さらにその下に追記する:

```js
import { compressImageFile } from "../image.js";
import { generatePictureId, putPictureBlob, getPictureBlob } from "../pictureStore.js";
import { putPhoto, fetchPhotoAsDataUrl, listServerPhotoIds } from "../photoApi.js";
```

`const { ref, reactive, computed, watch, onMounted } = Vue;`(12行目)はそのまま(`onMounted`は既にimport済みで今回初めて使用する)。

- [ ] **Step 2: 定数と状態を追加する**

`PURCHASE_MONTH_OPTIONS`定義の下に追記:

```js
const MAX_PICTURES = 5;
```

`emptyFormState()`(20-34行目)に `pictures` と `photoError` を追加する:

```js
function emptyFormState() {
  return {
    name: "",
    equipId: "",
    equipSuggestedId: null,
    equipSuggestedTitle: "",
    purchaseyear: "",
    purchasemonth: -1,
    memory: "",
    year: "",
    repairer: "",
    about: "",
    note: "",
    pictures: [],
    photoError: "",
  };
}
```

`setup(props, { emit })`内、`const store = window.ecolifeStore;`(49行目)の直後に追記:

```js
const externalStore = window.externalRecordsStore;
const pictureThumbs = reactive({});
```

- [ ] **Step 3: 写真選択ハンドラを追加する**

`onNameBlur`関数の下(188行目付近、`equipLabel`関数の前)に追記:

```js
async function onPhotoInput(actionId, event) {
  const files = Array.from(event.target.files || []);
  event.target.value = "";
  if (!files.length) return;
  const form = ensureForm(actionId);
  form.photoError = "";
  const remaining = MAX_PICTURES - form.pictures.length;
  for (const file of files.slice(0, remaining)) {
    try {
      const dataUrl = await compressImageFile(file);
      const pid = generatePictureId();
      await putPictureBlob(pid, dataUrl);
      form.pictures.push({ pid, dataUrl });
      putPhoto(pid, dataUrl).catch((err) => console.error(`写真のサーバー登録に失敗しました: ${pid}`, err));
    } catch (err) {
      form.photoError = "写真の読み込みに失敗しました。";
      console.error("写真の読み込みに失敗しました", err);
    }
  }
}

async function loadThumb(pid) {
  if (pictureThumbs[pid]) return;
  let dataUrl = await getPictureBlob(pid);
  if (!dataUrl) {
    try {
      dataUrl = await fetchPhotoAsDataUrl(pid);
      await putPictureBlob(pid, dataUrl);
    } catch (err) {
      console.error(`写真の取得に失敗しました: ${pid}`, err);
      return;
    }
  }
  pictureThumbs[pid] = dataUrl;
}

async function retryPendingPhotoUploads() {
  const all = loadJSON(externalStore, EXTERNAL_RECORDS_KEY, {});
  const localPids = Object.keys(all.picture ?? {});
  if (!localPids.length) return;
  let serverPids;
  try {
    serverPids = new Set(await listServerPhotoIds());
  } catch (err) {
    console.error("写真アップロード状況の確認に失敗しました", err);
    return;
  }
  for (const pid of localPids) {
    if (serverPids.has(pid)) continue;
    const dataUrl = await getPictureBlob(pid);
    if (!dataUrl) continue;
    try {
      await putPhoto(pid, dataUrl);
    } catch (err) {
      console.error(`写真の再送信に失敗しました: ${pid}`, err);
    }
  }
}
```

`loadJSON`と`EXTERNAL_RECORDS_KEY`を使うため、importを追加する。冒頭4行目の既存import:

```js
import { loadJSON } from "../storage.js";
```

を次に置き換える:

```js
import { loadJSON } from "../storage.js";
import { EXTERNAL_RECORDS_KEY } from "../external-records.js";
```

- [ ] **Step 4: `refreshEntries`でサムネイルを読み込む**

既存の`refreshEntries`(165-171行目)を置き換える:

```js
function refreshEntries(actionId) {
  if (actionId === "secondhand") {
    entryLists[actionId] = listSecondhandProducts(externalStore);
  } else if (actionId === "repair") {
    entryLists[actionId] = listRepairLogs(externalStore);
  }
  for (const entry of entryLists[actionId] ?? []) {
    for (const pid of entry.picture_ids ?? []) loadThumb(pid);
  }
}
```

- [ ] **Step 5: `saveSecondhand`/`saveRepair`で保存先ストアを切り替え、写真を紐付ける**

既存の`saveSecondhand`(197-211行目)を置き換える:

```js
function saveSecondhand(action) {
  const form = forms[action.id];
  const name = form.name.trim();
  if (!name) return;
  const id = addSecondhandProduct(externalStore, {
    name,
    equipId: form.equipId,
    purchaseyear: form.purchaseyear === "" ? null : form.purchaseyear,
    purchasemonth: form.purchasemonth,
    memory: form.memory.trim(),
  });
  if (form.pictures.length) {
    attachPicturesToProduct(externalStore, id, form.pictures.map((pic) => pic.pid));
  }
  resetForm(action.id);
  refreshEntries(action.id);
  markDone(action);
}
```

既存の`saveRepair`(213-227行目)を置き換える:

```js
function saveRepair(action) {
  const form = forms[action.id];
  const name = form.name.trim();
  if (!name) return;
  const logId = addRepairLog(externalStore, {
    productName: name,
    equipId: form.equipId,
    year: form.year === "" ? null : form.year,
    repairer: form.repairer,
    about: form.about.trim(),
  });
  if (form.pictures.length) {
    attachPicturesToRepairLog(externalStore, logId, form.pictures.map((pic) => pic.pid));
  }
  resetForm(action.id);
  refreshEntries(action.id);
  markDone(action);
}
```

`onNameBlur`は`equipItems`のみを使い保存先ストアと無関係のため変更不要。

- [ ] **Step 6: 起動時に未送信写真をリトライする**

`return { ... }`の直前(272行目付近)に追記:

```js
onMounted(() => {
  retryPendingPhotoUploads();
});
```

- [ ] **Step 7: `return`に新しい関数/状態を追加する**

既存の`return { ... }`ブロック(272-303行目)に以下を追加する:

```js
      forms,
      entryLists,
      onNameBlur,
      equipLabel,
      saveSecondhand,
      saveRepair,
      purchaseDateLabel,
      repairDateLabel,
      onPhotoInput,
      pictureThumbs,
      MAX_PICTURES,
```

- [ ] **Step 8: 構文エラーが無いことを確認する**

Run: `node --check js/pages/action-menu-page.js`
Expected: 出力なし(exit code 0)

- [ ] **Step 9: コミット**

```bash
git add js/pages/action-menu-page.js
git commit -m "feat: 中古/修理フォームに写真の撮影・選択・保存ロジックを配線"
```

---

### Task 7: `action-menu-page.js` — テンプレートに写真UIを追加

**Files:**
- Modify: `js/pages/action-menu-page.js`(template部分)

**Interfaces:**
- Consumes: Task 6で`return`された`onPhotoInput`, `pictureThumbs`, `MAX_PICTURES`, `forms[actionId].pictures`, `forms[actionId].photoError`

- [ ] **Step 1: 中古フォームに写真セクションを追加する**

既存の中古フォーム内、「概要」の`form-field`(351-354行目)と「記録を追加」ボタン(355行目)の間に挿入する:

```html
            <div class="form-field photo-field">
              <label>写真(最大{{ MAX_PICTURES }}枚)</label>
              <div class="photo-picker">
                <label class="btn photo-picker-btn">
                  撮影する
                  <input type="file" accept="image/*" capture="environment" class="photo-input"
                    :disabled="forms[action.id].pictures.length >= MAX_PICTURES"
                    @change="onPhotoInput(action.id, $event)">
                </label>
                <label class="btn photo-picker-btn">
                  アルバムから選択
                  <input type="file" accept="image/*" multiple class="photo-input"
                    :disabled="forms[action.id].pictures.length >= MAX_PICTURES"
                    @change="onPhotoInput(action.id, $event)">
                </label>
              </div>
              <p v-if="forms[action.id].pictures.length >= MAX_PICTURES" class="equip-suggestion-note">写真は{{ MAX_PICTURES }}枚まで登録できます。</p>
              <p v-if="forms[action.id].photoError" class="equip-suggestion-note">{{ forms[action.id].photoError }}</p>
              <div class="photo-thumb-list" v-if="forms[action.id].pictures.length">
                <img v-for="pic in forms[action.id].pictures" :key="pic.pid" :src="pic.dataUrl" class="photo-thumb" alt="登録する写真">
              </div>
            </div>
```

「これまでの記録」内、`entry-item`(359-363行目)にサムネイル表示を追加する。既存:

```html
              <div class="entry-item" v-for="entry in entryLists[action.id]" :key="entry.id">
                <p class="entry-item-name">{{ entry.name }}</p>
                <p class="entry-item-meta">{{ equipLabel(entry.equip_id) || '未分類' }} ・ {{ purchaseDateLabel(entry) }}</p>
                <p class="entry-item-memo" v-if="entry.memory">{{ entry.memory }}</p>
              </div>
```

を次に置き換える:

```html
              <div class="entry-item" v-for="entry in entryLists[action.id]" :key="entry.id">
                <p class="entry-item-name">{{ entry.name }}</p>
                <p class="entry-item-meta">{{ equipLabel(entry.equip_id) || '未分類' }} ・ {{ purchaseDateLabel(entry) }}</p>
                <p class="entry-item-memo" v-if="entry.memory">{{ entry.memory }}</p>
                <div class="photo-thumb-list" v-if="entry.picture_ids && entry.picture_ids.length">
                  <template v-for="pid in entry.picture_ids" :key="pid">
                    <img v-if="pictureThumbs[pid]" :src="pictureThumbs[pid]" class="photo-thumb" alt="登録された写真">
                  </template>
                </div>
              </div>
```

- [ ] **Step 2: 修理フォームに写真セクションを追加する**

既存の修理フォーム内、「概要」の`form-field`(402-405行目)と「記録を追加」ボタン(406行目)の間に挿入する(中古と同一マークアップ):

```html
            <div class="form-field photo-field">
              <label>写真(最大{{ MAX_PICTURES }}枚)</label>
              <div class="photo-picker">
                <label class="btn photo-picker-btn">
                  撮影する
                  <input type="file" accept="image/*" capture="environment" class="photo-input"
                    :disabled="forms[action.id].pictures.length >= MAX_PICTURES"
                    @change="onPhotoInput(action.id, $event)">
                </label>
                <label class="btn photo-picker-btn">
                  アルバムから選択
                  <input type="file" accept="image/*" multiple class="photo-input"
                    :disabled="forms[action.id].pictures.length >= MAX_PICTURES"
                    @change="onPhotoInput(action.id, $event)">
                </label>
              </div>
              <p v-if="forms[action.id].pictures.length >= MAX_PICTURES" class="equip-suggestion-note">写真は{{ MAX_PICTURES }}枚まで登録できます。</p>
              <p v-if="forms[action.id].photoError" class="equip-suggestion-note">{{ forms[action.id].photoError }}</p>
              <div class="photo-thumb-list" v-if="forms[action.id].pictures.length">
                <img v-for="pic in forms[action.id].pictures" :key="pic.pid" :src="pic.dataUrl" class="photo-thumb" alt="登録する写真">
              </div>
            </div>
```

修理の「これまでの記録」内、`entry-item`(410-414行目)の既存:

```html
              <div class="entry-item" v-for="entry in entryLists[action.id]" :key="entry.id">
                <p class="entry-item-name">{{ entry.productName }}</p>
                <p class="entry-item-meta">{{ repairDateLabel(entry) }}{{ entry.repairerLabel ? ' ・ ' + entry.repairerLabel : '' }}</p>
                <p class="entry-item-memo" v-if="entry.about">{{ entry.about }}</p>
              </div>
```

を次に置き換える:

```html
              <div class="entry-item" v-for="entry in entryLists[action.id]" :key="entry.id">
                <p class="entry-item-name">{{ entry.productName }}</p>
                <p class="entry-item-meta">{{ repairDateLabel(entry) }}{{ entry.repairerLabel ? ' ・ ' + entry.repairerLabel : '' }}</p>
                <p class="entry-item-memo" v-if="entry.about">{{ entry.about }}</p>
                <div class="photo-thumb-list" v-if="entry.picture_ids && entry.picture_ids.length">
                  <template v-for="pid in entry.picture_ids" :key="pid">
                    <img v-if="pictureThumbs[pid]" :src="pictureThumbs[pid]" class="photo-thumb" alt="登録された写真">
                  </template>
                </div>
              </div>
```

- [ ] **Step 3: 構文エラーが無いことを確認する**

Run: `node --check js/pages/action-menu-page.js`
Expected: 出力なし(exit code 0)

- [ ] **Step 4: 既存の自動テストが壊れていないことを確認する**

Run: `node --test`
Expected: Task開始前から失敗している`test/quiz.test.js`以外は全てPASS(このタスクでは新規のNode自動テストは追加しない)

- [ ] **Step 5: コミット**

```bash
git add js/pages/action-menu-page.js
git commit -m "feat: 中古/修理フォームに写真UI(撮影・選択・サムネイル表示)を追加"
```

---

### Task 8: スタイル追加 `style.css`

**Files:**
- Modify: `style.css`

**Interfaces:**
- Consumes: Task 7で追加したクラス名(`photo-field`, `photo-picker`, `photo-picker-btn`, `photo-input`, `photo-thumb-list`, `photo-thumb`)

- [ ] **Step 1: `.entry-item`定義(518-523行目)の直後にスタイルを追記する**

```css
.photo-picker {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 4px;
}

.photo-picker-btn {
  position: relative;
}

.photo-input {
  display: none;
}

.photo-thumb-list {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  margin-top: 8px;
}

.photo-thumb {
  width: 72px;
  height: 72px;
  object-fit: cover;
  border-radius: 8px;
  border: 1px solid var(--line);
}
```

- [ ] **Step 2: ブラウザで見た目を確認する**

ローカルサーバーで`index.html`を開き、中古または修理の記録画面で「撮影する」「アルバムから選択」ボタンが`.btn`と同じ見た目で並んで表示されること、選択後のサムネイルが72x72で並んで表示されることを確認する。

- [ ] **Step 3: コミット**

```bash
git add style.css
git commit -m "style: 写真ピッカー/サムネイルのスタイルを追加"
```

---

## 手動確認手順(全タスク完了後)

1. ローカルサーバーを起動し、モバイル幅のブラウザ(またはDevToolsのデバイスモード)で「中古」または「修理」の記録画面を開く。
2. 「撮影する」でカメラが起動する(モバイル実機推奨。PCブラウザではファイル選択ダイアログにフォールバックする場合がある)ことを確認する。
3. 「アルバムから選択」で複数枚(6枚以上)選択し、5枚を超えた分が追加されない(ボタンが無効化される)ことを確認する。
4. 選択直後にサムネイルが即表示される(圧縮・IndexedDB保存が同期的に見える速さで完了する)ことを確認する。
5. DevToolsのApplication > IndexedDB > `dailyecolife-pictures` > `pictures` に、長辺640px相当のdata URLが保存されていることを確認する。
6. DevToolsのNetworkタブで `mysql-api.php?resource=photo&id=...` へのPUTが発生し、成功していることを確認する。
7. 「記録を追加」を押し、一覧にサムネイルが表示されることを確認する。
8. ページをリロードし、`resource=ecolife`の初期ロードで中古/修理データが復元され、サムネイルも(IndexedDBから、またはサーバーからのフォールバック取得で)表示されることを確認する。
9. DevToolsでIndexedDBのデータを削除した状態でリロードし、サムネイルがサーバーから取得されIndexedDBに再キャッシュされることを確認する(`fetchPhotoAsDataUrl`のフォールバック経路)。
