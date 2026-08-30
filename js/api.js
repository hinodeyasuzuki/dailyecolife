const BASE_URL = "https://hinodeyasuzuki.github.io/homeenergycodes-public/api/v1/";

export const INPUT_JSON_URL = `${BASE_URL}input.json`;
export const ENERGY_JSON_URL = `${BASE_URL}energy.json`;
export const ENERGYCOST_JSON_URL = `${BASE_URL}energycost.json`;
export const EQUIP_JSON_URL = `${BASE_URL}equip.json`;

export async function fetchInputItems(fetchFn) {
  const response = await fetchFn(INPUT_JSON_URL);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

export async function fetchEnergyCodes(fetchFn) {
  const response = await fetchFn(ENERGY_JSON_URL);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

export async function fetchEnergyCostCodes(fetchFn) {
  const response = await fetchFn(ENERGYCOST_JSON_URL);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

export async function fetchEquipItems(fetchFn) {
  const response = await fetchFn(EQUIP_JSON_URL);
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}
