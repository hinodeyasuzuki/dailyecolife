import { loadJSON, saveJSON } from "./storage.js";
import { EXTERNAL_RECORDS_KEY } from "./external-records.js";
import { repairerLabel } from "./repairer-options.js";

const SECONDHAND_METHOD = 3;

function loadAll(store) {
  return loadJSON(store, EXTERNAL_RECORDS_KEY, {});
}

function nextId(entries, prefix) {
  let max = 0;
  for (const key of Object.keys(entries ?? {})) {
    if (!key.startsWith(prefix)) continue;
    const n = Number(key.slice(prefix.length));
    if (Number.isFinite(n) && n > max) max = n;
  }
  return `${prefix}${String(max + 1).padStart(3, "0")}`;
}

function sortByIdDesc(entries, prefix) {
  return entries.sort((a, b) => Number(b.id.slice(prefix.length)) - Number(a.id.slice(prefix.length)));
}

export function listSecondhandProducts(store) {
  const all = loadAll(store);
  const entries = Object.entries(all.products ?? {})
    .filter(([, product]) => Number(product.method) === SECONDHAND_METHOD)
    .map(([id, product]) => ({ id, ...product }));
  return sortByIdDesc(entries, "e");
}

export function listRepairLogs(store) {
  const all = loadAll(store);
  const products = all.products ?? {};
  const entries = Object.entries(all.repairlog ?? {}).map(([id, log]) => ({
    id,
    ...log,
    productName: products[log.product_id]?.name ?? "",
    repairerLabel: repairerLabel(log.repairer),
  }));
  return sortByIdDesc(entries, "l");
}

// saved-input.schema.json の products.* は全プロパティが必須(additionalProperties:false)のため、
// 未収集の項目も null/""/false/[] などスキーマ許容の既定値で必ずキーを埋める。
export function addSecondhandProduct(store, { name, equipId, purchaseyear, purchasemonth, memory }) {
  const all = loadAll(store);
  const products = { ...(all.products ?? {}) };
  const id = nextId(products, "e");
  products[id] = {
    name,
    equip_id: equipId || "",
    purchaseyear: purchaseyear ?? null,
    purchasemonth: purchasemonth ?? -1,
    method: SECONDHAND_METHOD,
    manufactureyear: null,
    room_id: "",
    watt: null,
    usagetime: null,
    maker: "",
    modelnumber: "",
    seller: "",
    frequency: null,
    enduseyear: null,
    favorite: false,
    repairlog_ids: [],
    picture_ids: [],
    memory: memory || "",
  };
  saveJSON(store, EXTERNAL_RECORDS_KEY, { ...all, products });
  return id;
}

export function addRepairLog(store, { productName, equipId, year, repairer, about }) {
  const all = loadAll(store);
  const products = { ...(all.products ?? {}) };
  const productId = nextId(products, "e");
  const repairlog = { ...(all.repairlog ?? {}) };
  const logId = nextId(repairlog, "l");

  products[productId] = {
    name: productName,
    equip_id: equipId || "",
    purchaseyear: null,
    purchasemonth: null,
    method: null,
    manufactureyear: null,
    room_id: "",
    watt: null,
    usagetime: null,
    maker: "",
    modelnumber: "",
    seller: "",
    frequency: null,
    enduseyear: null,
    favorite: false,
    repairlog_ids: [logId],
    picture_ids: [],
    memory: "",
  };
  repairlog[logId] = {
    year: year ?? null,
    month: null,
    day: null,
    product_id: productId,
    cost: null,
    repairer: repairer === "" || repairer === null || repairer === undefined ? null : Number(repairer),
    about: about || "",
    picture_ids: [],
    created_at: new Date().toISOString(),
  };

  saveJSON(store, EXTERNAL_RECORDS_KEY, { ...all, products, repairlog });
  return logId;
}

function mergePictureMetadata(all, pids) {
  const picture = { ...(all.picture ?? {}) };
  const now = new Date().toISOString();
  for (const pid of pids) {
    picture[pid] = { memo: "", created_at: now, sourceUrl: "" };
  }
  return picture;
}

export function attachPicturesToProduct(store, productId, pids) {
  if (!pids.length) return;
  const all = loadAll(store);
  const picture = mergePictureMetadata(all, pids);
  const products = { ...(all.products ?? {}) };
  const target = products[productId];
  if (target) {
    products[productId] = { ...target, picture_ids: [...(target.picture_ids ?? []), ...pids] };
  }
  saveJSON(store, EXTERNAL_RECORDS_KEY, { ...all, picture, products });
}

export function attachPicturesToRepairLog(store, logId, pids) {
  if (!pids.length) return;
  const all = loadAll(store);
  const picture = mergePictureMetadata(all, pids);
  const repairlog = { ...(all.repairlog ?? {}) };
  const target = repairlog[logId];
  if (target) {
    repairlog[logId] = { ...target, picture_ids: [...(target.picture_ids ?? []), ...pids] };
  }
  saveJSON(store, EXTERNAL_RECORDS_KEY, { ...all, picture, repairlog });
}
