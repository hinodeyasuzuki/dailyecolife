import { ACTIONS } from "../../data/actions.js";
import { RECORDS_KEY, RECORD_LENGTH } from "../records.js";
import { loadJSON } from "../storage.js";
import { listActionNoteHistory } from "../action-notes.js";
import {
  addDaysToDateKey,
  dateKeyLabel,
  dateKeyWeekday,
  daysInMonth,
  monthKeyAddMonths,
  monthKeyLabel,
  todayDateKey,
  todayMonthKey,
} from "../date.js";

const { ref, computed, watch } = Vue;

const EMPTY_RECORD = "0".repeat(RECORD_LENGTH);
const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];
const TREND_MONTHS_BACK = 11;
const TREND_WINDOW_DAYS = 60;
const TREND_Y_TICK_VALUES = [10, 50, 100, 200, 500];
const CHART_LEFT = 46;
const CHART_RIGHT = 392;
const CHART_TOP = 10;
const CHART_BOTTOM = 110;
const CHART_LABEL_Y = 128;
const CHART_AXIS_TITLE_X = 14;

function countPoints(record) {
  return record.split("").filter((c) => c === "1").length;
}

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
    const selectedMonthKey = ref(todayMonthKey());
    const noteActions = ACTIONS.filter((a) => a.type === "simple");
    const selectedNoteActionId = ref(noteActions[0]?.id ?? null);
    const noteHistoryTick = ref(0);

    function refreshRecords() {
      recordsData.value = loadJSON(store, RECORDS_KEY, {});
    }

    watch(
      () => props.refreshTick,
      () => {
        refreshRecords();
        noteHistoryTick.value += 1;
      }
    );

    const canGoNext = computed(() => selectedMonthKey.value !== todayMonthKey());

    function prevMonth() {
      selectedMonthKey.value = monthKeyAddMonths(selectedMonthKey.value, -1);
    }

    function nextMonth() {
      if (!canGoNext.value) return;
      selectedMonthKey.value = monthKeyAddMonths(selectedMonthKey.value, 1);
    }

    const monthLabel = computed(() => monthKeyLabel(selectedMonthKey.value));

    const monthDays = computed(() => {
      const total = daysInMonth(selectedMonthKey.value);
      const days = [];
      for (let day = 1; day <= total; day++) {
        const key = `${selectedMonthKey.value}${String(day).padStart(2, "0")}`;
        const record = recordsData.value[key] ?? EMPTY_RECORD;
        const points = countPoints(record);
        days.push({ key, day, points, hasPoint: points > 0 });
      }
      return days;
    });

    const monthTotal = computed(() => monthDays.value.reduce((sum, d) => sum + d.points, 0));

    const monthActionTotals = computed(() =>
      ACTIONS.map((action) => ({
        id: action.id,
        label: action.label,
        count: monthDays.value.reduce((sum, d) => {
          const record = recordsData.value[d.key] ?? EMPTY_RECORD;
          return sum + (record[action.recordIndex] === "1" ? 1 : 0);
        }, 0),
      })).sort((a, b) => b.count - a.count)
    );

    const historyCells = computed(() => {
      const firstDayKey = `${selectedMonthKey.value}01`;
      const leadingEmptyCells = Array.from({ length: dateKeyWeekday(firstDayKey) }, (_, index) => ({
        key: `empty-${index}`,
        empty: true,
      }));
      return [...leadingEmptyCells, ...monthDays.value];
    });

    const trendPoints = computed(() => {
      const graphStartMonthKey = monthKeyAddMonths(todayMonthKey(), -TREND_MONTHS_BACK);
      const graphStartDateKey = `${graphStartMonthKey}01`;
      const seriesStartDateKey = addDaysToDateKey(graphStartDateKey, -(TREND_WINDOW_DAYS - 1));

      const dateKeys = [];
      for (let key = seriesStartDateKey; key <= todayKey; key = addDaysToDateKey(key, 1)) {
        dateKeys.push(key);
      }

      const points = [];
      let windowSum = 0;
      for (let i = 0; i < dateKeys.length; i++) {
        windowSum += countPoints(recordsData.value[dateKeys[i]] ?? EMPTY_RECORD);
        if (i >= TREND_WINDOW_DAYS) {
          windowSum -= countPoints(recordsData.value[dateKeys[i - TREND_WINDOW_DAYS]] ?? EMPTY_RECORD);
        }
        if (dateKeys[i] >= graphStartDateKey) {
          points.push({ dateKey: dateKeys[i], value: windowSum });
        }
      }
      return points;
    });

    const trendMax = computed(() => Math.max(1, ...trendPoints.value.map((p) => p.value)));

    function trendX(index) {
      const count = trendPoints.value.length;
      if (count <= 1) return CHART_LEFT;
      return CHART_LEFT + (index / (count - 1)) * (CHART_RIGHT - CHART_LEFT);
    }

    function trendY(value) {
      return CHART_BOTTOM - (value / trendMax.value) * (CHART_BOTTOM - CHART_TOP);
    }

    const trendPolylinePoints = computed(() =>
      trendPoints.value.map((p, index) => `${trendX(index)},${trendY(p.value)}`).join(" ")
    );

    const trendYTicks = computed(() =>
      TREND_Y_TICK_VALUES.filter((value) => value <= trendMax.value).map((value) => ({
        value,
        y: trendY(value),
      }))
    );

    const trendTicks = computed(() =>
      trendPoints.value
        .map((p, index) => ({ ...p, index }))
        .filter((p) => p.dateKey.slice(6, 8) === "01")
        .map((p) => ({
          dateKey: p.dateKey,
          x: trendX(p.index),
          label: `${Number(p.dateKey.slice(4, 6))}月`,
        }))
    );

    const noteHistory = computed(() => {
      void noteHistoryTick.value;
      if (!selectedNoteActionId.value) return [];
      return listActionNoteHistory(store, selectedNoteActionId.value);
    });

    return {
      weekdayLabels: WEEKDAY_LABELS,
      selectedMonthKey,
      monthLabel,
      canGoNext,
      prevMonth,
      nextMonth,
      monthTotal,
      monthActionTotals,
      historyCells,
      trendPolylinePoints,
      trendTicks,
      trendYTicks,
      noteActions,
      selectedNoteActionId,
      noteHistory,
      dateKeyLabel,
      CHART_LABEL_Y,
      CHART_LEFT,
      CHART_RIGHT,
      CHART_AXIS_TITLE_X,
      CHART_TOP,
      CHART_BOTTOM,
    };
  },
  template: `
    <section>
      <h3 class="history-section-title">ポイント履歴</h3>
      <div class="history-month-nav">
        <button type="button" class="btn btn-ghost" @click="prevMonth">＜前月</button>
        <p class="history-month-label">{{ monthLabel }}</p>
        <button type="button" class="btn btn-ghost" :disabled="!canGoNext" @click="nextMonth">翌月＞</button>
      </div>
      <div class="history-weekdays" aria-hidden="true">
        <div v-for="weekday in weekdayLabels" :key="weekday">{{ weekday }}</div>
      </div>
      <div class="history-calendar">
        <div v-for="d in historyCells" :key="d.key" class="history-day" :class="{'has-point': d.hasPoint, 'empty-day': d.empty}">
          <template v-if="!d.empty">{{ d.day }}<br>{{ d.points }}pt</template>
        </div>
      </div>

      <table class="history-action-table">
        <thead>
          <tr><th>取り組み</th><th>ポイント数</th></tr>
        </thead>
        <tbody>
          <tr v-for="action in monthActionTotals" :key="action.id">
            <td>{{ action.label }}</td>
            <td>{{ action.count }}pt</td>
          </tr>
        </tbody>
      </table>
      <p class="point-summary right w100">{{ monthLabel }}のポイント合計: {{ monthTotal }}pt</p>

      <h3 class="history-section-title">直近60日ポイントの推移</h3>
      <svg class="history-trend" viewBox="0 0 400 140">
        <text
          :x="CHART_AXIS_TITLE_X"
          :y="(CHART_TOP + CHART_BOTTOM) / 2"
          :transform="'rotate(-90, ' + CHART_AXIS_TITLE_X + ', ' + (CHART_TOP + CHART_BOTTOM) / 2 + ')'"
          class="history-trend-axis-title">ポイント数(pt)</text>
        <g v-for="tick in trendYTicks" :key="'y-' + tick.value">
          <line :x1="CHART_LEFT" :x2="CHART_RIGHT" :y1="tick.y" :y2="tick.y" class="history-trend-gridline" />
          <text :x="CHART_LEFT - 6" :y="tick.y + 3" class="history-trend-ytick">{{ tick.value }}</text>
        </g>
        <polyline :points="trendPolylinePoints" fill="none" stroke="var(--accent-strong)" stroke-width="2" />
        <text v-for="tick in trendTicks" :key="tick.dateKey" :x="tick.x" :y="CHART_LABEL_Y" class="history-trend-tick">{{ tick.label }}</text>
      </svg>

      <h3 class="history-section-title">自由記入の記録</h3>
      <select v-model="selectedNoteActionId" class="history-note-select">
        <option v-for="action in noteActions" :key="action.id" :value="action.id">{{ action.label }}</option>
      </select>
      <div class="entry-list" v-if="noteHistory.length">
        <div class="entry-item" v-for="entry in noteHistory" :key="entry.dateKey">
          <p class="entry-item-meta">{{ dateKeyLabel(entry.dateKey) }}</p>
          <p class="entry-item-memo">{{ entry.note }}</p>
        </div>
      </div>
      <p v-else class="point-summary">記録はまだありません。</p>
    </section>
  `,
};
