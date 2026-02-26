const ENV = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};
const SUPABASE_URL = String(ENV.VITE_SUPABASE_URL || "").trim();
const SUPABASE_PUBLISHABLE_KEY = String(ENV.VITE_SUPABASE_ANON_KEY || "").trim();
const TABLE = "vault_states";
const AUTH_SESSION_KEY = "resource_vault_auth_session";
const API_PREFIX = "/rest/v1/";
const FETCH_TIMEOUT_MS = 9000;
const RETRY_BASE_MS = 220;
const RETRY_ATTEMPTS_GET = 3;
let lastAuthIssue = null;

function setAuthIssue(code, message) {
  lastAuthIssue = {
    code: String(code || "AUTH_ERROR"),
    message: String(message || "Authentication failed")
  };
}

function clearAuthIssue() {
  lastAuthIssue = null;
}

export function getAuthIssue() {
  return lastAuthIssue;
}

function makeSupabaseError(code, message, retriable = false, details = "") {
  const err = new Error(String(message || "Supabase error"));
  err.code = String(code || "SUPABASE_ERROR");
  err.retriable = !!retriable;
  err.details = String(details || "");
  return err;
}

function normalizeRequestError(err) {
  if (!err) return makeSupabaseError("SUPABASE_ERROR", "Unknown Supabase error", false);
  if (err.code) return err;
  const message = String(err.message || "Unknown Supabase error");
  if (err.name === "AbortError") return makeSupabaseError("NETWORK_TIMEOUT", "Request timed out", true, message);
  return makeSupabaseError("NETWORK_ERROR", message, true, message);
}

function canRetryRequest(method, err, attempt) {
  if (String(method || "GET").toUpperCase() !== "GET") return false;
  if (attempt >= RETRY_ATTEMPTS_GET) return false;
  return !!err?.retriable;
}

function waitMs(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function retryDelayMs(attempt) {
  const jitter = Math.floor(Math.random() * 120);
  return RETRY_BASE_MS * (2 ** Math.max(0, attempt - 1)) + jitter;
}

async function fetchWithTimeout(url, options = {}, timeoutMs = FETCH_TIMEOUT_MS) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, { ...options, signal: controller.signal });
  } finally {
    clearTimeout(timer);
  }
}

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

function isLikelyJwt(token) {
  const raw = String(token || "").trim();
  if (!raw) return false;
  const parts = raw.split(".");
  return parts.length === 3 && parts.every((x) => x.length > 0);
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
  clearAuthIssue();

  const cleanUrl = `${window.location.pathname}${window.location.search}`;
  window.history.replaceState({}, "", cleanUrl);
  return true;
}

export async function ensureValidSession() {
  const session = getSession();
  if (!session?.access_token || !session?.refresh_token) return null;
  const accessToken = String(session.access_token || "").trim();
  const tokenNotExpired = Number(session.expires_at || 0) > Date.now();
  const tokenLooksValid = isLikelyJwt(accessToken) && !!getUserIdFromAccessToken(accessToken);
  if (tokenNotExpired && tokenLooksValid) return session;

  const url = `${SUPABASE_URL}/auth/v1/token?grant_type=refresh_token`;
  let res = null;
  try {
    res = await fetchWithTimeout(url, {
      method: "POST",
      headers: supabaseHeaders(),
      body: JSON.stringify({ refresh_token: session.refresh_token })
    });
  } catch (err) {
    throw normalizeRequestError(err);
  }

  if (!res.ok) {
    clearSession();
    setAuthIssue("SESSION_EXPIRED", "Session expired, please sign in again.");
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

  if (!refreshed.access_token || !isLikelyJwt(refreshed.access_token) || !getUserIdFromAccessToken(refreshed.access_token)) {
    clearSession();
    setAuthIssue("SESSION_EXPIRED", "Session expired, please sign in again.");
    return null;
  }

  setSession(refreshed);
  clearAuthIssue();
  return refreshed;
}

export async function getCurrentUser() {
  if (!isSupabaseConfigured()) return null;
  const session = await ensureValidSession();
  if (!session?.access_token) return null;

  let res = null;
  try {
    res = await fetchWithTimeout(`${SUPABASE_URL}/auth/v1/user`, {
      method: "GET",
      headers: {
        ...supabaseHeaders(),
        Authorization: `Bearer ${session.access_token}`
      }
    });
  } catch (err) {
    throw normalizeRequestError(err);
  }

  if (!res.ok) {
    clearSession();
    if (res.status === 401 || res.status === 403) {
      setAuthIssue("SESSION_EXPIRED", "Session expired, please sign in again.");
    }
    return null;
  }

  clearAuthIssue();
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
  if (!isSupabaseConfigured()) {
    throw makeSupabaseError("SUPABASE_CONFIG", "Supabase is not configured", false);
  }

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
    if (!token) {
      setAuthIssue("SESSION_EXPIRED", "Session expired, please sign in again.");
      throw makeSupabaseError("SESSION_EXPIRED", "Session expired, please sign in again.", false);
    }
  }

  const url = `${SUPABASE_URL}${path}${toQueryString(query)}`;
  const headers = {
    ...supabaseHeaders(),
    ...(allowAnonymous ? {} : { Authorization: `Bearer ${token}` }),
    ...(prefer ? { Prefer: prefer } : {})
  };

  const runOnce = async () => {
    let res = null;
    try {
      res = await fetchWithTimeout(url, {
        method,
        headers,
        body: body == null ? undefined : JSON.stringify(body)
      });
    } catch (err) {
      throw normalizeRequestError(err);
    }

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const details = text || "Unknown error";
      if (res.status === 401 || res.status === 403) {
        setAuthIssue("SESSION_EXPIRED", "Session expired, please sign in again.");
        clearSession();
        throw makeSupabaseError("SESSION_EXPIRED", "Session expired, please sign in again.", false, details);
      }
      if (res.status >= 500) {
        throw makeSupabaseError("SUPABASE_SERVER", `Server error (${res.status})`, true, details);
      }
      throw makeSupabaseError("SUPABASE_HTTP", `Supabase request failed (${res.status})`, false, details);
    }

    if (res.status === 204) return null;
    const ctype = res.headers.get("content-type") || "";
    if (!ctype.includes("application/json")) return null;
    return await res.json();
  };

  for (let attempt = 1; attempt <= RETRY_ATTEMPTS_GET; attempt += 1) {
    try {
      return await runOnce();
    } catch (err) {
      const normalized = normalizeRequestError(err);
      if (!canRetryRequest(method, normalized, attempt)) throw normalized;
      await waitMs(retryDelayMs(attempt));
    }
  }
  throw makeSupabaseError("NETWORK_ERROR", "Request failed after retries", true);
}

export function restPath(tableName) {
  return `${API_PREFIX}${tableName}`;
}

export async function signOut() {
  const session = getSession();
  clearSession();
  clearAuthIssue();
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
