import { ACTIONS } from "../../data/actions.js";
import { RECORDS_KEY, isActionRecorded, setActionRecorded } from "../records.js";
import { loadJSON } from "../storage.js";
import { todayDateKey } from "../date.js";
import { actionDescription } from "../action-meta.js";
import { fetchEquipItems } from "../api.js";
import { guessEquipItem, equipTitle } from "../equip-guess.js";
import { listSecondhandProducts, listRepairLogs, addSecondhandProduct, addRepairLog } from "../external-input.js";
import { REPAIRER_OPTIONS } from "../repairer-options.js";

const { ref, reactive, computed, watch, onMounted } = Vue;

const PURCHASE_MONTH_OPTIONS = [
  { value: -1, label: "頃" },
  { value: 0, label: "月は不明" },
  ...Array.from({ length: 12 }, (_, i) => ({ value: i + 1, label: `${i + 1}月` })),
];

function emptyFormState() {
  return {
    name: "",
    equipId: "",
    equipSuggestedId: null,
    equipSuggestedTitle: "",
    purchaseyear: "",
    purchasemonth: -1,
    memory: "",
    year: "",
    repairer: "",
    about: "",
  };
}

export const ActionMenuPage = {
  emits: ["updated", "point-earned"],
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
    const store = window.ecolifeStore;
    const todayKey = todayDateKey();
    const recordsData = ref(loadJSON(store, RECORDS_KEY, {}));
    const viewedInfo = ref(false);

    const equipItems = ref([]);
    const equipError = ref(null);
    const forms = reactive({});
    const entryLists = reactive({});

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

    const currentYear = new Date().getFullYear();
    const yearOptions = Array.from({ length: 51 }, (_, i) => currentYear - i);
    const monthOptions = PURCHASE_MONTH_OPTIONS;
    const repairYearOptions = Array.from({ length: 21 }, (_, i) => currentYear - i);
    const repairerOptions = REPAIRER_OPTIONS;

    const equipOptions = computed(() => {
      const level1s = equipItems.value.filter((i) => i.level === 1);
      return level1s
        .map((l1) => ({
          id: l1.id,
          title: l1.title,
          items: equipItems.value.filter((i) => i.level === 3 && i.level1Id === l1.id),
        }))
        .filter((g) => g.items.length > 0);
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
      emit("point-earned");
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

    async function ensureEquipItems() {
      if (equipItems.value.length > 0) return;
      try {
        equipItems.value = await fetchEquipItems((url) => fetch(url));
      } catch (err) {
        equipError.value = "機器カテゴリー一覧を取得できませんでした。手動で選択してください。";
      }
    }

    function ensureForm(actionId) {
      if (!forms[actionId]) forms[actionId] = emptyFormState();
      return forms[actionId];
    }

    function refreshEntries(actionId) {
      if (actionId === "secondhand") {
        entryLists[actionId] = listSecondhandProducts(store);
      } else if (actionId === "repair") {
        entryLists[actionId] = listRepairLogs(store);
      }
    }

    function onNameBlur(actionId) {
      const form = ensureForm(actionId);
      const guess = guessEquipItem(equipItems.value, form.name);
      if (!guess) {
        form.equipSuggestedId = null;
        form.equipSuggestedTitle = "";
        return;
      }
      // 直前の提案から変更していなければ、新しい提案で上書きする(否定されていない=提案を採用)
      if (!form.equipId || form.equipId === form.equipSuggestedId) {
        form.equipId = guess.id;
      }
      form.equipSuggestedId = guess.id;
      form.equipSuggestedTitle = guess.title;
    }

    function equipLabel(equipId) {
      return equipTitle(equipItems.value, equipId);
    }

    function resetForm(actionId) {
      forms[actionId] = emptyFormState();
    }

    function saveSecondhand(action) {
      const form = forms[action.id];
      const name = form.name.trim();
      if (!name) return;
      addSecondhandProduct(store, {
        name,
        equipId: form.equipId,
        purchaseyear: form.purchaseyear === "" ? null : form.purchaseyear,
        purchasemonth: form.purchasemonth,
        memory: form.memory.trim(),
      });
      resetForm(action.id);
      refreshEntries(action.id);
      markDone(action);
    }

    function saveRepair(action) {
      const form = forms[action.id];
      const name = form.name.trim();
      if (!name) return;
      addRepairLog(store, {
        productName: name,
        equipId: form.equipId,
        year: form.year === "" ? null : form.year,
        repairer: form.repairer,
        about: form.about.trim(),
      });
      resetForm(action.id);
      refreshEntries(action.id);
      markDone(action);
    }

    function purchaseDateLabel(entry) {
      const year = entry.purchaseyear ? `${entry.purchaseyear}年` : "";
      let month = "";
      if (entry.purchasemonth > 0) month = `${entry.purchasemonth}月`;
      else if (entry.purchasemonth === -1) month = "頃";
      else if (entry.purchasemonth === 0) month = "月は不明";
      const date = `${year}${month}`;
      return date || "購入時期不明";
    }

    function repairDateLabel(entry) {
      return entry.year ? `${entry.year}年` : "修理年不明";
    }

    watch(
      pageActions,
      (actions) => {
        for (const action of actions) {
          if (action.type !== "external") continue;
          ensureForm(action.id);
          refreshEntries(action.id);
          ensureEquipItems();
        }
      },
      { immediate: true }
    );

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
      viewedInfo,
      openInfo,
      infoOpenLabel,
      infoReadLabel,
      actionDescription,
      equipOptions,
      equipError,
      yearOptions,
      monthOptions,
      repairYearOptions,
      repairerOptions,
      forms,
      entryLists,
      onNameBlur,
      equipLabel,
      saveSecondhand,
      saveRepair,
      purchaseDateLabel,
      repairDateLabel,
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

          <div class="detail-body" v-if="isExternalMode && action.id === 'secondhand' && forms[action.id]">
            <div class="form-field">
              <label>製品名</label>
              <input type="text" v-model="forms[action.id].name" @blur="onNameBlur(action.id)" placeholder="例: 32インチテレビ">
            </div>
            <div class="form-field" v-if="equipOptions.length">
              <label>機器カテゴリー(自動設定)</label>
              <select v-model="forms[action.id].equipId">
                <option value="">未選択</option>
                <optgroup v-for="group in equipOptions" :key="group.id" :label="group.title">
                  <option v-for="item in group.items" :key="item.id" :value="item.id">{{ item.title }}</option>
                </optgroup>
              </select>
              <p
                v-if="forms[action.id].equipSuggestedId && forms[action.id].equipId === forms[action.id].equipSuggestedId"
                class="equip-suggestion-note">
                製品名から「{{ forms[action.id].equipSuggestedTitle }}」を提案しました。違う場合は選び直してください。
              </p>
            </div>
            <p v-if="equipError" class="equip-suggestion-note">{{ equipError }}</p>
            <div class="meter-pair-fields">
              <div class="form-field">
                <label>購入年</label>
                <select v-model="forms[action.id].purchaseyear">
                  <option value="">不明</option>
                  <option v-for="y in yearOptions" :key="y" :value="y">{{ y }}年</option>
                </select>
              </div>
              <div class="form-field">
                <label>購入月</label>
                <select v-model="forms[action.id].purchasemonth">
                  <option v-for="opt in monthOptions" :key="opt.value" :value="opt.value">{{ opt.label }}</option>
                </select>
              </div>
            </div>
            <div class="form-field">
              <label>概要(商品の概要、経緯など)</label>
              <textarea v-model="forms[action.id].memory" rows="3"></textarea>
            </div>
            <button type="button" class="btn btn-primary" :disabled="!forms[action.id].name.trim()" @click="saveSecondhand(action)">記録を追加</button>

            <div class="entry-list" v-if="entryLists[action.id] && entryLists[action.id].length">
              <h3 class="entry-list-title">これまでの記録</h3>
              <div class="entry-item" v-for="entry in entryLists[action.id]" :key="entry.id">
                <p class="entry-item-name">{{ entry.name }}</p>
                <p class="entry-item-meta">{{ equipLabel(entry.equip_id) || '未分類' }} ・ {{ purchaseDateLabel(entry) }}</p>
                <p class="entry-item-memo" v-if="entry.memory">{{ entry.memory }}</p>
              </div>
            </div>
          </div>

          <div class="detail-body" v-else-if="isExternalMode && action.id === 'repair' && forms[action.id]">
            <div class="form-field">
              <label>製品名</label>
              <input type="text" v-model="forms[action.id].name" @blur="onNameBlur(action.id)" placeholder="例: 掃除機">
            </div>
            <div class="form-field" v-if="equipOptions.length">
              <label>機器カテゴリー(自動設定)</label>
              <select v-model="forms[action.id].equipId">
                <option value="">未選択</option>
                <optgroup v-for="group in equipOptions" :key="group.id" :label="group.title">
                  <option v-for="item in group.items" :key="item.id" :value="item.id">{{ item.title }}</option>
                </optgroup>
              </select>
              <p
                v-if="forms[action.id].equipSuggestedId && forms[action.id].equipId === forms[action.id].equipSuggestedId"
                class="equip-suggestion-note">
                製品名から「{{ forms[action.id].equipSuggestedTitle }}」を提案しました。違う場合は選び直してください。
              </p>
            </div>
            <p v-if="equipError" class="equip-suggestion-note">{{ equipError }}</p>
            <div class="form-field">
              <label>修理した年</label>
              <select v-model="forms[action.id].year">
                <option value="">不明</option>
                <option v-for="y in repairYearOptions" :key="y" :value="y">{{ y }}年</option>
              </select>
            </div>
            <div class="form-field">
              <label>だれが修理したか</label>
              <select v-model="forms[action.id].repairer">
                <option value="">不明</option>
                <option v-for="opt in repairerOptions" :key="opt.val" :value="opt.val">{{ opt.label }}</option>
              </select>
            </div>
            <div class="form-field">
              <label>概要(修理前の状態、修理した方法)</label>
              <textarea v-model="forms[action.id].about" rows="3"></textarea>
            </div>
            <button type="button" class="btn btn-primary" :disabled="!forms[action.id].name.trim()" @click="saveRepair(action)">記録を追加</button>

            <div class="entry-list" v-if="entryLists[action.id] && entryLists[action.id].length">
              <h3 class="entry-list-title">これまでの記録</h3>
              <div class="entry-item" v-for="entry in entryLists[action.id]" :key="entry.id">
                <p class="entry-item-name">{{ entry.productName }}</p>
                <p class="entry-item-meta">{{ repairDateLabel(entry) }}{{ entry.repairerLabel ? ' ・ ' + entry.repairerLabel : '' }}</p>
                <p class="entry-item-memo" v-if="entry.about">{{ entry.about }}</p>
              </div>
            </div>
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
