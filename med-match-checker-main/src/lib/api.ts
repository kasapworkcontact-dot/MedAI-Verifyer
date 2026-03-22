const BASE_URL = import.meta.env.VITE_API_URL || (import.meta.env.PROD ? "" : "http://localhost:5000");

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    credentials: "include",
    headers: { "Content-Type": "application/json", ...options.headers },
    ...options,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Request failed");
  return json as T;
}

export async function register(data: {
  username: string;
  email: string;
  password: string;
}) {
  return request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function login(data: { email: string; password: string }) {
  return request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export async function logout() {
  return request("/api/auth/logout", { method: "POST" });
}

export async function getMe() {
  return request<{ user: { id: number; username: string; email: string } }>(
    "/api/auth/me"
  );
}

export async function runDetect(formData: FormData) {
  const res = await fetch(`${BASE_URL}/api/detect`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "Detection failed");
  return json;
}

export async function runOCR(formData: FormData) {
  const res = await fetch(`${BASE_URL}/api/ocr`, {
    method: "POST",
    credentials: "include",
    body: formData,
  });
  const json = await res.json();
  if (!res.ok) throw new Error(json.error || "OCR failed");
  return json;
}

export async function getCrops(sessionId: string) {
  return request<{ crops: any[] }>(`/api/crops?session_id=${sessionId}`);
}

export function getCropUrl(filename: string) {
  return `${BASE_URL}/api/crops/${filename}`;
}

export async function saveLabel(cropId: number, humanLabel: string) {
  return request("/api/label", {
    method: "POST",
    body: JSON.stringify({ crop_id: cropId, human_label: humanLabel }),
  });
}

export async function getSessionSummary(sessionId: string) {
  return request<{ session_id: string; comparison: any[] }>(
    `/api/session/${sessionId}/summary`
  );
}

export async function saveFinalResults(sessionId: string, results: any[]) {
  return request("/api/final", {
    method: "POST",
    body: JSON.stringify({ session_id: sessionId, results }),
  });
}

export async function getHistory() {
  return request<{ sessions: any[] }>("/api/history");
}
