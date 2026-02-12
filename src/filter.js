export function normalizeTags(str) {
  return String(str || "")
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
}

export function detectSource(url) {
  const u = String(url || "").toLowerCase();
  if (u.includes("behance.net")) return "behance";
  if (u.includes("awwwards.com")) return "awwwards";
  if (u.includes("pinterest.")) return "pinterest";
  if (u.includes("dribbble.com")) return "dribbble";
  return "site";
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

export function matchesCollectionRules(item, rules) {
  if (!rules) return true;

  if (rules.onlyFavorite && !item.favorite) return false;

  if (Array.isArray(rules.types) && rules.types.length && !rules.types.includes(item.type)) return false;
  if (Array.isArray(rules.sources) && rules.sources.length && !rules.sources.includes(item.source)) return false;

  const itemTags = (item.tags || []).map((t) => String(t).toLowerCase());

  if (Array.isArray(rules.tagsAll) && rules.tagsAll.length) {
    const ok = rules.tagsAll.every((t) => itemTags.includes(String(t).toLowerCase()));
    if (!ok) return false;
  }

  if (Array.isArray(rules.tagsAny) && rules.tagsAny.length) {
    const ok = rules.tagsAny.some((t) => itemTags.includes(String(t).toLowerCase()));
    if (!ok) return false;
  }

  const q = String(rules.textContains || "").trim().toLowerCase();
  if (q) {
    const hay = `${item.title || ""} ${item.url || ""} ${item.note || ""} ${(item.tags || []).join(" ")}`.toLowerCase();
    if (!hay.includes(q)) return false;
  }

  return true;
}

function fetchWithTimeout(url, timeoutMs = 2200) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { method: "GET", signal: controller.signal }).finally(() => clearTimeout(timer));
}
