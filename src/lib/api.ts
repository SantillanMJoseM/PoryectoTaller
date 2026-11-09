// ============================================================================
// Sistema Taller — Cliente HTTP para el backend propio (migración PostgreSQL)
// ============================================================================
const BASE = (import.meta.env.VITE_API_URL as string | undefined)?.trim() || "";

export const API_URL = BASE;

function token(): string | null {
  return localStorage.getItem("st_access_token");
}
function refreshToken(): string | null {
  return localStorage.getItem("st_refresh_token");
}
export function setTokens(access: string, refresh?: string) {
  localStorage.setItem("st_access_token", access);
  if (refresh) localStorage.setItem("st_refresh_token", refresh);
}
export function clearTokens() {
  localStorage.removeItem("st_access_token");
  localStorage.removeItem("st_refresh_token");
}

export async function apiFetch(path: string, init: RequestInit = {}): Promise<any> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...(init.headers as any),
  };
  const t = token();
  if (t) headers["Authorization"] = `Bearer ${t}`;
  let res = await fetch(`${BASE}${path}`, { ...init, headers });
  if (res.status === 401 && refreshToken()) {
    // intentar refresh
    const r = await fetch(`${BASE}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refreshToken: refreshToken() }),
    });
    if (r.ok) {
      const d = await r.json();
      setTokens(d.access_token, d.refresh_token);
      headers["Authorization"] = `Bearer ${d.accessToken}`;
      res = await fetch(`${BASE}${path}`, { ...init, headers });
    } else {
      clearTokens();
    }
  }
  if (!res.ok) {
    let msg = `HTTP ${res.status}`;
    try { const j = await res.json(); msg = j.error ?? msg; } catch {}
    throw new Error(msg);
  }
  if (res.status === 204) return null;
  return res.json();
}

export const api = {
  get: (p: string) => apiFetch(p),
  post: (p: string, b?: any) => apiFetch(p, { method: "POST", body: JSON.stringify(b ?? {}) }),
  put: (p: string, b?: any) => apiFetch(p, { method: "PUT", body: JSON.stringify(b ?? {}) }),
  del: (p: string) => apiFetch(p, { method: "DELETE" }),
};
