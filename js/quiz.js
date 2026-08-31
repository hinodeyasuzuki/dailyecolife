import { loadJSON, saveJSON } from "./storage.js";

export const QUIZ_KEY = "dailyecolife_quiz";
export const QUIZ_API_URL =
  location.hostname === "localhost"
    ? "http://localhost/dev/quizapi/"
    : "https://s8.hinodeya-ecolife.com/quizapi/";

function loadAllQuiz(store) {
  return loadJSON(store, QUIZ_KEY, {});
}

async function fetchQuiz(fetchFn, id) {
  const url = id ? `${QUIZ_API_URL}?id=${encodeURIComponent(id)}` : QUIZ_API_URL;
  const response = await fetchFn(url);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

// 保存(同期ログ)には問題文・選択肢を残さず、quizIdと回答結果だけを記録する。
// 再表示時はquizIdでAPIから問題文を都度取得する。
export async function getTodayQuiz(store, dateKey, fetchFn) {
  const all = loadAllQuiz(store);
  let entry = all[dateKey];
  if (!entry) {
    const question = await fetchQuiz(fetchFn);
    entry = { quizId: question.id, answeredOption: null, correct: null };
    all[dateKey] = entry;
    saveJSON(store, QUIZ_KEY, all);
    return { question, answeredOption: entry.answeredOption, correct: entry.correct };
  }
  const question = await fetchQuiz(fetchFn, entry.quizId);
  return { question, answeredOption: entry.answeredOption, correct: entry.correct };
}

export function answerQuiz(store, dateKey, optionIndex, correct) {
  const all = loadAllQuiz(store);
  const entry = all[dateKey];
  if (!entry) return { correct: false };
  if (entry.answeredOption !== null) {
    return { correct: entry.correct };
  }
  entry.answeredOption = optionIndex;
  entry.correct = correct;
  saveJSON(store, QUIZ_KEY, all);
  return { correct };
}

export function isQuizAnswered(store, dateKey) {
  const all = loadAllQuiz(store);
  const entry = all[dateKey];
  return Boolean(entry && entry.answeredOption !== null);
}
