// equip.json のタイトルは製品名の口語表現と一致しないことがあるため、
// よく使われる呼び方だけ最小限のエイリアスで補う。
const ALIASES = {
  カーディガン: "818", // セーター
  スマホ: "241", // スマートフォン
};

function splitTokens(title) {
  return title
    .split(/[・、,，]/)
    .map((t) => t.trim())
    .filter((t) => t.length >= 2);
}

export function guessEquipItem(equipItems, productName) {
  const name = (productName ?? "").trim();
  if (!name || !Array.isArray(equipItems) || equipItems.length === 0) return null;

  for (const [alias, id] of Object.entries(ALIASES)) {
    if (name.includes(alias)) {
      const item = equipItems.find((i) => i.id === id);
      if (item) return item;
    }
  }

  const leaves = equipItems.filter((i) => i.level === 3);
  const matches = [];
  for (const item of leaves) {
    let longestToken = 0;
    for (const token of splitTokens(item.title)) {
      if (name.includes(token) && token.length > longestToken) {
        longestToken = token.length;
      }
    }
    if (longestToken > 0) matches.push({ item, tokenLength: longestToken });
  }
  if (matches.length === 0) return null;

  const maxLength = Math.max(...matches.map((m) => m.tokenLength));
  const best = matches.filter((m) => m.tokenLength === maxLength);
  if (best.length !== 1) return null; // 同点は誤提案になりやすいので提案しない
  return best[0].item;
}

export function equipTitle(equipItems, equipId) {
  if (!equipId) return "";
  return equipItems.find((i) => i.id === equipId)?.title ?? "";
}
