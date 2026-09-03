const DEFAULT_API_URL = new URL("../../api/mysql-api.php", import.meta.url).href;

function photoUrl(apiUrl, id) {
  const query = id ? `&id=${encodeURIComponent(id)}` : "&meta=1";
  return `${apiUrl}?resource=photo${query}`;
}

async function requireOk(response) {
  if (!response.ok) throw new Error(`写真API ${response.status}`);
  return response;
}

export async function putPhoto(pid, dataUrl, { apiUrl = DEFAULT_API_URL, fetchFn = fetch } = {}) {
  const response = await fetchFn(photoUrl(apiUrl, pid), {
    method: "PUT",
    credentials: "same-origin",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ dataUrl }),
  });
  await requireOk(response);
  return response.json();
}

export async function deletePhoto(pid, { apiUrl = DEFAULT_API_URL, fetchFn = fetch } = {}) {
  const response = await fetchFn(photoUrl(apiUrl, pid), { method: "DELETE", credentials: "same-origin" });
  await requireOk(response);
  return response.json();
}

export async function listServerPhotoIds({ apiUrl = DEFAULT_API_URL, fetchFn = fetch } = {}) {
  const response = await fetchFn(photoUrl(apiUrl, null), { credentials: "same-origin" });
  await requireOk(response);
  const data = await response.json();
  return (data.photos || []).map((p) => p.photo_id);
}

export async function fetchPhotoAsDataUrl(pid, { apiUrl = DEFAULT_API_URL, fetchFn = fetch } = {}) {
  const response = await fetchFn(photoUrl(apiUrl, pid), { credentials: "same-origin" });
  await requireOk(response);
  const blob = await response.blob();
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = () => reject(reader.error || new Error("写真の読み込みに失敗しました"));
    reader.readAsDataURL(blob);
  });
}
