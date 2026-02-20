let queued = false;
let lastFn = null;

export function scheduleRender(fn) {
  if (typeof fn !== "function") return;
  lastFn = fn;
  if (queued) return;
  queued = true;

  const flush = () => {
    queued = false;
    const next = lastFn;
    lastFn = null;
    next?.();
  };

  if (typeof window !== "undefined" && typeof window.requestAnimationFrame === "function") {
    window.requestAnimationFrame(flush);
    return;
  }
  queueMicrotask(flush);
}
