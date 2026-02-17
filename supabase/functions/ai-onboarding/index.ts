import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS"
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL") || "";
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY") || "";
const GROQ_API_KEY = Deno.env.get("GROQ_API_KEY") || "";
const TAVILY_API_KEY = Deno.env.get("TAVILY_API_KEY") || "";

const TRUSTED_HOSTS = [
  "developer.mozilla.org",
  "react.dev",
  "nextjs.org",
  "nodejs.org",
  "typescriptlang.org",
  "docs.python.org",
  "python.org",
  "supabase.com",
  "web.dev",
  "w3.org",
  "nngroup.com",
  "figma.com",
  "material.io",
  "uxdesign.cc",
  "a11yproject.com",
  "github.com",
  "vercel.com",
  "aws.amazon.com",
  "cloud.google.com",
  "microsoft.com"
];

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
  resources_lang?: "ru" | "en" | "both";
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

async function askGroq(systemPrompt: string, userPrompt: string) {
  if (!GROQ_API_KEY) return null;
  const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${GROQ_API_KEY}`
    },
    body: JSON.stringify({
      model: "llama-3.1-70b-versatile",
      temperature: 0.3,
      max_tokens: 900,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userPrompt }
      ]
    })
  });
  if (!res.ok) return null;
  const data = await res.json();
  const text = data?.choices?.[0]?.message?.content;
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

function hostnameOf(url: string) {
  try {
    return new URL(String(url || "")).hostname.toLowerCase();
  } catch {
    return "";
  }
}

function isTrustedHost(url: string) {
  const host = hostnameOf(url);
  if (!host) return false;
  return TRUSTED_HOSTS.some((x) => host === x || host.endsWith(`.${x}`));
}

function extractQuestionText(input: string | null) {
  if (!input) return "";
  const json = parseJsonFromText(input);
  const fromJson = String(json?.question || "").trim();
  if (fromJson) return fromJson;

  const cleaned = String(input)
    .replace(/^```json/i, "")
    .replace(/^```/i, "")
    .replace(/```$/i, "")
    .trim();

  const line = cleaned
    .split(/\r?\n/g)
    .map((x) => x.trim())
    .find((x) => !!x && !x.startsWith("{") && !x.startsWith("[") && !x.startsWith("}")) || "";

  const compact = line
    .replace(/^[-*•]\s*/, "")
    .replace(/^\d+[.)]\s*/, "")
    .replace(/^["'`]|["'`]$/g, "")
    .trim();

  if (!compact) return "";
  return /[?？]$/.test(compact) ? compact : `${compact}?`;
}

function buildGuidedQuestion(role: string, answers: InterviewAnswer[], lang: string) {
  const isEn = String(lang || "ru") === "en";
  const text = answers.map((x) => `${x.question} ${x.answer}`).join(" ").toLowerCase();
  const hasLevel = /(junior|middle|senior|intern|trainee|джун|джуниор|мидл|сеньор|стажер)/i.test(text);
  const hasFocus = /(работ|job|portfolio|портфол|interview|интервью|project|проект|growth|рост)/i.test(text);
  const hasTools = /(figma|photoshop|illustrator|after effects|framer|webflow|react|vue|angular|typescript|javascript|node|python|sql)/i.test(text);
  const hasGoal = /(недел|месяц|week|month|цель|goal|результат|result|kpi)/i.test(text);

  if (!hasLevel) {
    return isEn
      ? `What is your current level in ${role}: beginner, junior, middle, or senior?`
      : `Какой у тебя сейчас уровень в ${role}: beginner, junior, middle или senior?`;
  }
  if (!hasFocus) {
    return isEn
      ? "What are you focused on right now: finding work, improving skills, or building portfolio?"
      : "На чем ты сейчас сфокусирован: поиск работы, прокачка навыков или сборка портфолио?";
  }
  if (!hasTools) {
    return isEn
      ? "What tools or stack do you actually use every week?"
      : "Какие инструменты или стек ты реально используешь каждую неделю?";
  }
  if (!hasGoal) {
    return isEn
      ? "What concrete result do you want by the end of this month?"
      : "Какой конкретный результат ты хочешь получить к концу этого месяца?";
  }
  return isEn
    ? "What blocks you most right now, and what kind of resource would help immediately?"
    : "Что сейчас тебя сильнее всего тормозит и какой тип ресурса помог бы сразу?";
}

function buildOpenFallbackQuestion(role: string, answers: InterviewAnswer[], lang: string) {
  const isEn = String(lang || "ru") === "en";
  const last = answers.length ? String(answers[answers.length - 1]?.answer || "").trim() : "";
  if (!last) {
    return isEn
      ? `Great. You wrote "${role}". What exactly do you want to achieve in the next 2-3 months?`
      : `Отлично, ты написал "${role}". Чего конкретно хочешь достичь в ближайшие 2-3 месяца?`;
  }
  if (/ui|ux|design|дизайн/i.test(last)) {
    return isEn
      ? "What specific design skill do you want to improve first: visual, UX research, or prototyping?"
      : "Какой конкретный скилл в дизайне хочешь прокачать первым: визуал, UX-исследования или прототипирование?";
  }
  return isEn
    ? "What concrete result would you like to get by the end of this week?"
    : "Какой конкретный результат ты хочешь получить уже к концу этой недели?";
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

function fallbackQuestionsByLang(role: string, lang: string) {
  if (String(lang || "ru") !== "en") return fallbackQuestions(role);
  return [
    {
      question: `What is your current level in ${role}?`,
      options: ["Junior", "Middle", "Senior"]
    },
    {
      question: "What is your main focus right now?",
      options: ["Find a job", "Improve skills", "Build portfolio", "Prepare for interviews"]
    },
    {
      question: "Which stack is the most important for you now?",
      options: ["JavaScript/TypeScript", "React/Vue/Angular", "Node.js", "Figma/Product tools"]
    },
    {
      question: "What content format do you prefer?",
      options: ["articles", "tools", "templates"]
    }
  ];
}

function isGenericRole(role: string) {
  const normalized = normalizeToken(role).replaceAll("_", "");
  if (!normalized) return true;
  const genericTokens = new Set([
    "student",
    "студент",
    "learner",
    "beginner",
    "новичок",
    "ученик",
    "intern",
    "trainee"
  ]);
  return genericTokens.has(normalized);
}

function hasLevelInText(input: string) {
  const lower = input.toLowerCase();
  return ["junior", "middle", "senior", "джуниор", "мидл", "сеньор"].some((x) => lower.includes(x));
}

function hasFormatInText(input: string) {
  const lower = input.toLowerCase();
  return [
    "article",
    "articles",
    "tool",
    "tools",
    "template",
    "templates",
    "статья",
    "статьи",
    "инструмент",
    "шаблон"
  ].some((x) => lower.includes(x));
}

function hasMeaningfulGoalInText(input: string) {
  const detected = detectGoalsFromAnswers(input);
  if (detected.some((x) => x !== "improve_skills")) return true;
  const lower = input.toLowerCase();
  return ["job", "работ", "портфол", "interview", "интервью"].some((x) => lower.includes(x));
}

function buildFallbackFollowUp(role: string, answers: InterviewAnswer[], lang: string) {
  const isEn = String(lang || "ru") === "en";
  const allText = answers.map((x) => `${x.question} ${x.answer}`).join(" ").toLowerCase();
  const hasLevel = hasLevelInText(allText);
  const hasGoal = hasMeaningfulGoalInText(allText);
  const hasStack = detectStackFromAnswers(allText).length > 0;
  const hasFormat = hasFormatInText(allText);

  if (!answers.length && isGenericRole(role)) {
    return {
      question: isEn
        ? "Got it, student. Which direction do you want to start with?"
        : "Ок, студент. В каком направлении хочешь развиваться в первую очередь?",
      options: isEn
        ? ["Frontend", "Backend", "Data Analytics", "UI/UX", "Not sure yet"]
        : ["Frontend", "Backend", "Data Analytics", "UI/UX", "Пока не определился"]
    };
  }

  if (!hasLevel) {
    return {
      question: isEn ? "What is your current level?" : "Какой у тебя текущий уровень?",
      options: ["Junior", "Middle", "Senior"]
    };
  }

  if (!hasGoal) {
    return {
      question: isEn ? "What is your goal for the next 2-3 months?" : "Какая у тебя цель на ближайшие 2-3 месяца?",
      options: isEn
        ? ["Find first job", "Get stronger fundamentals", "Build portfolio", "Prepare for interviews"]
        : ["Найти первую работу", "Укрепить базу", "Собрать портфолио", "Подготовиться к интервью"]
    };
  }

  if (!hasStack) {
    return {
      question: isEn ? "What technologies are you already using?" : "С какими технологиями ты уже работаешь?",
      options: ["React/TypeScript", "Node.js", "Python/SQL", "Figma"]
    };
  }

  if (!hasFormat) {
    return {
      question: isEn ? "How do you prefer to learn?" : "В каком формате тебе удобнее учиться?",
      options: isEn
        ? ["Guides and articles", "Tools and practice", "Templates/checklists", "Mixed format"]
        : ["Гайды и статьи", "Инструменты и практика", "Шаблоны/чеклисты", "Смешанный формат"]
    };
  }

  const fallbackList = fallbackQuestionsByLang(role, lang);
  return fallbackList[Math.min(answers.length, fallbackList.length - 1)];
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

function detectResourcesLang(answers: InterviewAnswer[]): "ru" | "en" | "both" {
  const text = answers.map((x) => `${x.question} ${x.answer}`).join(" ").toLowerCase();
  const ru = /рус|russian|на русском|ru\b|кирилл/.test(text);
  const en = /english|англ|на английском|en\b/.test(text);
  if (ru && en) return "both";
  if (ru) return "ru";
  if (en) return "en";
  return "both";
}

async function fetchExternalResources(query: string, tags: string[], resourcesLang: "ru" | "en" | "both") {
  const resources: Array<{ title: string; url: string; snippet: string; tags: string[]; source: string }> = [];
  const langSuffix = resourcesLang === "ru"
    ? " russian language tutorial guide"
    : resourcesLang === "en"
      ? " english language tutorial guide"
      : "";
  const finalQuery = `${query}${langSuffix}`.trim();

  if (TAVILY_API_KEY) {
    const tavilyRes = await fetch("https://api.tavily.com/search", {
      method: "POST",
      headers: {
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        api_key: TAVILY_API_KEY,
        query: finalQuery,
        search_depth: "advanced",
        max_results: 10
      })
    });
    if (tavilyRes.ok) {
      const data = await tavilyRes.json();
      const results = Array.isArray(data?.results) ? data.results : [];
      for (const row of results.slice(0, 10)) {
        resources.push({
          title: String(row?.title || ""),
          url: String(row?.url || ""),
          snippet: String(row?.content || ""),
          tags,
          source: "tavily"
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

  const githubRes = await fetch(`https://api.github.com/search/repositories?q=${encodeURIComponent(finalQuery)}&sort=stars&order=desc&per_page=5`);
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
  profile: AiProfile,
  resourcesLang: "ru" | "en" | "both"
) {
  const seen = new Set<string>();
  const levelToken = profile.level.toLowerCase();
  const preferred = new Set(profile.format_pref);
  const stackTokens = new Set(profile.stack.map((x) => x.toLowerCase()));

  const ranked = items
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
      const trusted = isTrustedHost(x.url);
      const host = hostnameOf(x.url);
      if (hay.includes(levelToken)) score += 2;
      for (const token of stackTokens) {
        if (token && hay.includes(token)) score += 2;
      }
      if (preferred.has("articles") && x.source !== "github") score += 1;
      if (preferred.has("tools") && x.source === "github") score += 1;
      if (preferred.has("templates") && hay.includes("template")) score += 1;
      if (trusted) score += 6;
      else score -= 1;
      if (resourcesLang === "ru") {
        if (/[а-яё]/i.test(hay) || host.endsWith(".ru")) score += 3;
        else score -= 2;
      }
      if (resourcesLang === "en") {
        if (/[a-z]/i.test(hay) && !/[а-яё]/i.test(hay)) score += 2;
      }
      return { ...x, score, trusted };
    })
    .sort((a, b) => b.score - a.score);

  const trusted = ranked.filter((x) => x.trusted);
  const untrusted = ranked.filter((x) => !x.trusted);
  const blended = trusted.length ? [...trusted, ...untrusted] : ranked;
  return blended.slice(0, 12);
}

async function buildProfileAndResources(
  admin: ReturnType<typeof createClient>,
  userId: string,
  role: string,
  answers: InterviewAnswer[]
) {
  const aiText = await askGroq(
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
  const resourcesLang = detectResourcesLang(answers);
  const aiProfile: AiProfile = {
    role: parsedProfile?.role || fallbackProfile.role,
    level: parsedProfile?.level || fallbackProfile.level,
    stack: parsedProfile?.stack?.length ? parsedProfile.stack : fallbackProfile.stack,
    goals: parsedProfile?.goals?.length ? parsedProfile.goals : fallbackProfile.goals,
    format_pref: parsedProfile?.format_pref?.length ? parsedProfile.format_pref : fallbackProfile.format_pref,
    resources_lang: resourcesLang
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

  const external = await fetchExternalResources(query, tags, resourcesLang);
  const resources = rankResources([...internal, ...external], aiProfile, resourcesLang);

  await admin.from("users").upsert({
    id: userId,
    ai_profile: aiProfile,
    onboarding_completed_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  }, { onConflict: "id" });

  return { aiProfile, resources };
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

  if (action === "chat_turn") {
    if (!role) return jsonResponse(400, { error: "Role is required" });
    const lang = String(body?.lang || "ru");
    const answers = Array.isArray(body?.answers) ? body.answers as InterviewAnswer[] : [];
    const maxQuestions = 5;
    const enoughData = answers.length >= 4;
    if (enoughData || answers.length >= maxQuestions) {
      const { aiProfile, resources } = await buildProfileAndResources(admin, authData.user.id, role, answers);
      return jsonResponse(200, { done: true, ai_profile: aiProfile, resources });
    }

    const history = answers.map((x, idx) => `${idx + 1}. Q:${x.question} A:${x.answer}`).join("\n");
    const qText = await askGroq(
      "You are a senior mentor conducting a natural chat. Ask exactly one short follow-up question.",
      [
        `Role: ${role}`,
        `Already asked: ${answers.length}`,
        history ? `History:\n${history}` : "No history yet.",
        `Language: ${lang === "en" ? "English" : "Russian"}`,
        "Return plain text only.",
        "No JSON, no lists, no answer options, no repetition.",
        "Do not say phrases like 'you said' or repeat user's message verbatim."
      ].join("\n")
    );
    const modelQuestion = extractQuestionText(qText);
    const fallbackQuestion = buildGuidedQuestion(role, answers, lang);
    const weakQuestion = !modelQuestion ||
      modelQuestion.length < 12 ||
      /ты написал|you said|i got it|понял|i understand/i.test(modelQuestion.toLowerCase());
    const question = {
      question: String(weakQuestion ? fallbackQuestion : modelQuestion),
      options: []
    };
    return jsonResponse(200, { done: false, question });
  }

  if (action === "generate_questions") {
    if (!role) return jsonResponse(400, { error: "Role is required" });

    const aiText = await askGroq(
      "You generate interview questions for tech onboarding. Return strict JSON only.",
      `Role: ${role}. Return JSON: {"questions":[{"question":"..."}]} with 3-5 adaptive open-ended questions and no answer options.`
    );
    const parsed = parseJsonFromText(aiText);
    const questions = Array.isArray(parsed?.questions) && parsed.questions.length
      ? parsed.questions.slice(0, 5).map((q: unknown) => ({
        question: String((q as { question?: unknown })?.question || ""),
        options: []
      })).filter((q: { question: string }) => !!q.question)
      : [{ question: buildOpenFallbackQuestion(role, [], "ru"), options: [] }];

    return jsonResponse(200, { questions });
  }

  if (action === "finalize_profile") {
    const answers = Array.isArray(body?.answers) ? body.answers as InterviewAnswer[] : [];
    if (!role) return jsonResponse(400, { error: "Role is required" });
    if (!answers.length) return jsonResponse(400, { error: "Answers are required" });
    const { aiProfile, resources } = await buildProfileAndResources(admin, authData.user.id, role, answers);
    return jsonResponse(200, { ai_profile: aiProfile, resources });
  }

  return jsonResponse(400, { error: "Unsupported action" });
});
