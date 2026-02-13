import { normalizeSearchText, normalizeTags } from "./filter.js";

const KEY_V4 = "resource_vault_v4";
const LEGACY_KEYS = ["resource_vault_v3", "resource_vault_v2", "resource_vault_v1"];

const TYPE_VALUES = ["Project", "Studio", "Designer", "Inspiration", "Source"];
const SOURCE_VALUES = ["Site", "Behance", "Awwwards", "Pinterest", "Dribbble", "Other"];

export function load() {
  try {
    const raw4 = localStorage.getItem(KEY_V4);
    if (raw4) return JSON.parse(raw4);
  } catch {}

  for (const key of LEGACY_KEYS) {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) continue;
      const migrated = migrateToV4(JSON.parse(raw));
      localStorage.setItem(KEY_V4, JSON.stringify(migrated));
      return migrated;
    } catch {}
  }

  return null;
}

export function save(data) {
  localStorage.setItem(KEY_V4, JSON.stringify({ version: 4, ...data }));
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
    items,
    collections
  };
}

function normalizeCollection(col) {
  const id = String(col?.id || "");
  if (!id || id === "all" || id === "fav") return null;

  const name = String(col?.name || "Collection");
  const description = String(col?.description || "");
  const createdAt = toTimestamp(col?.createdAt);
  const updatedAt = toTimestamp(col?.updatedAt ?? col?.createdAt);

  const rules = normalizeRules(col?.rules);
  const legacyRulesEnabled = !!(col?.rulesEnabled ?? col?.mode === "smart" ?? false);
  const hasRules = hasRuleCriteria(rules);
  const kind = String(col?.kind || "").toLowerCase() === "smart" || legacyRulesEnabled || hasRules ? "smart" : "manual";

  return {
    id,
    name,
    description,
    kind,
    rules: kind === "smart" ? rules : undefined,
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

function normalizeRules(rules) {
  return {
    types: normalizeRuleList(rules?.types, normalizeType),
    sources: normalizeRuleList(rules?.sources, normalizeSource),
    requiredTags: normalizeTags(rules?.requiredTags ?? rules?.tagsAll ?? rules?.allTags ?? []),
    anyTags: normalizeTags(rules?.anyTags ?? rules?.tagsAny ?? []),
    containsText: normalizeSearchText(rules?.containsText ?? rules?.textContains ?? rules?.query ?? ""),
    onlyFavorites: !!(rules?.onlyFavorites ?? rules?.onlyFavorite ?? rules?.favoriteOnly)
  };
}

function normalizeRuleList(input, mapper) {
  if (!Array.isArray(input)) return [];
  return [...new Set(input.map(mapper).filter(Boolean))];
}

function hasRuleCriteria(rules) {
  return Boolean(
    rules.onlyFavorites ||
    rules.containsText ||
    rules.types.length ||
    rules.sources.length ||
    rules.requiredTags.length ||
    rules.anyTags.length
  );
}

function normalizeType(value) {
  const map = {
    project: "Project",
    studio: "Studio",
    designer: "Designer",
    inspiration: "Inspiration",
    source: "Source"
  };

  if (value == null || value === "") return null;
  const normalized = map[String(value).trim().toLowerCase()] || String(value).trim();
  return TYPE_VALUES.includes(normalized) ? normalized : null;
}

function normalizeSource(value) {
  const map = {
    site: "Site",
    behance: "Behance",
    awwwards: "Awwwards",
    pinterest: "Pinterest",
    dribbble: "Dribbble",
    other: "Other"
  };

  if (value == null || value === "") return null;
  const normalized = map[String(value).trim().toLowerCase()] || String(value).trim();
  return SOURCE_VALUES.includes(normalized) ? normalized : null;
}

function toTimestamp(value, fallback = Date.now()) {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
