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
    answers: [],
    currentQuestion: null,
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
      els.status.textContent = state.loading ? textByLang(getLang(), "Загрузка...", "Loading...") : "";
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

  function applyButtonsText() {
    if (els.restart) els.restart.textContent = textByLang(getLang(), "Начать заново", "Restart");
    if (els.skip) els.skip.textContent = state.step === "result"
      ? textByLang(getLang(), "Закрыть", "Close")
      : textByLang(getLang(), "Пропустить", "Skip");
  }

  function renderRoleStep() {
    if (els.title) els.title.textContent = textByLang(getLang(), "AI-онбординг", "AI onboarding");
    if (els.subtitle) els.subtitle.textContent = textByLang(getLang(), "Напиши роль и поехали в формате диалога", "Type your role and start a dialogue");
    applyButtonsText();
    if (els.chips) {
      els.chips.innerHTML = "";
    }
    if (els.chat) {
      els.chat.innerHTML = "";
      appendMessage(textByLang(
        getLang(),
        "Привет. Я буду задавать наводящие вопросы по твоим ответам. Пиши свободно, как в обычном чате.",
        "Hi. I will ask adaptive questions based on your answers."
      ));
    }
  }

  function renderQuestionStep() {
    const question = state.currentQuestion;
    if (!question) return;
    if (els.subtitle) {
      const count = state.answers.length + 1;
      els.subtitle.textContent = textByLang(getLang(), `Диалоговый шаг ${count}`, `Dialogue step ${count}`);
    }
    applyButtonsText();
    if (els.chips) {
      els.chips.innerHTML = "";
    }
    if (els.input) {
      els.input.placeholder = textByLang(getLang(), "Напиши ответ в свободной форме", "Write your answer in free form");
      els.input.value = "";
      els.input.focus();
    }
  }

  function renderResultStep() {
    if (els.subtitle) els.subtitle.textContent = textByLang(getLang(), "Готово: профиль и ресурсы", "Done: profile and resources");
    applyButtonsText();
    if (els.chips) {
      els.chips.innerHTML = "";
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
      els.input.placeholder = textByLang(getLang(), "Можешь закрыть окно", "You can close this window");
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
    const headers = { "Content-Type": "application/json" };
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
      if (res.status === 401 || raw.toLowerCase().includes("invalid jwt")) throw new Error(`${raw}\nDebug: ${jwtDebug}`);
      throw new Error(raw);
    }
    return await res.json();
  }

  async function chatTurn() {
    const data = await callFunction({
      action: "chat_turn",
      role: state.role,
      answers: state.answers,
      lang: getLang()
    });

    if (data?.done) {
      state.profile = data.ai_profile || null;
      state.resources = Array.isArray(data.resources) ? data.resources : [];
      state.step = "result";
      persist();
      render();
      return;
    }

    const q = data?.question || null;
    if (!q?.question) throw new Error(textByLang(getLang(), "AI не вернул следующий вопрос.", "AI did not return next question."));
    state.currentQuestion = q;
    state.step = "questions";
    persist();
    appendMessage(String(q.question), "bot");
    render();
  }

  async function submitRole(value) {
    const role = String(value || "").trim();
    if (!role) return;
    setLoading(true);
    try {
      appendMessage(role, "user");
      state.role = role;
      state.answers = [];
      state.currentQuestion = null;
      await chatTurn();
    } catch (err) {
      appendMessage(err?.message || "Failed to start interview.", "bot");
    } finally {
      setLoading(false);
    }
  }

  async function submitAnswer(value) {
    const answer = String(value || els.input?.value || "").trim();
    if (!answer || !state.currentQuestion?.question) return;
    setLoading(true);
    try {
      appendMessage(answer, "user");
      state.answers.push({ question: String(state.currentQuestion.question || ""), answer });
      state.currentQuestion = null;
      persist();
      await chatTurn();
    } catch (err) {
      appendMessage(err?.message || "Failed to continue interview.", "bot");
    } finally {
      setLoading(false);
    }
  }

  function onSend() {
    if (state.step === "role") void submitRole(els.input?.value || "");
    if (state.step === "questions") void submitAnswer(els.input?.value || "");
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
    if (state.step === "result") resetState();
    if (!state.role) state.step = "role";
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
