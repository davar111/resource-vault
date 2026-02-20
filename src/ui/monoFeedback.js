const SPINNER_FRAMES = ["\u280B", "\u2819", "\u2839", "\u2838", "\u283C", "\u2834", "\u2826", "\u2827", "\u2807", "\u280F"];
const activeEffects = new WeakMap();

function noopSpinner() {
  return {
    stop() {},
    setText() {},
    get isRunning() { return false; }
  };
}

function warnTarget(target) {
  console.warn("[monoFeedback] target not found:", target);
}

function resolveTarget(target) {
  if (!target) return null;
  if (typeof target === "string") return document.querySelector(target);
  return target instanceof Element ? target : null;
}

function stateFor(el) {
  const state = activeEffects.get(el) || {};
  if (!activeEffects.has(el)) activeEffects.set(el, state);
  return state;
}

function clearTimer(state, key) {
  if (!state[key]) return;
  clearInterval(state[key]);
  clearTimeout(state[key]);
  state[key] = null;
}

function setElementText(el, text) {
  el.textContent = String(text || "");
}

export function startSpinner(target, text, options = {}) {
  const el = resolveTarget(target);
  if (!el) {
    warnTarget(target);
    return noopSpinner();
  }

  const state = stateFor(el);
  if (state.spinner?.isRunning) state.spinner.stop();

  const intervalMs = Number(options.intervalMs) > 0 ? Number(options.intervalMs) : 80;
  const originalText = el.textContent || "";
  let bodyText = String(text || "");
  let frameIndex = 0;
  let running = true;

  const render = () => {
    if (!running) return;
    const frame = SPINNER_FRAMES[frameIndex % SPINNER_FRAMES.length];
    frameIndex += 1;
    setElementText(el, bodyText ? `${frame} ${bodyText}` : frame);
  };

  render();
  state.spinnerTimer = setInterval(render, intervalMs);

  const spinner = {
    stop(newText) {
      if (!running) return;
      running = false;
      clearTimer(state, "spinnerTimer");
      if (typeof newText === "string") setElementText(el, newText);
      else setElementText(el, originalText);
      if (state.spinner === spinner) state.spinner = null;
    },
    setText(newText) {
      bodyText = String(newText || "");
      render();
    },
    get isRunning() {
      return running;
    }
  };

  state.spinner = spinner;
  return spinner;
}

export function flashStatus(target, text, kind = "info", timeoutMs = 1200) {
  const el = resolveTarget(target);
  if (!el) {
    warnTarget(target);
    return () => {};
  }

  const state = stateFor(el);
  const safeKind = kind === "ok" || kind === "error" ? kind : "info";
  const prefix = safeKind === "ok" ? "\u2713 " : safeKind === "error" ? "\u2715 " : "\u2026 ";
  const originalText = el.textContent || "";
  const hadOk = el.classList.contains("status-ok");
  const hadError = el.classList.contains("status-error");
  const hadInfo = el.classList.contains("status-info");

  if (state.spinner?.isRunning) state.spinner.stop();
  clearTimer(state, "flashTimer");

  el.classList.remove("status-ok", "status-error", "status-info");
  el.classList.add(`status-${safeKind}`);
  setElementText(el, `${prefix}${String(text || "").replace(/^[\u2713\u2715\u2026]\s*/u, "")}`);

  const cancel = () => {
    clearTimer(state, "flashTimer");
    el.classList.remove("status-ok", "status-error", "status-info");
    if (hadOk) el.classList.add("status-ok");
    if (hadError) el.classList.add("status-error");
    if (hadInfo) el.classList.add("status-info");
    setElementText(el, originalText);
  };

  state.flashTimer = setTimeout(cancel, Math.max(0, Number(timeoutMs) || 1200));
  return cancel;
}

export function typewriter(target, text, options = {}) {
  const el = resolveTarget(target);
  if (!el) {
    warnTarget(target);
    return { stop() {}, get isRunning() { return false; } };
  }

  const state = stateFor(el);
  const speedMs = Number(options.speedMs) > 0 ? Number(options.speedMs) : 24;
  const clearBefore = options.clearBefore !== false;
  const fullText = String(text || "");
  let index = 0;
  let running = true;

  clearTimer(state, "typeTimer");
  if (clearBefore) setElementText(el, "");

  state.typeTimer = setInterval(() => {
    if (!running) return;
    index += 1;
    setElementText(el, fullText.slice(0, index));
    if (index >= fullText.length) {
      running = false;
      clearTimer(state, "typeTimer");
    }
  }, speedMs);

  return {
    stop() {
      if (!running) return;
      running = false;
      clearTimer(state, "typeTimer");
      setElementText(el, fullText);
    },
    get isRunning() {
      return running;
    }
  };
}
