export const ACTION_DESCRIPTIONS = {
  quiz: "4択の環境クイズに答えて、毎日の知識を1つずつ増やします。",
  packaging: "包装の少ない商品を選び、ごみの発生を抑える行動です。",
  foodloss: "食材を使い切って、食品ロスを減らすことを目指します。",
  recycle: "紙やプラスチックを分別し、資源として循環させます。",
  energysave: "暮らしの中でできる省エネの工夫を実践します。",
  lesscar: "徒歩・自転車・公共交通を優先し、車の利用を減らします。",
  news: "環境ニュースを読んで、社会の動きを知る習慣をつくります。",
  talk: "家族や友人と環境の話をして、行動を広げていきます。",
  secondhand: "中古品購入の記録ページに移動し、実践を記録します。",
  repair: "修理・リペアの記録ページに移動し、長く使う行動を記録します。",
  ecocheck: "日替わりのエコ診断に答えて、暮らしの傾向を確認します。",
  meterread: "検針票の情報を入力して、月ごとの使用量を記録します。",
};

export function actionDescription(action) {
  return ACTION_DESCRIPTIONS[action.id] ?? "このアクションの詳細を確認して進めます。";
}
