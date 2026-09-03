import { test } from "node:test";
import assert from "node:assert/strict";
import { EXTERNAL_RECORDS_KEY } from "../js/external-records.js";
import {
  listSecondhandProducts,
  listRepairLogs,
  addSecondhandProduct,
  addRepairLog,
  attachPicturesToProduct,
  attachPicturesToRepairLog,
} from "../js/external-input.js";

function createMockStore(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, value),
  };
}

function readSaved(store) {
  return JSON.parse(store.getItem(EXTERNAL_RECORDS_KEY));
}

test("addSecondhandProduct: productsにe***で追加され、methodは3", () => {
  const store = createMockStore();
  const id = addSecondhandProduct(store, {
    name: "32インチテレビ",
    equipId: "411",
    purchaseyear: 2023,
    purchasemonth: 5,
    memory: "友人から中古で購入",
  });
  assert.equal(id, "e001");
  const saved = readSaved(store);
  assert.equal(saved.products.e001.name, "32インチテレビ");
  assert.equal(saved.products.e001.equip_id, "411");
  assert.equal(saved.products.e001.method, 3);
  assert.equal(saved.products.e001.purchaseyear, 2023);
  assert.equal(saved.products.e001.purchasemonth, 5);
  assert.equal(saved.products.e001.memory, "友人から中古で購入");
});

test("addSecondhandProduct: スキーマ必須項目が全て埋まる", () => {
  const store = createMockStore();
  addSecondhandProduct(store, { name: "赤いカーディガン", equipId: "", purchaseyear: null, purchasemonth: -1, memory: "" });
  const product = readSaved(store).products.e001;
  for (const key of [
    "name",
    "equip_id",
    "purchaseyear",
    "purchasemonth",
    "method",
    "manufactureyear",
    "room_id",
    "watt",
    "usagetime",
    "maker",
    "modelnumber",
    "seller",
    "frequency",
    "enduseyear",
    "favorite",
    "repairlog_ids",
    "picture_ids",
    "memory",
  ]) {
    assert.ok(Object.prototype.hasOwnProperty.call(product, key), `${key} がない`);
  }
});

test("addSecondhandProduct: 既存のproductsを壊さずIDを連番で払い出す", () => {
  const store = createMockStore({
    [EXTERNAL_RECORDS_KEY]: JSON.stringify({ products: { e001: { name: "既存品" } } }),
  });
  const id = addSecondhandProduct(store, { name: "新品", equipId: "", purchaseyear: null, purchasemonth: -1, memory: "" });
  assert.equal(id, "e002");
  const saved = readSaved(store);
  assert.equal(saved.products.e001.name, "既存品");
  assert.equal(saved.products.e002.name, "新品");
});

test("listSecondhandProducts: method=3の製品だけを新しい順で返す", () => {
  const store = createMockStore({
    [EXTERNAL_RECORDS_KEY]: JSON.stringify({
      products: {
        e001: { name: "中古1", method: 3 },
        e002: { name: "新品", method: 1 },
        e003: { name: "中古2", method: 3 },
      },
    }),
  });
  const list = listSecondhandProducts(store);
  assert.deepEqual(list.map((p) => p.id), ["e003", "e001"]);
});

test("addRepairLog: productsとrepairlogの両方に追加され相互参照する", () => {
  const store = createMockStore();
  const logId = addRepairLog(store, {
    productName: "掃除機",
    equipId: "181",
    year: 2022,
    repairer: 4,
    about: "吸引力が落ちたので分解清掃",
  });
  assert.equal(logId, "l001");
  const saved = readSaved(store);
  assert.equal(saved.products.e001.name, "掃除機");
  assert.equal(saved.products.e001.equip_id, "181");
  assert.deepEqual(saved.products.e001.repairlog_ids, ["l001"]);
  assert.equal(saved.repairlog.l001.product_id, "e001");
  assert.equal(saved.repairlog.l001.year, 2022);
  assert.equal(saved.repairlog.l001.repairer, 4);
  assert.equal(saved.repairlog.l001.about, "吸引力が落ちたので分解清掃");
});

test("addRepairLog: スキーマ必須項目が全て埋まる", () => {
  const store = createMockStore();
  addRepairLog(store, { productName: "扇風機", equipId: "", year: null, repairer: "", about: "" });
  const log = readSaved(store).repairlog.l001;
  for (const key of ["year", "month", "day", "product_id", "cost", "repairer", "about", "picture_ids", "created_at"]) {
    assert.ok(Object.prototype.hasOwnProperty.call(log, key), `${key} がない`);
  }
  assert.equal(log.repairer, null);
});

test("listRepairLogs: 製品名を解決し新しい順で返す", () => {
  const store = createMockStore();
  addRepairLog(store, { productName: "扇風機", equipId: "", year: 2021, repairer: "", about: "" });
  addRepairLog(store, { productName: "洗濯機", equipId: "", year: 2022, repairer: "", about: "" });
  const list = listRepairLogs(store);
  assert.deepEqual(list.map((l) => l.productName), ["洗濯機", "扇風機"]);
});

test("listRepairLogs: repairerLabelにコードから解決したラベルを持つ", () => {
  const store = createMockStore();
  addRepairLog(store, { productName: "自転車", equipId: "", year: 2023, repairer: 3, about: "" });
  addRepairLog(store, { productName: "扇風機", equipId: "", year: 2021, repairer: "", about: "" });
  const list = listRepairLogs(store);
  assert.equal(list.find((l) => l.productName === "自転車").repairerLabel, "修理施設");
  assert.equal(list.find((l) => l.productName === "扇風機").repairerLabel, "");
});

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
