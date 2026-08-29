import { RECORDS_KEY, RECORD_LENGTH } from "../records.js";
import { loadJSON } from "../storage.js";
import { dateKeyDaysAgo, dateKeyWeekday, todayDateKey } from "../date.js";

const { ref, computed, watch } = Vue;

const EMPTY_RECORD = "0".repeat(RECORD_LENGTH);
const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

export const HistoryPage = {
  props: {
    refreshTick: {
      type: Number,
      default: 0,
    },
  },
  setup(props) {
    const store = window.ecolifeStore;
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

    const historyCells = computed(() => {
      const firstDay = historyDays.value[0];
      const leadingEmptyCells = Array.from({ length: dateKeyWeekday(firstDay.key) }, (_, index) => ({
        key: `empty-${index}`,
        empty: true,
      }));
      return [...leadingEmptyCells, ...historyDays.value];
    });

    return {
      totalPoints,
      weekdayLabels: WEEKDAY_LABELS,
      historyCells,
      historyDays,
    };
  },
  template: `
    <section>
      <p class="point-summary">直近2ヶ月のポイント: {{ totalPoints }}</p>
      <p>直近60日間の記録(色付き=ポイント獲得日)</p>
      <div class="history-weekdays" aria-hidden="true">
        <div v-for="weekday in weekdayLabels" :key="weekday">{{ weekday }}</div>
      </div>
      <div class="history-calendar">
        <div v-for="d in historyCells" :key="d.key" class="history-day" :class="{'has-point': d.hasPoint, 'empty-day': d.empty}">
          <template v-if="!d.empty">{{ d.key.slice(4) }}<br>{{ d.points }}pt</template>
        </div>
      </div>
    </section>
  `,
};
