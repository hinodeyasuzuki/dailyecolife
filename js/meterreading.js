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
