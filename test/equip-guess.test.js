import { test } from "node:test";
import assert from "node:assert/strict";
import { guessEquipItem, equipTitle } from "../js/equip-guess.js";

const EQUIP_ITEMS = [
  { id: "100", title: "家事", level: 1, parentId: null, level1Id: "100", level2Id: null },
  { id: "110", title: "調理機器", level: 2, parentId: "100", level1Id: "100", level2Id: "110" },
  { id: "114", title: "冷蔵庫", level: 3, parentId: "110", level1Id: "100", level2Id: "110" },
  { id: "400", title: "情報家電", level: 1, parentId: null, level1Id: "400", level2Id: null },
  { id: "410", title: "映像機器", level: 2, parentId: "400", level1Id: "400", level2Id: "410" },
  { id: "411", title: "テレビ", level: 3, parentId: "410", level1Id: "400", level2Id: "410" },
  { id: "412", title: "ポータブルテレビ", level: 3, parentId: "410", level1Id: "400", level2Id: "410" },
  { id: "800", title: "衣類", level: 1, parentId: null, level1Id: "800", level2Id: null },
  { id: "810", title: "洋服", level: 2, parentId: "800", level1Id: "800", level2Id: "810" },
  { id: "818", title: "セーター", level: 3, parentId: "810", level1Id: "800", level2Id: "810" },
];

test("guessEquipItem: 製品名に含まれるカテゴリー名から一致するものを返す", () => {
  const item = guessEquipItem(EQUIP_ITEMS, "32インチテレビ");
  assert.equal(item.id, "411");
});

test("guessEquipItem: エイリアスに一致する場合はエイリアス先を返す", () => {
  const item = guessEquipItem(EQUIP_ITEMS, "赤いカーディガン");
  assert.equal(item.id, "818");
});

test("guessEquipItem: 一致しない場合はnullを返す", () => {
  assert.equal(guessEquipItem(EQUIP_ITEMS, "謎の機械"), null);
});

test("guessEquipItem: 空の製品名はnullを返す", () => {
  assert.equal(guessEquipItem(EQUIP_ITEMS, ""), null);
  assert.equal(guessEquipItem(EQUIP_ITEMS, undefined), null);
});

test("equipTitle: idからタイトルを引ける", () => {
  assert.equal(equipTitle(EQUIP_ITEMS, "411"), "テレビ");
  assert.equal(equipTitle(EQUIP_ITEMS, ""), "");
  assert.equal(equipTitle(EQUIP_ITEMS, "999"), "");
});
