import { loadJSON } from "./storage.js";

export const EXTERNAL_RECORDS_KEY = "homeenergycodes.savedInput";

export function externalActionCount(store, actionId) {
  const data = loadJSON(store, EXTERNAL_RECORDS_KEY, {});
  if (actionId === "repair") {
    return Object.keys(data.repairlog ?? {}).length;
  }
  if (actionId === "secondhand") {
    return Object.values(data.products ?? {}).filter((product) => [3, 4, 5].includes(Number(product.method))).length;
  }
  return 0;
}