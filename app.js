import { ACTIONS } from "./data/actions.js";
import { RECORDS_KEY, countPointsForDay, isActionRecorded } from "./js/records.js";
import { loadJSON } from "./js/storage.js";
import { isQuizAnswered } from "./js/quiz.js";
import { getMonthReading } from "./js/meterreading.js";
import { dateKeyDaysAgo, todayDateKey, todayDisplayDate, todayMonthKey } from "./js/date.js";
import { HistoryPage } from "./js/pages/history-page.js";
import { QuizPage } from "./js/pages/quiz-page.js";
import { EcoDiagnosisPage } from "./js/pages/eco-diagnosis-page.js";
import { MeterReadingPage } from "./js/pages/meter-reading-page.js";
import { ActionMenuPage } from "./js/pages/action-menu-page.js";
import { createSyncStore } from "../ehome/sync.js";
import { getCurrentTenant } from "../ehome/common/tenant.js";
import { PRIVACY_POLICY_HTML, hasPrivacyConsent, recordConsent } from "../ehome/common/privacy.js";

const { createApp, ref, computed } = Vue;
getCurrentTenant().then((tenant) => {
  if (!tenant) return;
  document.title = `${tenant.name} | 毎日エコライフ`;
  window.dailyTenantName = tenant.name;
  const heading = document.querySelector("#tenant-heading");
  if (heading) heading.textContent = `${tenant.name} | `;
}).catch((error) => console.error("自治体設定の取得に失敗しました", error));
window.ecolifeStore = await createSyncStore({
  resource: "daily",
  entries: [
    { key: "dailyecolife_records", field: "records", fallback: {} },
    { key: "dailyecolife_quiz", field: "quiz", fallback: {} },
    { key: "dailyecolife_ecodiagnosis", field: "diagnosis", fallback: {} },
    { key: "dailyecolife_meterreading", field: "meter", fallback: {} },
  ],
});

const PAGE_COMPONENTS = {
  history: HistoryPage,
  quiz: QuizPage,
  diagnosis: EcoDiagnosisPage,
  meter: MeterReadingPage,
  actionMenu: ActionMenuPage,
};

const actionById = Object.fromEntries(ACTIONS.map((a) => [a.id, a]));
const METER_PAIRS = [
  ["elect", "electp"],
  ["nagas", "nagasp"],
  ["lpgas", "lpgasp"],
  ["keros", "kerosp"],
  ["gasol", "gasolp"],
  ["water", "waterp"],
];

const MENU_ITEMS = [
  { key: "quiz", title: "環境クイズ", actionId: "quiz" },
  { key: "diagnosis", title: "今日のエコ診断", actionId: "ecocheck" },
  {
    key: "actionMenu",
    title: "今日の省エネのヒント",
    actionId: "energyhint",
    params: { actionId: "energyhint", title: "省エネのヒント" },
  },
  {
    key: "actionMenu",
    title: "今日の修理のヒント",
    actionId: "repairhint",
    params: { actionId: "repairhint", title: "修理のヒント" },
  },
  {
    key: "actionMenu",
    title: "ニュースで環境情報収集",
    actionId: "news",
    params: { actionId: "news", title: "ニュースで環境情報収集" },
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
    title: "環境コミュニケーション",
    actionId: "talk",
    params: { actionId: "talk", title: "環境コミュニケーション" },
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
  { key: "meter", title: "検針票記録", actionId: "meterread" },
];

const MENU_SECTIONS = [
  { id: "information", title: "情報", items: MENU_ITEMS.slice(0, 5) },
  { id: "daily", title: "今日の取り組み", items: MENU_ITEMS.slice(5, 11) },
  { id: "occasional", title: "時々の取り組み", items: MENU_ITEMS.slice(11) },
];

const PAGE_TITLES = {
  history: "履歴",
  quiz: "環境クイズ",
  diagnosis: "エコ診断",
  meter: "検針票記録",
};

const menuHistoryState = { dailyecolifePage: "menu", params: {} };

function playPointSound() {
  const AudioContextClass = window.AudioContext3Dメッシュデータをpng形3Dメッシュデータをpng形式で圧縮することはできるか式で圧縮することはできるか || window.webkitAudioContext;
  if (!AudioContextClass) return;

  const audioContext = new AudioContextClass();
  const gain = audioContext.createGain();
  gain.connect(audioContext.destination);
  gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
  gain.gain.exponentialRampToValueAtTime(0.09, audioContext.currentTime + 0.02);
  gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.36);

  [659.25, 783.99].forEach((frequency, index) => {
    const oscillator = audioContext.createOscillator();
    const startTime = audioContext.currentTime + index * 0.12;
    oscillator.type = "sine";
    oscillator.frequency.setValueAtTime(frequency, startTime);
    oscillator.connect(gain);
    oscillator.start(startTime);
    oscillator.stop(startTime + 0.18);
  });

  window.setTimeout(() => audioContext.close(), 500);
}

