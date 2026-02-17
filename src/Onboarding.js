import { detectSourceFromUrl } from "./filter.js";

const STORAGE_KEY = "resource_vault_onboarding_state_v1";
const DEFAULT_FUNCTION_PATH = "/functions/v1/ai-onboarding";

function textByLang(lang, ru, en) {
  return String(lang || "ru") === "en" ? en : ru;
}

function safeJsonParse(raw, fallback) {
  try {
    return JSON.parse(String(raw || ""));
  } catch {
    return fallback;
  }
}

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
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

function decodeJwtPayload(token) {
  try {
    const payload = String(token || "").split(".")[1] || "";
    if (!payload) return null;
    const normalized = payload.replace(/-/g, "+").replace(/_/g, "/");
    const padded = `${normalized}${"=".repeat((4 - (normalized.length % 4)) % 4)}`;
    const decoded = atob(padded);
    return JSON.parse(decoded);
  } catch {
    return null;
  }
}

function projectRefFromUrl(url) {
  try {
    const host = new URL(String(url || "")).hostname;
    return host.endsWith(".supabase.co") ? host.replace(".supabase.co", "") : "";
  } catch {
    return "";
  }
}

function buildJwtDebug(functionUrl, token) {
  const expectedRef = projectRefFromUrl(functionUrl);
  const payload = decodeJwtPayload(token);
  const tokenIss = String(payload?.iss || "");
  const tokenIssRef = projectRefFromUrl(tokenIss);
  return JSON.stringify({
    expected_ref: expectedRef || "unknown",
    token_iss: tokenIss || "missing",
    token_iss_ref: tokenIssRef || "unknown",
    iss_ref_match: !!(expectedRef && tokenIssRef && expectedRef === tokenIssRef)
  });
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
    role: "",
    roleOptions: ["Frontend", "UI/UX", "Product Manager", "Backend", "Data Analyst"],
    answers: [],
    questions: [],
    step: "role",
    profile: null,
    resources: [],
    loading: false
  };
  let state = { ...initialState };

  function persist() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function hydrate() {
    const cached = safeJsonParse(localStorage.getItem(STORAGE_KEY), null);
    if (!cached || typeof cached !== "object") return;
    state = {
      ...state,
      ...cached,
      loading: false
    };
  }

  function resetState() {
    state = { ...initialState };
    localStorage.removeItem(STORAGE_KEY);
  }

  function setLoading(next) {
    state.loading = !!next;
    if (els.send) els.send.disabled = state.loading;
    if (els.skip) els.skip.disabled = state.loading;
    if (els.input) els.input.disabled = state.loading;
    if (els.status) {
      els.status.textContent = state.loading
        ? textByLang(getLang(), "Загрузка...", "Loading...")
        : "";
    }
  }

  function appendMessage(text, role = "bot") {
    if (!els.chat) return;
    const item = document.createElement("div");
    item.className = `onboarding-chat__msg onboarding-chat__msg--${role}`;
    item.innerHTML = escapeHtml(text);
    els.chat.appendChild(item);
    els.chat.scrollTop = els.chat.scrollHeight;
  }

  function renderRoleStep() {
    if (els.title) els.title.textContent = textByLang(getLang(), "AI-онбординг", "AI onboarding");
    if (els.subtitle) els.subtitle.textContent = textByLang(getLang(), "Выбери роль или введи свою", "Choose a role or type your own");
    if (els.restart) els.restart.textContent = textByLang(getLang(), "Начать заново", "Restart");
    if (els.skip) els.skip.textContent = textByLang(getLang(), "Пропустить", "Skip");
    if (els.chips) {
      els.chips.innerHTML = state.roleOptions
        .map((x) => `<button type="button" class="chip" data-role-option="${escapeHtml(x)}">${escapeHtml(x)}</button>`)
        .join("");
      els.chips.querySelectorAll("[data-role-option]").forEach((btn) => {
        btn.addEventListener("click", () => {
          const role = String(btn.getAttribute("data-role-option") || "").trim();
          if (!role) return;
          state.role = role;
          persist();
          submitRole(role);
        });
      });
    }
    if (els.chat) {
      els.chat.innerHTML = "";
      appendMessage(textByLang(getLang(), "Привет. Я задам короткое интервью и соберу профиль.", "Hi. I will run a short interview and build your profile."));
    }
  }

  function renderQuestionStep() {
    const question = state.questions[state.answers.length];
    if (!question) return;
    if (els.subtitle) {
      els.subtitle.textContent = textByLang(getLang(), `Вопрос ${state.answers.length + 1} из ${state.questions.length}`, `Question ${state.answers.length + 1} of ${state.questions.length}`);
    }
    appendMessage(question.question || question.label || "Question", "bot");
    if (els.chips) {
      const options = Array.isArray(question.options) ? question.options : [];
      els.chips.innerHTML = options
        .map((x) => `<button type="button" class="chip" data-answer-option="${escapeHtml(x)}">${escapeHtml(x)}</button>`)
        .join("");
      els.chips.querySelectorAll("[data-answer-option]").forEach((btn) => {
        btn.addEventListener("click", () => submitAnswer(String(btn.getAttribute("data-answer-option") || "")));
      });
    }
    if (els.input) {
      els.input.placeholder = textByLang(getLang(), "Или введи свой ответ", "Or type your answer");
      els.input.value = "";
      els.input.focus();
    }
  }

  function renderResultStep() {
    if (els.subtitle) els.subtitle.textContent = textByLang(getLang(), "Готово: профиль и ресурсы", "Done: profile and resources");
    if (els.chips) {
      els.chips.innerHTML = "";
      if (state.resources.length) {
        const addBtn = document.createElement("button");
        addBtn.type = "button";
        addBtn.className = "btn btn--primary";
        addBtn.textContent = textByLang(getLang(), `Добавить в Vault (${state.resources.length})`, `Add to Vault (${state.resources.length})`);
        addBtn.addEventListener("click", importResources);
        els.chips.appendChild(addBtn);
      }
    }
    if (els.chat) {
      const profileLine = document.createElement("pre");
      profileLine.className = "onboarding-chat__json";
      profileLine.textContent = JSON.stringify(state.profile || {}, null, 2);
      els.chat.appendChild(profileLine);
      if (state.resources.length) {
        const wrap = document.createElement("div");
        wrap.className = "onboarding-chat__list";
        wrap.innerHTML = state.resources
          .slice(0, 8)
          .map((r, idx) => {
            const title = escapeHtml(r.title || r.url || `Resource ${idx + 1}`);
            const url = escapeHtml(r.url || "");
            const source = escapeHtml(detectSourceFromUrl(r.url || ""));
            return `<a class="onboarding-chat__resource" href="${url}" target="_blank" rel="noreferrer">${idx + 1}. ${title} <span>${source}</span></a>`;
          })
          .join("");
        els.chat.appendChild(wrap);
      }
      els.chat.scrollTop = els.chat.scrollHeight;
    }
    if (els.input) {
      els.input.value = "";
      els.input.placeholder = textByLang(getLang(), "Можно закрыть окно", "You can close this window");
    }
  }

  function render() {
    if (state.step === "role") renderRoleStep();
    if (state.step === "questions") renderQuestionStep();
    if (state.step === "result") renderResultStep();
  }

  async function callFunction(payload) {
    const token = String(await getAccessToken() || "").trim();
    const jwtDebug = buildJwtDebug(functionUrl, token);
    if (!token || token.split(".").length !== 3) {
      throw new Error(`${textByLang(getLang(), "Сессия невалидна. Выйди и войди снова через Google.", "Session is invalid. Please sign out and sign in again.")}\nDebug: ${jwtDebug}`);
    }
    const anonKey = getAnonKey();
    const headers = {
      "Content-Type": "application/json"
    };
    if (anonKey) headers.apikey = anonKey;
    headers.Authorization = `Bearer ${token}`;
    const res = await fetch(functionUrl, {
      method: "POST",
      headers,
      body: JSON.stringify(payload)
    });
    if (!res.ok) {
      const text = await res.text().catch(() => "");
      const raw = text || `Function request failed (${res.status})`;
      if (res.status === 401 || raw.toLowerCase().includes("invalid jwt")) {
        throw new Error(`${raw}\nDebug: ${jwtDebug}`);
      }
      throw new Error(raw);
    }
    return await res.json();
  }

  async function submitRole(value) {
    const role = String(value || "").trim();
    if (!role) return;
    setLoading(true);
    try {
      appendMessage(role, "user");
      const data = await callFunction({ action: "generate_questions", role, lang: getLang() });
      state.role = role;
      state.questions = Array.isArray(data.questions) ? data.questions.slice(0, 5) : [];
      state.answers = [];
      state.step = "questions";
      persist();
      render();
    } catch (err) {
      appendMessage(err?.message || "Failed to generate questions.", "bot");
    } finally {
      setLoading(false);
    }
  }

  async function submitAnswer(value) {
    const answer = String(value || els.input?.value || "").trim();
    if (!answer) return;
    appendMessage(answer, "user");
    state.answers.push({ question: state.questions[state.answers.length]?.question || "", answer });
    persist();
    if (state.answers.length < state.questions.length) {
      renderQuestionStep();
      if (els.input) els.input.value = "";
      return;
    }
    setLoading(true);
    try {
      const data = await callFunction({
        action: "finalize_profile",
        role: state.role,
        answers: state.answers,
        lang: getLang()
      });
      state.profile = data.ai_profile || null;
      state.resources = Array.isArray(data.resources) ? data.resources : [];
      state.step = "result";
      persist();
      render();
    } catch (err) {
      appendMessage(err?.message || "Failed to finalize profile.", "bot");
    } finally {
      setLoading(false);
    }
  }

  async function importResources() {
    setLoading(true);
    try {
      const result = await onImportResources(state.resources, state.profile);
      const imported = Number(result?.imported || 0);
      const skipped = Number(result?.skipped || 0);
      appendMessage(
        textByLang(getLang(), `Импорт завершен. Добавлено: ${imported}, пропущено: ${skipped}.`, `Import finished. Added: ${imported}, skipped: ${skipped}.`),
        "bot"
      );
    } catch (err) {
      appendMessage(err?.message || "Failed to import resources.", "bot");
    } finally {
      setLoading(false);
    }
  }

  function onSend() {
    if (state.step === "role") submitRole(els.input?.value || "");
    if (state.step === "questions") submitAnswer(els.input?.value || "");
  }

  function skip() {
    if (state.step === "result") {
      modal.close();
      return;
    }
    state.step = "result";
    state.profile = state.profile || {
      role: state.role || "Generalist",
      level: "Junior",
      stack: [],
      goals: [],
      format_pref: ["articles"]
    };
    state.resources = state.resources || [];
    persist();
    render();
  }

  function open() {
    if (!ensureAuth()) return;
    hydrate();
    // Do not reopen stale completed onboarding from localStorage.
    if (state.step === "result") resetState();
    if (!state.role) state.step = "role";
    if (state.step === "questions" && state.answers.length >= state.questions.length) state.step = "role";
    render();
    modal.showModal();
  }

  function restart() {
    resetState();
    state.step = "role";
    render();
  }

  function bind() {
    triggerButton.addEventListener("click", open);
    els.close?.addEventListener("click", () => modal.close());
    els.send?.addEventListener("click", onSend);
    els.skip?.addEventListener("click", skip);
    els.restart?.addEventListener("click", restart);
    els.input?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") {
        e.preventDefault();
        onSend();
      }
    });
  }

  bind();
  return { open };
}
