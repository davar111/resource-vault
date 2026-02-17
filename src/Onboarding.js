const STORAGE_KEY = "resource_vault_onboarding_state_v3";
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

function buildQuestionBank(lang) {
  const isEn = String(lang || "ru") === "en";
  const langQ = isEn
    ? { text: "Preferred language of resources?", options: ["Russian", "English", "Both"] }
    : { text: "Язык ресурсов?", options: ["Русский", "English", "Оба"] };

  return {
    "UX/UI Designer": [
      { text: isEn ? "What is your current level?" : "Какой у тебя уровень опыта?", options: ["Junior", "Middle", "Senior", "Freelance"] },
      {
        text: isEn ? "What do you work on most often?" : "Над чем чаще всего работаешь?",
        options: isEn
          ? ["Mobile apps", "Websites", "Design systems", "SaaS products"]
          : ["Мобильные приложения", "Веб-сайты", "Дизайн-системы", "SaaS продукты"]
      },
      { text: isEn ? "What is your primary tool?" : "Какой инструмент основной?", options: ["Figma", "Adobe XD", "Sketch", "Framer"] },
      {
        text: isEn ? "What do you want to improve first?" : "Что хочешь прокачать?",
        options: isEn
          ? ["Animation / Micro-UX", "Typography", "UX research", "Visual style"]
          : ["Анимации / Micro-UX", "Типографика", "UX-ресёрч", "Визуальный стиль"]
      },
      langQ
    ],
    "Frontend Developer": [
      { text: isEn ? "What is your current level?" : "Какой у тебя уровень?", options: ["Junior", "Middle", "Senior", "Full Stack"] },
      { text: isEn ? "What is your primary stack?" : "Основной стек?", options: ["React", "Vue", "Vanilla JS", "Next.js"] },
      {
        text: isEn ? "What is your focus right now?" : "Что сейчас в фокусе?",
        options: isEn
          ? ["Performance", "Animations", "CSS / design", "Architecture"]
          : ["Производительность", "Анимации", "CSS / дизайн", "Архитектура"]
      },
      {
        text: isEn ? "What projects do you usually do?" : "Какой тип проектов?",
        options: isEn
          ? ["Startups", "Enterprise", "Pet projects", "Freelance"]
          : ["Стартапы", "Корпоратив", "Свои пет-проекты", "Фриланс"]
      },
      langQ
    ],
    "Product Manager": [
      { text: isEn ? "At which stage is your product most often?" : "На каком этапе обычно продукт?", options: ["Pre-MVP", "MVP / launch", "Growth", "Scale"] },
      {
        text: isEn ? "What matters most now?" : "Что сейчас важнее?",
        options: isEn
          ? ["Metrics & analytics", "CustDev / research", "Roadmap & priorities", "Team & processes"]
          : ["Метрики и аналитика", "CustDev / исследования", "Роадмап и приоритеты", "Команда и процессы"]
      },
      {
        text: isEn ? "What type of product?" : "Какой тип продукта?",
        options: isEn
          ? ["B2C app", "B2B SaaS", "Marketplace", "Internal tool"]
          : ["B2C приложение", "B2B SaaS", "Маркетплейс", "Внутренний инструмент"]
      },
      langQ
    ]
  };
}

function buildDefaultQuestions(lang) {
  const isEn = String(lang || "ru") === "en";
  return [
    { text: isEn ? "How long have you been doing this?" : "Как давно ты этим занимаешься?", options: isEn ? ["Just started", "1-2 years", "3-5 years", "5+ years"] : ["Только начинаю", "1-2 года", "3-5 лет", "5+ лет"] },
    {
      text: isEn ? "What is most important for you now?" : "Что для тебя сейчас важнее всего?",
      options: isEn ? ["Learn faster", "Build projects", "Find inspiration", "Follow trends"] : ["Учиться новому", "Делать проекты", "Находить вдохновение", "Следить за трендами"]
    },
    {
      text: isEn ? "What content format do you prefer?" : "Какой формат материалов предпочитаешь?",
      options: isEn ? ["Articles and guides", "Video tutorials", "Cases and examples", "Tools and resources"] : ["Статьи и гайды", "Видео / туториалы", "Примеры и кейсы", "Инструменты / ресурсы"]
    },
    { text: isEn ? "Preferred language of resources?" : "Язык ресурсов?", options: ["Русский", "English", isEn ? "Both" : "Оба"] }
  ];
}

