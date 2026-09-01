const API_URL = new URL("../../api/mysql-api.php", import.meta.url).href;
const AUTH_START_URL = new URL("../../api/auth-google-start.php", import.meta.url).href;

export function googleLoginUrl() {
  return AUTH_START_URL;
}

export async function getCurrentUser() {
  const response = await fetch(`${API_URL}?resource=auth&current=1`, {
    credentials: "same-origin",
    headers: { Accept: "application/json" },
  });
  if (!response.ok) throw new Error(`API ${response.status}`);
  const result = await response.json();
  return result.user ?? null;
}

export async function logout() {
  const response = await fetch(`${API_URL}?resource=auth&logout=1`, {
    credentials: "same-origin",
  });
  if (!response.ok) throw new Error(`API ${response.status}`);
  return response.json();
}
