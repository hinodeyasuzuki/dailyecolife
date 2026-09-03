# 中古・修理記録への写真登録 設計

## 背景・目的

`action-menu-page.js` の「中古」「修理」フォーム(`js/external-input.js` が扱う
`homeenergycodes.savedInput`、以下 `EXTERNAL_RECORDS_KEY`)に、撮影/ファイル選択
による写真登録機能を追加する。写真は長辺640pxに縮小したうえで、

- 端末内 IndexedDB に即時保存(体感速度・オフライン耐性のため)
- サーバーDB(`photos` テーブル、既存の `resource=photo` API)にも登録

する。あわせて、これまでサーバー同期されていなかった中古・修理データ本体
(製品名・時期・修理者など)も、今回はじめてサーバー同期の対象に含める。

## 現状(調査結果)

- `EXTERNAL_RECORDS_KEY`(`js/external-records.js:3` = `"homeenergycodes.savedInput"`)は
  dailyecolife では未同期(localStorageのみ)。
- 兄弟アプリ `myecoliferecords` は同じキーを `resource="ecolife"` で
  `createSyncStore` により既にサーバー同期している(`myecoliferecords/app.js:34-36`)。
- `data.picture[pid] = { memo, created_at, sourceUrl }` というメタデータ構造と、
  `products[id].picture_ids` / `repairlog[id].picture_ids` によるpid参照は
  `saved-input.schema.json` に既定義済みで、`myecoliferecords` 側で実際に使われている。
- 画像バイナリは `photos` テーブル(`session_hash`, `photo_id`, `mime_type`,
  `image_data` MEDIUMBLOB, `byte_size`, `updated_at`)に保存され、
  `api/mysql-api.php` の `resource=photo` で GET(meta一覧/単体取得)・
  PUT(`{dataUrl}` をデコードしてBLOB保存、16MB上限)・DELETE を提供する。
  `photo_id` は `^p[a-zA-Z0-9_-]{1,63}$` を要求。
- `myecoliferecords/lib/image.js` の `compressImageFile(file, {maxDimension=640,
  quality=0.6})` が Canvas 経由で長辺640pxのJPEG data URLを返す実装として既にある。
- 過去に `homeenergycodes` にあった IndexedDBラッパー(現在は削除済み、git履歴
  `c5b7c65:docs/input/lib/pictureStore.js`)が参考にできるパターンを持つ
  (DB名/バージョン/store名、`withStore` ヘルパー、CRUD一式)。ただし現行の
  `myecoliferecords/lib/pictureStore.js` はIndexedDBを使わずサーバー直叩きに
  置き換わっている。dailyecolifeでは要件どおりIndexedDBを主保存先として使う。

## データモデル

### サーバー同期(JSON メタデータ)

`app.js` に2つ目の `createSyncStore` 呼び出しを追加し、`EXTERNAL_RECORDS_KEY` を
`myecoliferecords` と同一の `resource="ecolife"` で同期する:

```js
window.externalRecordsStore = await createSyncStore({
  resource: "ecolife",
  entries: [{ key: EXTERNAL_RECORDS_KEY, field: null, fallback: {} }],
});
```

`external-input.js` の `loadAll`/`saveJSON` 呼び出し先を、現行の
`window.localStorage` 直接参照から、この `externalRecordsStore` 経由に変更する
(`createSyncStore` が返す `store` は `getItem`/`setItem` を持つlocalStorage互換
オブジェクトなので、既存 `loadJSON`/`saveJSON`(`js/storage.js`)にそのまま渡せる)。

### 写真メタデータ

`EXTERNAL_RECORDS_KEY` のJSON内に `picture` オブジェクトを追加する
(現状 `all.picture` は存在しないため、`loadAll` のfallbackと各保存関数で
`picture: {}` を初期化する):

```js
data.picture[pid] = {
  memo: "",
  created_at: "2026-09-03T12:00:00.000Z",
  sourceUrl: "",
};
```

`products[id].picture_ids` / `repairlog[id].picture_ids` に pid を追加する。
pid の発番は既存の `nextId(entries, prefix)` パターン(`external-input.js:11-19`)
を再利用し、`data.picture` を対象に `prefix="p"` で採番する(例: `p001`)。

### 画像バイナリ

JSON には含めない。IndexedDBと `photos` テーブルにのみ、pidをキーとして
data URL(IndexedDB)/ バイナリ(サーバー)を保存する。

## 画像処理

新規 `js/image.js`(`myecoliferecords/lib/image.js` を移植):

```js
export function computeScaledDimensions(width, height, maxDimension) { ... }
export function compressImageFile(file, { maxDimension = 640, quality = 0.6 } = {}) { ... }
```

FileReader → `Image` → `<canvas>`(`drawImage` でリサイズ)→
`canvas.toDataURL("image/jpeg", quality)` という既存実装をそのまま使う。

## IndexedDB 保存

