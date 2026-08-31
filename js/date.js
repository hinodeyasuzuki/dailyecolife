export function todayDateKey() {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

export function todayDisplayDate() {
  const d = new Date();
  return `${d.getMonth() + 1}月${d.getDate()}日`;
}

export function dateKeyWeekday(dateKey) {
  const year = Number(dateKey.slice(0, 4));
  const month = Number(dateKey.slice(4, 6));
  const day = Number(dateKey.slice(6, 8));
  return new Date(year, month - 1, day).getDay();
}

export function todayMonthKey() {
  return todayDateKey().slice(0, 6);
}

export function dateKeyDaysAgo(days) {
  const d = new Date();
  d.setDate(d.getDate() - days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${day}`;
}

export function monthKeyAddMonths(monthKey, diff) {
  const year = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(4, 6));
  const d = new Date(year, month - 1 + diff, 1);
  return `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function daysInMonth(monthKey) {
  const year = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(4, 6));
  return new Date(year, month, 0).getDate();
}

export function monthKeyLabel(monthKey) {
  const year = Number(monthKey.slice(0, 4));
  const month = Number(monthKey.slice(4, 6));
  return `${year}年${month}月`;
}

export function addDaysToDateKey(dateKey, days) {
  const year = Number(dateKey.slice(0, 4));
  const month = Number(dateKey.slice(4, 6));
  const day = Number(dateKey.slice(6, 8));
  const d = new Date(year, month - 1, day + days);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}${m}${dd}`;
}

export function dateKeyLabel(dateKey) {
  const month = Number(dateKey.slice(4, 6));
  const day = Number(dateKey.slice(6, 8));
  return `${month}月${day}日`;
}
