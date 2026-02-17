const STORAGE_KEY = "resource_vault_onboarding_state_v5";
const DEFAULT_FUNCTION_PATH = "/functions/v1/ai-onboarding";

function textByLang(lang, ru, en) {
  return String(lang || "ru") === "en" ? en : ru;
}

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function safeJsonParse(raw, fallback) {
  try {
    return JSON.parse(String(raw || ""));
  } catch {
    return fallback;
  }
}

function buildFunctionUrl(explicit) {
  const base = String(explicit || "").trim();
  if (base) return base;
  const env = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};
  const supabaseUrl = String(env.VITE_SUPABASE_URL || "").trim();
  return supabaseUrl ? `${supabaseUrl}${DEFAULT_FUNCTION_PATH}` : DEFAULT_FUNCTION_PATH;
}

function getAnonKey() {
  const env = typeof import.meta !== "undefined" && import.meta.env ? import.meta.env : {};
  return String(env.VITE_SUPABASE_ANON_KEY || "").trim();
}

function detectResourcesLangFromHistory(history) {
  const text = history.map((x) => `${x.question} ${x.answer}`).join(" ").toLowerCase();
  const ru = /рус|russian|на русском|кирилл/.test(text);
  const en = /english|англ|на английском/.test(text);
  if (ru && en) return "both";
  if (ru) return "ru";
  if (en) return "en";
  return "both";
}

