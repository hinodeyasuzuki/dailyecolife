import { ACTIONS } from "../../data/actions.js";
import { RECORDS_KEY, isActionRecorded, setActionRecorded } from "../records.js";
import { loadJSON } from "../storage.js";
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

    function openExternalLabel(action) {
      if (action.id === "secondhand") return "中古品購入ページを開く";
      if (action.id === "repair") return "修理修繕ページを開く";
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
      selectedActionId,
      pageActions,
      isDone,
      markDone,
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
            {{ isDone(action) ? 'このアクションは達成済みです。' : 'まだ達成していません。' }}
          </p>

          <div class="detail-body" v-if="isExternalMode">
            <a :href="action.url" target="_blank" rel="noopener" class="btn">{{ openExternalLabel(action) }}</a>
            <button v-if="!isDone(action)" class="btn btn-primary" @click="markDone(action)">今日記入した</button>
          </div>

          <div class="detail-body" v-else>
            <button v-if="!isDone(action)" class="btn btn-primary" @click="markDone(action)">できた</button>
          </div>
        </article>
      </div>
    </section>
  `,
};
