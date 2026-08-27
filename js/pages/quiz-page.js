import { ACTIONS } from "../../data/actions.js";
import { RECORDS_KEY, isActionRecorded, setActionRecorded } from "../records.js";
import { loadJSON } from "../storage.js";
import { getTodayQuiz, answerQuiz } from "../quiz.js";
import { todayDateKey } from "../date.js";
import { actionDescription } from "../action-meta.js";

const { ref, watch, onMounted } = Vue;

const quizAction = ACTIONS.find((a) => a.type === "quiz");

export const QuizPage = {
  emits: ["updated", "point-earned"],
  props: {
    refreshTick: {
      type: Number,
      default: 0,
    },
  },
  setup(props, { emit }) {
    const store = window.localStorage;
    const todayKey = todayDateKey();

    const recordsData = ref(loadJSON(store, RECORDS_KEY, {}));
    const quiz = ref(null);
    const loadError = ref(null);

    function recordsStore() {
      return {
        getItem: (key) => (key === RECORDS_KEY ? JSON.stringify(recordsData.value) : store.getItem(key)),
      };
    }

    function refreshRecords() {
      recordsData.value = loadJSON(store, RECORDS_KEY, {});
    }

    function isDone() {
      if (!quizAction) return false;
      return isActionRecorded(recordsStore(), todayKey, quizAction.recordIndex);
    }

    async function loadQuiz() {
      loadError.value = null;
      try {
        quiz.value = await getTodayQuiz(store, todayKey, (url) => fetch(url));
      } catch (err) {
        quiz.value = null;
        loadError.value = "クイズを取得できませんでした。";
      }
    }

    function submitAnswer(optionIndex) {
      if (!quizAction || !quiz.value || quiz.value.answeredOption !== null) return;
      const result = answerQuiz(store, todayKey, optionIndex);
      quiz.value = { ...quiz.value, answeredOption: optionIndex, correct: result.correct };
      setActionRecorded(store, todayKey, quizAction.recordIndex);
      refreshRecords();
      emit("updated");
      emit("point-earned");
    }

    watch(
      () => props.refreshTick,
      () => {
        refreshRecords();
      }
    );

    onMounted(() => {
      loadQuiz();
    });

    return {
      quizAction,
      quiz,
      loadError,
      isDone,
      submitAnswer,
      loadQuiz,
      actionDescription,
    };
  },
  template: `
    <section id="quiz-page">
      <article class="detail-panel" v-if="quizAction">
        <h2>{{ quizAction.label }}</h2>
        <p class="detail-description">今日の1問にチャレンジして、楽しくエコ知識をアップしよう。</p>
        <p class="detail-achievement" :class="{done: isDone()}">
          {{ isDone() ? '本日の問題は回答済みです。' : '本日の問題です。気軽に1つ選んでください。' }}
        </p>

        <div class="detail-body">
          <div v-if="loadError" class="load-error">
            <p>{{ loadError }}</p>
            <button class="btn" @click="loadQuiz">再試行</button>
          </div>
          <template v-else-if="quiz">
            <p class="detail-question">{{ quiz.question.question }}</p>
            <div v-for="n in [1,2,3,4]" :key="n">
              <button class="btn option-btn" :class="{ selected: quiz.answeredOption === n }" :disabled="quiz.answeredOption !== null" @click="submitAnswer(n)">
                {{ quiz.question['option' + n] }}
              </button>
            </div>
            <p v-if="quiz.answeredOption !== null" class="detail-result">
              {{ quiz.correct ? '正解！' : '不正解' }} - {{ quiz.question.explanation }}
            </p>
          </template>
        </div>
      </article>
    </section>
  `,
};
