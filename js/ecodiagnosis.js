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
