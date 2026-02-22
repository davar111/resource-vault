const FOCUSABLE_SELECTOR = [
  "a[href]",
  "area[href]",
  "button:not([disabled])",
  "input:not([disabled]):not([type='hidden'])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "[tabindex]:not([tabindex='-1'])"
].join(", ");

function getFocusableElements(root) {
  if (!root) return [];
  return Array.from(root.querySelectorAll(FOCUSABLE_SELECTOR)).filter((el) => {
    if (!(el instanceof HTMLElement)) return false;
    if (el.hidden) return false;
    if (el.getAttribute("aria-hidden") === "true") return false;
    return true;
  });
}

function focusFirstAvailable(dialog, preferredFocus) {
  if (preferredFocus instanceof HTMLElement && !preferredFocus.hasAttribute("disabled")) {
    preferredFocus.focus();
    return;
  }
  const first = getFocusableElements(dialog)[0];
  if (first instanceof HTMLElement) first.focus();
}

export function showDialogWithA11y(dialog, options = {}) {
  if (!dialog || typeof dialog.showModal !== "function") return;
  const preferredFocus = options.preferredFocus instanceof HTMLElement ? options.preferredFocus : null;
  const opener = document.activeElement instanceof HTMLElement ? document.activeElement : null;

  const onKeyDown = (e) => {
    if (e.key !== "Tab" || !dialog.open) return;
    const focusable = getFocusableElements(dialog);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    const current = document.activeElement;

    if (e.shiftKey && current === first) {
      e.preventDefault();
      last.focus();
      return;
    }
    if (!e.shiftKey && current === last) {
      e.preventDefault();
      first.focus();
    }
  };

  const onClose = () => {
    dialog.removeEventListener("keydown", onKeyDown);
    dialog.removeEventListener("close", onClose);
    if (opener && opener.isConnected) opener.focus();
  };

  dialog.addEventListener("keydown", onKeyDown);
  dialog.addEventListener("close", onClose);
  dialog.showModal();
  queueMicrotask(() => focusFirstAvailable(dialog, preferredFocus));
}
