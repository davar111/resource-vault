const STORAGE_KEY = "resource_vault_onboarding_state_v2";

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

function buildQuestionBank(lang) {
  const isEn = String(lang || "ru") === "en";
  if (isEn) {
    return {
      "UX/UI Designer": [
        { text: "What is your current level?", options: ["Junior", "Middle", "Senior", "Freelance"] },
        { text: "What do you work on most often?", options: ["Mobile apps", "Websites", "Design systems", "SaaS products"] },
        { text: "What is your primary tool?", options: ["Figma", "Adobe XD", "Sketch", "Framer"] },
        { text: "What do you want to improve first?", options: ["Animation / Micro-UX", "Typography", "UX research", "Visual style"] }
      ],
      "Frontend Developer": [
        { text: "What is your current level?", options: ["Junior", "Middle", "Senior", "Full Stack"] },
        { text: "What is your primary stack?", options: ["React", "Vue", "Vanilla JS", "Next.js"] },
        { text: "What is your focus right now?", options: ["Performance", "Animations", "CSS / design", "Architecture"] },
        { text: "What projects do you usually do?", options: ["Startups", "Enterprise", "Pet projects", "Freelance"] }
      ],
      "Product Manager": [
        { text: "At which stage is your product most often?", options: ["Pre-MVP", "MVP / launch", "Growth", "Scale"] },
        { text: "What matters most now?", options: ["Metrics & analytics", "CustDev / research", "Roadmap & priorities", "Team & processes"] },
        { text: "What type of product?", options: ["B2C app", "B2B SaaS", "Marketplace", "Internal tool"] }
      ]
    };
  }

  return {
    "UX/UI Designer": [
      { text: "Какой у тебя уровень опыта?", options: ["Junior", "Middle", "Senior", "Freelance"] },
      { text: "Над чем чаще всего работаешь?", options: ["Мобильные приложения", "Веб-сайты", "Дизайн-системы", "SaaS продукты"] },
      { text: "Какой инструмент основной?", options: ["Figma", "Adobe XD", "Sketch", "Framer"] },
      { text: "Что хочешь прокачать?", options: ["Анимации / Micro-UX", "Типографика", "UX-ресёрч", "Визуальный стиль"] }
    ],
    "Frontend Developer": [
      { text: "Какой у тебя уровень?", options: ["Junior", "Middle", "Senior", "Full Stack"] },
      { text: "Основной стек?", options: ["React", "Vue", "Vanilla JS", "Next.js"] },
      { text: "Что сейчас в фокусе?", options: ["Производительность", "Анимации", "CSS / дизайн", "Архитектура"] },
      { text: "Какой тип проектов?", options: ["Стартапы", "Корпоратив", "Свои пет-проекты", "Фриланс"] }
    ],
    "Product Manager": [
      { text: "На каком этапе обычно продукт?", options: ["Pre-MVP", "MVP / старт", "Growth", "Scale"] },
      { text: "Что сейчас важнее?", options: ["Метрики и аналитика", "CustDev / исследования", "Роадмап и приоритеты", "Команда и процессы"] },
      { text: "Какой тип продукта?", options: ["B2C приложение", "B2B SaaS", "Маркетплейс", "Внутренний инструмент"] }
    ]
  };
}

function buildDefaultQuestions(lang) {
  const isEn = String(lang || "ru") === "en";
  return isEn
    ? [
      { text: "How long have you been doing this?", options: ["Just started", "1-2 years", "3-5 years", "5+ years"] },
      { text: "What is most important for you now?", options: ["Learn faster", "Build projects", "Find inspiration", "Follow trends"] },
      { text: "What content format do you prefer?", options: ["Articles and guides", "Video tutorials", "Cases and examples", "Tools and resources"] }
    ]
    : [
      { text: "Как давно ты этим занимаешься?", options: ["Только начинаю", "1-2 года", "3-5 лет", "5+ лет"] },
      { text: "Что для тебя сейчас важнее всего?", options: ["Учиться новому", "Делать проекты", "Находить вдохновение", "Следить за трендами"] },
      { text: "Какой формат материалов предпочитаешь?", options: ["Статьи и гайды", "Видео / туториалы", "Примеры и кейсы", "Инструменты / ресурсы"] }
    ];
}

function buildRoleOptions(lang) {
  const isEn = String(lang || "ru") === "en";
  return isEn
    ? ["UX/UI Designer", "Frontend Developer", "Product Manager", "Motion Designer", "Brand Designer", "Marketing / SMM", "3D / CGI Artist", "No-Code Developer"]
    : ["UX/UI Designer", "Frontend Developer", "Product Manager", "Motion Designer", "Brand Designer", "Marketing / SMM", "3D / CGI Artist", "No-Code Developer"];
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
    focus: answers.map((x) => String(x.answer || "")).filter(Boolean).slice(0, 5)
  };
}

