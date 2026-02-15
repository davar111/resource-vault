export const TYPE_CODES = ["case", "inspiration", "article", "tool", "asset"];
export const SOURCE_CODES = ["site", "behance", "awwwards", "pinterest", "dribbble", "other"];

export function normalizeTypeCode(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return null;

  const legacyMap = {
    project: "case",
    inspiration: "inspiration",
    designer: "case",
    studio: "case",
    source: "case"
  };

  const normalized = legacyMap[raw] || raw;
  return TYPE_CODES.includes(normalized) ? normalized : null;
}

export function normalizeSourceCode(value) {
  const raw = String(value || "").trim().toLowerCase();
  if (!raw) return null;

  const map = {
    site: "site",
    behance: "behance",
    awwwards: "awwwards",
    pinterest: "pinterest",
    dribbble: "dribbble",
    other: "other"
  };

  const normalized = map[raw] || raw;
  return SOURCE_CODES.includes(normalized) ? normalized : null;
}
