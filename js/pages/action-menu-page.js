import { ACTIONS } from "../../data/actions.js";
import { RECORDS_KEY, isActionRecorded, setActionRecorded } from "../records.js";
import { loadJSON } from "../storage.js";
import { externalActionCount } from "../external-records.js";
import { todayDateKey } from "../date.js";
import { actionDescription } from "../action-meta.js";

const { ref, computed, watch } = Vue;

export const ActionMenuPage = {
  emits: ["updated"],
  props: {
    refreshTick: {
      type: Number,
      default: 0,
    },
    pageParams: {
      type: Object,
      default: () => ({}),
    },
  },
  setup(props, { emit }) {
    const store = window.localStorage;
    const todayKey = todayDateKey();
    const recordsData = ref(loadJSON(store, RECORDS_KEY, {}));
    const externalCountsAtOpen = {
      repair: externalActionCount(store, "repair"),
      secondhand: externalActionCount(store, "secondhand"),
    };
    const externalMessage = ref("");
    const viewedInfo = ref(false);

    const selectedActionId = computed(() => props.pageParams.actionId ?? null);
    const selectedAction = computed(() => {
      if (!selectedActionId.value) return null;
      return ACTIONS.find((a) => a.id === selectedActionId.value) ?? null;
    });
    const selectedMode = computed(() => props.pageParams.mode ?? "simple");
    const isExternalMode = computed(() => {
      if (selectedAction.value) return selectedAction.value.type === "external";
      return selectedMode.value === "external";
    });
    const isInfoMode = computed(() => selectedAction.value?.type === "info");
    const pageActions = computed(() => {
      if (selectedAction.value) return [selectedAction.value];
      if (selectedActionId.value) return [];
      const type = isExternalMode.value ? "external" : "simple";
      return ACTIONS.filter((a) => a.type === type).sort((a, b) => a.order - b.order);
    });

    function recordsStore() {
      return {
        getItem: (key) => (key === RECORDS_KEY ? JSON.stringify(recordsData.value) : store.getItem(key)),
      };
    }

    function refreshRecords() {
      recordsData.value = loadJSON(store, RECORDS_KEY, {});
    }

    function isDone(action) {
      return isActionRecorded(recordsStore(), todayKey, action.recordIndex);
    }

    function markDone(action) {
      if (isDone(action)) return;
      setActionRecorded(store, todayKey, action.recordIndex);
      refreshRecords();
      emit("updated");
    }

    function markExternalDone(action) {
      if (isDone(action)) return;
      if (externalActionCount(store, action.id) <= externalCountsAtOpen[action.id]) {
        externalMessage.value = "外部記録に新しい記入が見つかりません。記入後にもう一度確認してください。";
        return;
      }
      externalMessage.value = "";
      markDone(action);
    }

    function openInfo(action) {
      const url = new URL(action.url);
      url.searchParams.set("ymd", todayKey);
      viewedInfo.value = true;
      window.open(url.toString(), "_blank", "noopener");
    }

    function infoOpenLabel(action) {
      return `${action.label}を表示`;
    }

    function infoReadLabel(action) {
      return `${action.label}を読んだ`;
    }

    function openExternalLabel(action) {
      if (action.id === "secondhand") return "中古品ページを開く";
      if (action.id === "repair") return "修理履歴ページを開く";
      return "外部ページを開く";
    }

    watch(
      () => props.refreshTick,
      () => {
        refreshRecords();
      }
    );

    return {
      selectedMode,
      selectedAction,
      isExternalMode,
      isInfoMode,
      selectedActionId,
      pageActions,
      isDone,
      markDone,
      markExternalDone,
      externalMessage,
      viewedInfo,
      openInfo,
      infoOpenLabel,
      infoReadLabel,
      openExternalLabel,
      actionDescription,
    };
  },
  template: `
    <section>
      <div class="category-section">
        <article v-for="action in pageActions" :key="action.id" class="detail-panel" :class="{done: isDone(action)}">
          <h2>{{ action.label }}</h2>
          <p class="detail-description">{{ actionDescription(action) }}</p>
          <p class="detail-achievement" :class="{done: isDone(action)}">
            {{ isDone(action) ? '本日達成できました。' : 'まだ達成できていません。' }}
          </p>

          <div class="detail-body" v-if="isExternalMode">
            <a :href="action.url" target="_blank" rel="noopener" class="btn">{{ openExternalLabel(action) }}</a>
            <button v-if="!isDone(action)" class="btn btn-primary" @click="markExternalDone(action)">今日記入した</button>
            <p v-if="externalMessage && !isDone(action)" class="external-action-message">{{ externalMessage }}</p>
          </div>

          <div class="detail-body" v-else-if="isInfoMode">
            <button type="button" class="btn" @click="openInfo(action)">{{ infoOpenLabel(action) }}</button>
            <button v-if="!isDone(action)" type="button" class="btn btn-primary" :disabled="!viewedInfo" @click="markDone(action)">{{ infoReadLabel(action) }}</button>
          </div>

          <div class="detail-body" v-else>
            <button v-if="!isDone(action)" class="btn btn-primary" @click="markDone(action)">本日（前回の記入以降）できた</button>
          </div>
        </article>
      </div>
    </section>
  `,
};
