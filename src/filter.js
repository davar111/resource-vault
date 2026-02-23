export const TAG_MIN_LEN = 2;
export const TAG_MAX_LEN = 24;

export function toHttpUrl(input) {
  const raw = String(input || "").trim();
  if (!raw) return "";
  try {
    const u = new URL(raw);
    const protocol = String(u.protocol || "").toLowerCase();
    if (protocol !== "http:" && protocol !== "https:") return "";
    return u.toString();
  } catch {
    return "";
  }
}

export function normalizeTags(input) {
  const rawList = Array.isArray(input)
    ? input
    : String(input || "").split(",");

  const seen = new Set();
  const out = [];

  for (const raw of rawList) {
    const next = String(raw || "").trim().toLowerCase().slice(0, TAG_MAX_LEN);
    if (next.length < TAG_MIN_LEN) continue;
    if (!next || seen.has(next)) continue;
    seen.add(next);
    out.push(next);
  }

  return out;
}

export function normalizeSearchText(input) {
  return String(input || "").trim().toLowerCase();
}

export function detectSource(url) {
  return detectSourceFromUrl(url);
}

export function detectSourceFromUrl(url) {
  const raw = String(url || "").trim();
  if (!raw) return "other";

  try {
    const u = new URL(raw);
    const host = u.hostname.toLowerCase();
    if (host.includes("behance.net")) return "behance";
    if (host.includes("dribbble.com")) return "dribbble";
    if (host.includes("pinterest.com") || host.includes("pin.it")) return "pinterest";
    if (host.includes("awwwards.com")) return "awwwards";
    return "site";
  } catch {
    return "other";
  }
}

export function domainFromUrl(url) {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return "";
  }
}

export function faviconUrl(url) {
  const d = domainFromUrl(url);
  if (!d) return "";
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=64`;
}

export async function tryFetchTitle(url) {
  const clean = String(url || "").trim();
  if (!clean) return "";

  const candidates = [
    clean,
    `https://r.jina.ai/http://${clean.replace(/^https?:\/\//, "")}`,
    `https://r.jina.ai/https://${clean.replace(/^https?:\/\//, "")}`
  ];

  for (const u of candidates) {
    try {
      const res = await fetchWithTimeout(u, 2200);
      if (!res.ok) continue;
      const text = await res.text();
      const m = text.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (m?.[1]) return m[1].trim().replace(/\s+/g, " ").slice(0, 120);
    } catch {}
  }
  return "";
}

export async function tryFetchPreview(url) {
  const clean = String(url || "").trim();
  if (!clean) return "";

  const normalized = clean.startsWith("http://") || clean.startsWith("https://") ? clean : `https://${clean}`;

  const candidates = [
    normalized,
    `https://r.jina.ai/http://${normalized.replace(/^https?:\/\//, "")}`,
    `https://r.jina.ai/https://${normalized.replace(/^https?:\/\//, "")}`
  ];

  for (const u of candidates) {
    try {
      const res = await fetchWithTimeout(u, 2200);
      if (!res.ok) continue;
      const text = await res.text();

      const meta =
        text.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i)?.[1] ||
        text.match(/<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["'][^>]*>/i)?.[1] ||
        text.match(/<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["'][^>]*>/i)?.[1];

      if (!meta) continue;

      const decoded = meta.trim().replaceAll("&amp;", "&").replaceAll("&quot;", '"').replaceAll("&#39;", "'");
      const absolute = new URL(decoded, normalized).href;
      if (/^https?:\/\//.test(absolute)) return absolute;
    } catch {}
  }

  return "";
}

export function previewFallbackUrl(url) {
  const clean = String(url || "").trim();
  if (!clean) return "";
  const normalized = clean.startsWith("http://") || clean.startsWith("https://") ? clean : `https://${clean}`;
  return `https://image.thum.io/get/width/1200/noanimate/${encodeURI(normalized)}`;
}

export function matchesLink(link, filterOrRules = {}) {
  const types = Array.isArray(filterOrRules.types) ? filterOrRules.types : [];
  const sources = Array.isArray(filterOrRules.sources) ? filterOrRules.sources : [];
  const requiredTags = normalizeTags(filterOrRules.requiredTags || []);
  const anyTags = normalizeTags(filterOrRules.anyTags || []);
  const containsText = normalizeSearchText(filterOrRules.containsText);
  const onlyFavorites = !!(filterOrRules.onlyFavorites ?? filterOrRules.favoriteOnly);
  const tagContains = normalizeSearchText(filterOrRules.tagContains ?? filterOrRules.tag);

  if (onlyFavorites && !link.favorite) return false;
  if (types.length && !types.includes(link.type)) return false;
  if (sources.length && !sources.includes(link.source)) return false;

  const tags = normalizeTags(link.tags || []);
  if (requiredTags.length && !requiredTags.every((tag) => tags.includes(tag))) return false;
  if (anyTags.length && !anyTags.some((tag) => tags.includes(tag))) return false;

  if (tagContains && !tags.some((tag) => tag.includes(tagContains))) return false;

  if (containsText) {
    const haystack = [
      String(link.title || ""),
      String(link.url || ""),
      String(link.note || ""),
      tags.join(" ")
    ].join(" ").toLowerCase();

    if (!haystack.includes(containsText)) return false;
  }

  return true;
}

function fetchWithTimeout(url, timeoutMs = 2200) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { method: "GET", signal: controller.signal }).finally(() => clearTimeout(timer));
}
