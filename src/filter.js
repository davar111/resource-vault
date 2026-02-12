export function normalizeTags(str){
  return (str || "")
    .split(",")
    .map(s => s.trim().toLowerCase())
    .filter(Boolean);
}

export function detectSource(url){
  const u = (url || "").toLowerCase();
  if (u.includes("behance.net")) return "behance";
  if (u.includes("awwwards.com")) return "awwwards";
  if (u.includes("pinterest.")) return "pinterest";
  if (u.includes("dribbble.com")) return "dribbble";
  return "site";
}

export function domainFromUrl(url){
  try{ return new URL(url).hostname.replace(/^www\./,""); }
  catch{ return ""; }
}

export function faviconUrl(url){
  const d = domainFromUrl(url);
  if (!d) return "";
  return `https://www.google.com/s2/favicons?domain=${encodeURIComponent(d)}&sz=64`;
}

export async function tryFetchTitle(url){
  const clean = String(url || "").trim();
  if (!clean) return "";

  const candidates = [
    clean,
    `https://r.jina.ai/http://${clean.replace(/^https?:\/\//, "")}`,
    `https://r.jina.ai/https://${clean.replace(/^https?:\/\//, "")}`,
  ];

  for (const u of candidates){
    try{
      const res = await fetchWithTimeout(u, 2600);
      if (!res.ok) continue;
      const text = await res.text();
      const m = text.match(/<title[^>]*>([^<]+)<\/title>/i);
      if (m?.[1]) return m[1].trim().replace(/\s+/g, " ").slice(0, 120);
    }catch{}
  }
  return "";
}

export async function tryFetchPreview(url){
  const clean = String(url || "").trim();
  if (!clean) return "";

  const normalized = clean.startsWith("http://") || clean.startsWith("https://")
    ? clean
    : `https://${clean}`;

  const candidates = [
    normalized,
    `https://r.jina.ai/http://${normalized.replace(/^https?:\/\//, "")}`,
    `https://r.jina.ai/https://${normalized.replace(/^https?:\/\//, "")}`,
  ];

  for (const u of candidates){
    try{
      const res = await fetchWithTimeout(u, 2600);
      if (!res.ok) continue;
      const text = await res.text();

      const meta =
        text.match(/<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i)?.[1] ||
        text.match(/<meta[^>]+name=["']twitter:image(?::src)?["'][^>]+content=["']([^"']+)["'][^>]*>/i)?.[1] ||
        text.match(/<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["'][^>]*>/i)?.[1];

      if (!meta) continue;

      const decoded = meta
        .trim()
        .replaceAll("&amp;", "&")
        .replaceAll("&quot;", "\"")
        .replaceAll("&#39;", "'");

      const absolute = new URL(decoded, normalized).href;
      if (absolute.startsWith("http://") || absolute.startsWith("https://")) {
        return absolute;
      }
    }catch{}
  }

  return "";
}

export function previewFallbackUrl(url){
  const clean = String(url || "").trim();
  if (!clean) return "";

  const normalized = clean.startsWith("http://") || clean.startsWith("https://")
    ? clean
    : `https://${clean}`;

  return `https://image.thum.io/get/width/1200/noanimate/${encodeURI(normalized)}`;
}

function fetchWithTimeout(url, timeoutMs = 2600){
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  return fetch(url, { method: "GET", signal: controller.signal }).finally(() => clearTimeout(timer));
}

export function matchesRules(item, rules, search="", activeTag=""){
  if (!rules) return true;

  if (rules.favoriteOnly && !item.favorite) return false;

  if (rules.types?.length && !rules.types.includes(item.type)) return false;
  if (rules.sources?.length && !rules.sources.includes(item.source)) return false;

  const itemTags = (item.tags || []).map(t => t.toLowerCase());

  if (activeTag){
    if (!itemTags.includes(activeTag.toLowerCase())) return false;
  }

  if (rules.allTags?.length){
    const allOk = rules.allTags.every(t => itemTags.includes(t.toLowerCase()));
    if (!allOk) return false;
  }

  if (rules.anyTags?.length){
    const anyOk = rules.anyTags.some(t => itemTags.includes(t.toLowerCase()));
    if (!anyOk) return false;
  }

  const q = (rules.query || "").trim().toLowerCase();
  const s = (search || "").trim().toLowerCase();
  const hay = `${item.title||""} ${item.url||""} ${item.note||""}`.toLowerCase();

  if (q && !hay.includes(q)) return false;
  if (s && !hay.includes(s)) return false;

  return true;
}
