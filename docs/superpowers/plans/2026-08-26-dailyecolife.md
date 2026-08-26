# 毎日エコライフ Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 毎日のエコ活動アクションを一覧表示し、実行を記録してポイントを貯めるVue 3(CDN)製の静的Webアプリを実装する。

**Architecture:** ビルドツールなしの静的サイト。ロジック層(`js/*.js`、ES Modules、Node `node:test`でTDD)とUI層(`index.html`/`app.js`/`style.css`、ブラウザ手動確認)を分離する。すべての永続化はブラウザ`localStorage`。ロジック層の関数はstorageオブジェクトを引数で受け取るDI形式にし、Node環境でモックstorageを使ってテストできるようにする。

**Tech Stack:** Vue 3(CDN, `unpkg.com/vue@3/dist/vue.global.js`)、ES Modules、Node.js組み込み`node:test` + `node:assert/strict`(追加パッケージ不要)。

**Spec:** `/home/suzuki/www/dev/dailyecolife/docs/superpowers/specs/2026-08-26-dailyecolife-design.md`

## Global Constraints

- 記録フォーマットは14桁固定の0/1文字列(spec「日次記録」節)。桁位置は`recordIndex`(0〜13)。
- アクション定義は表示順(`order`)と記録順(`recordIndex`)を分離して管理する(`data/actions.js`)。
- エコ診断・検針票の回答データは本アプリの`localStorage`にのみ保存し、外部へ書き戻さない。
- 中古品購入・修理修繕(`external`タイプ)はmyecoliferecordsへの別タブリンク＋自己申告ボタンのみ(自動連携は行わない)。
- クイズ・エコ診断は日付キーでキャッシュし、同日中は同じ問題/項目を再取得しない。
- 検針票の加点は「消費量・料金ともに最低1項目ずつ入力済み」になった月内最初の保存操作でのみ発生させる(月内で複数回は加点しない)。
- ビルドツールは使わない。すべてブラウザでそのまま動作するES Modulesで書く。
- Vue CDN読み込みはバージョン固定+SRI(`integrity`/`crossorigin`)を付与する(CDN改ざん対策)。

---

## Task 1: プロジェクト基盤構築

**Files:**
- Create: `/home/suzuki/www/dev/dailyecolife/.gitignore`
- Create: `/home/suzuki/www/dev/dailyecolife/data/` (ディレクトリ)
- Create: `/home/suzuki/www/dev/dailyecolife/js/` (ディレクトリ)
- Create: `/home/suzuki/www/dev/dailyecolife/test/` (ディレクトリ)

**Interfaces:**
- Produces: gitリポジトリ、以降のタスクが使うディレクトリ構成

- [ ] **Step 1: gitリポジトリを初期化する**

```bash
cd /home/suzuki/www/dev/dailyecolife
git init
```

- [ ] **Step 2: .gitignoreを作成する**

```
.DS_Store
*.log
```

- [ ] **Step 3: ディレクトリを作成する**

```bash
mkdir -p /home/suzuki/www/dev/dailyecolife/data
mkdir -p /home/suzuki/www/dev/dailyecolife/js
mkdir -p /home/suzuki/www/dev/dailyecolife/test
```

- [ ] **Step 4: 初期コミット**

```bash
cd /home/suzuki/www/dev/dailyecolife
git add .gitignore 開発 docs
git commit -m "chore: プロジェクト基盤とディレクトリ構成を作成"
```

---

## Task 2: アクション定義ファイル (data/actions.js)

**Files:**
- Create: `/home/suzuki/www/dev/dailyecolife/data/actions.js`
- Test: `/home/suzuki/www/dev/dailyecolife/test/actions.test.js`

**Interfaces:**
- Produces: `export const ACTIONS` — 配列。各要素は `{ id: string, recordIndex: number, order: number, category: string, label: string, type: "simple"|"quiz"|"external"|"eco-diagnosis"|"meter-reading", url?: string }`

- [ ] **Step 1: 失敗するテストを書く**

`/home/suzuki/www/dev/dailyecolife/test/actions.test.js`:

```js
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
```

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `node --test test/actions.test.js`
Expected: FAIL(`data/actions.js`が存在せずimportエラー)

- [ ] **Step 3: 実装する**

`/home/suzuki/www/dev/dailyecolife/data/actions.js`:

```js
export const ACTIONS = [
  { id: "quiz", recordIndex: 0, order: 1, category: "情報", label: "環境クイズ", type: "quiz" },
  { id: "packaging", recordIndex: 1, order: 2, category: "ごみ・資源", label: "包装少ない購入", type: "simple" },
  { id: "foodloss", recordIndex: 2, order: 3, category: "ごみ・資源", label: "食品ロスゼロ", type: "simple" },
  { id: "recycle", recordIndex: 3, order: 4, category: "ごみ・資源", label: "紙・プラ全量リサイクル", type: "simple" },
  { id: "energysave", recordIndex: 4, order: 5, category: "省エネ", label: "省エネの工夫", type: "simple" },
  { id: "lesscar", recordIndex: 5, order: 6, category: "省エネ", label: "車の使用を減らした", type: "simple" },
  { id: "news", recordIndex: 6, order: 7, category: "情報", label: "環境ニュースで情報収集", type: "simple" },
  { id: "talk", recordIndex: 7, order: 8, category: "情報", label: "環境の話をした", type: "simple" },
  { id: "secondhand", recordIndex: 8, order: 9, category: "過去のこと", label: "中古品購入", type: "external", url: "https://hinodeyasuzuki.github.io/myecoliferecords/" },
  { id: "repair", recordIndex: 9, order: 10, category: "過去のこと", label: "修理修繕・リペア", type: "external", url: "https://hinodeyasuzuki.github.io/myecoliferecords/" },
  { id: "ecocheck", recordIndex: 10, order: 11, category: "自分の暮らし", label: "エコ診断", type: "eco-diagnosis" },
  { id: "meterread", recordIndex: 11, order: 12, category: "自分の暮らし", label: "検針票記録", type: "meter-reading" },
];
```

