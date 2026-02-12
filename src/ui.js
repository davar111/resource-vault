import { matchesRules, domainFromUrl, faviconUrl, previewFallbackUrl } from "./filter.js";
import { t } from "./i18n.js";

export function render(state, els, onChange) {
  const L = state.lang || "ru";
  renderCollections(state, els, onChange, L);
  renderHeader(state, els, L);
  renderChips(state, els, onChange, L);
  renderGrid(state, els, onChange, L);
}

function collectionLabel(c, L) {
  if (c.id === "all") return t(L, "all");
  if (c.id === "fav") return t(L, "favorites");
  return c.name;
}

function renderCollections(state, els, onChange, L) {
  els.collectionsList.innerHTML = "";

  for (const c of state.collections) {
    const count = visibleItems(state, c).length;

    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "collection" + (state.activeCollectionId === c.id ? " collection--active" : "");
    btn.innerHTML = `
      <div class="collection__left">
        <div class="dot"></div>
        <div>${escapeHtml(collectionLabel(c, L))}</div>
      </div>
      <div class="badge">${count}</div>
    `;

    btn.addEventListener("click", () => {
      state.activeCollectionId = c.id;
      render(state, els, onChange);
    });

    els.collectionsList.appendChild(btn);
  }
}

function renderHeader(state, els, L) {
  const active = state.collections.find((c) => c.id === state.activeCollectionId) || state.collections[0];

  els.activeTitle.textContent = collectionLabel(active, L);

  const n = filteredItems(state).length;
  const tagPart = state.activeTag ? ` • ${t(L, "tag")}: ${state.activeTag}` : "";
  els.activeMeta.textContent = `${n} ${t(L, "items")}${tagPart}`;
}

function renderChips(state, els, onChange, L) {
  if (!els.chips) return;

  const counts = tagsHistogram(filteredItems(state, { ignoreActiveTag: true }));
  els.chips.innerHTML = "";

  const all = document.createElement("button");
  all.type = "button";
  all.className = "chip" + (!state.activeTag ? " chip--on" : "");
  all.innerHTML = `${t(L, "allTagsChip")} <span class="chip__count">${sumCounts(counts)}</span>`;
  all.addEventListener("click", () => {
    state.activeTag = "";
    render(state, els, onChange);
  });
  els.chips.appendChild(all);

  const top = Object.entries(counts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 18);

  for (const [tag, n] of top) {
    const chip = document.createElement("button");
    chip.type = "button";
    chip.className = "chip" + (state.activeTag === tag ? " chip--on" : "");
    chip.innerHTML = `${escapeHtml(tag)} <span class="chip__count">${n}</span>`;
    chip.addEventListener("click", () => {
      state.activeTag = state.activeTag === tag ? "" : tag;
      render(state, els, onChange);
    });
    els.chips.appendChild(chip);
  }
}

function renderGrid(state, els, onChange, L) {
  const list = filteredItems(state);

  els.grid.innerHTML = "";
  if (!list.length) {
    const empty = document.createElement("div");
    empty.className = "empty";
    empty.innerHTML = `
      <div class="empty__title">${escapeHtml(t(L, "emptyTitle"))}</div>
      <div class="empty__text">${escapeHtml(t(L, "emptyText"))}</div>
    `;
    els.grid.appendChild(empty);
    return;
  }

  list.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "card";
    card.style.setProperty("--stagger", `${Math.min(index, 14) * 28}ms`);

    const domain = domainFromUrl(item.url);
    const tags = (item.tags || []).slice(0, 10);
    const icon = faviconUrl(item.url);
    const fallbackPreview = previewFallbackUrl(item.url);
    const previewSrc = item.previewImage || fallbackPreview;

    card.innerHTML = `
      ${previewSrc ? `
        <a class="card__preview-wrap" href="${item.url}" target="_blank" rel="noreferrer">
          <img class="card__preview" src="${escapeHtml(previewSrc)}" data-fallback="${escapeHtml(fallbackPreview)}" alt="${escapeHtml(item.title || "preview")}" loading="lazy" referrerpolicy="no-referrer" />
        </a>
      ` : ""}

      <div class="card__top">
        <div class="card__left">
          ${icon ? `<img class="favicon" src="${icon}" alt="">` : `<div class="favicon"></div>`}
          <div>
            <div class="card__title">${escapeHtml(item.title || domain || "Untitled")}</div>
            <div class="card__meta">${escapeHtml(domain)} • ${escapeHtml(item.type)} • ${escapeHtml(item.source)}</div>
          </div>
        </div>
        <button class="fav ${item.favorite ? "fav--on" : ""}" type="button" title="${escapeHtml(t(L, "favorites"))}">★</button>
      </div>

      ${item.note ? `<div class="card__note">${escapeHtml(item.note)}</div>` : ""}

      <div class="tags">
        ${tags.map((tg, i) => `<span class="tag ${i === 0 ? "tag--accent" : ""}">${escapeHtml(tg)}</span>`).join("")}
      </div>

      <div class="card__actions">
        <a class="btn btn--ghost" href="${item.url}" target="_blank" rel="noreferrer">${escapeHtml(t(L, "open"))}</a>
        <button class="btn btn--ghost" type="button" data-del="1">${escapeHtml(t(L, "del"))}</button>
      </div>
    `;

    card.querySelector(".fav").addEventListener("click", () => {
      item.favorite = !item.favorite;
      onChange?.();
      render(state, els, onChange);
    });

    card.querySelector("[data-del]").addEventListener("click", () => {
      state.items = state.items.filter((x) => x.id !== item.id);
      onChange?.();
      render(state, els, onChange);
    });

    card.querySelectorAll(".tag").forEach((el) => {
      el.addEventListener("click", () => {
        const tg = el.textContent.trim().toLowerCase();
        state.activeTag = state.activeTag === tg ? "" : tg;
        render(state, els, onChange);
      });
    });

    const previewEl = card.querySelector(".card__preview");
    if (previewEl) {
      previewEl.addEventListener("error", () => {
        const fb = previewEl.dataset.fallback || "";
        if (fb && previewEl.src !== fb) {
          previewEl.src = fb;
          return;
        }
        previewEl.closest(".card__preview-wrap")?.remove();
      });
    }

    els.grid.appendChild(card);
  });
}

function filteredItems(state, opts = {}) {
  const active = state.collections.find((c) => c.id === state.activeCollectionId) || state.collections[0];
  const activeTag = opts.ignoreActiveTag ? "" : state.activeTag || "";

  return state.items
    .filter((item) => matchesRules(item, active.rules, state.search, activeTag))
    .sort((a, b) => b.createdAt - a.createdAt);
}

function visibleItems(state, collection) {
  return state.items.filter((item) => matchesRules(item, collection.rules, state.search, ""));
}

function tagsHistogram(items) {
  const map = Object.create(null);
  for (const it of items) {
    for (const tg of it.tags || []) {
      const k = String(tg || "").trim().toLowerCase();
      if (!k) continue;
      map[k] = (map[k] || 0) + 1;
    }
  }
  return map;
}

function sumCounts(map) {
  return Object.values(map).reduce((a, b) => a + b, 0);
}

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