const app = createApp({
  components: {
    HistoryPage,
    QuizPage,
    EcoDiagnosisPage,
    MeterReadingPage,
    ActionMenuPage,
  },
  setup() {
    const store = window.ecolifeStore;
    const todayKey = todayDateKey();
    const monthKey = todayMonthKey();
    const displayDate = todayDisplayDate();

    const currentPage = ref("menu");
    const currentPageParams = ref({});
    const refreshTick = ref(0);
    const recordsData = ref(loadJSON(store, RECORDS_KEY, {}));
    const showWelcome = ref(!hasPrivacyConsent(store));
    const privacyAgreed = ref(false);
    const showPrivacyPolicy = ref(false);
    const showAbout = ref(false);
    const showPointNotice = ref(false);
    let pointNoticeTimer;

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
      hidePointNotice();
      currentPage.value = pageKey;
      currentPageParams.value = params;
      window.history.pushState({ dailyecolifePage: pageKey, params }, "", window.location.href);
    }

    function backToMenu() {
      hidePointNotice();
      window.history.back();
    }

    window.addEventListener("popstate", (event) => {
      hidePointNotice();
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

    function hidePointNotice() {
      window.clearTimeout(pointNoticeTimer);
      showPointNotice.value = false;
    }

    function handlePointEarned() {
      window.clearTimeout(pointNoticeTimer);
      showPointNotice.value = true;
      playPointSound();
      handleUpdated();
      pointNoticeTimer = window.setTimeout(hidePointNotice, 2000);
    }

    function acceptPrivacyPolicy() {
      if (!privacyAgreed.value) return;
      recordConsent(store);
      showWelcome.value = false;
    }

    function isMenuItemDone(item) {
      const action = actionById[item.actionId];
      if (!action) return false;
      if (action.type === "meter-reading") {
        const reading = getMonthReading(store, monthKey);
        return METER_PAIRS.every(([energyCode, costCode]) =>
          typeof reading[energyCode] === "number" && typeof reading[costCode] === "number"
        );
      }
      return isActionRecorded(recordsStore(), todayKey, action.recordIndex);
    }

    function isMenuItemPartial(item) {
      const action = actionById[item.actionId];
      if (!action || action.type !== "meter-reading") return false;
      const reading = getMonthReading(store, monthKey);
      const completed = METER_PAIRS.filter(([energyCode, costCode]) =>
        typeof reading[energyCode] === "number" && typeof reading[costCode] === "number"
      ).length;
      return completed > 0 && completed < METER_PAIRS.length;
    }

    function isMenuItemAnswered(item) {
      const action = actionById[item.actionId];
      if (!action || action.type !== "quiz") return false;
      return isQuizAnswered(store, todayKey);
    }

    function menuItemStatusText(item) {
      if (isMenuItemDone(item)) return "達成";
      if (isMenuItemAnswered(item)) return "回答済";
      if (isMenuItemPartial(item)) return "一部達成";
      return "未達成";
    }

    function menuItemStatusClass(item) {
      if (isMenuItemDone(item)) return "done";
      if (isMenuItemAnswered(item)) return "answered";
      if (isMenuItemPartial(item)) return "partial";
      return "pending";
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
      MENU_SECTIONS,
      currentPage,
      currentPageParams,
      currentComponent,
      currentTitle,
      displayDate,
      refreshTick,
      todayPoints,
      totalPoints,
      showWelcome,
      privacyAgreed,
      showPrivacyPolicy,
      privacyPolicyHtml: PRIVACY_POLICY_HTML,
      showAbout,
      showPointNotice,
      hidePointNotice,
      openPage,
      backToMenu,
      handleUpdated,
      handlePointEarned,
      acceptPrivacyPolicy,
      isMenuItemDone,
      isMenuItemPartial,
      isMenuItemAnswered,
      menuItemStatusText,
      menuItemStatusClass,
    };
  },
  template: `
    <div>
      <header class="app-header">
        <p class="series-name">🌿 エコライフノート</p>
        <h1><span id="tenant-heading"></span>毎日エコライフ（{{ displayDate }}）</h1>
        <div class="point-stats">
          <div class="point-stat point-stat-today">
            <span class="point-stat-icon" aria-hidden="true">🌱</span>
            <div class="point-stat-text">
              <span class="point-stat-label">今日のポイント</span>
              <span class="point-stat-value">{{ todayPoints }}<span class="point-stat-unit">pt</span></span>
            </div>
          </div>
          <div class="point-stat point-stat-range">
            <span class="point-stat-label">直近2ヶ月</span>
            <span class="point-stat-value">{{ totalPoints }}<span class="point-stat-unit">pt</span></span>
          </div>
        </div>
      </header>

      <section v-if="currentPage === 'menu'" class="menu-screen">
        <div class="menu-sections">
          <section v-for="section in MENU_SECTIONS" :key="section.id" class="menu-section" :aria-labelledby="'menu-section-' + section.id">
            <h2 :id="'menu-section-' + section.id" class="menu-section-title">{{ section.title }}</h2>
            <div class="menu-grid">
              <button
                v-for="item in section.items"
                :key="item.title"
                type="button"
                class="action-card action-card-button top-menu-card"
                :class="{done: isMenuItemDone(item)}"
                @click="openPage(item.key, item.params || {})">
                <div class="action-card-title">
                  <span>{{ item.title }}</span>
                  <span class="status-badge" :class="menuItemStatusClass(item)">
                    {{ menuItemStatusText(item) }}
                  </span>
                </div>
              </button>
            </div>
          </section>
        </div>
        <button type="button" class="btn menu-history-button" @click="openPage('history')">ポイント履歴</button>
      </section>

      <section v-else class="detail-screen">
        <button class="btn btn-ghost" @click="backToMenu">< メニューに戻る</button>
        <component
          :is="currentComponent"
          :refresh-tick="refreshTick"
          :page-params="currentPageParams"
          @updated="handleUpdated"
          @point-earned="handlePointEarned"></component>
        <button class="btn btn-ghost mt-10" @click="backToMenu">< メニューに戻る</button>
      </section>

      <footer class="app-footer">
        <a class="btn btn-ghost footer-link" href="../ehome/">エコライフノート</a>
        <button type="button" class="btn btn-ghost footer-link" @click="showPrivacyPolicy = true">プライバシーポリシー</button>
        <button type="button" class="btn btn-ghost footer-link" @click="showAbout = true">このアプリについて</button>
      </footer>

      <div v-if="showWelcome" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
        <section class="modal-content">
          <p class="series-name">エコライフノート</p>
          <h2 id="welcome-title">毎日エコライフへようこそ</h2>
          <p>日々の小さな行動を記録し、ポイントとして振り返るアプリです。</p>
          <p>記録はブラウザに保存され、同期時にCookieセッションに対応するサーバーへ保存されます。</p>
          <label class="consent-check">
            <input type="checkbox" v-model="privacyAgreed">
            <span>エコライフノートの利用方針に同意する</span>
          </label>
          <button type="button" class="btn btn-ghost modal-policy-link" @click="showPrivacyPolicy = true">プライバシーポリシーを確認</button>
          <button type="button" class="btn btn-primary" :disabled="!privacyAgreed" @click="acceptPrivacyPolicy">はじめる</button>
        </section>
      </div>

      <div v-if="showPrivacyPolicy" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="privacy-title">
        <section class="modal-content">
          <h2 id="privacy-title">エコライフノートの利用方針</h2>
          <div v-html="privacyPolicyHtml"></div>
          <button type="button" class="btn" @click="showPrivacyPolicy = false">閉じる</button>
        </section>
      </div>

      <div v-if="showAbout" class="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="about-title">
        <section class="modal-content">
          <h2 id="about-title">このアプリについて</h2>
          <p>毎日エコライフは、日常でできる環境配慮行動を記録し、継続を振り返るためのアプリです。</p>
          <p>クイズ、エコ診断、検針票記録などを通して、暮らしの中の環境との関わりを見つめます。</p>
          <p><a href="https://www.hinodeya-ecolife.com/" target="_blank" rel="noopener noreferrer">有限会社ひのでやエコライフ研究所</a>が提供しています。</p>
          <button type="button" class="btn" @click="showAbout = false">閉じる</button>
        </section>
      </div>

      <transition name="point-earned">
        <aside v-if="showPointNotice" class="point-notice" role="status" aria-live="polite" aria-labelledby="point-notice-title">
          <div class="point-notice-illustration" aria-hidden="true">🌱</div>
          <div>
            <p class="point-notice-label">今日のエコアクション</p>
            <h2 id="point-notice-title">+1 ポイント</h2>
            <p class="point-notice-message">環境の取り組み、ありがとうございます。</p>
          </div>
          <button type="button" class="point-notice-close" aria-label="ポイント取得のお知らせを閉じる" @click="hidePointNotice">×</button>
        </aside>
      </transition>
    </div>
  `,
});

app.mount("#app");
