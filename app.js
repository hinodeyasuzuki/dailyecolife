import { ACTIONS } from "./data/actions.js";
import {
  RECORDS_KEY,
  RECORD_LENGTH,
  isActionRecorded,
  setActionRecorded,
  isActionRecordedInMonth,
} from "./js/records.js";
import { loadJSON } from "./js/storage.js";
import { getTodayQuiz, answerQuiz } from "./js/quiz.js";
import { getTodayDiagnosisItem, answerDiagnosis } from "./js/ecodiagnosis.js";
import { getMonthReading, saveMonthReading, awardMeterReadingPoint } from "./js/meterreading.js";
import { fetchInputItems, fetchEnergyCodes, fetchEnergyCostCodes } from "./js/api.js";

const { createApp, ref, reactive, computed } = Vue;

function todayDateKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

function todayMonthKey() {
  return todayDateKey().slice(0, 6);
}

function dateKeyDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

const categories = [...new Set(ACTIONS.map((a) => a.category))];

const EMPTY_RECORD = "0".repeat(RECORD_LENGTH);

const app = createApp({
  setup() {
    const store = window.localStorage;
    const todayKey = todayDateKey();
    const monthKey = todayMonthKey();
    const currentTab = ref("top");
    const openActionId = ref(null);
    const loadError = ref(null);
    const pendingRetry = ref(null);

    const quiz = ref(null);
    const diagnosisItem = ref(null);
    const inputItems = ref([]);
    const energyCodes = ref([]);
    const energyCostCodes = ref([]);
    const meterValues = reactive({});

    // localStorageの記録データをVueのreactiveな依存として保持する。
    // 書き込み系の関数は必ずwriteRecord経由でこのrefを再代入し、
    // isDone/totalPoints/historyDaysがそこから再計算されるようにする。
    const recordsData = ref(loadJSON(store, RECORDS_KEY, {}));

    // js/records.jsの関数(isActionRecorded等)をrecordsData.valueに対して
    // そのまま使い回すための疑似store。
    function recordsStore() {
      return {
        getItem: (key) => (key === RECORDS_KEY ? JSON.stringify(recordsData.value) : store.getItem(key)),
      };
    }

    function refreshRecordsData() {
      recordsData.value = loadJSON(store, RECORDS_KEY, {});
    }

    function writeRecord(dateKey, recordIndex) {
      setActionRecorded(store, dateKey, recordIndex);
      refreshRecordsData();
    }

    const totalPoints = computed(() => {
      const startKey = dateKeyDaysAgo(60);
      let total = 0;
      for (const [dateKey, record] of Object.entries(recordsData.value)) {
        if (dateKey >= startKey && dateKey <= todayKey) {
          total += record.split("").filter((c) => c === "1").length;
        }
      }
      return total;
    });

    const historyDays = computed(() => {
      const days = [];
      for (let i = 59; i >= 0; i--) {
        const key = dateKeyDaysAgo(i);
        const record = recordsData.value[key] ?? EMPTY_RECORD;
        const points = record.split("").filter((c) => c === "1").length;
        days.push({ key, points, hasPoint: points > 0 });
      }
      return days;
    });

    function isDone(action) {
      if (action.type === "meter-reading") {
        return isActionRecordedInMonth(recordsStore(), monthKey, action.recordIndex);
      }
      return isActionRecorded(recordsStore(), todayKey, action.recordIndex);
    }

    function actionsByCategory(category) {
      return ACTIONS.filter((a) => a.category === category).sort((a, b) => a.order - b.order);
    }

    function markSimpleDone(action) {
      if (isDone(action)) return;
      writeRecord(todayKey, action.recordIndex);
    }

    function markExternalDone(action) {
      if (isDone(action)) return;
      writeRecord(todayKey, action.recordIndex);
    }

    async function openQuiz(action) {
      openActionId.value = action.id;
      loadError.value = null;
      pendingRetry.value = null;
      try {
        quiz.value = await getTodayQuiz(store, todayKey, (url) => fetch(url));
      } catch (err) {
        quiz.value = null;
        loadError.value = "クイズを取得できませんでした。";
        pendingRetry.value = () => openQuiz(action);
      }
    }

    function submitQuizAnswer(action, optionIndex) {
      const result = answerQuiz(store, todayKey, optionIndex);
      quiz.value = { ...quiz.value, answeredOption: optionIndex, correct: result.correct };
      writeRecord(todayKey, action.recordIndex);
    }

    async function openEcoDiagnosis(action) {
      openActionId.value = action.id;
      loadError.value = null;
      pendingRetry.value = null;
      try {
        if (inputItems.value.length === 0) {
          inputItems.value = await fetchInputItems((url) => fetch(url));
        }
        diagnosisItem.value = getTodayDiagnosisItem(store, todayKey, inputItems.value);
      } catch (err) {
        diagnosisItem.value = null;
        loadError.value = "エコ診断を取得できませんでした。";
        pendingRetry.value = () => openEcoDiagnosis(action);
      }
    }

    function submitDiagnosisAnswer(action, val) {
      answerDiagnosis(store, todayKey, val);
      diagnosisItem.value = { ...diagnosisItem.value, answerVal: val };
      writeRecord(todayKey, action.recordIndex);
    }

    async function openMeterReading(action) {
      openActionId.value = action.id;
      loadError.value = null;
      pendingRetry.value = null;
      try {
        if (energyCodes.value.length === 0) {
          energyCodes.value = await fetchEnergyCodes((url) => fetch(url));
          energyCostCodes.value = await fetchEnergyCostCodes((url) => fetch(url));
        }
        const existing = getMonthReading(store, monthKey);
        Object.assign(meterValues, existing);
      } catch (err) {
        energyCodes.value = [];
        energyCostCodes.value = [];
        loadError.value = "検針票の項目を取得できませんでした。";
        pendingRetry.value = () => openMeterReading(action);
      }
    }

    function submitMeterReading(action) {
      const codes = [...energyCodes.value.map((c) => c.code), ...energyCostCodes.value.map((c) => c.code)];
      const values = {};
      for (const code of codes) {
        if (meterValues[code] !== undefined && meterValues[code] !== "") {
          values[code] = Number(meterValues[code]);
        }
      }
      const result = saveMonthReading(
        store,
        monthKey,
        values,
        energyCodes.value.map((c) => c.code),
        energyCostCodes.value.map((c) => c.code)
      );
      const awarded = awardMeterReadingPoint(store, monthKey, todayKey, action.recordIndex, result.completed);
      if (awarded) {
        refreshRecordsData();
      }
    }

    function closeActionDetail() {
      openActionId.value = null;
      loadError.value = null;
      pendingRetry.value = null;
    }

    return {
      currentTab,
      categories,
      actionsByCategory,
      isDone,
      openActionId,
      loadError,
      pendingRetry,
      quiz,
      diagnosisItem,
      inputItems,
      energyCodes,
      energyCostCodes,
      meterValues,
      totalPoints,
      historyDays,
      markSimpleDone,
      markExternalDone,
      openQuiz,
      submitQuizAnswer,
      openEcoDiagnosis,
      submitDiagnosisAnswer,
      openMeterReading,
      submitMeterReading,
      closeActionDetail,
    };
  },
  template: `
    <div>
      <header class="app-header">
        <h1>毎日エコライフ</h1>
        <div class="point-summary">直近2ヶ月のポイント: {{ totalPoints }}</div>
      </header>
      <nav class="tabs">
        <button class="tab-button" :class="{active: currentTab === 'top'}" @click="currentTab = 'top'">トップ</button>
        <button class="tab-button" :class="{active: currentTab === 'history'}" @click="currentTab = 'history'">履歴</button>
      </nav>

      <section v-if="currentTab === 'top'">
        <div v-for="category in categories" :key="category" class="category-section">
          <h2>{{ category }}</h2>
          <div v-for="action in actionsByCategory(category)" :key="action.id"
               class="action-card" :class="{done: isDone(action)}">
            <div class="action-card-title">
              <span>{{ action.label }}</span>
              <span v-if="isDone(action)">✅</span>
            </div>
            <div class="action-card-body">
              <button v-if="action.type === 'simple' && !isDone(action)" class="btn btn-primary" @click="markSimpleDone(action)">できた</button>

              <template v-if="action.type === 'quiz'">
                <button v-if="openActionId !== action.id" class="btn" @click="openQuiz(action)">クイズを見る</button>
                <div v-else>
                  <div v-if="loadError" class="load-error">
                    <p>{{ loadError }}</p>
                    <button class="btn" @click="pendingRetry()">再試行</button>
                  </div>
                  <template v-else-if="quiz">
                    <p>{{ quiz.question.question }}</p>
                    <div v-for="n in [1,2,3,4]" :key="n">
                      <button class="btn" :disabled="quiz.answeredOption !== null" @click="submitQuizAnswer(action, n)">
                        {{ quiz.question['option' + n] }}
                      </button>
                    </div>
                    <p v-if="quiz.answeredOption !== null">
                      {{ quiz.correct ? '正解！' : '不正解' }} - {{ quiz.question.explanation }}
                    </p>
                  </template>
                  <button class="btn" @click="closeActionDetail">閉じる</button>
                </div>
              </template>

              <template v-if="action.type === 'external'">
                <a :href="action.url" target="_blank" rel="noopener" class="btn">myecoliferecordsを開く</a>
                <button v-if="!isDone(action)" class="btn btn-primary" @click="markExternalDone(action)">今日記入した</button>
              </template>

              <template v-if="action.type === 'eco-diagnosis'">
                <button v-if="openActionId !== action.id" class="btn" @click="openEcoDiagnosis(action)">エコ診断を開く</button>
                <div v-else>
                  <div v-if="loadError" class="load-error">
                    <p>{{ loadError }}</p>
                    <button class="btn" @click="pendingRetry()">再試行</button>
                  </div>
                  <template v-else-if="diagnosisItem && diagnosisItem.item">
                    <p>{{ diagnosisItem.item.title }}</p>
                    <p>{{ diagnosisItem.item.text }}</p>
                    <div v-for="opt in diagnosisItem.item.options" :key="opt.val">
                      <button class="btn" :disabled="diagnosisItem.answerVal !== null" @click="submitDiagnosisAnswer(action, opt.val)">
                        {{ opt.disp }}
                      </button>
                    </div>
                  </template>
                  <button class="btn" @click="closeActionDetail">閉じる</button>
                </div>
              </template>

              <template v-if="action.type === 'meter-reading'">
                <button v-if="openActionId !== action.id" class="btn" @click="openMeterReading(action)">検針票を記録する</button>
                <div v-else>
                  <div v-if="loadError" class="load-error">
                    <p>{{ loadError }}</p>
                    <button class="btn" @click="pendingRetry()">再試行</button>
                  </div>
                  <template v-else>
                    <div class="form-field" v-for="c in energyCodes" :key="c.code">
                      <label>{{ c.name }}({{ c.unit }})</label>
                      <input type="number" v-model="meterValues[c.code]">
                    </div>
                    <div class="form-field" v-for="c in energyCostCodes" :key="c.code">
                      <label>{{ c.name }}</label>
                      <input type="number" v-model="meterValues[c.code]">
                    </div>
                    <button class="btn btn-primary" @click="submitMeterReading(action)">保存</button>
                  </template>
                  <button class="btn" @click="closeActionDetail">閉じる</button>
                </div>
              </template>
            </div>
          </div>
        </div>
      </section>

      <section v-if="currentTab === 'history'">
        <p>直近60日間の記録(色付き=ポイント獲得日)</p>
        <div class="history-calendar">
          <div v-for="d in historyDays" :key="d.key" class="history-day" :class="{'has-point': d.hasPoint}">
            {{ d.key.slice(4) }}<br>{{ d.points }}pt
          </div>
        </div>
      </section>
    </div>
  `,
});

app.mount("#app");
