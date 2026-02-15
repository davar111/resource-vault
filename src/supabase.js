const ENV = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};
const SUPABASE_URL = String(ENV.VITE_SUPABASE_URL || "").trim();
const SUPABASE_PUBLISHABLE_KEY = String(ENV.VITE_SUPABASE_ANON_KEY || "").trim();
const TABLE = "vault_states";
const AUTH_SESSION_KEY = "resource_vault_auth_session";
const API_PREFIX = "/rest/v1/";

function canUseBrowserStorage() {
  return typeof localStorage !== "undefined";
}

function getSession() {
  if (!canUseBrowserStorage()) return null;

  try {
    const raw = localStorage.getItem(AUTH_SESSION_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function setSession(session) {
  if (!canUseBrowserStorage()) return;
  localStorage.setItem(AUTH_SESSION_KEY, JSON.stringify(session));
}

function clearSession() {
  if (!canUseBrowserStorage()) return;
  localStorage.removeItem(AUTH_SESSION_KEY);
}

function decodeBase64Url(input) {
  const normalized = input.replace(/-/g, "+").replace(/_/g, "/");
  const padded = `${normalized}${"=".repeat((4 - (normalized.length % 4)) % 4)}`;

  if (typeof atob === "function") return atob(padded);
  if (typeof Buffer !== "undefined") return Buffer.from(padded, "base64").toString("utf8");
  return "";
}

function getUserIdFromAccessToken(accessToken) {
  if (!accessToken || !String(accessToken).includes(".")) return null;

  try {
    const payload = JSON.parse(decodeBase64Url(String(accessToken).split(".")[1]));
    const sub = String(payload?.sub || "").trim();
    return sub || null;
  } catch {
    return null;
  }
}

function getVaultRowId(session) {
  const userId = getUserIdFromAccessToken(session?.access_token);
  return userId ? `user_${userId}` : null;
}

function supabaseHeaders() {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
    "Content-Type": "application/json"
  };
}

function toQueryString(query = {}) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(query || {})) {
    if (value == null) continue;
    params.set(key, String(value));
  }
  const s = params.toString();
  return s ? `?${s}` : "";
}

export function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
}

export function getSupabaseConfigError() {
  if (!SUPABASE_URL) return "Missing VITE_SUPABASE_URL";
  if (!SUPABASE_PUBLISHABLE_KEY) return "Missing VITE_SUPABASE_ANON_KEY";
  return "";
}

function authRedirectUrl() {
  if (typeof window === "undefined") return "";
  return `${window.location.origin}${window.location.pathname}`;
}

export function signInWithGoogle() {
  if (!isSupabaseConfigured() || typeof window === "undefined") return false;
  const redirectTo = encodeURIComponent(authRedirectUrl());
  const url = `${SUPABASE_URL}/auth/v1/authorize?provider=google&redirect_to=${redirectTo}`;
  window.location.assign(url);
  return true;
}

export async function completeAuthFromUrl() {
  if (typeof window === "undefined") return false;
  const hash = String(window.location.hash || "");
  if (!hash.startsWith("#")) return false;

  const params = new URLSearchParams(hash.slice(1));
  const accessToken = String(params.get("access_token") || "");
  const refreshToken = String(params.get("refresh_token") || "");
  if (!accessToken || !refreshToken) return false;

  const expiresIn = Number(params.get("expires_in") || 3600);
  const session = {
    access_token: accessToken,
    refresh_token: refreshToken,
    token_type: String(params.get("token_type") || "bearer"),
    expires_at: Date.now() + Math.max(1, expiresIn - 30) * 1000
  };
  setSession(session);

  const cleanUrl = `${window.location.pathname}${window.location.search}`;
  window.history.replaceState({}, "", cleanUrl);
  return true;
}

export async function ensureValidSession() {
  const session = getSession();
  if (!session?.access_token || !session?.refresh_token) return null;
  if (session.expires_at && session.expires_at > Date.now()) return session;

  const url = `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`;
  const res = await fetch(url, {
    method: "POST",
    headers: supabaseHeaders(),
    body: JSON.stringify({ refresh_token: session.refresh_token })
  });

  if (!res.ok) {
    clearSession();
    return null;
  }

  const next = await res.json();
  const expiresIn = Number(next?.expires_in || 3600);
  const refreshed = {
    access_token: String(next?.access_token || ""),
    refresh_token: String(next?.refresh_token || session.refresh_token),
    token_type: String(next?.token_type || "bearer"),
    expires_at: Date.now() + Math.max(1, expiresIn - 30) * 1000
  };

  if (!refreshed.access_token) {
    clearSession();
    return null;
  }

  setSession(refreshed);
  return refreshed;
}

