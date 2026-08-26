# 毎日エコライフ 設計仕様

## 概要
毎日取り組めるエコ活動アクションを一覧表示し、実行したことを記録してポイントを貯めるWebアプリ。`開発/about.md`の要件を実装に落とし込む。

## 技術スタック
- Vue 3(CDN読み込み、ビルドツールなし)
- 素のCSS
- GitHub Pagesにそのまま配置できる静的サイト構成
- `myecoliferecords`(姉妹アプリ)と技術・見た目のトーンを揃える

## ファイル構成
```
index.html          エントリポイント、Vueアプリのマウント先
app.js               Vueアプリ本体(コンポーネント、状態管理、localStorage操作)
style.css            スタイル
data/actions.js      アクション定義ファイル(表示順・記録順・種別を管理)
```

## 外部データソース
| 用途 | URL | 備考 |
|---|---|---|
| 環境クイズ | `https://s8.hinodeya-ecolife.com/quizapi/` | コールごとにランダムな1問を返す。日付キーでキャッシュして固定化する |
| エコ診断項目マスタ | `https://hinodeyasuzuki.github.io/homeenergycodes-public/api/v1/input.json` | 179項目(2026-08-21時点)。読み取り専用 |
| 検針票コード表(消費量) | `https://hinodeyasuzuki.github.io/homeenergycodes-public/api/v1/energy.json` | 9項目。読み取り専用 |
| 検針票コード表(料金) | `https://hinodeyasuzuki.github.io/homeenergycodes-public/api/v1/energycost.json` | 8項目。読み取り専用 |
| 中古品購入・修理修繕の記入先 | `https://hinodeyasuzuki.github.io/myecoliferecords/` | 別オリジンのVueアプリ。localStorageは共有不可のため、別タブで開き自己申告で記録する |

homeenergycodes-public、myecoliferecordsともに読み取り専用の公開データ/別アプリであり、本アプリから書き戻すAPIは存在しない。エコ診断・検針票の回答は本アプリのlocalStorageにのみ保存する。

## データモデル

### 日次記録
キー: `dailyecolife_records`
```json
{"20260826": "10110100000100"}
```
- キーは`YYYYMMDD`
- 値は14桁固定の0/1文字列。桁位置は`data/actions.js`の`recordIndex`(0〜13)に対応
- 現在定義済みアクションは12個、`recordIndex`12・13は将来拡張用の予約枠(常に`0`)

### アクション定義ファイル (`data/actions.js`)
表示順(`order`)と記録順(`recordIndex`)を分離して管理する。

```js
export const ACTIONS = [
  { id: "quiz",       recordIndex: 0,  order: 1,  category: "情報",       label: "環境クイズ",             type: "quiz" },
  { id: "packaging",  recordIndex: 1,  order: 2,  category: "ごみ・資源", label: "包装少ない購入",         type: "simple" },
  { id: "foodloss",   recordIndex: 2,  order: 3,  category: "ごみ・資源", label: "食品ロスゼロ",           type: "simple" },
  { id: "recycle",    recordIndex: 3,  order: 4,  category: "ごみ・資源", label: "紙・プラ全量リサイクル", type: "simple" },
  { id: "energysave", recordIndex: 4,  order: 5,  category: "省エネ",     label: "省エネの工夫",           type: "simple" },
  { id: "lesscar",    recordIndex: 5,  order: 6,  category: "省エネ",     label: "車の使用を減らした",     type: "simple" },
  { id: "news",       recordIndex: 6,  order: 7,  category: "情報",       label: "環境ニュースで情報収集", type: "simple" },
  { id: "talk",       recordIndex: 7,  order: 8,  category: "情報",       label: "環境の話をした",         type: "simple" },
  { id: "secondhand", recordIndex: 8,  order: 9,  category: "過去のこと", label: "中古品購入",             type: "external", url: "https://hinodeyasuzuki.github.io/myecoliferecords/" },
  { id: "repair",     recordIndex: 9,  order: 10, category: "過去のこと", label: "修理修繕・リペア",       type: "external", url: "https://hinodeyasuzuki.github.io/myecoliferecords/" },
  { id: "ecocheck",   recordIndex: 10, order: 11, category: "自分の暮らし", label: "エコ診断",             type: "eco-diagnosis" },
  { id: "meterread",  recordIndex: 11, order: 12, category: "自分の暮らし", label: "検針票記録",           type: "meter-reading" },
];
```