function buildRoleOptions() {
  return ["UX/UI Designer", "Frontend Developer", "Product Manager", "Motion Designer", "Brand Designer", "Marketing / SMM", "3D / CGI Artist", "No-Code Developer"];
}

function buildProfile(role, answers) {
  const lower = answers.map((x) => String(x.answer || "").toLowerCase()).join(" ");
  let level = "Junior";
  if (lower.includes("senior")) level = "Senior";
  else if (lower.includes("middle")) level = "Middle";
  return {
    role: role || "Generalist",
    level,
    goals: answers.slice(0, 2).map((x) => String(x.answer || "")).filter(Boolean),
    focus: answers.map((x) => String(x.answer || "")).filter(Boolean).slice(0, 6)
  };
}

function detectResourcesLangFromAnswers(answers) {
  const text = answers.map((x) => `${x.question} ${x.answer}`).join(" ").toLowerCase();
  const ru = /рус|russian|на русском|кирилл/.test(text);
  const en = /english|англ|на английском/.test(text);
  if (ru && en) return "both";
  if (ru) return "ru";
  if (en) return "en";
  return "both";
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
    close: modal.querySelector("[data-onboarding-close]"),
    status: modal.querySelector("[data-onboarding-status]")
  };

  const initialState = {
    step: "role",
    role: "",
    questionIndex: 0,
    questions: [],
    currentQuestion: null,
    answers: [],
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

  function appendMessage(text, role = "bot") {
    if (!els.chat) return;
    const msg = document.createElement("div");
    msg.className = `onboarding-chat__msg onboarding-chat__msg--${role}`;
    msg.innerHTML = escapeHtml(text);
    els.chat.appendChild(msg);
    els.chat.scrollTop = els.chat.scrollHeight;
  }

  function setLoading(next) {
    state.loading = !!next;
    if (els.send) els.send.disabled = state.loading;
    if (els.skip) els.skip.disabled = state.loading;
    if (els.input) els.input.disabled = state.loading;
  }

  function setStatus(text = "") {
    if (els.status) els.status.textContent = text;
  }

  function applyButtonsText() {
    if (els.title) els.title.textContent = textByLang(getLang(), "AI-онбординг", "AI onboarding");
    if (els.restart) els.restart.textContent = textByLang(getLang(), "Начать заново", "Restart");
    if (els.skip) els.skip.textContent = state.step === "result" ? textByLang(getLang(), "Закрыть", "Close") : textByLang(getLang(), "Пропустить", "Skip");
    if (els.send) els.send.textContent = "Send";
    if (els.input) {
      if (state.step === "role") els.input.placeholder = textByLang(getLang(), "Напиши роль или выбери ниже", "Type role or choose below");
      else if (state.step === "questions") els.input.placeholder = textByLang(getLang(), "Напиши ответ...", "Write your answer...");
      else els.input.placeholder = textByLang(getLang(), "Готово", "Done");
    }
  }

  function renderRoleChips() {
    if (!els.chips) return;
    els.chips.dataset.mode = "roles";
    els.chips.innerHTML = buildRoleOptions()
      .map((x) => `<button type="button" class="chip" data-role="${escapeHtml(x)}">${escapeHtml(x)}</button>`)
      .join("");
    els.chips.querySelectorAll("[data-role]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const role = String(btn.getAttribute("data-role") || "").trim();
        if (!role) return;
        if (els.input) els.input.value = role;
        submitRole(role);
      });
    });
  }

  function renderQuestionOptions(question) {
    if (!els.chips) return;
    els.chips.dataset.mode = "answers";
    const options = Array.isArray(question?.options) ? question.options : [];
    els.chips.innerHTML = options.map((x) => `<button type="button" class="chip" data-answer="${escapeHtml(x)}">${escapeHtml(x)}</button>`).join("");
    els.chips.querySelectorAll("[data-answer]").forEach((btn) => {
      btn.addEventListener("click", () => submitAnswer(String(btn.getAttribute("data-answer") || "")));
    });
  }

  async function importResources() {
    if (!state.resources.length) return;
    setLoading(true);
    try {
      const result = await onImportResources(state.resources, state.profile);
      state.importSummary = {
        imported: Number(result?.imported || 0),
        skipped: Number(result?.skipped || 0)
      };
      persist();
      appendMessage(textByLang(getLang(), `Импортировано: ${state.importSummary.imported}, пропущено: ${state.importSummary.skipped}.`, `Imported: ${state.importSummary.imported}, skipped: ${state.importSummary.skipped}.`), "bot");
      render();
    } catch (err) {
      appendMessage(err?.message || "Import failed.", "bot");
    } finally {
      setLoading(false);
    }
  }

  function renderResult() {
    if (els.subtitle) els.subtitle.textContent = textByLang(getLang(), "Готово: профиль и ресурсы", "Done: profile and resources");
    if (els.chips) {
      els.chips.dataset.mode = "result";
      els.chips.innerHTML = "";
      const values = state.answers.map((x) => String(x.answer || "")).filter(Boolean).slice(0, 6);
      for (const value of values) {
        const tag = document.createElement("button");
        tag.type = "button";
        tag.className = "chip";
        tag.disabled = true;
        tag.textContent = value;
        els.chips.appendChild(tag);
      }
      if (state.resources.length) {
        const importBtn = document.createElement("button");
        importBtn.type = "button";
        importBtn.className = "btn btn--primary";
        importBtn.textContent = textByLang(getLang(), "Добавить ссылки в Vault", "Add links to Vault");
        importBtn.addEventListener("click", () => void importResources());
        els.chips.appendChild(importBtn);
      }
    }

    if (!els.chat) return;
    els.chat.innerHTML = "";
    appendMessage(textByLang(getLang(), "Отлично, интервью завершено. Профиль собран.", "Great, interview is done. Profile is ready."), "bot");
    const pre = document.createElement("pre");
    pre.className = "onboarding-chat__json";
    pre.textContent = JSON.stringify(state.profile || {}, null, 2);
    els.chat.appendChild(pre);

    if (state.resources.length) {
      const wrap = document.createElement("div");
      wrap.className = "onboarding-chat__list";
      wrap.innerHTML = state.resources
        .slice(0, 12)
        .map((r, idx) => {
          const title = escapeHtml(r?.title || r?.url || `Resource ${idx + 1}`);
          const url = escapeHtml(r?.url || "");
          return `<a class="onboarding-chat__resource" href="${url}" target="_blank" rel="noreferrer">${idx + 1}. ${title}</a>`;
        })
        .join("");
      els.chat.appendChild(wrap);
    }
    if (state.importSummary) {
      appendMessage(
        textByLang(
          getLang(),
          `Импортировано: ${state.importSummary.imported}, пропущено: ${state.importSummary.skipped}.`,
          `Imported: ${state.importSummary.imported}, skipped: ${state.importSummary.skipped}.`
        ),
        "bot"
      );
    }
  }

  async function finalizeProfileAndResources() {
    setLoading(true);
    setStatus(textByLang(getLang(), "Подбираю качественные ресурсы...", "Selecting high-quality resources..."));
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
          answers: state.answers,
          resources_lang: detectResourcesLangFromAnswers(state.answers)
        })
      });
      if (!res.ok) throw new Error((await res.text().catch(() => "")) || `Finalize failed (${res.status})`);
      const data = await res.json();
      state.profile = data?.ai_profile || buildProfile(state.role, state.answers);
      state.resources = Array.isArray(data?.resources) ? data.resources : [];
    } catch (err) {
      state.profile = state.profile || buildProfile(state.role, state.answers);
      state.resources = [];
      appendMessage(err?.message || "Failed to fetch resources.", "bot");
    } finally {
      setLoading(false);
      setStatus("");
      persist();
      render();
    }
  }

  function askCurrentQuestion() {
    if (state.questionIndex >= state.questions.length) {
      state.step = "result";
      state.currentQuestion = null;
      state.profile = buildProfile(state.role, state.answers);
      state.resources = [];
      state.importSummary = null;
      persist();
      render();
      void finalizeProfileAndResources();
      return;
    }
    const q = state.questions[state.questionIndex];
    state.currentQuestion = q;
    state.step = "questions";
    persist();
    appendMessage(String(q.text || ""), "bot");
    render();
  }

  function submitRole(value) {
    const role = String(value || els.input?.value || "").trim();
    if (!role) return;
    state.role = role;
    state.answers = [];
    state.questionIndex = 0;
    state.profile = null;
    state.resources = [];
    state.importSummary = null;
    state.questions = buildQuestionBank(getLang())[role] || buildDefaultQuestions(getLang());
    state.currentQuestion = null;
    appendMessage(role, "user");
    askCurrentQuestion();
  }

  function submitAnswer(value) {
    const answer = String(value || els.input?.value || "").trim();
    if (!answer || !state.currentQuestion) return;
    appendMessage(answer, "user");
    state.answers.push({ question: String(state.currentQuestion.text || ""), answer });
    state.questionIndex += 1;
    state.currentQuestion = null;
    persist();
    askCurrentQuestion();
  }

  function onSend() {
    if (state.step === "role") submitRole(els.input?.value || "");
    else if (state.step === "questions") submitAnswer(els.input?.value || "");
  }

  function render() {
    applyButtonsText();
    if (!els.chat) return;

    if (state.step === "role") {
      if (els.subtitle) els.subtitle.textContent = textByLang(getLang(), "Кто ты в диджитале?", "Who are you in digital?");
      els.chat.innerHTML = "";
      appendMessage(textByLang(getLang(), "Привет. Выбери роль и отвечай на короткие вопросы. В конце соберу профиль и ресурсы.", "Hi. Choose a role and answer short questions. I will build profile and resources at the end."), "bot");
      renderRoleChips();
      setStatus("");
      if (els.input) {
        els.input.value = "";
        els.input.focus();
      }
      return;
    }

    if (state.step === "questions") {
      if (els.subtitle) {
        const total = Math.max(1, state.questions.length);
        const step = Math.min(state.questionIndex + 1, total);
        els.subtitle.textContent = textByLang(getLang(), `Диалоговый шаг ${step}/${total}`, `Dialogue step ${step}/${total}`);
      }
      renderQuestionOptions(state.currentQuestion);
      setStatus("");
      if (els.input) {
        els.input.value = "";
        els.input.focus();
      }
      return;
    }

    renderResult();
    setStatus("");
  }

  function open() {
    if (!ensureAuth()) return;
    const cached = safeJsonParse(localStorage.getItem(STORAGE_KEY), null);
    if (cached && typeof cached === "object" && cached.step === "questions" && cached.role) state = { ...initialState, ...cached };
    else resetState();
    render();
    modal.showModal();
  }

  function restart() {
    resetState();
    render();
  }

  function skip() {
    if (state.step === "result") {
      modal.close();
      return;
    }
    state.step = "result";
    state.profile = state.profile || buildProfile(state.role, state.answers);
    persist();
    render();
  }

  function bind() {
    triggerButton.addEventListener("click", open);
    els.close?.addEventListener("click", () => modal.close());
    els.send?.addEventListener("click", onSend);
    els.skip?.addEventListener("click", skip);
    els.restart?.addEventListener("click", restart);
    els.input?.addEventListener("keydown", (e) => {
      if (e.key !== "Enter") return;
      e.preventDefault();
      onSend();
    });
  }

  bind();
  return { open };
}