新規 `js/pictureStore.js`(削除済み `homeenergycodes` の実装を移植):

- DB名: `dailyecolife-pictures`、`DB_VERSION=1`、object store名: `pictures`
  (key=pid文字列、value=data URL文字列)
- 提供する関数: `getPictureBlob(pid)`, `putPictureBlob(pid, dataUrl)`,
  `deletePictureBlob(pid)`, `getAllPictureBlobs()`
- `openDb()` + `withStore(mode, fn)` ヘルパーで transaction を共通化する
  既存パターンを踏襲する。

## サーバー連携

新規 `js/photoApi.js`(`myecoliferecords/lib/pictureStore.js` のサーバー呼び出し
部分を移植、dailyecolifeの `api/mysql-api.php` パスに合わせる):

- `putPhoto(pid, dataUrl)`: `PUT ?resource=photo&id=pid` body `{dataUrl}`
- `deletePhoto(pid)`: `DELETE ?resource=photo&id=pid`
- `fetchPhotoAsDataUrl(pid)`: `GET ?resource=photo&id=pid` → blob → data URL
- `listServerPhotoIds()`: `GET ?resource=photo&meta=1` → `photos[].photo_id` の配列

### 保存フロー

1. ユーザーが画像を選択/撮影 → `compressImageFile` で圧縮
2. pid を発番し `putPictureBlob(pid, dataUrl)` でIndexedDBに即保存
   (フォームの下書き状態にサムネイルとして表示)
3. `putPhoto(pid, dataUrl)` を非同期で呼び出しサーバーに送信。
   失敗時は `console.error` に留め、UIをブロックしない
   (画像はIndexedDBに残っているため記録自体は失われない)。
4. 「記録を追加」押下時、下書き中の pid 群を新規 product/repairlog の
   `picture_ids` に書き込み、`data.picture[pid]` メタデータを保存する。

### 未送信写真の簡易リトライ

複雑な再送キューは作らない(YAGNI)。アプリ起動時、
`data.picture` に存在する pid 一覧と `listServerPhotoIds()` の差分を取り、
サーバーに存在しない pid についてのみ、IndexedDBから読み出して
`putPhoto` を再試行する。

### 他端末で登録された写真の表示

サムネイル表示時、対象pidが `getPictureBlob` でIndexedDBに見つからなければ
`fetchPhotoAsDataUrl(pid)` でサーバーから取得し、`putPictureBlob` で
ローカルにもキャッシュしてから表示する。

## UI/UX

`action-menu-page.js` の中古(316-365行目)・修理(368-416行目)フォームに
写真セクションを追加する:

- 「撮影する」: `<input type="file" accept="image/*" capture="environment">`
- 「アルバムから選択」: `<input type="file" accept="image/*" multiple>`
- 選択・撮影ごとに保存フロー1〜3を実行し、`forms[action.id].pictures`
  (下書き中のpid+dataURL配列)にサムネイルを追加表示。1件あたり上限5枚とし、
  上限到達時はボタンを無効化してメッセージ表示。
- 「記録を追加」押下時に保存フロー4を実行し、下書きをクリアする。
- 「これまでの記録」一覧(357行目/408行目付近)にもサムネイルを表示する。
  表示に必要なpidのみ都度 `getPictureBlob`(必要なら上記フォールバック経由)で
  取得し、画面表示専用の非永続reactiveキャッシュ(`{ [pid]: dataUrl }`)に
  保持する(localStorageの `data` には含めない)。

## エラーハンドリング

- 画像読み込み失敗(FileReader/Imageエラー)、IndexedDB操作失敗、
  サーバー側16MB上限超過などは、フォーム内に簡潔なエラーメッセージを表示し
  当該写真の追加のみ中断する(記録自体の保存は妨げない)。
- サーバーへのアップロード失敗は上記「簡易リトライ」に任せ、ユーザー操作は
  ブロックしない。

## テスト方針

- `test/image.test.js`(新規): `computeScaledDimensions` のロジック検証。
  (`compressImageFile` はCanvas/Image依存のためユニットテストは限定的、
  縮小寸法計算のみ検証)
- `test/pictureStore.test.js`(新規): IndexedDB CRUD。Node環境での実行に
  `fake-indexeddb` の追加が必要か既存テスト構成を確認して判断する。
- `test/external-input.test.js`(既存拡張): pid発番・`picture_ids`紐付け・
  `data.picture` メタデータ書き込みのユニットテストを追加。
- UI手動確認: ブラウザで撮影/ファイル選択→縮小→IndexedDB即時反映→
  サーバー登録、を一通り確認する。

## スコープ外(既知の制限)

- フォーム下書き段階で追加した写真は、フォームを送信せず離脱した場合
  ローカル(IndexedDB)・サーバーの両方に孤立して残る。クリーンアップ機構は
  今回作らない。
- 写真の削除・並べ替えUIは今回のスコープに含めない。
