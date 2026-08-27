import { ACTIONS } from "./data/actions.js";
import { RECORDS_KEY, countPointsForDay, isActionRecorded, isActionRecordedInMonth } from "./js/records.js";
import { loadJSON } from "./js/storage.js";
import { dateKeyDaysAgo, todayDateKey, todayMonthKey } from "./js/date.js";
import { HistoryPage } from "./js/pages/history-page.js";
import { QuizPage } from "./js/pages/quiz-page.js";
import { EcoDiagnosisPage } from "./js/pages/eco-diagnosis-page.js";
import { MeterReadingPage } from "./js/pages/meter-reading-page.js";
import { ActionMenuPage } from "./js/pages/action-menu-page.js";

const { createApp, ref, computed } = Vue;

const PAGE_COMPONENTS = {
  history: HistoryPage,
  quiz: QuizPage,
  diagnosis: EcoDiagnosisPage,
  meter: MeterReadingPage,
  actionMenu: ActionMenuPage,
};

const actionById = Object.fromEntries(ACTIONS.map((a) => [a.id, a]));

const MENU_ITEMS = [
  { key: "quiz", title: "環境クイズ", actionId: "quiz" },
  { key: "diagnosis", title: "今日のエコ診断", actionId: "ecocheck" },
  {
    key: "actionMenu",
    title: "食品ロスゼロ",
    actionId: "foodloss",
    params: { actionId: "foodloss", title: "食品ロスゼロ" },
  },
  {
    key: "actionMenu",
    title: "紙・プラ全量リサイクル",
    actionId: "recycle",
    params: { actionId: "recycle", title: "紙・プラ全量リサイクル" },
  },
  {
    key: "actionMenu",
    title: "包装が少ない購入",
    actionId: "packaging",
    params: { actionId: "packaging", title: "包装が少ない購入" },
  },
  {
    key: "actionMenu",
    title: "省エネの工夫",
    actionId: "energysave",
    params: { actionId: "energysave", title: "省エネの工夫" },
  },
  {
    key: "actionMenu",
    title: "車の使用を削減",
    actionId: "lesscar",
    params: { actionId: "lesscar", title: "車の使用を削減" },
  },
  {
    key: "actionMenu",
    title: "中古品購入",
    actionId: "secondhand",
    params: { actionId: "secondhand", title: "中古品購入" },
  },
  {
    key: "actionMenu",
    title: "修理修繕・リペア",
    actionId: "repair",
    params: { actionId: "repair", title: "修理修繕・リペア" },
  },
  {
    key: "actionMenu",
    title: "環境ニュースで情報収集",
    actionId: "news",
    params: { actionId: "news", title: "環境ニュースで情報収集" },
  },
  {
    key: "actionMenu",
    title: "環境コミュニケーション",
    actionId: "talk",
    params: { actionId: "talk", title: "環境コミュニケーション" },
  },
  { key: "meter", title: "検針票記録", actionId: "meterread" },
];

const PAGE_TITLES = {
  history: "履歴",
  quiz: "環境クイズ",
  diagnosis: "エコ診断",
  meter: "検針票記録",
};

const menuHistoryState = { dailyecolifePage: "menu", params: {} };

const app = createApp({
  components: {
    HistoryPage,
    QuizPage,
    EcoDiagnosisPage,
    MeterReadingPage,
    ActionMenuPage,
  },
  setup() {
    const store = window.localStorage;
    const todayKey = todayDateKey();
    const monthKey = todayMonthKey();

    const currentPage = ref("menu");
    const currentPageParams = ref({});
    const refreshTick = ref(0);
    const recordsData = ref(loadJSON(store, RECORDS_KEY, {}));

    window.history.pushState(menuHistoryState, "", window.location.href);

    function refreshRecords() {
      recordsData.value = loadJSON(store, RECORDS_KEY, {});
    }

    function recordsStore() {
      return {
        getItem: (key) => (key === RECORDS_KEY ? JSON.stringify(recordsData.value) : store.getItem(key)),
      };
    }

    function openPage(pageKey, params = {}) {
      currentPage.value = pageKey;
      currentPageParams.value = params;
      window.history.pushState({ dailyecolifePage: pageKey, params }, "", window.location.href);
    }

    function backToMenu() {
      window.history.back();
    }

    window.addEventListener("popstate", (event) => {
      const state = event.state;
      if (state?.dailyecolifePage) {
        currentPage.value = state.dailyecolifePage;
        currentPageParams.value = state.params ?? {};
        refreshRecords();
        return;
      }
      if (window.confirm("毎日エコライフを終了しますか？（保存されています）")) {
        window.history.back();
        return;
      }
      window.history.pushState(menuHistoryState, "", window.location.href);
    });

    function handleUpdated() {
      refreshTick.value += 1;
      refreshRecords();
    }

    function isMenuItemDone(item) {
      const action = actionById[item.actionId];
      if (!action) return false;
      if (action.type === "meter-reading") {
        return isActionRecordedInMonth(recordsStore(), monthKey, action.recordIndex);
      }
      return isActionRecorded(recordsStore(), todayKey, action.recordIndex);
    }

    function menuItemStatusText(item) {
      return isMenuItemDone(item) ? "達成" : "未達成";
    }

    const todayPoints = computed(() => countPointsForDay(recordsStore(), todayKey));

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

    const currentComponent = computed(() => {
      return PAGE_COMPONENTS[currentPage.value] ?? null;
    });

    const currentTitle = computed(() => {
      if (currentPage.value === "actionMenu") {
        return currentPageParams.value.title ?? "メニュー展開";
      }
      return PAGE_TITLES[currentPage.value] ?? "";
    });

    return {
      MENU_ITEMS,
      currentPage,
      currentPageParams,
      currentComponent,
      currentTitle,
      refreshTick,
      todayPoints,
      totalPoints,
      openPage,
      backToMenu,
      handleUpdated,
      isMenuItemDone,
      menuItemStatusText,
    };
  },
  template: `
    <div>
      <header class="app-header">
        <h1>毎日エコライフ</h1>
        <div class="point-summary">今日のポイント: {{ todayPoints }} / 直近2ヶ月のポイント: {{ totalPoints }}</div>
      </header>

      <section v-if="currentPage === 'menu'" class="menu-grid">
        <button
          type="button"
          class="btn btn-primary history-op-button"
          @click="openPage('history')">
          履歴を開く
        </button>
        <button
          v-for="item in MENU_ITEMS"
          :key="item.title"
          type="button"
          class="action-card action-card-button top-menu-card"
          :class="{done: isMenuItemDone(item)}"
          @click="openPage(item.key, item.params || {})">
          <div class="action-card-title">
            <span>{{ item.title }}</span>
            <span class="status-badge" :class="isMenuItemDone(item) ? 'done' : 'pending'">
              {{ menuItemStatusText(item) }}
            </span>
          </div>
        </button>
      </section>

      <section v-else class="detail-screen">
        <button class="btn btn-ghost" @click="backToMenu">< メニューに戻る</button>
        <component
          :is="currentComponent"
          :refresh-tick="refreshTick"
          :page-params="currentPageParams"
          @updated="handleUpdated"></component>
      </section>
    </div>
  `,
});

app.mount("#app");