`type`はカード上での記入UIの出し分けに使う:
- `simple`: ボタン1つで「できた」を記録
- `quiz`: クイズ表示・回答UI
- `external`: 外部リンク＋「今日記入した」自己申告ボタン
- `eco-diagnosis` / `meter-reading`: フォーム入力(記入画面へ遷移)

### 種別ごとの補助データ
記録内容そのもの(日次14桁とは別のlocalStorageキー)。

- クイズ: `dailyecolife_quiz`
  ```json
  {"20260826": {"question": {...}, "answeredOption": 2, "correct": true}}
  ```
  その日最初にAPIを叩いた結果を日付キーでキャッシュし、以後は同じ問題をキャッシュから表示する(APIはコール毎にランダムな問題を返すため)。回答済みの場合は正解・不正解を表示するのみで再回答は不可。

- エコ診断: `dailyecolife_ecodiagnosis`
  ```json
  {"20260826": {"itemId": "i010", "answerVal": 2}}
  ```
  日付ごとにinput.jsonから1件ランダム抽出しキャッシュ。未回答ならフォーム表示、回答済みなら結果表示のみ。

- 検針票: `dailyecolife_meterreading`
  ```json
  {"202608": {"elect": 120, "electp": 3500, ...}}
  ```
  月キー(`YYYYMM`)。energy.json由来の消費量コードとenergycost.json由来の料金コードをまとめて1フォームで入力・保存する。

## 画面構成

### トップ画面
- カテゴリ別(ごみ・資源／省エネ／情報／過去のこと／自分の暮らし)にアクションを`order`順でカード表示
- 各カードに今日実行済みかどうかのチェックマークを表示
- `simple` / `quiz` / `eco-diagnosis` はカード内で直接実行
- `external` / `meter-reading` は記入画面への遷移ボタンを表示
- 直近2ヶ月分の合計ポイントをヘッダーに表示

### 記入画面
- 中古品購入・修理修繕: 概要説明＋「myecoliferecordsを開く」外部リンク(別タブ)＋「今日記入した」自己申告ボタン
- エコ診断: 今日分のinput.json項目1件と選択肢を表示し回答を保存
- 検針票記録: 当月分のenergy.json(9項目)＋energycost.json(8項目)の入力フォーム、保存ボタン

### 履歴画面
- 日別の実行状況(14桁を可視化したカレンダーもしくは一覧)
- ポイント推移の表示

## ポイント集計ロジック
- 日次14桁のうち`1`が立っている桁数 = その日の合計ポイント
- `simple` / `quiz` / `external` / `eco-diagnosis`: 実行した当日の該当`recordIndex`を`1`に立てる(1日1回まで)
- `meter-reading`: 当月分について「消費量(energy.json由来)・料金(energycost.json由来)ともに最低1項目ずつ入力済み」になった時点で、保存操作を行った当日の該当`recordIndex`を`1`に立てる。以後その月は再カウントしない(フォームの追記・修正は可能だが加点は月内で1回のみ)

## エラー処理
- 外部API(クイズ、homeenergycodes-public)取得失敗時はエラーメッセージとリトライボタンを表示。記録操作自体はブロックしない
- localStorageの読み書きはユーティリティ関数(`loadJSON`/`saveJSON`)に集約し、パース失敗時は空オブジェクトにフォールバックする

## テスト方針
- ユニットテストはスコープ外。ブラウザでの手動確認を実施する
  - 各アクションの記録→翌日に持ち越されず新しい日付キーで管理されること
  - クイズ・エコ診断が同日内で再取得されず固定表示されること
  - 検針票の月次ポイントが条件成立時点で1回のみ加算されること
  - localStorage初回アクセス時(データなし)にエラーにならないこと

## スコープ外(今回は対応しない)
- ★項目(中古品購入・修理修繕)のmyecoliferecordsとの自動連携(クロスオリジン制約により技術的に不可)
- サーバーサイド保存・複数端末間の同期
- ユニットテスト整備
