import { loadJSON, saveJSON } from "./storage.js";

export const ACTION_NOTES_KEY = "dailyecolife_actionnotes";

function loadAllNotes(store) {
  return loadJSON(store, ACTION_NOTES_KEY, {});
}

export function getActionNote(store, dateKey, actionId) {
  const all = loadAllNotes(store);
  return all[dateKey]?.[actionId] ?? "";
}

export function setActionNote(store, dateKey, actionId, note) {
  const all = loadAllNotes(store);
  all[dateKey] = { ...all[dateKey], [actionId]: note };
  saveJSON(store, ACTION_NOTES_KEY, all);
}

export function listActionNoteHistory(store, actionId) {
  const all = loadAllNotes(store);
  return Object.entries(all)
    .filter(([, notes]) => notes[actionId])
    .map(([dateKey, notes]) => ({ dateKey, note: notes[actionId] }))
    .sort((a, b) => (a.dateKey < b.dateKey ? 1 : -1));
}
