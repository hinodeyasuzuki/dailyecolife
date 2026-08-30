export const REPAIRER_OPTIONS = [
  { val: 1, label: "自分" },
  { val: 2, label: "家族・友人" },
  { val: 3, label: "修理施設" },
  { val: 4, label: "修理業者" },
];

export function repairerLabel(val) {
  if (val === null || val === undefined || val === "") return "";
  return REPAIRER_OPTIONS.find((o) => o.val === Number(val))?.label ?? "";
}
