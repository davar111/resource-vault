import { matchesLink, domainFromUrl, faviconUrl, previewFallbackUrl } from "./filter.js";
import { t } from "./i18n.js";

let activeActions = {};

export function render(state, els, onChange, actions = activeActions) {
  activeActions = actions || {};
  const L = state.lang || "ru";
  renderNav(state, els, L);
  renderCollections(state, els, onChange, L);
  renderHeader(state, els, L);
  renderActiveFilters(state, els, onChange, L);
  renderGrid(state, els, onChange, activeActions, L);
}

function renderNav(state, els, L) {
  if (els.navAll) {
    els.navAll.textContent = t(L, "navAll");
    els.navAll.classList.toggle("nav-item--active", state.activeCollectionId === "all");
  }
  if (els.navFav) {
    els.navFav.textContent = t(L, "navFav");
    els.navFav.classList.toggle("nav-item--active", state.activeCollectionId === "fav");
  }
  if (els.navRecent) {
    els.navRecent.textContent = t(L, "navRecent");
    els.navRecent.classList.toggle("nav-item--active", state.activeCollectionId === "recent");
  }
}

function renderCollections(state, els, onChange, L) {
  ensureCollectionMenuOutsideClose();
  els.collectionsList.innerHTML = "";

  for (const c of state.collections) {
    const count = visibleItems(state, c).length;
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "collection" + (state.activeCollectionId === c.id ? " collection--active" : "");
    btn.dataset.collectionId = c.id;
    btn.innerHTML = `
      <div class="collection__left">
        <div class="dot"></div>
        <div class="collection__name">
          <div>${escapeHtml(c.name)}</div>
          ${c.kind === "smart" ? `<span class="badge badge--smart">${escapeHtml(t(L, "kindSmart"))}</span>` : ""}
        </div>
      </div>
      <div class="collection__right">
        <div class="badge">${count}</div>
        <div class="collection__menu">
          <button class="collection__menu-trigger" type="button" data-col-menu="1"><span class="collection__menu-dots">⋯</span></button>
          <div class="collection__menu-pop" data-col-pop hidden>
            <button class="collection__menu-item" type="button" data-col-rename="1">${escapeHtml(t(L, "renameCollection"))}</button>
            <button class="collection__menu-item collection__menu-item--danger" type="button" data-col-del="1">${escapeHtml(t(L, "deleteCollection"))}</button>
          </div>
        </div>
      </div>
    `;

    btn.addEventListener("click", () => {
      state.activeCollectionId = c.id;
      render(state, els, onChange);
    });

    if (c.kind === "manual") {
      btn.addEventListener("dragover", (e) => {
        e.preventDefault();
      });

      btn.addEventListener("dragenter", (e) => {
        e.preventDefault();
        btn.classList.add("collection--dragover");
      });

      btn.addEventListener("dragleave", () => {
        btn.classList.remove("collection--dragover");
      });

      btn.addEventListener("drop", (e) => {
        e.preventDefault();
        e.stopPropagation();
        btn.classList.remove("collection--dragover");

        const itemId = String(e.dataTransfer?.getData("text/resource-vault-item-id") || "").trim();
        if (!itemId) return;

        const item = state.items.find((x) => x.id === itemId);
        if (!item) return;

        const ids = Array.isArray(item.collectionIds) ? item.collectionIds : [];
        if (ids.includes(c.id)) return;

        item.collectionIds = [...ids, c.id];
        item.updatedAt = Date.now();
        onChange?.();
        render(state, els, onChange);
      });
    }

    const trigger = btn.querySelector("[data-col-menu]");
    const pop = btn.querySelector("[data-col-pop]");
    if (trigger && pop) {
      trigger.addEventListener("click", (e) => {
        e.stopPropagation();
        const wasHidden = pop.hidden;
        closeAllCollectionMenus();
        pop.hidden = !wasHidden;
      });
    }

    const rename = btn.querySelector("[data-col-rename]");
    if (rename) {
      rename.addEventListener("click", (e) => {
        e.stopPropagation();
        closeAllCollectionMenus();
        const next = prompt(t(L, "renameCollectionPrompt"), c.name || "");
        if (!next) return;
        const name = String(next).trim();
        if (!name) return;
        c.name = name;
        c.updatedAt = Date.now();
        onChange?.();
        render(state, els, onChange);
      });
    }

    const del = btn.querySelector("[data-col-del]");
    if (del) {
      del.addEventListener("click", (e) => {
        e.stopPropagation();
        closeAllCollectionMenus();
        if (!confirm(t(L, "deleteCollectionConfirm"))) return;
        state.collections = state.collections.filter((x) => x.id !== c.id);
        for (const item of state.items) {
          item.collectionIds = (item.collectionIds || []).filter((x) => x !== c.id);
        }
        if (state.activeCollectionId === c.id) state.activeCollectionId = "all";
        onChange?.();
        render(state, els, onChange);
      });
    }

    els.collectionsList.appendChild(btn);
  }
}