function buildQuestionBank(lang) {
  const isEn = String(lang || "ru") === "en";
  const langQ = isEn
    ? { id: "lang", text: "Preferred language of resources?", options: ["Russian", "English", "Both"] }
    : { id: "lang", text: "Язык ресурсов?", options: ["Русский", "English", "Оба"] };

  return {
    "UX/UI Designer": [
      {
        id: "level",
        text: isEn ? "What is your current level?" : "Какой у тебя уровень опыта?",
        options: ["Junior", "Middle", "Senior", "Freelance"],
        next: { Junior: "focus_j", Middle: "focus_m", Senior: "focus_s", Freelance: "focus_m" }
      },
      {
        id: "focus_j",
        text: isEn ? "What do you want to learn first?" : "Что хочешь освоить в первую очередь?",
        options: isEn
          ? ["UX basics", "Figma", "Portfolio", "Visual style"]
          : ["Основы UX", "Figma", "Портфолио", "Визуальный стиль"],
        next: { "*": "tool" }
      },
      {
        id: "focus_m",
        text: isEn ? "What do you work on most often?" : "Над чем чаще всего работаешь?",
        options: isEn
          ? ["Mobile apps", "Websites", "Design systems", "SaaS products"]
          : ["Мобильные приложения", "Веб-сайты", "Дизайн-системы", "SaaS продукты"],
        next: { "*": "tool" }
      },
      {
        id: "focus_s",
        text: isEn ? "What is your main focus right now?" : "Что сейчас в главном фокусе?",
        options: isEn
          ? ["Mentoring", "Design systems", "Strategy", "Freelance projects"]
          : ["Менторство", "Дизайн-системы", "Стратегия", "Фриланс проекты"],
        next: { "*": "tool" }
      },
      {
        id: "tool",
        text: isEn ? "What is your primary tool?" : "Какой инструмент основной?",
        options: ["Figma", "Adobe XD", "Sketch", "Framer"],
        next: { "*": "improve" }
      },
      {
        id: "improve",
        text: isEn ? "What do you want to improve most?" : "Что хочешь прокачать больше всего?",
        options: isEn
          ? ["Animation / Micro-UX", "Typography", "UX research", "Visual style"]
          : ["Анимации / Micro-UX", "Типографика", "UX-ресёрч", "Визуальный стиль"],
        next: { "*": "lang" }
      },
      langQ
    ],
    "Frontend Developer": [
      {
        id: "level",
        text: isEn ? "What is your current level?" : "Какой у тебя уровень?",
        options: ["Junior", "Middle", "Senior", "Full Stack"],
        next: { Junior: "stack_j", "*": "stack" }
      },
      {
        id: "stack_j",
        text: isEn ? "What are you learning now?" : "Что сейчас изучаешь?",
        options: isEn
          ? ["HTML / CSS basics", "JavaScript", "First framework", "TypeScript"]
          : ["HTML / CSS основы", "JavaScript", "Первый фреймворк", "TypeScript"],
        next: { "*": "focus" }
      },
      {
        id: "stack",
        text: isEn ? "What is your primary stack?" : "Основной стек?",
        options: ["React", "Vue", "Vanilla JS", "Next.js"],
        next: { "*": "focus" }
      },
      {
        id: "focus",
        text: isEn ? "What is your focus right now?" : "Что сейчас в фокусе?",
        options: isEn
          ? ["Performance", "Animations", "CSS / design", "Architecture"]
          : ["Производительность", "Анимации", "CSS / дизайн", "Архитектура"],
        next: { "*": "projects" }
      },
      {
        id: "projects",
        text: isEn ? "What projects do you usually do?" : "Какой тип проектов?",
        options: isEn
          ? ["Startups", "Enterprise", "Pet projects", "Freelance"]
          : ["Стартапы", "Корпоратив", "Пет-проекты", "Фриланс"],
        next: { "*": "lang" }
      },
      langQ
    ],
    "Product Manager": [
      {
        id: "stage",
        text: isEn ? "At what stage is your product?" : "На каком этапе обычно продукт?",
        options: ["Pre-MVP", "MVP / launch", "Growth", "Scale"],
        next: { "Pre-MVP": "focus_early", "MVP / launch": "focus_early", "*": "focus_growth" }
      },
      {
        id: "focus_early",
        text: isEn ? "What is most important now?" : "Что сейчас важнее всего?",
        options: isEn
          ? ["Hypothesis validation", "CustDev", "PMF", "MVP development"]
          : ["Проверка гипотез", "CustDev", "PMF", "Разработка MVP"],
        next: { "*": "ptype" }
      },
      {
        id: "focus_growth",
        text: isEn ? "What is most important now?" : "Что сейчас важнее всего?",
        options: isEn
          ? ["Metrics & analytics", "Retention", "Roadmap priorities", "Team processes"]
          : ["Метрики и аналитика", "Retention", "Приоритеты roadmap", "Процессы команды"],
        next: { "*": "ptype" }
      },
      {
        id: "ptype",
        text: isEn ? "What type of product?" : "Какой тип продукта?",
        options: isEn
          ? ["B2C app", "B2B SaaS", "Marketplace", "Internal tool"]
          : ["B2C приложение", "B2B SaaS", "Маркетплейс", "Внутренний инструмент"],
        next: { "*": "lang" }
      },
      langQ
    ]
  };
}

function buildDefaultQuestions(lang) {
  const isEn = String(lang || "ru") === "en";
  return [
    {
      id: "experience",
      text: isEn ? "How long have you been doing this?" : "Как давно ты этим занимаешься?",
      options: isEn ? ["Just started", "1-2 years", "3-5 years", "5+ years"] : ["Только начинаю", "1-2 года", "3-5 лет", "5+ лет"],
      next: { "*": "goal" }
    },
    {
      id: "goal",
      text: isEn ? "What is most important now?" : "Что для тебя сейчас важнее всего?",
      options: isEn
        ? ["Learn new skills", "Build projects", "Find inspiration", "Follow trends"]
        : ["Учиться новому", "Делать проекты", "Находить вдохновение", "Следить за трендами"],
      next: { "*": "format" }
    },
    {
      id: "format",
      text: isEn ? "What format do you prefer?" : "Какой формат материалов предпочитаешь?",
      options: isEn
        ? ["Articles", "Video", "Cases", "Tools"]
        : ["Статьи", "Видео", "Кейсы", "Инструменты"],
      next: { "*": "lang" }
    },
    {
      id: "lang",
      text: isEn ? "Preferred language of resources?" : "Язык ресурсов?",
      options: ["Русский", "English", isEn ? "Both" : "Оба"]
    }
  ];
}