- [ ] **Step 4: テストを実行し成功を確認する**

Run: `node --test test/actions.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: コミット**

```bash
git add data/actions.js test/actions.test.js
git commit -m "feat: アクション定義ファイルを追加"
```

---

## Task 3: storage.js 汎用ユーティリティ

**Files:**
- Create: `/home/suzuki/www/dev/dailyecolife/js/storage.js`
- Test: `/home/suzuki/www/dev/dailyecolife/test/storage.test.js`

**Interfaces:**
- Consumes: なし(独立モジュール)
- Produces:
  - `loadJSON(store, key, fallback)` — `store`は`{getItem(key): string|null, setItem(key, value): void}`を満たすオブジェクト(ブラウザの`localStorage`または後続タスクのモック)。`key`のJSONをパースして返す。存在しない/パース失敗時は`fallback`を返す。
  - `saveJSON(store, key, value)` — `value`をJSON文字列化して`store.setItem`する。

- [ ] **Step 1: 失敗するテストを書く**

`/home/suzuki/www/dev/dailyecolife/test/storage.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { loadJSON, saveJSON } from "../js/storage.js";

function createMockStore() {
  const data = new Map();
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, value),
  };
}

test("loadJSON: 未設定キーはfallbackを返す", () => {
  const store = createMockStore();
  assert.deepEqual(loadJSON(store, "missing", { foo: 1 }), { foo: 1 });
});

test("saveJSON→loadJSONで値が往復する", () => {
  const store = createMockStore();
  saveJSON(store, "key1", { a: 1, b: [1, 2] });
  assert.deepEqual(loadJSON(store, "key1", null), { a: 1, b: [1, 2] });
});

test("loadJSON: 壊れたJSONはfallbackにフォールバックする", () => {
  const store = createMockStore();
  store.setItem("broken", "{not valid json");
  assert.deepEqual(loadJSON(store, "broken", {}), {});
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `node --test test/storage.test.js`
Expected: FAIL(`js/storage.js`が存在せずimportエラー)

- [ ] **Step 3: 実装する**

`/home/suzuki/www/dev/dailyecolife/js/storage.js`:

```js
export function loadJSON(store, key, fallback) {
  const raw = store.getItem(key);
  if (raw === null || raw === undefined) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export function saveJSON(store, key, value) {
  store.setItem(key, JSON.stringify(value));
}
```

- [ ] **Step 4: テストを実行し成功を確認する**

Run: `node --test test/storage.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: コミット**

```bash
git add js/storage.js test/storage.test.js
git commit -m "feat: localStorage用のJSON読み書きユーティリティを追加"
```

---

## Task 4: records.js 日次記録・ポイント集計ロジック

**Files:**
- Create: `/home/suzuki/www/dev/dailyecolife/js/records.js`
- Test: `/home/suzuki/www/dev/dailyecolife/test/records.test.js`

**Interfaces:**
- Consumes: `loadJSON`, `saveJSON` from `../js/storage.js`
- Produces:
  - `RECORDS_KEY = "dailyecolife_records"` (定数export)
  - `RECORD_LENGTH = 14` (定数export)
  - `getDayRecord(store, dateKey)` → 14桁文字列。未設定日は`"00000000000000"`。
  - `isActionRecorded(store, dateKey, recordIndex)` → boolean
  - `setActionRecorded(store, dateKey, recordIndex)` → void。該当日の該当桁を`"1"`に更新して保存。
  - `isActionRecordedInMonth(store, monthKey, recordIndex)` → boolean。`monthKey`は`"YYYYMM"`。その月のいずれかの日で該当桁が`"1"`ならtrue。
  - `countPointsForDay(store, dateKey)` → number。14桁中`"1"`の数。
  - `countPointsForRange(store, startDateKey, endDateKey)` → number。`YYYYMMDD`昇順比較で範囲内(両端含む)の日の合計ポイント。

- [ ] **Step 1: 失敗するテストを書く**

`/home/suzuki/www/dev/dailyecolife/test/records.test.js`:

```js
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
```

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `node --test test/records.test.js`
Expected: FAIL(`js/records.js`が存在せずimportエラー)

- [ ] **Step 3: 実装する**

`/home/suzuki/www/dev/dailyecolife/js/records.js`:

```js
import { loadJSON, saveJSON } from "./storage.js";

export const RECORDS_KEY = "dailyecolife_records";
export const RECORD_LENGTH = 14;
const EMPTY_RECORD = "0".repeat(RECORD_LENGTH);

function loadAllRecords(store) {
  return loadJSON(store, RECORDS_KEY, {});
}

export function getDayRecord(store, dateKey) {
  const all = loadAllRecords(store);
  return all[dateKey] ?? EMPTY_RECORD;
}

export function isActionRecorded(store, dateKey, recordIndex) {
  return getDayRecord(store, dateKey)[recordIndex] === "1";
}

export function setActionRecorded(store, dateKey, recordIndex) {
  const all = loadAllRecords(store);
  const current = all[dateKey] ?? EMPTY_RECORD;
  const chars = current.split("");
  chars[recordIndex] = "1";
  all[dateKey] = chars.join("");
  saveJSON(store, RECORDS_KEY, all);
}

export function isActionRecordedInMonth(store, monthKey, recordIndex) {
  const all = loadAllRecords(store);
  for (const dateKey of Object.keys(all)) {
    if (dateKey.startsWith(monthKey) && all[dateKey][recordIndex] === "1") {
      return true;
    }
  }
  return false;
}

export function countPointsForDay(store, dateKey) {
  const record = getDayRecord(store, dateKey);
  return record.split("").filter((c) => c === "1").length;
}

export function countPointsForRange(store, startDateKey, endDateKey) {
  const all = loadAllRecords(store);
  let total = 0;
  for (const [dateKey, record] of Object.entries(all)) {
    if (dateKey >= startDateKey && dateKey <= endDateKey) {
      total += record.split("").filter((c) => c === "1").length;
    }
  }
  return total;
}
```

- [ ] **Step 4: テストを実行し成功を確認する**

Run: `node --test test/records.test.js`
Expected: PASS (6 tests)

- [ ] **Step 5: コミット**

```bash
git add js/records.js test/records.test.js
git commit -m "feat: 日次記録の読み書きとポイント集計ロジックを追加"
```

---

## Task 5: quiz.js クイズ取得・キャッシュ・回答ロジック

**Files:**
- Create: `/home/suzuki/www/dev/dailyecolife/js/quiz.js`
- Test: `/home/suzuki/www/dev/dailyecolife/test/quiz.test.js`

**Interfaces:**
- Consumes: `loadJSON`, `saveJSON` from `../js/storage.js`
- Produces:
  - `QUIZ_KEY = "dailyecolife_quiz"` (定数export)
  - `QUIZ_API_URL = "https://s8.hinodeya-ecolife.com/quizapi/"` (定数export)
  - `async getTodayQuiz(store, dateKey, fetchFn)` → `{ question: object, answeredOption: number|null, correct: boolean|null }`。既存キャッシュがあればそれを返す。なければ`fetchFn(QUIZ_API_URL)`(戻り値は`Response`互換、`.json()`を持つ)を呼びクイズ本文を取得・キャッシュして返す(`answeredOption`/`correct`は`null`)。
  - `answerQuiz(store, dateKey, optionIndex)` → `{ correct: boolean }`。キャッシュ済みクイズに対して回答を記録し正誤判定する。既に回答済みなら何もせず現在の状態を返す(再回答不可)。

- [ ] **Step 1: 失敗するテストを書く**

`/home/suzuki/www/dev/dailyecolife/test/quiz.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { getTodayQuiz, answerQuiz, QUIZ_API_URL } from "../js/quiz.js";

function createMockStore(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, value),
  };
}

