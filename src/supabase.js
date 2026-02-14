const SUPABASE_URL = "https://rxgyynzyamkuollsufll.supabase.co";
const SUPABASE_PUBLISHABLE_KEY = "sb_publishable_l6IrycSm6Df5cGITO5CYog_Ael8f768";
const TABLE = "vault_states";
const STORAGE_ID_KEY = "resource_vault_device_id";

function canUseBrowserStorage() {
  return typeof localStorage !== "undefined";
}

function getDeviceId() {
  if (!canUseBrowserStorage()) return "server";

  const existing = localStorage.getItem(STORAGE_ID_KEY);
  if (existing) return existing;

  const generated = typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
    ? crypto.randomUUID()
    : `device_${Date.now()}_${Math.random().toString(16).slice(2)}`;

  localStorage.setItem(STORAGE_ID_KEY, generated);
  return generated;
}

function supabaseHeaders() {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${SUPABASE_PUBLISHABLE_KEY}`,
    "Content-Type": "application/json"
  };
}

export function isSupabaseConfigured() {
  return Boolean(SUPABASE_URL && SUPABASE_PUBLISHABLE_KEY);
}

export async function loadCloudState() {
  if (!isSupabaseConfigured() || typeof fetch === "undefined") return null;

  const deviceId = getDeviceId();
  const url = `${SUPABASE_URL}/rest/v1/${TABLE}?select=payload&id=eq.${encodeURIComponent(deviceId)}&limit=1`;

  const res = await fetch(url, {
    method: "GET",
    headers: { ...supabaseHeaders(), Prefer: "return=representation" }
  });

  if (!res.ok) throw new Error(`Cloud load failed (${res.status})`);
  const rows = await res.json();
  return rows?.[0]?.payload || null;
}

export async function saveCloudState(payload) {
  if (!isSupabaseConfigured() || typeof fetch === "undefined") return;

  const deviceId = getDeviceId();
  const url = `${SUPABASE_URL}/rest/v1/${TABLE}?on_conflict=id`;
  const body = JSON.stringify([
    {
      id: deviceId,
      payload,
      updated_at: new Date().toISOString()
    }
  ]);

  const res = await fetch(url, {
    method: "POST",
    headers: { ...supabaseHeaders(), Prefer: "resolution=merge-duplicates,return=minimal" },
    body
  });

  if (!res.ok) throw new Error(`Cloud save failed (${res.status})`);
}