function buildRoleOptions() {
  return ["UX/UI Designer", "Frontend Developer", "Product Manager", "Motion Designer", "Brand Designer", "Marketing / SMM", "3D / CGI Artist", "No-Code Developer"];
}

function detectFormatPref(history) {
  const t = history.map((x) => String(x.answer || "").toLowerCase()).join(" ");
  if (/инструмент|tool/.test(t)) return ["tools"];
  if (/кейс|case/.test(t)) return ["articles"];
  if (/шаблон|template/.test(t)) return ["templates"];
  return ["articles"];
}

function buildProfile(role, history) {
  const t = history.map((x) => String(x.answer || "").toLowerCase()).join(" ");
  let level = "Junior";
  if (/senior|сеньор/.test(t)) level = "Senior";
  else if (/middle|мидл/.test(t)) level = "Middle";
  return {
    role: role || "Generalist",
    level,
    goals: history.slice(0, 3).map((x) => String(x.answer || "")).filter(Boolean),
    format_pref: detectFormatPref(history)
  };
}

function resolveNextQuestion(currentQuestion, answer, allQuestions, answeredIds) {
  const map = currentQuestion?.next || {};
  const nextId = map[String(answer)] || map["*"] || "";
  if (nextId) {
    const next = allQuestions.find((q) => q.id === nextId);
    if (next && !answeredIds.has(next.id)) return next;
  }
  return allQuestions.find((q) => !answeredIds.has(q.id) && q.id !== currentQuestion.id) || null;
}