function renderHeader(state, els, L) {
  const active = getActiveCollection(state);
  const list = filteredItems(state);

  if (!active || active.id === "all") {
    els.activeTitle.textContent = t(L, "all");
    els.activeMeta.textContent = `${list.length} ${t(L, "items")}`;
    return;
  }

  if (active.id === "fav") {
    els.activeTitle.textContent = t(L, "favorites");
    els.activeMeta.textContent = `${list.length} ${t(L, "items")}`;
    return;
  }

  if (active.id === "recent") {
    els.activeTitle.textContent = t(L, "recent");
    els.activeMeta.textContent = `${list.length} ${t(L, "items")}`;
    return;
  }

  els.activeTitle.textContent = `${t(L, "collectionSingle")}: ${active.name}`;
  const mode = active.kind === "smart" ? t(L, "contextSmart") : t(L, "contextManual");
  els.activeMeta.textContent = `${list.length} ${t(L, "items")} • ${mode}`;
}

function renderActiveFilters(state, els, onChange, L) {
  const bar = els.activeFilters;
  if (!bar) return;
  bar.innerHTML = "";
  const chipsBar = bar.closest(".chipsbar");

  const chips = [];
  for (const type of state.filters.types || []) {
    chips.push({ key: "type", value: type, label: `${t(L, "chipType")}: ${displayOptionLabel(type, "type", L)}` });
  }
  for (const src of state.filters.sources || []) {
    chips.push({ key: "source", value: src, label: `${t(L, "chipSource")}: ${displayOptionLabel(src, "source", L)}` });
  }
  if (state.filters.tag) chips.push({ key: "tag", value: state.filters.tag, label: `${t(L, "chipTag")}: ${state.filters.tag}` });
  if (state.filters.favoriteOnly) chips.push({ key: "fav", value: "1", label: t(L, "chipFav") });

  if (!chips.length && !state.search) {
    if (chipsBar) chipsBar.hidden = true;
    return;
  }

  if (chipsBar) chipsBar.hidden = false;

  for (const c of chips) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip chip--on";
    btn.textContent = `${c.label} ×`;
    btn.addEventListener("click", () => {
      removeFilter(state, c);
      syncFilterInputs(state, els);
      onChange?.();
      render(state, els, onChange);
    });
    bar.appendChild(btn);
  }

  if (state.search) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip chip--on";
    btn.textContent = `Search: ${state.search} ×`;
    btn.addEventListener("click", () => {
      state.search = "";
      if (els.searchInput) els.searchInput.value = "";
      syncFilterInputs(state, els);
      onChange?.();
      render(state, els, onChange);
    });
    bar.appendChild(btn);
  }

  const clear = document.createElement("button");
  clear.type = "button";
  clear.className = "chip";
  clear.textContent = t(L, "clearFilters");
  clear.addEventListener("click", () => {
    state.filters = { types: [], sources: [], tag: "", favoriteOnly: false };
    state.search = "";
    if (els.searchInput) els.searchInput.value = "";
    syncFilterInputs(state, els);
    onChange?.();
    render(state, els, onChange);
  });
  bar.appendChild(clear);
}

