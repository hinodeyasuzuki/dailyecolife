import { ACTIONS } from "../../data/actions.js";
import { RECORDS_KEY, isActionRecorded, setActionRecorded } from "../records.js";
import { loadJSON } from "../storage.js";
import { getTodayDiagnosisItem, answerDiagnosis } from "../ecodiagnosis.js";
import { fetchInputItems } from "../api.js";
import { todayDateKey } from "../date.js";
import { actionDescription } from "../action-meta.js";
import { EXTERNAL_RECORDS_KEY } from "../external-records.js";

const { ref, computed, watch, onMounted } = Vue;

function isPlaceholderOption(opt) {
  return opt.disp === "選んで下さい";
}

const diagnosisAction = ACTIONS.find((a) => a.type === "eco-diagnosis");

export const EcoDiagnosisPage = {
  emits: ["updated", "point-earned"],
  props: {
    refreshTick: {
      type: Number,
      default: 0,
    },
  },
  setup(props, { emit }) {
    const store = window.ecolifeStore;
    const externalStore = window.externalRecordsStore;
    const diagnosisStore = {
      getItem: (key) => (key === EXTERNAL_RECORDS_KEY ? externalStore.getItem(key) : store.getItem(key)),
      setItem: (key, value) => (key === EXTERNAL_RECORDS_KEY ? externalStore.setItem(key, value) : store.setItem(key, value)),
    };
    const todayKey = todayDateKey();

    const inputItems = ref([]);
    const diagnosisItem = ref(null);
    const loadError = ref(null);
    const recordsData = ref(loadJSON(store, RECORDS_KEY, {}));

    function recordsStore() {
      return {
        getItem: (key) => (key === RECORDS_KEY ? JSON.stringify(recordsData.value) : store.getItem(key)),
      };
    }

    function refreshRecords() {
      recordsData.value = loadJSON(store, RECORDS_KEY, {});
    }

    function isDone() {
      if (!diagnosisAction) return false;
      return isActionRecorded(recordsStore(), todayKey, diagnosisAction.recordIndex);
    }

    async function loadDiagnosis() {
      loadError.value = null;
      try {
        if (inputItems.value.length === 0) {
          inputItems.value = await fetchInputItems((url) => fetch(url));
        }
        diagnosisItem.value = getTodayDiagnosisItem(diagnosisStore, todayKey, inputItems.value);
      } catch (err) {
        diagnosisItem.value = null;
        loadError.value = "エコ診断を取得できませんでした。";
      }
    }

    const visibleOptions = computed(() => (diagnosisItem.value?.item?.options ?? []).filter((opt) => !isPlaceholderOption(opt)));

    function submitAnswer(val) {
      if (!diagnosisAction || !diagnosisItem.value) return;
      const completedBeforeAnswer = isDone();
      answerDiagnosis(diagnosisStore, todayKey, val);
      diagnosisItem.value = { ...diagnosisItem.value, answerVal: val };
      if (!completedBeforeAnswer) {
        setActionRecorded(store, todayKey, diagnosisAction.recordIndex);
        emit("point-earned");
      }
      refreshRecords();
      emit("updated");
    }

    watch(
      () => props.refreshTick,
      () => {
        refreshRecords();
        loadDiagnosis();
      }
    );

    onMounted(() => {
      loadDiagnosis();
    });

    return {
      diagnosisAction,
      diagnosisItem,
      loadError,
      isDone,
      submitAnswer,
      loadDiagnosis,
      actionDescription,
      visibleOptions,
    };
  },
  template: `
    <section>
      <article class="detail-panel" v-if="diagnosisAction">
        <h2>{{ diagnosisAction.label }}</h2>
        <p class="detail-description">{{ actionDescription(diagnosisAction) }}</p>
        <p class="detail-achievement" :class="{done: isDone()}">
          {{ isDone() ? '本日記入済みです。' : '記入してください。' }}
        </p>
        <p class="center">いままでの入力は<a href="../myecoliferecords/?page=input">Myエコライフ記録</a>で確認できます。</p>

        <div class="detail-body">
          <div v-if="loadError" class="load-error">
            <p>{{ loadError }}</p>
            <button class="btn" @click="loadDiagnosis">再試行</button>
          </div>
          <template v-else-if="diagnosisItem && diagnosisItem.item">
            <p class="detail-question">{{ diagnosisItem.item.title }}</p>
            <p>{{ diagnosisItem.item.text }}</p>
            <div v-for="opt in visibleOptions" :key="opt.val">
              <button class="btn option-btn" :class="{ selected: diagnosisItem.answerVal === opt.val }" @click="submitAnswer(opt.val)">
                {{ opt.disp }}
              </button>
            </div>
          </template>
        </div>
      </article>
    </section>
  `,
};
