import { test } from "node:test";
import assert from "node:assert/strict";
import { getTodayQuiz, answerQuiz, QUIZ_API_URL } from "../js/quiz.js";

function createMockStore(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, value),
  };
}

const sampleQuestion = {
  id: 176,
  category: "desertification",
  question: "砂漠化を防ぐ条約は？",
  option1: "ラムサール条約",
  option2: "国連砂漠化対処条約",
  option3: "モントリオール議定書",
  option4: "京都議定書",
  answer: 2,
  explanation: "説明文",
};

test("getTodayQuiz: 未キャッシュ時はfetchFnを呼びキャッシュする", async () => {
  const store = createMockStore();
  let calledUrl = null;
  const fetchFn = async (url) => {
    calledUrl = url;
    return { ok: true, json: async () => sampleQuestion };
  };
  const result = await getTodayQuiz(store, "20260826", fetchFn);
  assert.equal(calledUrl, QUIZ_API_URL);
  assert.deepEqual(result.question, sampleQuestion);
  assert.equal(result.answeredOption, null);
  assert.equal(result.correct, null);
});

test("getTodayQuiz: キャッシュ済みならfetchFnを呼ばない", async () => {
  const store = createMockStore();
  const fetchFn = async () => {
    throw new Error("呼ばれてはいけない");
  };
  await new Promise((resolve) => {
    const seedFetch = async () => ({ ok: true, json: async () => sampleQuestion });
    getTodayQuiz(store, "20260826", seedFetch).then(resolve);
  });
  const result = await getTodayQuiz(store, "20260826", fetchFn);
  assert.deepEqual(result.question, sampleQuestion);
});

test("answerQuiz: 正解を選ぶとcorrect=trueで記録される", async () => {
  const store = createMockStore();
  const fetchFn = async () => ({ ok: true, json: async () => sampleQuestion });
  await getTodayQuiz(store, "20260826", fetchFn);
  const result = answerQuiz(store, "20260826", 2);
  assert.equal(result.correct, true);
  const after = await getTodayQuiz(store, "20260826", fetchFn);
  assert.equal(after.answeredOption, 2);
  assert.equal(after.correct, true);
});

test("answerQuiz: 不正解を選ぶとcorrect=falseで記録される", async () => {
  const store = createMockStore();
  const fetchFn = async () => ({ ok: true, json: async () => sampleQuestion });
  await getTodayQuiz(store, "20260826", fetchFn);
  const result = answerQuiz(store, "20260826", 1);
  assert.equal(result.correct, false);
});

test("getTodayQuiz: response.okがfalseの場合はエラーがthrowされる", async () => {
  const store = createMockStore();
  const fetchFn = async () => ({ ok: false, status: 500, json: async () => ({}) });
  await assert.rejects(() => getTodayQuiz(store, "20260826", fetchFn), /HTTP 500/);
});

test("answerQuiz: 回答済みの場合は再回答できず元の結果を返す", async () => {
  const store = createMockStore();
  const fetchFn = async () => ({ ok: true, json: async () => sampleQuestion });
  await getTodayQuiz(store, "20260826", fetchFn);
  answerQuiz(store, "20260826", 2);
  const second = answerQuiz(store, "20260826", 1);
  assert.equal(second.correct, true);
});
