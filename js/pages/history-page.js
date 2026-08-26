import { RECORDS_KEY, RECORD_LENGTH } from "../records.js";
import { loadJSON } from "../storage.js";
import { dateKeyDaysAgo, todayDateKey } from "../date.js";

const { ref, computed, watch } = Vue;

const EMPTY_RECORD = "0".repeat(RECORD_LENGTH);

export const HistoryPage = {
  props: {
    refreshTick: {
      type: Number,
      default: 0,
    },
  },
  setup(props) {
    const store = window.localStorage;
    const todayKey = todayDateKey();
    const recordsData = ref(loadJSON(store, RECORDS_KEY, {}));

    function refreshRecords() {
      recordsData.value = loadJSON(store, RECORDS_KEY, {});
    }

    watch(
      () => props.refreshTick,
      () => {
        refreshRecords();
      }
    );

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

    return {
      totalPoints,
      historyDays,
    };
  },
  template: `
    <section>
      <p class="point-summary">直近2ヶ月のポイント: {{ totalPoints }}</p>
      <p>直近60日間の記録(色付き=ポイント獲得日)</p>
      <div class="history-calendar">
        <div v-for="d in historyDays" :key="d.key" class="history-day" :class="{'has-point': d.hasPoint}">
          {{ d.key.slice(4) }}<br>{{ d.points }}pt
        </div>
      </div>
    </section>
  `,
};
