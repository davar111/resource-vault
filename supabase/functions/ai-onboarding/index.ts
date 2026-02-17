import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";
const SERPER_API_KEY = Deno.env.get("SERPER_API_KEY") || "";

type InterviewAnswer = {
  question: string;
  answer: string;
};

type AiProfile = {
  role: string;
  level: "Junior" | "Middle" | "Senior";
  stack: string[];
  goals: string[];
  format_pref: Array<"articles" | "tools" | "templates">;
};

const STOP_WORDS = new Set([
  "какой", "какая", "какие", "какие-то", "тебя", "твой", "твоя", "твоей", "уровень",
  "чем", "фокус", "сейчас", "ответ", "формат", "материалов", "предпочитаешь", "или",
  "и", "в", "на", "по", "для", "у", "из", "к", "как", "это", "that", "this", "with",
  "from", "your", "you", "what", "which", "where", "when", "why", "how", "the", "and",
  "или", "uiux"
]);

const STACK_ALIASES: Record<string, string> = {
  "ui/ux": "ui/ux",
  "ux/ui": "ui/ux",
  "ux": "ux",
  "ui": "ui",
  "figma": "figma",
  "sketch": "sketch",
  "photoshop": "photoshop",
  "illustrator": "illustrator",
  "adobexd": "adobe_xd",
  "adobe_xd": "adobe_xd",
  "webflow": "webflow",
  "framer": "framer",
  "notion": "notion",
  "miro": "miro",
  "react": "react",
  "vue": "vue",
  "angular": "angular",
  "typescript": "typescript",
  "javascript": "javascript",
  "node": "nodejs",
  "nodejs": "nodejs",
  "python": "python",
  "sql": "sql",
  "product": "product",
  "analytics": "analytics",
  "ga4": "ga4"
};

const GOAL_ALIASES: Record<string, string> = {
  "найти работу": "find_job",
  "job": "find_job",
  "career": "find_job",
  "интервью": "interview_prep",
  "interview": "interview_prep",
  "портфолио": "build_portfolio",
  "portfolio": "build_portfolio",
  "прокачать": "improve_skills",
  "skills": "improve_skills",
  "growth": "improve_skills"
};

function jsonResponse(status: number, payload: unknown) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" }
  });
}

function normalizeList(input: unknown) {
  const arr = Array.isArray(input) ? input : [];
  const out = new Set<string>();
  for (const raw of arr) {
    const value = String(raw || "").trim().toLowerCase();
    if (!value) continue;
    out.add(value);
  }
  return [...out];
}

function normalizeToken(raw: string) {
  return String(raw || "")
    .trim()
    .toLowerCase()
    .replace(/[_\s]+/g, "_")
    .replace(/[^\p{L}\p{N}_/+.-]/gu, "");
}

function cleanStack(input: unknown) {
  const arr = Array.isArray(input) ? input : [];
  const out = new Set<string>();
  for (const raw of arr) {
    const token = normalizeToken(String(raw || ""));
    if (!token || token.length < 2 || token.length > 32) continue;
    const compact = token.replaceAll("_", "");
    if (STOP_WORDS.has(compact) || STOP_WORDS.has(token)) continue;
    const normalized = STACK_ALIASES[token] || STACK_ALIASES[compact] || token;
    if (STOP_WORDS.has(normalized)) continue;
    out.add(normalized);
  }
  return [...out].slice(0, 10);
}

function cleanGoals(input: unknown) {
  const arr = Array.isArray(input) ? input : [];
  const out = new Set<string>();
  for (const raw of arr) {
    const token = normalizeToken(String(raw || ""));
    if (!token) continue;
    const normalized = GOAL_ALIASES[token] || token;
    if (!normalized || STOP_WORDS.has(normalized)) continue;
    out.add(normalized);
  }
  if (!out.size) out.add("improve_skills");
  return [...out].slice(0, 6);
}

function detectGoalsFromAnswers(answerText: string) {
  const lower = answerText.toLowerCase();
  const goals = new Set<string>();
  for (const [key, value] of Object.entries(GOAL_ALIASES)) {
    if (lower.includes(key)) goals.add(value);
  }
  if (!goals.size) goals.add("improve_skills");
  return [...goals];
}