const sampleQuestion = {
  id: 176,
  category: "desertification",
  question: "砂漠化を防ぐ条約は？",
  option1: "ラムサール条約",
  option2: "国連砂漠化対処条約",
  option3: "モントリオール議定書",
  option4: "京都議定書",
  answer: 2,
  explanation: "説明文",
};

test("getTodayQuiz: 未キャッシュ時はfetchFnを呼びキャッシュする", async () => {
  const store = createMockStore();
  let calledUrl = null;
  const fetchFn = async (url) => {
    calledUrl = url;
    return { json: async () => sampleQuestion };
  };
  const result = await getTodayQuiz(store, "20260826", fetchFn);
  assert.equal(calledUrl, QUIZ_API_URL);
  assert.deepEqual(result.question, sampleQuestion);
  assert.equal(result.answeredOption, null);
  assert.equal(result.correct, null);
});

test("getTodayQuiz: キャッシュ済みならfetchFnを呼ばない", async () => {
  const store = createMockStore();
  const fetchFn = async () => {
    throw new Error("呼ばれてはいけない");
  };
  await new Promise((resolve) => {
    const seedFetch = async () => ({ json: async () => sampleQuestion });
    getTodayQuiz(store, "20260826", seedFetch).then(resolve);
  });
  const result = await getTodayQuiz(store, "20260826", fetchFn);
  assert.deepEqual(result.question, sampleQuestion);
});

test("answerQuiz: 正解を選ぶとcorrect=trueで記録される", async () => {
  const store = createMockStore();
  const fetchFn = async () => ({ json: async () => sampleQuestion });
  await getTodayQuiz(store, "20260826", fetchFn);
  const result = answerQuiz(store, "20260826", 2);
  assert.equal(result.correct, true);
  const after = await getTodayQuiz(store, "20260826", fetchFn);
  assert.equal(after.answeredOption, 2);
  assert.equal(after.correct, true);
});

test("answerQuiz: 不正解を選ぶとcorrect=falseで記録される", async () => {
  const store = createMockStore();
  const fetchFn = async () => ({ json: async () => sampleQuestion });
  await getTodayQuiz(store, "20260826", fetchFn);
  const result = answerQuiz(store, "20260826", 1);
  assert.equal(result.correct, false);
});

