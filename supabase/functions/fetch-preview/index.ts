const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const BLOCKED_DOMAINS = [
  "pinterest.com",
  "pinterest.ru",
  "instagram.com",
  "linkedin.com",
  "fb.com",
  "facebook.com"
];

function jsonResponse(status: number, body: Record<string, unknown>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json; charset=utf-8"
    }
  });
}

function isBlockedDomain(hostname: string) {
  const host = String(hostname || "").trim().toLowerCase();
  if (!host) return false;
  return BLOCKED_DOMAINS.some((domain) => host === domain || host.endsWith(`.${domain}`));
}

function pickMetaPreview(html: string) {
  const source = String(html || "");
  const patterns = [
    /<meta[^>]+property=["']og:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+name=["']twitter:image["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<meta[^>]+name=["']twitter:image:src["'][^>]+content=["']([^"']+)["'][^>]*>/i,
    /<link[^>]+rel=["']image_src["'][^>]+href=["']([^"']+)["'][^>]*>/i
  ];
  for (const pattern of patterns) {
    const match = source.match(pattern);
    if (match?.[1]) return String(match[1]).trim();
  }
  return "";
}

function toHttpAbsolute(rawUrl: string, baseUrl: string) {
  const cleaned = String(rawUrl || "")
    .trim()
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'");
  if (!cleaned) return null;
  try {
    const absolute = new URL(cleaned, baseUrl);
    if (absolute.protocol !== "http:" && absolute.protocol !== "https:") return null;
    return absolute.toString();
  } catch {
    return null;
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });

  const body = await req.json().catch(() => ({}));
  const rawUrl = String(body?.url || "").trim();
  if (!/^https?:\/\//i.test(rawUrl)) {
    return jsonResponse(400, { error: "url must start with http:// or https://" });
  }

  let parsedUrl: URL;
  try {
    parsedUrl = new URL(rawUrl);
  } catch {
    return jsonResponse(400, { error: "Invalid URL" });
  }

  if (isBlockedDomain(parsedUrl.hostname)) {
    return jsonResponse(200, { preview: null, blocked: true });
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), 5000);

  try {
    const res = await fetch(parsedUrl.toString(), {
      method: "GET",
      headers: {
        "User-Agent": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)",
        Accept: "text/html,application/xhtml+xml"
      },
      signal: controller.signal
    });
    if (!res.ok) return jsonResponse(200, { preview: null });

    const html = await res.text();
    const rawPreview = pickMetaPreview(html);
    if (!rawPreview) return jsonResponse(200, { preview: null });

    const preview = toHttpAbsolute(rawPreview, parsedUrl.toString());
    return jsonResponse(200, { preview: preview || null });
  } catch {
    return jsonResponse(200, { preview: null });
  } finally {
    clearTimeout(timer);
  }
});