export async function getCurrentUser() {
  if (!isSupabaseConfigured()) return null;
  const session = await ensureValidSession();
  if (!session?.access_token) return null;

  const res = await fetch(`${SUPABASE_URL}/auth/v1/user`, {
    method: "GET",
    headers: {
      ...supabaseHeaders(),
      Authorization: `Bearer ${session.access_token}`
    }
  });

  if (!res.ok) {
    clearSession();
    return null;
  }

  return await res.json();
}

export async function getSessionAccessToken() {
  const session = await ensureValidSession();
  return session?.access_token || "";
}

export async function getSessionUserId() {
  const session = await ensureValidSession();
  return getUserIdFromAccessToken(session?.access_token) || "";
}

export async function supabaseRequest(path, options = {}) {
  if (!isSupabaseConfigured()) throw new Error("Supabase is not configured");

  const {
    method = "GET",
    query = {},
    body = undefined,
    prefer = "",
    allowAnonymous = false
  } = options;

  let token = "";
  if (!allowAnonymous) {
    token = await getSessionAccessToken();
    if (!token) throw new Error("Not authenticated");
  }

  const url = `${SUPABASE_URL}${path}${toQueryString(query)}`;
  const headers = {
    ...supabaseHeaders(),
    ...(allowAnonymous ? {} : { Authorization: `Bearer ${token}` }),
    ...(prefer ? { Prefer: prefer } : {})
  };

  const res = await fetch(url, {
    method,
    headers,
    body: body == null ? undefined : JSON.stringify(body)
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Supabase ${method} ${path} failed (${res.status}): ${text || "Unknown error"}`);
  }

  if (res.status === 204) return null;
  const ctype = res.headers.get("content-type") || "";
  if (!ctype.includes("application/json")) return null;
  return await res.json();
}

export function restPath(tableName) {
  return `${API_PREFIX}${tableName}`;
}

export async function signOut() {
  const session = getSession();
  clearSession();
  if (!session?.access_token || !isSupabaseConfigured()) return;

  await fetch(`${SUPABASE_URL}/auth/v1/logout`, {
    method: "POST",
    headers: {
      ...supabaseHeaders(),
      Authorization: `Bearer ${session.access_token}`
    }
  }).catch(() => {});
}

export async function loadCloudState() {
  if (!isSupabaseConfigured() || typeof fetch === "undefined") return null;

  const session = await ensureValidSession();
  const rowId = getVaultRowId(session);
  if (!session?.access_token || !rowId) return null;
  const url = `${SUPABASE_URL}/rest/v1/${TABLE}?select=payload&id=eq.${encodeURIComponent(rowId)}&limit=1`;

  const res = await fetch(url, {
    method: "GET",
    headers: {
      ...supabaseHeaders(),
      Authorization: `Bearer ${session.access_token}`,
      Prefer: "return=representation"
    }
  });

  if (!res.ok) throw new Error(`Cloud load failed (${res.status})`);
  const rows = await res.json();
  return rows?.[0]?.payload || null;
}

export async function saveCloudState(payload) {
  if (!isSupabaseConfigured() || typeof fetch === "undefined") return;

  const session = await ensureValidSession();
  const rowId = getVaultRowId(session);
  if (!session?.access_token || !rowId) return;
  const url = `${SUPABASE_URL}/rest/v1/${TABLE}?on_conflict=id`;
  const body = JSON.stringify([
    {
      id: rowId,
      payload,
      updated_at: new Date().toISOString()
    }
  ]);

  const res = await fetch(url, {
    method: "POST",
    headers: {
      ...supabaseHeaders(),
      Authorization: `Bearer ${session.access_token}`,
      Prefer: "resolution=merge-duplicates,return=minimal"
    },
    body
  });

  if (!res.ok) throw new Error(`Cloud save failed (${res.status})`);
}
