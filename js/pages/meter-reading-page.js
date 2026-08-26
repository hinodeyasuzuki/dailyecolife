import { ACTIONS } from "../../data/actions.js";
import { RECORDS_KEY, isActionRecordedInMonth } from "../records.js";
import { loadJSON } from "../storage.js";
import { getMonthReading, saveMonthReading, awardMeterReadingPoint } from "../meterreading.js";
import { fetchEnergyCodes, fetchEnergyCostCodes } from "../api.js";
import { todayDateKey, todayMonthKey } from "../date.js";
import { actionDescription } from "../action-meta.js";

const { ref, reactive, watch, onMounted } = Vue;

const meterAction = ACTIONS.find((a) => a.type === "meter-reading");

export const MeterReadingPage = {
  emits: ["updated"],
  props: {
    refreshTick: {
      type: Number,
      default: 0,
    },
  },
  setup(props, { emit }) {
    const store = window.localStorage;
    const todayKey = todayDateKey();
    const monthKey = todayMonthKey();

    const recordsData = ref(loadJSON(store, RECORDS_KEY, {}));
    const energyCodes = ref([]);
    const energyCostCodes = ref([]);
    const meterValues = reactive({});
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
      if (!meterAction) return false;
      return isActionRecordedInMonth(recordsStore(), monthKey, meterAction.recordIndex);
    }

    async function loadForm() {
      loadError.value = null;
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
      }
    }

    function saveReading() {
      if (!meterAction) return;
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
      const awarded = awardMeterReadingPoint(store, monthKey, todayKey, meterAction.recordIndex, result.completed);
      if (awarded) {
        refreshRecords();
        emit("updated");
      }
    }

    watch(
      () => props.refreshTick,
      () => {
        refreshRecords();
      }
    );

    onMounted(() => {
      loadForm();
    });

    return {
      meterAction,
      energyCodes,
      energyCostCodes,
      meterValues,
      loadError,
      isDone,
      saveReading,
      loadForm,
      actionDescription,
    };
  },
  template: `
    <section>
      <article class="detail-panel" v-if="meterAction">
        <h2>{{ meterAction.label }}</h2>
        <p class="detail-description">{{ actionDescription(meterAction) }}</p>
        <p class="detail-achievement" :class="{done: isDone()}">
          {{ isDone() ? 'このアクションは達成済みです。' : 'まだ達成していません。' }}
        </p>

        <div class="detail-body">
          <div v-if="loadError" class="load-error">
            <p>{{ loadError }}</p>
            <button class="btn" @click="loadForm">再試行</button>
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
            <button class="btn btn-primary" @click="saveReading">保存</button>
          </template>
        </div>
      </article>
    </section>
  `,
};
