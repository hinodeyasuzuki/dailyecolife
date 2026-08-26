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
