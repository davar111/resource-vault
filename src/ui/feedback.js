import { flashStatus } from "./monoFeedback.js";
import { showDialogWithA11y } from "./dialogA11y.js";

function resolveTarget(targetOrEl) {
  if (typeof targetOrEl === "string") return document.querySelector(targetOrEl);
  if (targetOrEl instanceof Element) return targetOrEl;
  return document.getElementById("authStatus");
}

function dialogEls() {
  const dialog = document.getElementById("rv-feedback-dialog");
  if (!dialog) return null;
  return {
    dialog,
    title: document.getElementById("rvFeedbackTitle"),
    message: document.getElementById("rvFeedbackMessage"),
    inputWrap: document.getElementById("rvFeedbackInputWrap"),
    input: document.getElementById("rvFeedbackInput"),
    cancel: document.getElementById("rvFeedbackCancel"),
    submit: document.getElementById("rvFeedbackSubmit")
  };
}

export function toast(targetOrEl, text, options = {}) {
  const target = resolveTarget(targetOrEl);
  if (!target) return () => {};
  return flashStatus(target, text, options.kind || "info", options.timeoutMs ?? 1400);
}

export function confirmDialog({
  title,
  message,
  confirmText = "OK",
  cancelText = "Cancel"
} = {}) {
  const els = dialogEls();
  if (!els?.dialog || !els.cancel || !els.submit) return Promise.resolve(false);

  if (els.title) els.title.textContent = String(title || "");
  if (els.message) els.message.textContent = String(message || "");
  if (els.inputWrap) els.inputWrap.hidden = true;
  if (els.input) els.input.value = "";
  els.submit.textContent = String(confirmText || "OK");
  els.cancel.textContent = String(cancelText || "Cancel");

  return new Promise((resolve) => {
    let settled = false;
    const cleanup = () => {
      els.cancel.removeEventListener("click", onCancel);
      els.submit.removeEventListener("click", onSubmit);
      els.dialog.removeEventListener("cancel", onCancel);
      els.dialog.removeEventListener("close", onClose);
    };
    const finish = (value) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };
    const onCancel = (e) => {
      if (e) e.preventDefault();
      els.dialog.close();
      finish(false);
    };
    const onSubmit = (e) => {
      if (e) e.preventDefault();
      els.dialog.close();
      finish(true);
    };
    const onClose = () => finish(false);

    els.cancel.addEventListener("click", onCancel);
    els.submit.addEventListener("click", onSubmit);
    els.dialog.addEventListener("cancel", onCancel);
    els.dialog.addEventListener("close", onClose, { once: true });
    showDialogWithA11y(els.dialog, { preferredFocus: els.submit });
  });
}

export function promptDialog({
  title,
  message,
  defaultValue = "",
  placeholder = "",
  submitText = "Save",
  cancelText = "Cancel"
} = {}) {
  const els = dialogEls();
  if (!els?.dialog || !els.cancel || !els.submit || !els.input || !els.inputWrap) return Promise.resolve(null);

  if (els.title) els.title.textContent = String(title || "");
  if (els.message) els.message.textContent = String(message || "");
  els.inputWrap.hidden = false;
  els.input.value = String(defaultValue || "");
  els.input.placeholder = String(placeholder || "");
  els.submit.textContent = String(submitText || "Save");
  els.cancel.textContent = String(cancelText || "Cancel");

  return new Promise((resolve) => {
    let settled = false;
    const cleanup = () => {
      els.cancel.removeEventListener("click", onCancel);
      els.submit.removeEventListener("click", onSubmit);
      els.input.removeEventListener("keydown", onKeyDown);
      els.dialog.removeEventListener("cancel", onCancel);
      els.dialog.removeEventListener("close", onClose);
    };
    const finish = (value) => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(value);
    };
    const onCancel = (e) => {
      if (e) e.preventDefault();
      els.dialog.close();
      finish(null);
    };
    const onSubmit = (e) => {
      if (e) e.preventDefault();
      const next = String(els.input.value || "");
      els.dialog.close();
      finish(next);
    };
    const onKeyDown = (e) => {
      if (e.key === "Enter") onSubmit(e);
    };
    const onClose = () => finish(null);

    els.cancel.addEventListener("click", onCancel);
    els.submit.addEventListener("click", onSubmit);
    els.input.addEventListener("keydown", onKeyDown);
    els.dialog.addEventListener("cancel", onCancel);
    els.dialog.addEventListener("close", onClose, { once: true });
    showDialogWithA11y(els.dialog, { preferredFocus: els.input });
  });
}
