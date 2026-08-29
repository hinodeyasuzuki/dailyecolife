import { loadJSON, saveJSON } from "./storage.js";
import { EXTERNAL_RECORDS_KEY } from "./external-records.js";

export const ECODIAGNOSIS_KEY = "dailyecolife_ecodiagnosis";

function loadAll(store) {
  return loadJSON(store, ECODIAGNOSIS_KEY, {});
}

function loadSavedInput(store) {
  return loadJSON(store, EXTERNAL_RECORDS_KEY, {});
}

export function getTodayDiagnosisItem(store, dateKey, allItems, randomFn = Math.random) {
  const all = loadAll(store);
  const savedInput = loadSavedInput(store);
  let entry = all[dateKey];
  if (!entry) {
    const index = Math.floor(randomFn() * allItems.length);
    entry = { itemId: allItems[index].id, answerVal: null };
    all[dateKey] = entry;
    saveJSON(store, ECODIAGNOSIS_KEY, all);
  }
  let item = allItems.find((i) => i.id === entry.itemId);
  if (!item) {
    if (savedInput.input?.[entry.itemId] === undefined) {
      const index = Math.floor(randomFn() * allItems.length);
      item = allItems[index];
      entry = { itemId: item.id, answerVal: null };
      all[dateKey] = entry;
      saveJSON(store, ECODIAGNOSIS_KEY, all);
    } else {
      return { item: null, answerVal: savedInput.input[entry.itemId] };
    }
  }
  return { item, answerVal: savedInput.input?.[entry.itemId] ?? null };
}

export function answerDiagnosis(store, dateKey, answerVal) {
  const all = loadAll(store);
  const entry = all[dateKey];
  if (!entry) return;
  const savedInput = loadSavedInput(store);
  savedInput.input = { ...savedInput.input, [entry.itemId]: answerVal };
  saveJSON(store, EXTERNAL_RECORDS_KEY, savedInput);
}