function renderGrid(state, els, onChange, actions, L) {
  ensureCardMenuOutsideClose();
  const list = filteredItems(state);
  els.grid.innerHTML = "";
  els.grid.classList.toggle("grid--empty", !list.length);

  if (!list.length) {
    const active = getActiveCollection(state);
    const empty = document.createElement("div");
    empty.className = "empty";

    if (!active || active.id === "all") {
      empty.innerHTML = `
        <div class="empty__title">${escapeHtml(t(L, "emptyAllTitle"))}</div>
        <div class="empty__text">${escapeHtml(t(L, "emptyAllText"))}</div>
        <div class="empty__actions"><button class="btn btn--primary" type="button" data-add-link="1">${escapeHtml(t(L, "quickAdd"))}</button></div>
      `;
    } else if (active.id === "fav") {
      empty.innerHTML = `
        <div class="empty__title">${escapeHtml(t(L, "emptyFavTitle"))}</div>
        <div class="empty__text">${escapeHtml(t(L, "emptyFavText"))}</div>
        <div class="empty__actions"><button class="btn btn--primary" type="button" data-add-link="1">${escapeHtml(t(L, "quickAdd"))}</button></div>
      `;
    } else if (active.id === "recent") {
      empty.innerHTML = `
        <div class="empty__title">${escapeHtml(t(L, "emptyRecentTitle"))}</div>
        <div class="empty__text">${escapeHtml(t(L, "emptyRecentText"))}</div>
      `;
    } else if (active.kind === "smart") {
      empty.innerHTML = `
        <div class="empty__title">${escapeHtml(t(L, "emptyCollectionTitle"))}</div>
        <div class="empty__text">${escapeHtml(t(L, "emptySmartText"))}</div>
      `;
    } else {
      empty.innerHTML = `
        <div class="empty__title">${escapeHtml(t(L, "emptyCollectionTitle"))}</div>
        <div class="empty__text">${escapeHtml(t(L, "emptyCollectionText"))}</div>
        <div class="empty__actions">
          <button class="btn btn--primary" type="button" data-add-link="1">${escapeHtml(t(L, "quickAdd"))}</button>
        </div>
      `;
    }

    wireQuickAdd(empty);
    els.grid.appendChild(empty);
    return;
  }

  list.forEach((item, index) => {
    const card = document.createElement("div");
    card.className = "card";
    card.style.setProperty("--stagger", `${Math.min(index, 14) * 20}ms`);
    card.draggable = true;
    card.dataset.itemId = item.id;

    const domain = domainFromUrl(item.url);
    const tags = (item.tags || []).slice(0, 10);
    const icon = faviconUrl(item.url);
    const previewSrc = item.previewImage || previewFallbackUrl(item.url);

    card.innerHTML = `
      ${previewSrc ? `
      <a class="card__preview-wrap" href="${item.url}" target="_blank" rel="noreferrer">
        <img class="card__preview" src="${escapeHtml(previewSrc)}" data-fallback="${escapeHtml(previewFallbackUrl(item.url))}" alt="${escapeHtml(item.title || "preview")}" loading="lazy" referrerpolicy="no-referrer" />
      </a>` : ""}

      <div class="card__top">
        <div class="card__left">
          ${icon ? `<img class="favicon" src="${icon}" alt="">` : `<div class="favicon"></div>`}
          <div>
            <a class="card__title-link" href="${item.url}" target="_blank" rel="noreferrer">${escapeHtml(item.title || domain || "Untitled")}</a>
            <div class="card__meta">${escapeHtml(domain)} • ${escapeHtml(displayOptionLabel(item.type, "type", L))} • ${escapeHtml(displayOptionLabel(item.source, "source", L))}</div>
          </div>
        </div>
        <div class="card__tools">
          <button class="fav ${item.favorite ? "fav--on" : ""}" type="button" title="${escapeHtml(t(L, "favorites"))}">&#9733;</button>
          <div class="card__menu">
            <button class="card__menu-trigger" type="button" data-card-menu="1" aria-label="Actions"><span class="collection__menu-dots">&#8943;</span></button>
            <div class="card__menu-pop" data-card-pop hidden>
              <button class="card__menu-item" type="button" data-edit="1">${escapeHtml(t(L, "edit"))}</button>
              <button class="card__menu-item card__menu-item--danger" type="button" data-del="1">${escapeHtml(t(L, "del"))}</button>
            </div>
          </div>
        </div>
      </div>

      ${item.note ? `<div class="card__note">${escapeHtml(item.note)}</div>` : ""}
      <div class="tags">${tags.map((tg, i) => `<span class="tag ${i === 0 ? "tag--accent" : ""}"><span class="tag__text">${escapeHtml(tg)}</span></span>`).join("")}</div>
    `;

    card.querySelector(".fav")?.addEventListener("click", () => {
      item.favorite = !item.favorite;
      item.updatedAt = Date.now();
      onChange?.();
      render(state, els, onChange);
    });

    const menuTrigger = card.querySelector("[data-card-menu]");
    const menuPop = card.querySelector("[data-card-pop]");
    if (menuTrigger && menuPop) {
      menuTrigger.addEventListener("click", (e) => {
        e.stopPropagation();
        const wasHidden = menuPop.hidden;
        closeAllCardMenus();
        menuPop.hidden = !wasHidden;
      });
    }

    card.querySelector("[data-edit]")?.addEventListener("click", (e) => {
      e.stopPropagation();
      closeAllCardMenus();
      actions?.onEditItem?.(item.id);
    });

    card.querySelector("[data-del]")?.addEventListener("click", () => {
      closeAllCardMenus();
      state.items = state.items.filter((x) => x.id !== item.id);
      onChange?.();
      render(state, els, onChange);
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

    card.addEventListener("dragstart", (e) => {
      if (!e.dataTransfer) return;
      e.dataTransfer.setData("text/resource-vault-item-id", item.id);
      e.dataTransfer.effectAllowed = "move";
      card.classList.add("card--dragging");
    });

    card.addEventListener("dragend", () => {
      card.classList.remove("card--dragging");
      document.querySelectorAll(".collection--dragover").forEach((el) => el.classList.remove("collection--dragover"));
    });

    card.querySelectorAll('a[target="_blank"]').forEach((link) => {
      link.draggable = false;
      link.addEventListener("click", () => {
        actions?.onOpenItem?.(item.id);
      });
    });

    els.grid.appendChild(card);
  });

  const addCard = document.createElement("button");
  addCard.type = "button";
  addCard.className = "card card--add";
  addCard.style.setProperty("--stagger", `${Math.min(list.length, 14) * 20}ms`);
  addCard.innerHTML = `
    <span class="card__add-plus">+</span>
    <span class="card__add-text">${escapeHtml(t(L, "quickAddHint"))}</span>
  `;
  addCard.addEventListener("click", openAddModal);
  els.grid.appendChild(addCard);
}

function filteredItems(state) {
  const active = getActiveCollection(state);
  const recentOrder = new Map((state.recentViewedIds || []).map((id, idx) => [id, idx]));

  const list = state.items
    .filter((item) => itemInActiveContext(item, active))
    .filter((item) => matchesLink(item, {
      types: state.filters.types || [],
      sources: state.filters.sources || [],
      tagContains: state.filters.tag || "",
      favoriteOnly: !!state.filters.favoriteOnly
    }))
    .filter((item) => matchesSearch(item, state.search));

  if (active?.id === "recent") {
    return list.sort((a, b) => (recentOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (recentOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER));
  }

  return list.sort((a, b) => compareItems(a, b, state.sortBy || "newest"));
}

function visibleItems(state, collection) {
  return state.items.filter((item) => itemInCollectionView(item, collection));
}

function getActiveCollection(state) {
  if (state.activeCollectionId === "all") return { id: "all", name: "All" };
  if (state.activeCollectionId === "fav") return { id: "fav", name: "Favorites" };
  if (state.activeCollectionId === "recent") return { id: "recent", name: "Recent", recentViewedIds: state.recentViewedIds || [] };
  return state.collections.find((c) => c.id === state.activeCollectionId) || { id: "all", name: "All" };
}

function itemInActiveContext(item, active) {
  if (!active || active.id === "all") return true;
  if (active.id === "fav") return !!item.favorite;
  if (active.id === "recent") return Array.isArray(active.recentViewedIds) && active.recentViewedIds.includes(item.id);
  return itemInCollectionView(item, active);
}

function itemInCollectionView(item, collection) {
  if (!collection || collection.id === "all") return true;
  if (collection.id === "fav") return !!item.favorite;
  if (collection.kind === "smart") return matchesLink(item, collection.rules || {});
  return Array.isArray(item.collectionIds) && item.collectionIds.includes(collection.id);
}

function matchesSearch(item, search) {
  const s = String(search || "").trim().toLowerCase();
  if (!s) return true;
  const hay = `${item.title || ""} ${item.url || ""} ${item.note || ""} ${(item.tags || []).join(" ")}`.toLowerCase();
  return hay.includes(s);
}

function compareItems(a, b, sortBy) {
  const titleA = String(a.title || a.url || "").toLowerCase();
  const titleB = String(b.title || b.url || "").toLowerCase();
  const sourceA = String(a.source || "Other").toLowerCase();
  const sourceB = String(b.source || "Other").toLowerCase();

  switch (sortBy) {
    case "oldest":
      return (a.createdAt || 0) - (b.createdAt || 0);
    case "title_asc":
      return titleA.localeCompare(titleB, "ru");
    case "title_desc":
      return titleB.localeCompare(titleA, "ru");
    case "source_asc":
      return sourceA.localeCompare(sourceB, "ru") || titleA.localeCompare(titleB, "ru");
    case "newest":
    default:
      return (b.createdAt || 0) - (a.createdAt || 0);
  }
}

function displayOptionLabel(value, kind, lang) {
  if (!value) return t(lang, "anyOption");
  return t(lang, `${kind}_${String(value).toLowerCase()}`);
}

function removeFilter(state, chip) {
  if (chip.key === "type") state.filters.types = state.filters.types.filter((x) => x !== chip.value);
  if (chip.key === "source") state.filters.sources = state.filters.sources.filter((x) => x !== chip.value);
  if (chip.key === "tag") state.filters.tag = "";
  if (chip.key === "fav") state.filters.favoriteOnly = false;
}

function syncFilterInputs(state, els) {
  const selectedTypes = new Set(state.filters.types || []);
  const selectedSources = new Set(state.filters.sources || []);

  els.filterTypes?.querySelectorAll('input[name="filterType"]').forEach((input) => {
    input.checked = selectedTypes.has(input.value);
  });

  els.filterSources?.querySelectorAll('input[name="filterSource"]').forEach((input) => {
    input.checked = selectedSources.has(input.value);
  });

  if (els.filterTagInput) els.filterTagInput.value = state.filters.tag || "";
  if (els.filterFavoriteOnly) els.filterFavoriteOnly.checked = !!state.filters.favoriteOnly;
}

function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function openAddModal() {
  document.getElementById("btnAddLink")?.click();
}

function wireQuickAdd(root) {
  root.querySelectorAll("[data-add-link]").forEach((el) => {
    el.addEventListener("click", openAddModal);
  });
}

let collectionMenuOutsideBound = false;
let cardMenuOutsideBound = false;

function closeAllCollectionMenus() {
  document.querySelectorAll("[data-col-pop]").forEach((el) => {
    el.hidden = true;
  });
}

function ensureCollectionMenuOutsideClose() {
  if (collectionMenuOutsideBound) return;
  collectionMenuOutsideBound = true;

  document.addEventListener("click", (e) => {
    if (e.target.closest(".collection__menu")) return;
    closeAllCollectionMenus();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllCollectionMenus();
  });
}

function closeAllCardMenus() {
  document.querySelectorAll("[data-card-pop]").forEach((el) => {
    el.hidden = true;
  });
}

function ensureCardMenuOutsideClose() {
  if (cardMenuOutsideBound) return;
  cardMenuOutsideBound = true;

  document.addEventListener("click", (e) => {
    if (e.target.closest(".card__menu")) return;
    closeAllCardMenus();
  });

  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape") closeAllCardMenus();
  });
}