test("answerQuiz: 回答済みの場合は再回答できず元の結果を返す", async () => {
  const store = createMockStore();
  const fetchFn = async () => ({ json: async () => sampleQuestion });
  await getTodayQuiz(store, "20260826", fetchFn);
  answerQuiz(store, "20260826", 2);
  const second = answerQuiz(store, "20260826", 1);
  assert.equal(second.correct, true);
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `node --test test/quiz.test.js`
Expected: FAIL(`js/quiz.js`が存在せずimportエラー)

- [ ] **Step 3: 実装する**

`/home/suzuki/www/dev/dailyecolife/js/quiz.js`:

```js
import { loadJSON, saveJSON } from "./storage.js";

export const QUIZ_KEY = "dailyecolife_quiz";
export const QUIZ_API_URL = "https://s8.hinodeya-ecolife.com/quizapi/";

function loadAllQuiz(store) {
  return loadJSON(store, QUIZ_KEY, {});
}

export async function getTodayQuiz(store, dateKey, fetchFn) {
  const all = loadAllQuiz(store);
  if (all[dateKey]) {
    return all[dateKey];
  }
  const response = await fetchFn(QUIZ_API_URL);
  const question = await response.json();
  const entry = { question, answeredOption: null, correct: null };
  all[dateKey] = entry;
  saveJSON(store, QUIZ_KEY, all);
  return entry;
}

export function answerQuiz(store, dateKey, optionIndex) {
  const all = loadAllQuiz(store);
  const entry = all[dateKey];
  if (entry.answeredOption !== null) {
    return { correct: entry.correct };
  }
  const correct = entry.question.answer === optionIndex;
  entry.answeredOption = optionIndex;
  entry.correct = correct;
  saveJSON(store, QUIZ_KEY, all);
  return { correct };
}
```

- [ ] **Step 4: テストを実行し成功を確認する**

Run: `node --test test/quiz.test.js`
Expected: PASS (5 tests)

- [ ] **Step 5: コミット**

```bash
git add js/quiz.js test/quiz.test.js
git commit -m "feat: クイズの日次キャッシュ・回答ロジックを追加"
```

---

## Task 6: ecodiagnosis.js エコ診断ロジック

**Files:**
- Create: `/home/suzuki/www/dev/dailyecolife/js/ecodiagnosis.js`
- Test: `/home/suzuki/www/dev/dailyecolife/test/ecodiagnosis.test.js`

**Interfaces:**
- Consumes: `loadJSON`, `saveJSON` from `../js/storage.js`
- Produces:
  - `ECODIAGNOSIS_KEY = "dailyecolife_ecodiagnosis"` (定数export)
  - `getTodayDiagnosisItem(store, dateKey, allItems, randomFn = Math.random)` → `{ item: object, answerVal: number|null }`。`allItems`はinput.json形式の配列(各要素`{id, ...}`)。既存キャッシュがあればそのidに対応する`item`を`allItems`から引いて返す。なければ`randomFn()`を使って`allItems`から1件選びキャッシュする(`answerVal`は`null`)。
  - `answerDiagnosis(store, dateKey, answerVal)` → void。キャッシュ済みエントリに回答値を保存する(未回答時のみ上書き可能、回答済みなら何もしない)。

- [ ] **Step 1: 失敗するテストを書く**

`/home/suzuki/www/dev/dailyecolife/test/ecodiagnosis.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { getTodayDiagnosisItem, answerDiagnosis } from "../js/ecodiagnosis.js";

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
});

test("answerDiagnosis: 回答済みなら上書きしない", () => {
  const store = createMockStore();
  getTodayDiagnosisItem(store, "20260826", items, () => 0.5);
  answerDiagnosis(store, "20260826", 2);
  answerDiagnosis(store, "20260826", 3);
  const result = getTodayDiagnosisItem(store, "20260826", items, () => 0.5);
  assert.equal(result.answerVal, 2);
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `node --test test/ecodiagnosis.test.js`
Expected: FAIL(`js/ecodiagnosis.js`が存在せずimportエラー)

- [ ] **Step 3: 実装する**

`/home/suzuki/www/dev/dailyecolife/js/ecodiagnosis.js`:

```js
import { loadJSON, saveJSON } from "./storage.js";

export const ECODIAGNOSIS_KEY = "dailyecolife_ecodiagnosis";

function loadAll(store) {
  return loadJSON(store, ECODIAGNOSIS_KEY, {});
}

export function getTodayDiagnosisItem(store, dateKey, allItems, randomFn = Math.random) {
  const all = loadAll(store);
  let entry = all[dateKey];
  if (!entry) {
    const index = Math.floor(randomFn() * allItems.length);
    entry = { itemId: allItems[index].id, answerVal: null };
    all[dateKey] = entry;
    saveJSON(store, ECODIAGNOSIS_KEY, all);
  }
  const item = allItems.find((i) => i.id === entry.itemId);
  return { item, answerVal: entry.answerVal };
}

export function answerDiagnosis(store, dateKey, answerVal) {
  const all = loadAll(store);
  const entry = all[dateKey];
  if (!entry || entry.answerVal !== null) return;
  entry.answerVal = answerVal;
  saveJSON(store, ECODIAGNOSIS_KEY, all);
}
```

- [ ] **Step 4: テストを実行し成功を確認する**

Run: `node --test test/ecodiagnosis.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: コミット**

```bash
git add js/ecodiagnosis.js test/ecodiagnosis.test.js
git commit -m "feat: エコ診断の日次キャッシュ・回答ロジックを追加"
```

---

## Task 7: meterreading.js 検針票記録ロジック

**Files:**
- Create: `/home/suzuki/www/dev/dailyecolife/js/meterreading.js`
- Test: `/home/suzuki/www/dev/dailyecolife/test/meterreading.test.js`

**Interfaces:**
- Consumes: `loadJSON`, `saveJSON` from `../js/storage.js`
- Produces:
  - `METERREADING_KEY = "dailyecolife_meterreading"` (定数export)
  - `getMonthReading(store, monthKey)` → `object`(コード→数値のマップ、未設定なら`{}`)
  - `saveMonthReading(store, monthKey, values, energyCodes, energyCostCodes)` → `{ completed: boolean }`。`values`は`{code: number}`のマップ。既存の値とマージして保存する。`energyCodes`/`energyCostCodes`はそれぞれのコード文字列配列(`energy.json`/`energycost.json`の`code`フィールド一覧)。マージ後、`energyCodes`のうち最低1つ、`energyCostCodes`のうち最低1つが数値として存在すれば`completed: true`。

- [ ] **Step 1: 失敗するテストを書く**

`/home/suzuki/www/dev/dailyecolife/test/meterreading.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import { getMonthReading, saveMonthReading } from "../js/meterreading.js";

function createMockStore(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, value),
  };
}

const energyCodes = ["elect", "nagas", "water"];
const energyCostCodes = ["electp", "nagasp"];

test("getMonthReading: 未設定月は空オブジェクト", () => {
  const store = createMockStore();
  assert.deepEqual(getMonthReading(store, "202608"), {});
});

test("saveMonthReading: 消費量のみだとcompleted=false", () => {
  const store = createMockStore();
  const result = saveMonthReading(store, "202608", { elect: 120 }, energyCodes, energyCostCodes);
  assert.equal(result.completed, false);
});

test("saveMonthReading: 消費量・料金が両方揃うとcompleted=true", () => {
  const store = createMockStore();
  saveMonthReading(store, "202608", { elect: 120 }, energyCodes, energyCostCodes);
  const result = saveMonthReading(store, "202608", { electp: 3500 }, energyCodes, energyCostCodes);
  assert.equal(result.completed, true);
  assert.deepEqual(getMonthReading(store, "202608"), { elect: 120, electp: 3500 });
});

test("saveMonthReadingは既存値を上書きせずマージする", () => {
  const store = createMockStore();
  saveMonthReading(store, "202608", { elect: 120, nagas: 30 }, energyCodes, energyCostCodes);
  saveMonthReading(store, "202608", { water: 5 }, energyCodes, energyCostCodes);
  assert.deepEqual(getMonthReading(store, "202608"), { elect: 120, nagas: 30, water: 5 });
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `node --test test/meterreading.test.js`
Expected: FAIL(`js/meterreading.js`が存在せずimportエラー)

- [ ] **Step 3: 実装する**

`/home/suzuki/www/dev/dailyecolife/js/meterreading.js`:

```js
import { loadJSON, saveJSON } from "./storage.js";

export const METERREADING_KEY = "dailyecolife_meterreading";

function loadAll(store) {
  return loadJSON(store, METERREADING_KEY, {});
}

export function getMonthReading(store, monthKey) {
  const all = loadAll(store);
  return all[monthKey] ?? {};
}

export function saveMonthReading(store, monthKey, values, energyCodes, energyCostCodes) {
  const all = loadAll(store);
  const merged = { ...(all[monthKey] ?? {}), ...values };
  all[monthKey] = merged;
  saveJSON(store, METERREADING_KEY, all);

  const hasEnergy = energyCodes.some((code) => typeof merged[code] === "number");
  const hasCost = energyCostCodes.some((code) => typeof merged[code] === "number");
  return { completed: hasEnergy && hasCost };
}
```

- [ ] **Step 4: テストを実行し成功を確認する**

Run: `node --test test/meterreading.test.js`
Expected: PASS (4 tests)

- [ ] **Step 5: コミット**

```bash
git add js/meterreading.js test/meterreading.test.js
git commit -m "feat: 検針票記録の保存・完了判定ロジックを追加"
```

---

## Task 8: api.js 外部データ取得ラッパー

**Files:**
- Create: `/home/suzuki/www/dev/dailyecolife/js/api.js`
- Test: `/home/suzuki/www/dev/dailyecolife/test/api.test.js`

**Interfaces:**
- Consumes: なし
- Produces:
  - `INPUT_JSON_URL`, `ENERGY_JSON_URL`, `ENERGYCOST_JSON_URL` (定数export、`https://hinodeyasuzuki.github.io/homeenergycodes-public/api/v1/` 配下)
  - `async fetchInputItems(fetchFn)` → input.jsonの配列をパースして返す
  - `async fetchEnergyCodes(fetchFn)` → energy.jsonの配列をパースして返す
  - `async fetchEnergyCostCodes(fetchFn)` → energycost.jsonの配列をパースして返す

- [ ] **Step 1: 失敗するテストを書く**

`/home/suzuki/www/dev/dailyecolife/test/api.test.js`:

```js
import { test } from "node:test";
import assert from "node:assert/strict";
import {
  fetchInputItems,
  fetchEnergyCodes,
  fetchEnergyCostCodes,
  INPUT_JSON_URL,
  ENERGY_JSON_URL,
  ENERGYCOST_JSON_URL,
} from "../js/api.js";

function makeFetchFn(map) {
  return async (url) => ({ json: async () => map[url] });
}

test("fetchInputItems: INPUT_JSON_URLをfetchしパースして返す", async () => {
  const fetchFn = makeFetchFn({ [INPUT_JSON_URL]: [{ id: "i010" }] });
  const result = await fetchInputItems(fetchFn);
  assert.deepEqual(result, [{ id: "i010" }]);
});

test("fetchEnergyCodes: ENERGY_JSON_URLをfetchしパースして返す", async () => {
  const fetchFn = makeFetchFn({ [ENERGY_JSON_URL]: [{ code: "elect", name: "購入電力", unit: "kWh" }] });
  const result = await fetchEnergyCodes(fetchFn);
  assert.deepEqual(result, [{ code: "elect", name: "購入電力", unit: "kWh" }]);
});

test("fetchEnergyCostCodes: ENERGYCOST_JSON_URLをfetchしパースして返す", async () => {
  const fetchFn = makeFetchFn({ [ENERGYCOST_JSON_URL]: [{ code: "electp", name: "購入電力料金" }] });
  const result = await fetchEnergyCostCodes(fetchFn);
  assert.deepEqual(result, [{ code: "electp", name: "購入電力料金" }]);
});
```

- [ ] **Step 2: テストを実行し失敗を確認する**

Run: `node --test test/api.test.js`
Expected: FAIL(`js/api.js`が存在せずimportエラー)

- [ ] **Step 3: 実装する**

`/home/suzuki/www/dev/dailyecolife/js/api.js`:

```js
const BASE_URL = "https://hinodeyasuzuki.github.io/homeenergycodes-public/api/v1/";

export const INPUT_JSON_URL = `${BASE_URL}input.json`;
export const ENERGY_JSON_URL = `${BASE_URL}energy.json`;
export const ENERGYCOST_JSON_URL = `${BASE_URL}energycost.json`;

export async function fetchInputItems(fetchFn) {
  const response = await fetchFn(INPUT_JSON_URL);
  return response.json();
}

export async function fetchEnergyCodes(fetchFn) {
  const response = await fetchFn(ENERGY_JSON_URL);
  return response.json();
}

export async function fetchEnergyCostCodes(fetchFn) {
  const response = await fetchFn(ENERGYCOST_JSON_URL);
  return response.json();
}
```

- [ ] **Step 4: テストを実行し成功を確認する**

Run: `node --test test/api.test.js`
Expected: PASS (3 tests)

- [ ] **Step 5: コミット**

```bash
git add js/api.js test/api.test.js
git commit -m "feat: 外部データ取得ラッパーを追加"
```

---

## Task 9: 全ロジック層のテストを一括実行して確認

**Files:**
- なし(既存ファイルの確認のみ)

**Interfaces:**
- Consumes: Task 2〜8で作成した全テストファイル
- Produces: なし

- [ ] **Step 1: 全テストを実行する**

Run: `node --test test/`
Expected: PASS(全25テスト: actions 5 + storage 3 + records 6 + quiz 5 + ecodiagnosis 4 + meterreading 4 + api 3 = 30。数が一致することを確認する)

- [ ] **Step 2: 失敗があれば該当タスクに戻って修正する**

失敗したテストがあれば、対応するTask N(2〜8)のStep 3実装を見直して修正し、再度`node --test test/`を実行する。

---

## Task 10: style.css 共通スタイル

**Files:**
- Create: `/home/suzuki/www/dev/dailyecolife/style.css`

**Interfaces:**
- Consumes: なし
- Produces: `index.html`から`<link>`で読み込まれるスタイルシート。使用するクラス名: `.app-header`, `.point-summary`, `.tabs`, `.tab-button`, `.category-section`, `.action-card`, `.action-card.done`, `.action-card-title`, `.action-card-body`, `.btn`, `.btn-primary`, `.form-field`, `.history-calendar`, `.history-day`, `.history-day.has-point`

- [ ] **Step 1: スタイルシートを作成する**

`/home/suzuki/www/dev/dailyecolife/style.css`:

```css
:root {
  color-scheme: light dark;
  --bg: #ffffff;
  --fg: #1a1d21;
  --muted: #5b6270;
  --card: #f6f7f9;
  --border: #e2e5ea;
  --accent: #1a6b4a;
  --done: #4fbf8e;
}

* {
  box-sizing: border-box;
}

body {
  margin: 0;
  background: var(--bg);
  color: var(--fg);
  font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "Hiragino Sans", "Yu Gothic", sans-serif;
  line-height: 1.6;
}

#app {
  max-width: 720px;
  margin: 0 auto;
  padding: 16px;
}

.app-header {
  padding: 12px 0;
  border-bottom: 1px solid var(--border);
  margin-bottom: 16px;
}

.point-summary {
  display: flex;
  gap: 16px;
  font-size: 0.95rem;
  color: var(--muted);
}

.tabs {
  display: flex;
  gap: 8px;
  margin-bottom: 16px;
}

.tab-button {
  padding: 8px 16px;
  border: 1px solid var(--border);
  background: var(--card);
  border-radius: 6px;
  cursor: pointer;
}

.tab-button.active {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}

.category-section {
  margin-bottom: 20px;
}

.category-section h2 {
  font-size: 1rem;
  color: var(--muted);
  margin-bottom: 8px;
}

.action-card {
  border: 1px solid var(--border);
  background: var(--card);
  border-radius: 8px;
  padding: 12px 16px;
  margin-bottom: 8px;
}

.action-card.done {
  border-color: var(--done);
}

.action-card-title {
  font-weight: bold;
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.action-card-body {
  margin-top: 8px;
}

.btn {
  padding: 8px 14px;
  border-radius: 6px;
  border: 1px solid var(--border);
  background: #fff;
  cursor: pointer;
}

.btn-primary {
  background: var(--accent);
  color: #fff;
  border-color: var(--accent);
}

.form-field {
  margin-bottom: 12px;
}

.form-field label {
  display: block;
  margin-bottom: 4px;
  font-size: 0.9rem;
  color: var(--muted);
}

.history-calendar {
  display: grid;
  grid-template-columns: repeat(7, 1fr);
  gap: 4px;
}

.history-day {
  border: 1px solid var(--border);
  border-radius: 4px;
  padding: 6px 4px;
  text-align: center;
  font-size: 0.8rem;
}

.history-day.has-point {
  background: var(--done);
  color: #fff;
}
```

- [ ] **Step 2: コミット**

```bash
git add style.css
git commit -m "feat: 共通スタイルシートを追加"
```

---

## Task 11: app.js Vueアプリ本体(トップ画面・記入画面)

**Files:**
- Create: `/home/suzuki/www/dev/dailyecolife/app.js`

**Interfaces:**
- Consumes:
  - `ACTIONS` from `./data/actions.js`
  - `getDayRecord, isActionRecorded, setActionRecorded, isActionRecordedInMonth, countPointsForDay, countPointsForRange` from `./js/records.js`
  - `getTodayQuiz, answerQuiz` from `./js/quiz.js`
  - `getTodayDiagnosisItem, answerDiagnosis` from `./js/ecodiagnosis.js`
  - `getMonthReading, saveMonthReading` from `./js/meterreading.js`
  - `fetchInputItems, fetchEnergyCodes, fetchEnergyCostCodes` from `./js/api.js`
  - グローバル`Vue`(CDN経由、`index.html`で先に読み込み済み)
- Produces: `window`にマウントされるVueアプリ(`createApp(...).mount("#app")`)。`index.html`の`<script type="module" src="./app.js"></script>`から読み込まれる。

- [ ] **Step 1: 日付ユーティリティとVueアプリの土台を実装する**

`/home/suzuki/www/dev/dailyecolife/app.js`:

```js
import { ACTIONS } from "./data/actions.js";
import {
  getDayRecord,
  isActionRecorded,
  setActionRecorded,
  isActionRecordedInMonth,
  countPointsForRange,
} from "./js/records.js";
import { getTodayQuiz, answerQuiz } from "./js/quiz.js";
import { getTodayDiagnosisItem, answerDiagnosis } from "./js/ecodiagnosis.js";
import { getMonthReading, saveMonthReading } from "./js/meterreading.js";
import { fetchInputItems, fetchEnergyCodes, fetchEnergyCostCodes } from "./js/api.js";

const { createApp, ref, reactive, computed, onMounted } = Vue;

function todayDateKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function todayMonthKey() {
  return todayDateKey().slice(0, 6);
}

function dateKeyDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

const categories = [...new Set(ACTIONS.map((a) => a.category))];

const app = createApp({
  setup() {
    const store = window.localStorage;
    const todayKey = todayDateKey();
    const monthKey = todayMonthKey();
    const currentTab = ref("top");
    const openActionId = ref(null);

    const quiz = ref(null);
    const diagnosisItem = ref(null);
    const inputItems = ref([]);
    const energyCodes = ref([]);
    const energyCostCodes = ref([]);
    const meterValues = reactive({});

    const totalPoints = computed(() =>
      countPointsForRange(store, dateKeyDaysAgo(60), todayKey)
    );

    function isDone(action) {
      if (action.type === "meter-reading") {
        return isActionRecordedInMonth(store, monthKey, action.recordIndex);
      }
      return isActionRecorded(store, todayKey, action.recordIndex);
    }

    function actionsByCategory(category) {
      return ACTIONS.filter((a) => a.category === category).sort((a, b) => a.order - b.order);
    }

    function markSimpleDone(action) {
      if (isDone(action)) return;
      setActionRecorded(store, todayKey, action.recordIndex);
    }

    function markExternalDone(action) {
      if (isDone(action)) return;
      setActionRecorded(store, todayKey, action.recordIndex);
    }

    async function openQuiz(action) {
      openActionId.value = action.id;
      quiz.value = await getTodayQuiz(store, todayKey, (url) => fetch(url));
    }

    function submitQuizAnswer(action, optionIndex) {
      const result = answerQuiz(store, todayKey, optionIndex);
      quiz.value = { ...quiz.value, answeredOption: optionIndex, correct: result.correct };
      if (result.correct) {
        setActionRecorded(store, todayKey, action.recordIndex);
      }
    }

    async function openEcoDiagnosis(action) {
      openActionId.value = action.id;
      if (inputItems.value.length === 0) {
        inputItems.value = await fetchInputItems((url) => fetch(url));
      }
      diagnosisItem.value = getTodayDiagnosisItem(store, todayKey, inputItems.value);
    }

    function submitDiagnosisAnswer(action, val) {
      answerDiagnosis(store, todayKey, val);
      diagnosisItem.value = { ...diagnosisItem.value, answerVal: val };
      setActionRecorded(store, todayKey, action.recordIndex);
    }

    async function openMeterReading(action) {
      openActionId.value = action.id;
      if (energyCodes.value.length === 0) {
        energyCodes.value = await fetchEnergyCodes((url) => fetch(url));
        energyCostCodes.value = await fetchEnergyCostCodes((url) => fetch(url));
      }
      const existing = getMonthReading(store, monthKey);
      Object.assign(meterValues, existing);
    }

    function submitMeterReading(action) {
      const codes = [...energyCodes.value.map((c) => c.code), ...energyCostCodes.value.map((c) => c.code)];
      const values = {};
      for (const code of codes) {
        if (meterValues[code] !== undefined && meterValues[code] !== "") {
          values[code] = Number(meterValues[code]);
        }
      }
      const result = saveMonthReading(
        store,
        monthKey,
        values,
        energyCodes.value.map((c) => c.code),
        energyCostCodes.value.map((c) => c.code)
      );
      if (result.completed && !isActionRecordedInMonth(store, monthKey, action.recordIndex)) {
        setActionRecorded(store, todayKey, action.recordIndex);
      }
    }

    function closeActionDetail() {
      openActionId.value = null;
    }

    return {
      currentTab,
      categories,
      actionsByCategory,
      isDone,
      openActionId,
      quiz,
      diagnosisItem,
      inputItems,
      energyCodes,
      energyCostCodes,
      meterValues,
      totalPoints,
      markSimpleDone,
      markExternalDone,
      openQuiz,
      submitQuizAnswer,
      openEcoDiagnosis,
      submitDiagnosisAnswer,
      openMeterReading,
      submitMeterReading,
      closeActionDetail,
    };
  },
  template: `
    <div>
      <header class="app-header">
        <h1>毎日エコライフ</h1>
        <div class="point-summary">直近2ヶ月のポイント: {{ totalPoints }}</div>
      </header>
      <nav class="tabs">
        <button class="tab-button" :class="{active: currentTab === 'top'}" @click="currentTab = 'top'">トップ</button>
        <button class="tab-button" :class="{active: currentTab === 'history'}" @click="currentTab = 'history'">履歴</button>
      </nav>

      <section v-if="currentTab === 'top'">
        <div v-for="category in categories" :key="category" class="category-section">
          <h2>{{ category }}</h2>
          <div v-for="action in actionsByCategory(category)" :key="action.id"
               class="action-card" :class="{done: isDone(action)}">
            <div class="action-card-title">
              <span>{{ action.label }}</span>
              <span v-if="isDone(action)">✅</span>
            </div>
            <div class="action-card-body">
              <button v-if="action.type === 'simple' && !isDone(action)" class="btn btn-primary" @click="markSimpleDone(action)">できた</button>

              <template v-if="action.type === 'quiz'">
                <button v-if="openActionId !== action.id" class="btn" @click="openQuiz(action)">クイズを見る</button>
                <div v-else-if="quiz">
                  <p>{{ quiz.question.question }}</p>
                  <div v-for="n in [1,2,3,4]" :key="n">
                    <button class="btn" :disabled="quiz.answeredOption !== null" @click="submitQuizAnswer(action, n)">
                      {{ quiz.question['option' + n] }}
                    </button>
                  </div>
                  <p v-if="quiz.answeredOption !== null">
                    {{ quiz.correct ? '正解！' : '不正解' }} - {{ quiz.question.explanation }}
                  </p>
                </div>
              </template>

              <template v-if="action.type === 'external'">
                <a :href="action.url" target="_blank" rel="noopener" class="btn">myecoliferecordsを開く</a>
                <button v-if="!isDone(action)" class="btn btn-primary" @click="markExternalDone(action)">今日記入した</button>
              </template>

              <template v-if="action.type === 'eco-diagnosis'">
                <button v-if="openActionId !== action.id" class="btn" @click="openEcoDiagnosis(action)">エコ診断を開く</button>
                <div v-else-if="diagnosisItem">
                  <p>{{ diagnosisItem.item.title }}</p>
                  <p>{{ diagnosisItem.item.text }}</p>
                  <div v-for="opt in diagnosisItem.item.options" :key="opt.val">
                    <button class="btn" :disabled="diagnosisItem.answerVal !== null" @click="submitDiagnosisAnswer(action, opt.val)">
                      {{ opt.disp }}
                    </button>
                  </div>
                </div>
              </template>

              <template v-if="action.type === 'meter-reading'">
                <button v-if="openActionId !== action.id" class="btn" @click="openMeterReading(action)">検針票を記録する</button>
                <div v-else>
                  <div class="form-field" v-for="c in energyCodes" :key="c.code">
                    <label>{{ c.name }}({{ c.unit }})</label>
                    <input type="number" v-model="meterValues[c.code]">
                  </div>
                  <div class="form-field" v-for="c in energyCostCodes" :key="c.code">
                    <label>{{ c.name }}</label>
                    <input type="number" v-model="meterValues[c.code]">
                  </div>
                  <button class="btn btn-primary" @click="submitMeterReading(action)">保存</button>
                </div>
              </template>
            </div>
          </div>
        </div>
      </section>

      <section v-if="currentTab === 'history'">
        <p>履歴画面は次のタスクで実装します。</p>
      </section>
    </div>
  `,
});

app.mount("#app");
```

- [ ] **Step 2: index.htmlを作成しブラウザで動作確認する(Task 12実施後に確認するため、ここではファイル保存のみ)**

このステップはTask 12でindex.html作成後にまとめて確認する。

- [ ] **Step 3: コミット**

```bash
git add app.js
git commit -m "feat: トップ画面・各記入UIを持つVueアプリ本体を追加"
```

---

## Task 12: index.html と履歴画面

**Files:**
- Create: `/home/suzuki/www/dev/dailyecolife/index.html`
- Modify: `/home/suzuki/www/dev/dailyecolife/app.js`(履歴タブの実装を追加)

**Interfaces:**
- Consumes: `app.js`, `style.css`
- Produces: ブラウザで開ける完成したアプリ

- [ ] **Step 1: index.htmlを作成する**

`/home/suzuki/www/dev/dailyecolife/index.html`:

```html
<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>毎日エコライフ</title>
<meta name="viewport" content="width=device-width, initial-scale=1">
<link rel="stylesheet" href="./style.css">
</head>
<body>
<div id="app"></div>
<script src="https://unpkg.com/vue@3.5.13/dist/vue.global.prod.js"
        integrity="sha384-W/1Fp/LgAYO/oTn9Gs+PbeWuMuq1eQCnUMPCeg8POmMYchhzxctjEqtbiCIxDOON"
        crossorigin="anonymous"></script>
<script type="module" src="./app.js"></script>
</body>
</html>
```

- [ ] **Step 2: app.jsに履歴タブの実装を追加する**

`app.js`の`setup()`内、`totalPoints`の`computed`定義の直後に追加:

```js
const historyDays = computed(() => {
  const days = [];
  for (let i = 59; i >= 0; i--) {
    const key = dateKeyDaysAgo(i);
    const record = getDayRecord(store, key);
    const points = record.split("").filter((c) => c === "1").length;
    days.push({ key, points, hasPoint: points > 0 });
  }
  return days;
});
```

`import`文に`getDayRecord`を追加:

```js
import {
  getDayRecord,
  isActionRecorded,
  setActionRecorded,
  isActionRecordedInMonth,
  countPointsForRange,
} from "./js/records.js";
```

`return`オブジェクトに`historyDays`を追加する。

テンプレートの履歴セクションを置き換える:

```html
<section v-if="currentTab === 'history'">
  <p>直近60日間の記録(色付き=ポイント獲得日)</p>
  <div class="history-calendar">
    <div v-for="d in historyDays" :key="d.key" class="history-day" :class="{'has-point': d.hasPoint}">
      {{ d.key.slice(4) }}<br>{{ d.points }}pt
    </div>
  </div>
</section>
```

- [ ] **Step 3: ブラウザで動作確認する**

```bash
cd /home/suzuki/www/dev/dailyecolife
python3 -m http.server 8765
```

ブラウザで `http://localhost:8765/` を開き、以下を確認する:
- トップ画面に5カテゴリのアクションカードが表示される
- 「できた」ボタンでsimpleアクションが完了マークになる
- クイズを開くと問題が表示され、回答すると正誤とその日は再回答不可であることが確認できる
- エコ診断を開くと1項目表示され回答できる
- 検針票フォームで値を入力し保存すると、消費量・料金両方入れた時点でカードが完了マークになる
- 中古品購入/修理修繕のリンクが別タブで開き、「今日記入した」で完了マークになる
- 履歴タブで直近60日のカレンダーが表示される
- ページをリロードしても記録が保持される(localStorage永続化)

確認後、`Ctrl+C`でサーバーを停止する。

- [ ] **Step 4: コミット**

```bash
git add index.html app.js
git commit -m "feat: index.htmlと履歴画面を追加し、アプリを完成させる"
```

---

## Self-Review Notes

- **Spec coverage:** データモデル(Task 2-7)、外部データ取得(Task 8)、画面構成(Task 10-12)、ポイント集計(Task 4, Task 11の`totalPoints`/`isDone`)、エラー処理の基本方針(fetch失敗時は未処理のままPromise rejectとなりconsoleエラーになる程度 — スコープ外と明記した簡易実装)を各タスクでカバーしている。
- **Placeholder scan:** 「TBD」等のプレースホルダーなし。全ステップに実コードを記載。
- **Type consistency:** `store`は全モジュールで`{getItem, setItem}`インターフェースに統一。`dateKey`は`YYYYMMDD`、`monthKey`は`YYYYMM`で全タスク一貫。`recordIndex`は`data/actions.js`定義値をTask 11で参照。