function detectStackFromAnswers(answerText: string) {
  const lower = answerText.toLowerCase();
  const stack = new Set<string>();
  for (const [key, value] of Object.entries(STACK_ALIASES)) {
    if (lower.includes(key.replaceAll("_", " "))) stack.add(value);
  }
  for (const token of lower.split(/[\s,./:;()[\]{}!?'"`|\\-]+/g)) {
    const normalized = normalizeToken(token);
    if (!normalized) continue;
    if (STOP_WORDS.has(normalized)) continue;
    if (STACK_ALIASES[normalized]) stack.add(STACK_ALIASES[normalized]);
  }
  return [...stack].slice(0, 8);
}

function normalizeProfile(input: Partial<AiProfile>): AiProfile {
  const levelRaw = String(input?.level || "Junior");
  const level = levelRaw === "Senior" || levelRaw === "Middle" ? levelRaw : "Junior";
  const formatInput = Array.isArray(input?.format_pref) ? input?.format_pref : [];
  const formatSet = new Set<"articles" | "tools" | "templates">();
  for (const raw of formatInput) {
    if (raw === "articles" || raw === "tools" || raw === "templates") formatSet.add(raw);
  }
  if (formatSet.size === 0) formatSet.add("articles");

  return {
    role: String(input?.role || "Generalist").trim(),
    level,
    stack: cleanStack(input?.stack),
    goals: cleanGoals(input?.goals),
    format_pref: [...formatSet]
  };
}

async function askGemini(systemPrompt: string, userPrompt: string) {
  if (!GEMINI_API_KEY) return null;
  const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${encodeURIComponent(GEMINI_API_KEY)}`;
  const body = {
    system_instruction: {
      parts: [{ text: systemPrompt }]
    },
    contents: [{ role: "user", parts: [{ text: userPrompt }] }],
    generationConfig: {
      temperature: 0.4,
      maxOutputTokens: 900
    }
  };
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  });
  if (!res.ok) return null;
  const data = await res.json();
  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
  return typeof text === "string" ? text : null;
}

function parseJsonFromText(input: string | null) {
  if (!input) return null;
  const cleaned = input.replace(/^```json/i, "").replace(/^```/i, "").replace(/```$/, "").trim();
  try {
    return JSON.parse(cleaned);
  } catch {
    return null;
  }
}

function fallbackQuestions(role: string) {
  return [
    {
      question: `Какой у тебя уровень в ${role}?`,
      options: ["Junior", "Middle", "Senior"]
    },
    {
      question: "На чем фокус сейчас?",
      options: ["Найти работу", "Прокачать навыки", "Собрать портфолио", "Подготовиться к интервью"]
    },
    {
      question: "Какой стек для тебя ключевой?",
      options: ["JavaScript/TypeScript", "React/Vue/Angular", "Node.js", "Figma/Product tools"]
    },
    {
      question: "Какой формат материалов предпочитаешь?",
      options: ["articles", "tools", "templates"]
    }
  ];
}

function deriveFallbackProfile(role: string, answers: InterviewAnswer[]): AiProfile {
  const answersText = answers.map((x) => String(x.answer || "")).join(" ").toLowerCase();
  let level: AiProfile["level"] = "Junior";
  if (answersText.includes("senior")) level = "Senior";
  else if (answersText.includes("middle")) level = "Middle";

  const formatPref: AiProfile["format_pref"] = [];
  if (answersText.includes("tool")) formatPref.push("tools");
  if (answersText.includes("template")) formatPref.push("templates");
  if (formatPref.length === 0) formatPref.push("articles");

  return normalizeProfile({
    role,
    level,
    stack: detectStackFromAnswers(answersText),
    goals: detectGoalsFromAnswers(answersText),
    format_pref: formatPref
  });
}

async function fetchExternalResources(query: string, tags: string[]) {
  const resources: Array<{ title: string; url: string; snippet: string; tags: string[]; source: string }> = [];

  if (SERPER_API_KEY) {
    const serperRes = await fetch("https://google.serper.dev/search", {
      method: "POST",
      headers: {
        "X-API-KEY": SERPER_API_KEY,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ q: query, num: 8 })
    });
    if (serperRes.ok) {
      const data = await serperRes.json();
      const organic = Array.isArray(data?.organic) ? data.organic : [];
      for (const row of organic.slice(0, 8)) {
        resources.push({
          title: String(row?.title || ""),
          url: String(row?.link || ""),
          snippet: String(row?.snippet || ""),
          tags,
          source: "serper"
        });
      }
    }
    return resources;
  }

  const tag = tags[0] || "javascript";
  const devtoRes = await fetch(`https://dev.to/api/articles?per_page=5&tag=${encodeURIComponent(tag)}`);
  if (devtoRes.ok) {
    const list = await devtoRes.json();
    for (const row of (Array.isArray(list) ? list : []).slice(0, 5)) {
      resources.push({
        title: String(row?.title || ""),
        url: String(row?.url || ""),
        snippet: String(row?.description || ""),
        tags: normalizeList(row?.tag_list || []),
        source: "devto"
      });
    }
  }

  const githubRes = await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(query)}&sort=stars&order=desc&per_page=5`);
  if (githubRes.ok) {
    const data = await githubRes.json();
    const items = Array.isArray(data?.items) ? data.items : [];
    for (const row of items.slice(0, 5)) {
      resources.push({
        title: String(row?.full_name || ""),
        url: String(row?.html_url || ""),
        snippet: String(row?.description || ""),
        tags,
        source: "github"
      });
    }
  }

  return resources;
}

function rankResources(
  items: Array<{ title: string; url: string; snippet: string; tags: string[]; source: string }>,
  profile: AiProfile
) {
  const seen = new Set<string>();
  const levelToken = profile.level.toLowerCase();
  const preferred = new Set(profile.format_pref);
  const stackTokens = new Set(profile.stack.map((x) => x.toLowerCase()));

  return items
    .filter((x) => x.url.startsWith("http"))
    .filter((x) => {
      const key = x.url.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .map((x) => {
      const hay = `${x.title} ${x.snippet} ${(x.tags || []).join(" ")}`.toLowerCase();
      let score = 0;
      if (hay.includes(levelToken)) score += 2;
      for (const token of stackTokens) {
        if (token && hay.includes(token)) score += 2;
      }
      if (preferred.has("articles") && x.source !== "github") score += 1;
      if (preferred.has("tools") && x.source === "github") score += 1;
      if (preferred.has("templates") && hay.includes("template")) score += 1;
      return { ...x, score };
    })
    .sort((a, b) => b.score - a.score)
    .slice(0, 12);
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  if (req.method !== "POST") return jsonResponse(405, { error: "Method not allowed" });
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY || !SUPABASE_ANON_KEY) {
    return jsonResponse(500, { error: "Supabase environment is not configured" });
  }

  const authHeader = req.headers.get("authorization") || "";
  const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7) : "";
  if (!token) return jsonResponse(401, { error: "Missing bearer token" });

  const authClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: `Bearer ${token}` } }
  });
  const { data: authData, error: authError } = await authClient.auth.getUser();
  if (authError || !authData?.user) return jsonResponse(401, { error: "Unauthorized" });

  const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
  const body = await req.json().catch(() => ({}));
  const action = String(body?.action || "");
  const role = String(body?.role || "").trim();

  if (action === "generate_questions") {
    if (!role) return jsonResponse(400, { error: "Role is required" });

    const aiText = await askGemini(
      "You generate interview questions for tech onboarding. Return strict JSON only.",
      `Role: ${role}. Return JSON: {"questions":[{"question":"...","options":["..."]}]} with 3-5 questions, each with 3-5 short options.`
    );
    const parsed = parseJsonFromText(aiText);
    const questions = Array.isArray(parsed?.questions) && parsed.questions.length
      ? parsed.questions.slice(0, 5)
      : fallbackQuestions(role);

    return jsonResponse(200, { questions });
  }

  if (action === "finalize_profile") {
    const answers = Array.isArray(body?.answers) ? body.answers as InterviewAnswer[] : [];
    if (!role) return jsonResponse(400, { error: "Role is required" });
    if (!answers.length) return jsonResponse(400, { error: "Answers are required" });

    const aiText = await askGemini(
      "You produce a strict JSON profile for a technical learning app.",
      [
        `Role: ${role}`,
        "Answers:",
        ...answers.map((x, idx) => `${idx + 1}. ${x.question}: ${x.answer}`),
        "Return JSON only in schema:",
        `{"role":"string","level":"Junior|Middle|Senior","stack":["string"],"goals":["string"],"format_pref":["articles","tools","templates"]}`
      ].join("\n")
    );

    const parsed = parseJsonFromText(aiText);
    const fallbackProfile = deriveFallbackProfile(role, answers);
    const parsedProfile = parsed ? normalizeProfile(parsed) : null;
    const aiProfile: AiProfile = {
      role: parsedProfile?.role || fallbackProfile.role,
      level: parsedProfile?.level || fallbackProfile.level,
      stack: parsedProfile?.stack?.length ? parsedProfile.stack : fallbackProfile.stack,
      goals: parsedProfile?.goals?.length ? parsedProfile.goals : fallbackProfile.goals,
      format_pref: parsedProfile?.format_pref?.length ? parsedProfile.format_pref : fallbackProfile.format_pref
    };
    const tags = normalizeList([aiProfile.role, ...aiProfile.stack, ...aiProfile.goals]).slice(0, 10);
    const query = `${aiProfile.role} ${aiProfile.stack.join(" ")} ${aiProfile.level}`.trim();

    const linksQuery = admin
      .from("links")
      .select("title,url,note,tags,source,type,created_at")
      .limit(20);
    const { data: internalLinks } = tags.length
      ? await linksQuery.overlaps("tags", tags)
      : await linksQuery.order("created_at", { ascending: false });

    const internal = (internalLinks || []).map((x) => ({
      title: String(x?.title || x?.url || ""),
      url: String(x?.url || ""),
      snippet: String(x?.note || ""),
      tags: normalizeList(x?.tags),
      source: String(x?.source || "internal")
    }));

    const external = await fetchExternalResources(query, tags);
    const resources = rankResources([...internal, ...external], aiProfile);

    await admin.from("users").upsert({
      id: authData.user.id,
      ai_profile: aiProfile,
      onboarding_completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }, { onConflict: "id" });

    return jsonResponse(200, { ai_profile: aiProfile, resources });
  }

  return jsonResponse(400, { error: "Unsupported action" });
});