export function initOnboarding(options = {}) {
  const modal = options.modal;
  const triggerButton = options.triggerButton;
  const getLang = typeof options.getLang === "function" ? options.getLang : () => "ru";
  const ensureAuth = typeof options.ensureAuth === "function" ? options.ensureAuth : () => true;
  const getAccessToken = typeof options.getAccessToken === "function" ? options.getAccessToken : async () => "";
  const onImportResources = typeof options.onImportResources === "function" ? options.onImportResources : async () => ({ imported: 0, skipped: 0 });
  const functionUrl = buildFunctionUrl(options.functionUrl);

  if (!modal || !triggerButton) return null;

  const els = {
    title: modal.querySelector("[data-onboarding-title]"),
    subtitle: modal.querySelector("[data-onboarding-subtitle]"),
    chat: modal.querySelector("[data-onboarding-chat]"),
    chips: modal.querySelector("[data-onboarding-chips]"),
    input: modal.querySelector("[data-onboarding-input]"),
    send: modal.querySelector("[data-onboarding-send]"),
    skip: modal.querySelector("[data-onboarding-skip]"),
    restart: modal.querySelector("[data-onboarding-restart]"),
    footer: modal.querySelector(".row.row--end"),
    close: modal.querySelector("[data-onboarding-close]"),
    status: modal.querySelector("[data-onboarding-status]")
  };

  const initialState = {
    step: "role",
    role: "",
    allQuestions: [],
    currentQuestion: null,
    history: [],
    profile: null,
    resources: [],
    loading: false,
    importSummary: null
  };

  let state = { ...initialState };

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function resetState() {
    state = { ...initialState };
    localStorage.removeItem(STORAGE_KEY);
  }

  function setLoading(next) {
    state.loading = !!next;
    if (els.skip) els.skip.disabled = state.loading;
  }

  function setStatus(text = "") {
    if (els.status) els.status.textContent = text;
  }

  function appendMessage(text, role = "bot") {
    if (!els.chat) return;
    const msg = document.createElement("div");
    msg.className = `onboarding-chat__msg onboarding-chat__msg--${role}`;
    msg.textContent = String(text || "");
    els.chat.appendChild(msg);
    els.chat.scrollTop = els.chat.scrollHeight;
  }

  function applyButtonsText() {
    if (els.title) els.title.textContent = textByLang(getLang(), "AI-онбординг", "AI onboarding");
    if (els.restart) els.restart.textContent = textByLang(getLang(), "Начать заново", "Restart");
    if (els.skip) els.skip.textContent = state.step === "result" ? textByLang(getLang(), "Закрыть", "Close") : textByLang(getLang(), "Пропустить", "Skip");
  }

  function hideFreeInput() {
    if (els.input) {
      els.input.value = "";
      els.input.disabled = true;
      const row = els.input.closest(".row") || els.input.parentElement;
      if (row) row.style.display = "none";
      else els.input.style.display = "none";
    }
    if (els.send) els.send.style.display = "none";
    if (els.footer) els.footer.classList.add("onboarding-footer");
  }

  function removeInlineImportButton() {
    els.footer?.querySelector(".ob-inline-import")?.remove();
  }

  function renderInlineImportButton() {
    if (!els.footer || !state.resources.length) return;
    removeInlineImportButton();
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn--primary ob-inline-import";
    btn.textContent = textByLang(getLang(), "Добавить ссылки в Vault", "Add links to Vault");
    btn.addEventListener("click", () => void importResources());
    if (els.restart) els.footer.insertBefore(btn, els.restart);
    else if (els.skip) els.footer.insertBefore(btn, els.skip);
    else els.footer.appendChild(btn);
  }

  function renderBackButton() {
    if (!els.chips || state.step !== "questions" || !state.history.length) return;
    const back = document.createElement("button");
    back.type = "button";
    back.className = "ob-back-btn";
    back.textContent = textByLang(getLang(), "← Назад", "← Back");
    back.addEventListener("click", goBack);
    els.chips.appendChild(back);
  }

  function renderRoleChips() {
    if (!els.chips) return;
    els.chips.dataset.mode = "roles";
    els.chips.innerHTML = "";
    const wrap = document.createElement("div");
    wrap.className = "onboarding-chips-wrap";
    for (const role of buildRoleOptions()) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip";
      btn.textContent = role;
      btn.addEventListener("click", () => submitRole(role));
      wrap.appendChild(btn);
    }
    els.chips.appendChild(wrap);
  }

  function renderQuestionChips(question) {
    if (!els.chips) return;
    els.chips.dataset.mode = "answers";
    els.chips.innerHTML = "";
    renderBackButton();
    const wrap = document.createElement("div");
    wrap.className = "onboarding-chips-wrap";
    for (const opt of Array.isArray(question?.options) ? question.options : []) {
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "chip";
      btn.textContent = opt;
      btn.addEventListener("click", () => submitAnswer(opt));
      wrap.appendChild(btn);
    }
    els.chips.appendChild(wrap);
  }

  function showSkeletonResources(count = 5) {
    if (!els.chat) return;
    const wrap = document.createElement("div");
    wrap.id = "ob-skeleton-wrap";
    for (let i = 0; i < count; i += 1) {
      const sk = document.createElement("div");
      sk.className = "ob-skeleton ob-skeleton-card";
      wrap.appendChild(sk);
    }
    els.chat.appendChild(wrap);
    els.chat.scrollTop = els.chat.scrollHeight;
  }

  function removeSkeletonResources() {
    const sk = document.getElementById("ob-skeleton-wrap");
    sk?.remove();
  }

  function renderResourceCards(resources) {
    if (!els.chat || !Array.isArray(resources) || !resources.length) return;
    for (const [idx, r] of resources.slice(0, 12).entries()) {
      const title = String(r?.title || r?.url || `Resource ${idx + 1}`);
      const url = String(r?.url || "");
      const host = (() => {
        try {
          return new URL(url).hostname;
        } catch {
          return "";
        }
      })();
      const card = document.createElement("a");
      card.className = "onboarding-chat__resource ob-resource-card";
      card.style.animationDelay = `${Math.min(idx, 8) * 28}ms`;
      card.href = url;
      card.target = "_blank";
      card.rel = "noreferrer";
      card.innerHTML = `<span>${idx + 1}.</span> ${escapeHtml(title)}${host ? ` <small>${escapeHtml(host)}</small>` : ""}`;
      els.chat.appendChild(card);
    }
    els.chat.scrollTop = els.chat.scrollHeight;
  }

  async function importResources() {
    if (!state.resources.length) return;
    setLoading(true);
    try {
      const result = await onImportResources(state.resources, state.profile);
      state.importSummary = { imported: Number(result?.imported || 0), skipped: Number(result?.skipped || 0) };
      persist();
      appendMessage(textByLang(getLang(), `Импортировано: ${state.importSummary.imported}, пропущено: ${state.importSummary.skipped}.`, `Imported: ${state.importSummary.imported}, skipped: ${state.importSummary.skipped}.`), "bot");
    } catch (err) {
      appendMessage(err?.message || "Import failed.", "bot");
    } finally {
      setLoading(false);
    }
  }

  async function finalizeProfileAndResources() {
    setLoading(true);
    setStatus(textByLang(getLang(), "Подбираю ресурсы...", "Selecting resources..."));
    appendMessage(textByLang(getLang(), "Собираю персональные ресурсы для тебя...", "Collecting personal resources for you..."), "bot");
    showSkeletonResources(5);
    try {
      const token = String(await getAccessToken() || "").trim();
      if (!token) throw new Error(textByLang(getLang(), "Нет активной сессии.", "No active session."));
      const headers = { "Content-Type": "application/json", Authorization: `Bearer ${token}` };
      const anonKey = getAnonKey();
      if (anonKey) headers.apikey = anonKey;
      const res = await fetch(functionUrl, {
        method: "POST",
        headers,
        body: JSON.stringify({
          action: "finalize_profile",
          role: state.role,
          answers: state.history.map((x) => ({ question: x.question, answer: x.answer })),
          resources_lang: detectResourcesLangFromHistory(state.history)
        })
      });
      if (!res.ok) throw new Error((await res.text().catch(() => "")) || `Finalize failed (${res.status})`);
      const data = await res.json();
      state.profile = data?.ai_profile || buildProfile(state.role, state.history);
      state.resources = Array.isArray(data?.resources) ? data.resources : [];
    } catch (err) {
      state.profile = state.profile || buildProfile(state.role, state.history);
      state.resources = [];
      appendMessage(err?.message || "Failed to fetch resources.", "bot");
    } finally {
      removeSkeletonResources();
      setLoading(false);
      setStatus("");
      persist();
      renderResult();
    }
  }

  function renderResult() {
    if (els.subtitle) els.subtitle.textContent = textByLang(getLang(), "Готово — профиль и ресурсы", "Done — profile and resources");
    if (els.chips) {
      els.chips.dataset.mode = "result";
      els.chips.innerHTML = "";
    }
    renderInlineImportButton();
    if (!els.chat) return;
    appendMessage(
      state.resources.length
        ? textByLang(getLang(), `Нашел ${state.resources.length} ресурсов:`, `Found ${state.resources.length} resources:`)
        : textByLang(getLang(), "Профиль собран. Ресурсы пока не найдены.", "Profile is ready. No resources found yet."),
      "bot"
    );
    renderResourceCards(state.resources);
  }

  function updateSubtitle() {
    if (!els.subtitle) return;
    if (state.step === "role") {
      els.subtitle.textContent = textByLang(getLang(), "Кто ты в диджитале?", "Who are you in digital?");
      return;
    }
    if (state.step === "questions") {
      const total = state.allQuestions.length || 1;
      const step = state.history.length + 1;
      els.subtitle.textContent = textByLang(getLang(), `Вопрос ${step} из ${total}`, `Question ${step} of ${total}`);
      return;
    }
    els.subtitle.textContent = textByLang(getLang(), "Готово — профиль и ресурсы", "Done — profile and resources");
  }

  function askCurrentQuestion() {
    if (!state.currentQuestion) {
      state.step = "result";
      state.profile = buildProfile(state.role, state.history);
      state.resources = [];
      state.importSummary = null;
      persist();
      void finalizeProfileAndResources();
      return;
    }
    state.step = "questions";
    appendMessage(String(state.currentQuestion.text || ""), "bot");
    updateSubtitle();
    renderQuestionChips(state.currentQuestion);
    persist();
  }

  function submitRole(role) {
    if (!role) return;
    state.role = String(role);
    state.history = [];
    state.profile = null;
    state.resources = [];
    state.importSummary = null;
    state.allQuestions = buildQuestionBank(getLang())[state.role] || buildDefaultQuestions(getLang());
    state.currentQuestion = state.allQuestions[0] || null;
    state.step = "questions";
    if (els.chat) els.chat.innerHTML = "";
    appendMessage(state.role, "user");
    askCurrentQuestion();
  }

  function submitAnswer(answerRaw) {
    const answer = String(answerRaw || "").trim();
    if (!answer || !state.currentQuestion) return;
    appendMessage(answer, "user");
    state.history.push({
      questionId: String(state.currentQuestion.id || ""),
      question: String(state.currentQuestion.text || ""),
      answer
    });
    const answeredIds = new Set(state.history.map((x) => x.questionId));
    state.currentQuestion = resolveNextQuestion(state.currentQuestion, answer, state.allQuestions, answeredIds);
    askCurrentQuestion();
  }

  function goBack() {
    if (!state.history.length) return;
    state.history.pop();
    const answeredIds = new Set(state.history.map((x) => x.questionId));
    state.currentQuestion = state.allQuestions.find((q) => !answeredIds.has(q.id)) || state.allQuestions[0] || null;
    if (els.chat) {
      const msgs = els.chat.querySelectorAll(".onboarding-chat__msg");
      const removeCount = Math.min(2, msgs.length);
      for (let i = 0; i < removeCount; i += 1) msgs[msgs.length - 1 - i]?.remove();
    }
    askCurrentQuestion();
  }

  function renderRole() {
    if (els.chat) {
      els.chat.innerHTML = "";
      appendMessage(
        textByLang(
          getLang(),
          "Привет. Выбери роль, отвечай на вопросы, и я подберу ресурсы.",
          "Hi. Choose your role, answer a few questions, and I will pick resources."
        ),
        "bot"
      );
    }
    renderRoleChips();
    removeInlineImportButton();
    updateSubtitle();
    setStatus("");
  }

  function open() {
    if (!ensureAuth()) return;
    const cached = safeJsonParse(localStorage.getItem(STORAGE_KEY), null);
    if (cached && typeof cached === "object") state = { ...initialState, ...cached, loading: false };
    else resetState();
    applyButtonsText();
    hideFreeInput();
    if (state.step === "result") renderResult();
    else if (state.step === "questions") askCurrentQuestion();
    else renderRole();
    modal.showModal();
  }

  function restart() {
    resetState();
    applyButtonsText();
    hideFreeInput();
    renderRole();
  }

  function skip() {
    if (state.step === "result") {
      modal.close();
      return;
    }
    state.currentQuestion = null;
    askCurrentQuestion();
  }

  function bind() {
    triggerButton.addEventListener("click", open);
    els.close?.addEventListener("click", () => modal.close());
    els.skip?.addEventListener("click", skip);
    els.restart?.addEventListener("click", restart);
  }

  bind();
  return { open };
}