export function initOnboarding(options = {}) {
  const modal = options.modal;
  const triggerButton = options.triggerButton;
  const getLang = typeof options.getLang === "function" ? options.getLang : () => "ru";
  const ensureAuth = typeof options.ensureAuth === "function" ? options.ensureAuth : () => true;

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
    profile: null
  };

  let state = { ...initialState };

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function clearPersisted() {
    localStorage.removeItem(STORAGE_KEY);
  }

  function resetState() {
    state = { ...initialState };
    clearPersisted();
  }

  function appendMessage(text, role = "bot") {
    if (!els.chat) return;
    const msg = document.createElement("div");
    msg.className = `onboarding-chat__msg onboarding-chat__msg--${role}`;
    msg.innerHTML = escapeHtml(text);
    els.chat.appendChild(msg);
    els.chat.scrollTop = els.chat.scrollHeight;
  }

  function setStatus(text = "") {
    if (els.status) els.status.textContent = text;
  }

  function setInputPlaceholder() {
    if (!els.input) return;
    if (state.step === "role") {
      els.input.placeholder = textByLang(getLang(), "Напиши роль или выбери ниже", "Type role or choose below");
      return;
    }
    if (state.step === "questions") {
      els.input.placeholder = textByLang(getLang(), "Напиши ответ...", "Write your answer...");
      return;
    }
    els.input.placeholder = textByLang(getLang(), "Готово", "Done");
  }

  function applyButtonsText() {
    if (els.title) els.title.textContent = textByLang(getLang(), "AI-онбординг", "AI onboarding");
    if (els.restart) els.restart.textContent = textByLang(getLang(), "Начать заново", "Restart");
    if (els.skip) {
      els.skip.textContent = state.step === "result"
        ? textByLang(getLang(), "Закрыть", "Close")
        : textByLang(getLang(), "Пропустить", "Skip");
    }
    if (els.send) els.send.textContent = textByLang(getLang(), "Send", "Send");
    setInputPlaceholder();
  }

  function renderRoleChips() {
    if (!els.chips) return;
    els.chips.dataset.mode = "roles";
    const roles = buildRoleOptions(getLang());
    els.chips.innerHTML = roles
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
    els.chips.innerHTML = options
      .map((x) => `<button type="button" class="chip" data-answer="${escapeHtml(x)}">${escapeHtml(x)}</button>`)
      .join("");
    els.chips.querySelectorAll("[data-answer]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const answer = String(btn.getAttribute("data-answer") || "").trim();
        if (!answer) return;
        if (els.input) els.input.value = answer;
        submitAnswer(answer);
      });
    });
  }

  function renderResult() {
    if (els.subtitle) {
      els.subtitle.textContent = textByLang(getLang(), "Готово: персональный профиль", "Done: personal profile");
    }
    if (els.chips) {
      els.chips.dataset.mode = "result";
      els.chips.innerHTML = "";
      const values = (state.answers || []).map((x) => String(x.answer || "")).filter(Boolean).slice(0, 6);
      for (const value of values) {
        const tag = document.createElement("button");
        tag.type = "button";
        tag.className = "chip";
        tag.textContent = value;
        tag.disabled = true;
        els.chips.appendChild(tag);
      }
    }
    if (els.chat) {
      const done = textByLang(
        getLang(),
        "Отлично, интервью завершено. Профиль собран.",
        "Great, interview is done. Profile is ready."
      );
      appendMessage(done, "bot");
      const pre = document.createElement("pre");
      pre.className = "onboarding-chat__json";
      pre.textContent = JSON.stringify(state.profile || {}, null, 2);
      els.chat.appendChild(pre);
      els.chat.scrollTop = els.chat.scrollHeight;
    }
    if (els.input) els.input.value = "";
  }

  function askCurrentQuestion() {
    if (state.questionIndex >= state.questions.length) {
      state.step = "result";
      state.currentQuestion = null;
      state.profile = buildProfile(state.role, state.answers);
      persist();
      render();
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
    state.questions = buildQuestionBank(getLang())[role] || buildDefaultQuestions(getLang());
    state.currentQuestion = null;

    appendMessage(role, "user");
    askCurrentQuestion();
  }

  function submitAnswer(value) {
    const answer = String(value || els.input?.value || "").trim();
    if (!answer || !state.currentQuestion) return;

    appendMessage(answer, "user");
    state.answers.push({
      question: String(state.currentQuestion.text || ""),
      answer
    });
    state.questionIndex += 1;
    state.currentQuestion = null;
    persist();
    askCurrentQuestion();
  }

  function onSend() {
    if (state.step === "role") {
      submitRole(els.input?.value || "");
      return;
    }
    if (state.step === "questions") {
      submitAnswer(els.input?.value || "");
    }
  }

  function render() {
    applyButtonsText();
    if (!els.chat) return;

    if (state.step === "role") {
      if (els.subtitle) {
        els.subtitle.textContent = textByLang(getLang(), "Кто ты в диджитале?", "Who are you in digital?");
      }
      els.chat.innerHTML = "";
      appendMessage(
        textByLang(
          getLang(),
          "Привет. Выбери роль и отвечай на короткие вопросы. В конце соберу персональный профиль.",
          "Hi. Choose a role and answer short questions. I will build a personal profile at the end."
        ),
        "bot"
      );
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
    if (cached && typeof cached === "object" && cached.step === "questions" && cached.role) {
      state = { ...initialState, ...cached };
    } else {
      resetState();
    }
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
