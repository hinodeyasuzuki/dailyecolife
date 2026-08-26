import { loadJSON, saveJSON } from "./storage.js";

export const QUIZ_KEY = "dailyecolife_quiz";
export const QUIZ_API_URL = "https://s8.hinodeya-ecolife.com/quizapi/";

function loadAllQuiz(store) {
  return loadJSON(store, QUIZ_KEY, {});
}

export async function getTodayQuiz(store, dateKey, fetchFn) {
  const all = loadAllQuiz(store);
  if (all[dateKey]) {
    return all[dateKey];
  }
  const response = await fetchFn(QUIZ_API_URL);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  const question = await response.json();
  const entry = { question, answeredOption: null, correct: null };
  all[dateKey] = entry;
  saveJSON(store, QUIZ_KEY, all);
  return entry;
}

export function answerQuiz(store, dateKey, optionIndex) {
  const all = loadAllQuiz(store);
  const entry = all[dateKey];
  if (entry.answeredOption !== null) {
    return { correct: entry.correct };
  }
  const correct = entry.question.answer === optionIndex;
  entry.answeredOption = optionIndex;
  entry.correct = correct;
  saveJSON(store, QUIZ_KEY, all);
  return { correct };
}
