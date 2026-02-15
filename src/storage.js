import { normalizeSearchText, normalizeTags } from "./filter.js";

const UI_SETTINGS_KEY = "resource_vault_ui_v1";

const LEGACY_KEYS = ["resource_vault_v4", "resource_vault_v3", "resource_vault_v2", "resource_vault_v1"];
const TYPE_VALUES = ["case", "inspiration", "article", "tool", "asset"];
const SOURCE_VALUES = ["site", "behance", "awwwards", "pinterest", "dribbble", "other"];

export function loadUiSettings() {
  try {
    const raw = localStorage.getItem(UI_SETTINGS_KEY);
    if (!raw) return { lang: "ru", sortBy: "newest" };
    const parsed = JSON.parse(raw);
    return {
      lang: parsed?.lang === "en" ? "en" : "ru",
      sortBy: typeof parsed?.sortBy === "string" ? parsed.sortBy : "newest"
    };
  } catch {
    return { lang: "ru", sortBy: "newest" };
  }
}

export function saveUiSettings(settings) {
  const payload = {
    lang: settings?.lang === "en" ? "en" : "ru",
    sortBy: typeof settings?.sortBy === "string" ? settings.sortBy : "newest"
  };
  localStorage.setItem(UI_SETTINGS_KEY, JSON.stringify(payload));
}

export function loadLegacyVault() {
  for (const key of LEGACY_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      return migrateToV4(JSON.parse(raw));
    } catch {}
  }
  return null;
}

export function migrateToV4(raw) {
  const sourceItems = Array.isArray(raw?.items) ? raw.items : [];
  const sourceCollections = Array.isArray(raw?.collections) ? raw.collections : [];

  const collections = sourceCollections
    .map((col) => normalizeCollection(col))
    .filter(Boolean);

  const collectionIds = new Set(collections.map((col) => col.id));

  const items = sourceItems
    .map((item) => normalizeLink(item, collectionIds))
    .filter((item) => item.id && item.url);

  const itemById = new Map(items.map((item) => [item.id, item]));
  for (const col of sourceCollections) {
    if (!col?.id || !Array.isArray(col.itemIds)) continue;
    for (const itemId of col.itemIds) {
      const item = itemById.get(String(itemId));
      if (!item || !collectionIds.has(String(col.id))) continue;
      if (!item.collectionIds.includes(String(col.id))) item.collectionIds.push(String(col.id));
    }
  }

  return {
    version: 4,
    lang: raw?.lang === "en" ? "en" : "ru",
    sortBy: typeof raw?.sortBy === "string" ? raw.sortBy : "newest",
    recentViewedIds: normalizeRecent(raw?.recentViewedIds ?? raw?.viewHistory ?? []),
    items,
    collections,
    savedFilters: []
  };
}

function normalizeCollection(col) {
  const id = String(col?.id || "");
  if (!id || id === "all" || id === "fav") return null;

  const name = String(col?.name || "Collection");
  const description = String(col?.description || "");
  const createdAt = toTimestamp(col?.createdAt);
  const updatedAt = toTimestamp(col?.updatedAt ?? col?.createdAt);

  return {
    id,
    name,
    description,
    kind: "manual",
    createdAt,
    updatedAt
  };
}

function normalizeLink(item, validCollectionIds) {
  const now = Date.now();
  const createdAt = toTimestamp(item?.createdAt, now);
  const updatedAt = toTimestamp(item?.updatedAt ?? item?.createdAt, createdAt);

  const candidateIds = [];
  if (Array.isArray(item?.collectionIds)) candidateIds.push(...item.collectionIds);
  if (Array.isArray(item?.collections)) candidateIds.push(...item.collections);
  if (item?.collectionId) candidateIds.push(item.collectionId);

  const collectionIds = [...new Set(candidateIds.map((id) => String(id)).filter((id) => validCollectionIds.has(id)))];

  return {
    id: String(item?.id || ""),
    url: String(item?.url || ""),
    title: String(item?.title || ""),
    previewImage: String(item?.previewImage || ""),
    note: String(item?.note || ""),
    favorite: !!item?.favorite,
    type: normalizeType(item?.type),
    source: normalizeSource(item?.source),
    tags: normalizeTags(item?.tags || []),
    createdAt,
    updatedAt,
    collectionIds
  };
}

function normalizeType(value) {
  const map = {
    project: "case",
    studio: "case",
    designer: "case",
    inspiration: "inspiration",
    source: "case",
    case: "case",
    article: "article",
    tool: "tool",
    asset: "asset"
  };

  if (value == null || value === "") return null;
  const normalized = map[String(value).trim().toLowerCase()] || String(value).trim().toLowerCase();
  return TYPE_VALUES.includes(normalized) ? normalized : null;
}

function normalizeSource(value) {
  const map = {
    site: "site",
    behance: "behance",
    awwwards: "awwwards",
    pinterest: "pinterest",
    dribbble: "dribbble",
    other: "other"
  };

  if (value == null || value === "") return null;
  const normalized = map[String(value).trim().toLowerCase()] || String(value).trim().toLowerCase();
  return SOURCE_VALUES.includes(normalized) ? normalized : null;
}

function toTimestamp(value, fallback = Date.now()) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}

function normalizeRecent(input) {
  if (!Array.isArray(input)) return [];
  return [...new Set(input.map((x) => String(x || "").trim()).filter(Boolean))].slice(0, 100);
}

export { normalizeSearchText };
