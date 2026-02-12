const KEY_V3 = "resource_vault_v3";
const KEY_V2 = "resource_vault_v2";
const KEY_V1 = "resource_vault_v1";

export function load() {
  try {
    const raw3 = localStorage.getItem(KEY_V3);
    if (raw3) return JSON.parse(raw3);
  } catch {}

  try {
    const raw2 = localStorage.getItem(KEY_V2);
    if (raw2) {
      const v2 = JSON.parse(raw2);
      const migrated = migrateToV3(v2);
      localStorage.setItem(KEY_V3, JSON.stringify(migrated));
      return migrated;
    }
  } catch {}

  try {
    const raw1 = localStorage.getItem(KEY_V1);
    if (raw1) {
      const v1 = JSON.parse(raw1);
      const migrated = migrateToV3(v1);
      localStorage.setItem(KEY_V3, JSON.stringify(migrated));
      return migrated;
    }
  } catch {}

  return null;
}

export function save(data) {
  localStorage.setItem(KEY_V3, JSON.stringify({ version: 3, ...data }));
}

function migrateToV3(raw) {
  const sourceItems = Array.isArray(raw?.items) ? raw.items : [];
  const sourceCollections = Array.isArray(raw?.collections) ? raw.collections : [];

  const collections = [];
  const byId = new Map();

  for (const col of sourceCollections) {
    if (!col?.id) continue;
    if (col.id === "all" || col.id === "fav") continue;

    const rules = normalizeRules(col.rules);
    const rulesEnabled = Boolean((col.rulesEnabled ?? hasRuleCriteria(rules)) || col.mode === "smart");

    const next = {
      id: col.id,
      name: String(col.name || "Collection"),
      description: String(col.description || ""),
      manual: true,
      rulesEnabled,
      rules
    };

    collections.push(next);
    byId.set(next.id, next);
  }

  const items = sourceItems.map((it) => ({
    id: String(it?.id || ""),
    url: String(it?.url || ""),
    title: String(it?.title || ""),
    previewImage: String(it?.previewImage || ""),
    tags: Array.isArray(it?.tags) ? it.tags.map((x) => String(x)) : [],
    type: String(it?.type || "project"),
    source: String(it?.source || "site"),
    note: String(it?.note || ""),
    favorite: !!it?.favorite,
    createdAt: Number(it?.createdAt || Date.now()),
    collections: Array.isArray(it?.collections) ? [...new Set(it.collections.map((x) => String(x)))] : []
  })).filter((it) => it.id && it.url);

  const itemById = new Map(items.map((it) => [it.id, it]));
  for (const col of sourceCollections) {
    if (!col?.id || col.id === "all" || col.id === "fav") continue;
    if (!Array.isArray(col.itemIds)) continue;
    for (const itemId of col.itemIds) {
      const item = itemById.get(String(itemId));
      if (!item) continue;
      if (!item.collections.includes(col.id)) item.collections.push(col.id);
    }
  }

  return {
    version: 3,
    lang: raw?.lang === "en" ? "en" : "ru",
    sortBy: typeof raw?.sortBy === "string" ? raw.sortBy : "newest",
    items,
    collections
  };
}

function normalizeRules(rules) {
  return {
    types: Array.isArray(rules?.types) ? rules.types.map((x) => String(x)) : [],
    sources: Array.isArray(rules?.sources) ? rules.sources.map((x) => String(x)) : [],
    tagsAll: Array.isArray(rules?.tagsAll)
      ? rules.tagsAll.map((x) => String(x))
      : Array.isArray(rules?.allTags)
        ? rules.allTags.map((x) => String(x))
        : [],
    tagsAny: Array.isArray(rules?.tagsAny)
      ? rules.tagsAny.map((x) => String(x))
      : Array.isArray(rules?.anyTags)
        ? rules.anyTags.map((x) => String(x))
        : [],
    textContains: String(rules?.textContains ?? rules?.query ?? ""),
    onlyFavorite: !!(rules?.onlyFavorite ?? rules?.favoriteOnly)
  };
}

function hasRuleCriteria(rules) {
  return Boolean(
    rules.onlyFavorite ||
    rules.textContains ||
    rules.types.length ||
    rules.sources.length ||
    rules.tagsAll.length ||
    rules.tagsAny.length
  );
}
