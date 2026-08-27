import { ACTIONS } from "../../data/actions.js";
import { RECORDS_KEY, isActionRecordedInMonth } from "../records.js";
import { loadJSON } from "../storage.js";
import { getMonthReading, saveMonthReading, awardMeterReadingPoint } from "../meterreading.js";
import { fetchEnergyCodes, fetchEnergyCostCodes } from "../api.js";
import { todayDateKey, todayMonthKey } from "../date.js";
import { actionDescription } from "../action-meta.js";

const { ref, reactive, computed, watch, onMounted } = Vue;

const meterAction = ACTIONS.find((a) => a.type === "meter-reading");
const METER_PAIRS = [
  { energyCode: "elect", costCode: "electp" },
  { energyCode: "nagas", costCode: "nagasp" },
  { energyCode: "lpgas", costCode: "lpgasp" },
  { energyCode: "keros", costCode: "kerosp" },
  { energyCode: "gasol", costCode: "gasolp" },
  { energyCode: "water", costCode: "waterp" },
];

function previousMonthKey(monthKey) {
  const date = new Date(Number(monthKey.slice(0, 4)), Number(monthKey.slice(4, 6)) - 2, 1);
  return `${date.getFullYear()}${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(monthKey) {
  return `${monthKey.slice(0, 4)}年${Number(monthKey.slice(4, 6))}月`;
}

export const MeterReadingPage = {
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
    const monthKey = todayMonthKey();
    const previousKey = previousMonthKey(monthKey);

    const recordsData = ref(loadJSON(store, RECORDS_KEY, {}));
    const energyCodes = ref([]);
    const energyCostCodes = ref([]);
    const meterValues = reactive({});
    const loadError = ref(null);
    const selectedMonthKey = ref(monthKey);
    const monthOptions = [
      { key: monthKey, label: `今月（${monthLabel(monthKey)}）` },
      { key: previousKey, label: `前月（${monthLabel(previousKey)}）` },
    ];
    const meterPairs = computed(() =>
      METER_PAIRS.map(({ energyCode, costCode }) => ({
        energy: energyCodes.value.find((code) => code.code === energyCode),
        cost: energyCostCodes.value.find((code) => code.code === costCode),
      })).filter((pair) => pair.energy && pair.cost)
    );

    function recordsStore() {
      return {
        getItem: (key) => (key === RECORDS_KEY ? JSON.stringify(recordsData.value) : store.getItem(key)),
      };
    }

    function refreshRecords() {
      recordsData.value = loadJSON(store, RECORDS_KEY, {});
    }

    function completedPairCount() {
      return METER_PAIRS.filter(({ energyCode, costCode }) =>
        typeof meterValues[energyCode] === "number" &&
        typeof meterValues[costCode] === "number" &&
        !Number.isNaN(meterValues[energyCode]) &&
        !Number.isNaN(meterValues[costCode])
      ).length;
    }

    function isDone() {
      return completedPairCount() === METER_PAIRS.length;
    }

    function isPartDone() {
      const completed = completedPairCount();
      return completed > 0 && completed < METER_PAIRS.length;
    }

    function loadMonthReading() {
      const existing = getMonthReading(store, selectedMonthKey.value);
      for (const code of Object.keys(meterValues)) {
        delete meterValues[code];
      }
      Object.assign(meterValues, existing);
    }

    async function loadForm() {
      loadError.value = null;
      try {
        if (energyCodes.value.length === 0) {
          energyCodes.value = await fetchEnergyCodes((url) => fetch(url));
          energyCostCodes.value = await fetchEnergyCostCodes((url) => fetch(url));
        }
        loadMonthReading();
      } catch (err) {
        energyCodes.value = [];
        energyCostCodes.value = [];
        loadError.value = "検針票の項目を取得できませんでした。";
      }
    }

    function saveReading() {
      if (!meterAction) return;
      const codes = meterPairs.value.flatMap((pair) => [pair.energy.code, pair.cost.code]);
      const values = {};
      for (const code of codes) {
        if (meterValues[code] !== undefined && meterValues[code] !== "") {
          values[code] = Number(meterValues[code]);
        }
      }

      const result = saveMonthReading(
        store,
        selectedMonthKey.value,
        values,
        METER_PAIRS.map((pair) => pair.energyCode),
        METER_PAIRS.map((pair) => pair.costCode)
      );
      const recordDateKey = selectedMonthKey.value === monthKey ? todayKey : `${selectedMonthKey.value}01`;
      const awarded = awardMeterReadingPoint(store, selectedMonthKey.value, recordDateKey, meterAction.recordIndex, result.completed);
      if (awarded) {
        refreshRecords();
        emit("updated");
        emit("point-earned");
      }
    }

    watch(
      () => props.refreshTick,
      () => {
        refreshRecords();
      }
    );

    watch(selectedMonthKey, () => {
      loadMonthReading();
    });

    onMounted(() => {
      loadForm();
    });

    return {
      meterAction,
      energyCodes,
      energyCostCodes,
      meterValues,
      loadError,
      selectedMonthKey,
      monthOptions,
      meterPairs,
      isDone,
      isPartDone,
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
        <p class="detail-achievement" :class="{done: isDone(), partial: isPartDone()}">
          {{ isDone() ? 'この月の検針票記録は達成済みです。' : isPartDone() ? '一部達成済みです。' : '使用量と料金をセットで入力してください。' }}
        </p>

        <div class="detail-body">
          <div v-if="loadError" class="load-error">
            <p>{{ loadError }}</p>
            <button class="btn" @click="loadForm">再試行</button>
          </div>
          <template v-else>
            <div class="month-selector" role="group" aria-label="記録する月">
              <button
                v-for="month in monthOptions"
                :key="month.key"
                type="button"
                class="btn month-selector-button"
                :class="{ selected: selectedMonthKey === month.key }"
                @click="selectedMonthKey = month.key">
                {{ month.label }}
              </button>
            </div>
            <div v-for="pair in meterPairs" :key="pair.energy.code" class="meter-pair">
              <p class="meter-pair-title">{{ pair.energy.name }}</p>
              <div class="meter-pair-fields">
                <div class="form-field">
                  <label>{{ pair.energy.name }}（{{ pair.energy.unit }}）</label>
                  <input type="number" min="0" step="any" v-model="meterValues[pair.energy.code]">
                </div>
                <div class="form-field">
                  <label>{{ pair.cost.name }}（円）</label>
                  <input type="number" min="0" step="1" v-model="meterValues[pair.cost.code]">
                </div>
              </div>
            </div>
            <button class="btn btn-primary" @click="saveReading">保存</button>
          </template>
        </div>
      </article>

    </section>
  `,
};
