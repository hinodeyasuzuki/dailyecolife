import { loadJSON, saveJSON } from "./storage.js";
import { EXTERNAL_RECORDS_KEY } from "./external-records.js";

export const ECODIAGNOSIS_KEY = "dailyecolife_ecodiagnosis";

function loadAll(store) {
  return loadJSON(store, ECODIAGNOSIS_KEY, {});
}

function loadSavedInput(store) {
  return loadJSON(store, EXTERNAL_RECORDS_KEY, {});
}

//除外して1問ずつ尋ねる
const EXCLUDED_CONS = new Set(["consSeason", "consHTcold"]);
const EXCLUDED_TITLES = new Set(["ホームタンクの容量", "灯油ホームタンク回数"]);

function pickNextItem(allItems, savedInput, randomFn) {
  const eligible = allItems.filter((i) => !EXCLUDED_CONS.has(i.cons) && !EXCLUDED_TITLES.has(i.title));
  const unanswered = eligible.filter((i) => savedInput.input?.[i.id] === undefined);
  const totalUnanswered = unanswered.filter((i) => i.cons === "consTotal");
  const pool = totalUnanswered.length > 0 ? totalUnanswered : unanswered.length > 0 ? unanswered : eligible;
  return pool[Math.floor(randomFn() * pool.length)];
}

export function getTodayDiagnosisItem(store, dateKey, allItems, randomFn = Math.random) {
  const all = loadAll(store);
  const savedInput = loadSavedInput(store);
  let entry = all[dateKey];
  if (!entry) {
    entry = { itemId: pickNextItem(allItems, savedInput, randomFn).id, answerVal: null };
    all[dateKey] = entry;
    saveJSON(store, ECODIAGNOSIS_KEY, all);
  }
  let item = allItems.find((i) => i.id === entry.itemId);
  if (!item) {
    if (savedInput.input?.[entry.itemId] === undefined) {
      item = pickNextItem(allItems, savedInput, randomFn);
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
