const API_URL = new URL("../../api/mysql-api.php", import.meta.url).href;

export async function getCurrentTenant() {
  const response = await fetch(`${API_URL}?resource=tenant&current=1`, {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`API ${response.status}`);
  const result = await response.json();
  return result.tenant ?? null;
}

export async function getTenant(code) {
  const response = await fetch(`${API_URL}?resource=tenant&code=${encodeURIComponent(code)}`, {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`API ${response.status}`);
  const result = await response.json();
  return result.tenant ?? null;
}

export async function clearCurrentTenant() {
  const response = await fetch(`${API_URL}?resource=tenant&clear=1`, {
    credentials: "same-origin",
  });
  if (!response.ok) throw new Error(`API ${response.status}`);
  return response.json();
}