import { loadJSON, saveJSON } from "./storage.js";
import { EXTERNAL_RECORDS_KEY } from "./external-records.js";

function loadAll(store) {
  return loadJSON(store, EXTERNAL_RECORDS_KEY, {});
}

export function getMonthReading(store, monthKey) {
  const all = loadAll(store);
  return {
    ...(all.energy?.[monthKey] ?? {}),
    ...(all.energycost?.[monthKey] ?? {}),
  };
}

export function saveMonthReading(store, monthKey, values, energyCodes, energyCostCodes) {
  const all = loadAll(store);
  const energy = { ...(all.energy?.[monthKey] ?? {}) };
  const energycost = { ...(all.energycost?.[monthKey] ?? {}) };
  for (const [code, value] of Object.entries(values)) {
    if (energyCodes.includes(code)) energy[code] = value;
    if (energyCostCodes.includes(code)) energycost[code] = value;
  }
  all.energy = { ...all.energy, [monthKey]: energy };
  all.energycost = { ...all.energycost, [monthKey]: energycost };
  saveJSON(store, EXTERNAL_RECORDS_KEY, all);

  const merged = { ...energy, ...energycost };
  const completed = energyCodes.some(
    (code) => energyCostCodes.includes(`${code}p`) && typeof merged[code] === "number" && typeof merged[`${code}p`] === "number"
  );
  return { completed };
}
