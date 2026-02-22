import { matchesLink, domainFromUrl, faviconUrl, previewFallbackUrl } from "./filter.js";
import { t } from "./i18n.js";
import { confirmDialog, promptDialog } from "./ui/feedback.js";
import { showDialogWithA11y } from "./ui/dialogA11y.js";

let activeActions = {};

export function render(state, els, onChange, actions = activeActions) {
  activeActions = actions || {};
  const L = state.lang || "ru";
  renderNav(state, els, L);
  renderCollections(state, els, onChange, L);
  renderSavedFilters(state, els, onChange, activeActions, L);
  renderHeader(state, els, L);
  renderActiveFilters(state, els, onChange, L);
  renderDemoHint(state, els, L);
  renderGrid(state, els, onChange, activeActions, L);
}

function renderDemoHint(state, els, L) {
  if (!els.demoHint || !els.demoHintText || !els.demoHintAdd) return;
  const show = !!state.isUsingDemoData;
  els.demoHint.hidden = !show;
  if (!show) return;
  els.demoHintText.textContent = t(L, "demoHintText");
  els.demoHintAdd.textContent = t(L, "demoHintAction");
}

function renderNav(state, els, L) {
  const setNavText = (el, value) => {
    if (!el) return;
    const label = el.querySelector(".nav-label");
    if (label) label.textContent = value;
    else el.textContent = value;
  };
  if (els.navAll) {
    setNavText(els.navAll, t(L, "navAll"));
    els.navAll.classList.toggle("nav-item--active", state.activeCollectionId === "all" && !state.activeSavedFilterId);
  }
  if (els.navFav) {
    setNavText(els.navFav, t(L, "navFav"));
    els.navFav.classList.toggle("nav-item--active", state.activeCollectionId === "fav");
  }
  if (els.navHidden) {
    setNavText(els.navHidden, t(L, "navHidden"));
    els.navHidden.classList.toggle("nav-item--active", state.activeCollectionId === "hidden");
  }
  if (els.navRecent) {
    setNavText(els.navRecent, t(L, "navRecent"));
    els.navRecent.classList.toggle("nav-item--active", state.activeCollectionId === "recent");
  }
  if (els.navLiquid) {
    setNavText(els.navLiquid, t(L, "navLiquid"));
    els.navLiquid.classList.toggle("nav-item--active", state.activeCollectionId === "liquid");
  }
}

function renderCollections(state, els, onChange, L) {
  ensureCollectionMenuOutsideClose();
  if (!els.collectionsList) return;
  els.collectionsList.innerHTML = "";

  for (const c of state.collections || []) {
    const count = visibleItems(state, c).length;
    const isOwner = !!(state.currentUserId && c.ownerId === state.currentUserId);
    const canInvite = !!(isOwner && c.isShared);
    const canManage = !!isOwner;
    const hasMenu = canInvite || canManage;
    const isPinned = (state.ui?.pinnedCollectionIds || []).includes(c.id);
    const sharedBadge = c.isShared ? `<span class="badge badge--smart">${escapeHtml(t(L, "sharedBadge"))}</span>` : "";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "collection" + (state.activeCollectionId === c.id ? " collection--active" : "");
    btn.dataset.collectionId = c.id;
    btn.draggable = true;
    btn.innerHTML = `
      <div class="collection__left">
        <div class="dot"></div>
        <div class="collection__name"><div>${escapeHtml(c.name)}</div>${sharedBadge}</div>
      </div>
      <div class="collection__right">
        <button class="collection__pin ${isPinned ? "collection__pin--on" : ""}" type="button" data-col-pin="1" title="${escapeHtml(t(L, isPinned ? "unpinCollection" : "pinCollection"))}" aria-label="${escapeHtml(t(L, isPinned ? "unpinCollection" : "pinCollection"))}">&#128204;</button>
        <div class="badge">${count}</div>
        ${hasMenu ? `<div class="collection__menu">
          <button class="collection__menu-trigger" type="button" data-col-menu="1"><span class="collection__menu-dots">&#8943;</span></button>
          <div class="collection__menu-pop" data-col-pop hidden>
            ${canInvite ? `<button class="collection__menu-item" type="button" data-col-invite="1">${escapeHtml(t(L, "inviteToCollection"))}</button>` : ""}
            ${canManage ? `<button class="collection__menu-item" type="button" data-col-rename="1">${escapeHtml(t(L, "renameCollection"))}</button>` : ""}
            ${canManage ? `<button class="collection__menu-item collection__menu-item--danger" type="button" data-col-del="1">${escapeHtml(t(L, "deleteCollection"))}</button>` : ""}
          </div>
        </div>` : ""}
      </div>
    `;

    wireCollectionInteractions({ btn, collection: c, state, els, onChange, L });

    els.collectionsList.appendChild(btn);
  }
}

function wireCollectionInteractions({ btn, collection, state, els, onChange, L }) {
  btn.addEventListener("click", () => {
    state.activeSavedFilterId = null;
    state.activeCollectionId = collection.id;
    render(state, els, onChange, activeActions);
  });

  btn.addEventListener("dragstart", (e) => {
    if (!e.dataTransfer) return;
    e.dataTransfer.setData("text/resource-vault-collection-id", collection.id);
    e.dataTransfer.effectAllowed = "move";
    btn.classList.add("collection--dragging");
  });

  btn.addEventListener("dragend", () => {
    btn.classList.remove("collection--dragging");
    document.querySelectorAll(".collection--dragover").forEach((el) => el.classList.remove("collection--dragover"));
  });

  btn.addEventListener("dragover", (e) => e.preventDefault());
  btn.addEventListener("dragenter", (e) => {
    e.preventDefault();
    btn.classList.add("collection--dragover");
  });
  btn.addEventListener("dragleave", () => btn.classList.remove("collection--dragover"));
  btn.addEventListener("drop", async (e) => {
    e.preventDefault();
    e.stopPropagation();
    btn.classList.remove("collection--dragover");
    const draggedCollectionId = String(e.dataTransfer?.getData("text/resource-vault-collection-id") || "").trim();
    if (draggedCollectionId && draggedCollectionId !== collection.id) {
      await activeActions?.onReorderCollections?.(draggedCollectionId, collection.id);
      return;
    }
    const itemId = String(e.dataTransfer?.getData("text/resource-vault-item-id") || "").trim();
    if (!itemId) return;
    await activeActions?.onAssignToCollection?.(itemId, collection.id);
  });

  btn.querySelector("[data-col-pin]")?.addEventListener("click", async (e) => {
    e.stopPropagation();
    await activeActions?.onTogglePinCollection?.(collection.id);
  });

  bindCollectionMenuToggle(btn, "[data-col-menu]", "[data-col-pop]");

  btn.querySelector("[data-col-rename]")?.addEventListener("click", async (e) => {
    e.stopPropagation();
    closeAllCollectionMenus();
    const next = await promptDialog({
      title: t(L, "renameCollection"),
      message: t(L, "renameCollectionPrompt"),
      defaultValue: collection.name || "",
      submitText: t(L, "save"),
      cancelText: t(L, "cancel")
    });
    if (next == null) return;
    const name = String(next || "").trim();
    if (!name) return;
    await activeActions?.onRenameCollection?.(collection.id, name);
  });

  btn.querySelector("[data-col-invite]")?.addEventListener("click", async (e) => {
    e.stopPropagation();
    closeAllCollectionMenus();
    await activeActions?.onInviteCollection?.(collection.id);
  });

  btn.querySelector("[data-col-del]")?.addEventListener("click", async (e) => {
    e.stopPropagation();
    closeAllCollectionMenus();
    const ok = await confirmAction(els, L, {
      title: t(L, "deleteCollectionTitle"),
      text: t(L, "deleteCollectionText"),
      confirm: t(L, "del")
    });
    if (!ok) return;
    await activeActions?.onDeleteCollection?.(collection.id);
  });
}

function renderSavedFilters(state, els, onChange, actions, L) {
  if (els.savedFiltersSection) {
    els.savedFiltersSection.hidden = !state.isAuthenticated || !(state.savedFilters || []).length;
  }
  if (!els.savedFiltersList) return;
  els.savedFiltersList.innerHTML = "";

  for (const f of state.savedFilters || []) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "collection" + (state.activeSavedFilterId === f.id ? " collection--active" : "");
    btn.innerHTML = `
      <div class="collection__left">
        <div class="dot"></div>
        <div class="collection__name"><div>${escapeHtml(f.name)}</div></div>
      </div>
      <div class="collection__right">
        <div class="collection__menu">
          <button class="collection__menu-trigger" type="button" data-filter-menu="1"><span class="collection__menu-dots">&#8943;</span></button>
          <div class="collection__menu-pop" data-filter-pop hidden>
            <button class="collection__menu-item collection__menu-item--danger" type="button" data-filter-del="1">${escapeHtml(t(L, "del"))}</button>
          </div>
        </div>
      </div>
    `;

    wireSavedFilterInteractions({ btn, savedFilter: f, state, els, onChange, actions, L });

    els.savedFiltersList.appendChild(btn);
  }
}

function wireSavedFilterInteractions({ btn, savedFilter, state, els, onChange, actions, L }) {
  btn.addEventListener("click", () => {
    state.activeSavedFilterId = savedFilter.id;
    state.activeCollectionId = "all";
    const filter = savedFilter.filter || {};
    state.filters.types = Array.isArray(filter.types) ? [...filter.types] : [];
    state.filters.sources = Array.isArray(filter.sources) ? [...filter.sources] : [];
    state.filters.tag = String(filter.tag || "");
    state.filters.favoriteOnly = !!filter.favoriteOnly;
    state.search = String(filter.search || "");
    state.sortBy = String(filter.sortBy || state.sortBy || "newest");
    syncFilterInputs(state, els);
    if (els.searchInput) els.searchInput.value = state.search;
    if (els.sortSelect) els.sortSelect.value = state.sortBy;
    onChange?.();
    render(state, els, onChange, actions);
  });

  bindCollectionMenuToggle(btn, "[data-filter-menu]", "[data-filter-pop]");

  btn.querySelector("[data-filter-del]")?.addEventListener("click", async (e) => {
    e.stopPropagation();
    closeAllCollectionMenus();
    const ok = await confirmAction(els, L, {
      title: t(L, "deleteSavedFilterTitle"),
      text: t(L, "deleteSavedFilterText"),
      confirm: t(L, "del")
    });
    if (!ok) return;
    await actions?.onDeleteSavedFilter?.(savedFilter.id);
  });
}

function bindCollectionMenuToggle(root, triggerSelector, popSelector) {
  // Shared toggle behavior for collection/saved-filter context menus.
  const trigger = root.querySelector(triggerSelector);
  const pop = root.querySelector(popSelector);
  if (!trigger || !pop) return;

  trigger.addEventListener("click", (e) => {
    e.stopPropagation();
    const wasHidden = pop.hidden;
    closeAllCollectionMenus();
    pop.hidden = !wasHidden;
    trigger.closest(".collection__menu")?.classList.toggle("collection__menu--open", !pop.hidden);
  });
}

function renderHeader(state, els, L) {
  const active = getActiveCollection(state);
  const list = filteredItems(state);

  if (state.activeSavedFilterId) {
    const sf = (state.savedFilters || []).find((x) => x.id === state.activeSavedFilterId);
    els.activeTitle.textContent = sf ? sf.name : t(L, "all");
    els.activeMeta.textContent = `${list.length} ${t(L, "items")}`;
    return;
  }

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
  if (active.id === "liquid") {
    els.activeTitle.textContent = t(L, "liquidTitle");
    els.activeMeta.textContent = t(L, "liquidMeta");
    return;
  }
  if (active.id === "hidden") {
    els.activeTitle.textContent = t(L, "hidden");
    els.activeMeta.textContent = `${list.length} ${t(L, "items")}`;
    return;
  }

  els.activeTitle.textContent = `${t(L, "collectionSingle")}: ${active.name}`;
  els.activeMeta.textContent = `${list.length} ${t(L, "items")} | ${t(L, "contextManual")}`;
}

function renderActiveFilters(state, els, onChange, L) {
  const bar = els.activeFilters;
  if (!bar) return;
  bar.innerHTML = "";
  const chipsBar = bar.closest(".chipsbar");

  const chips = [];
  for (const type of state.filters.types || []) chips.push({ key: "type", value: type, label: `${t(L, "chipType")}: ${displayOptionLabel(type, "type", L)}` });
  for (const src of state.filters.sources || []) chips.push({ key: "source", value: src, label: `${t(L, "chipSource")}: ${displayOptionLabel(src, "source", L)}` });
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
    btn.textContent = `${c.label} x`;
    btn.addEventListener("click", () => {
      removeFilter(state, c);
      syncFilterInputs(state, els);
      onChange?.();
      render(state, els, onChange, activeActions);
    });
    bar.appendChild(btn);
  }

  if (state.search) {
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "chip chip--on";
    btn.textContent = `${t(L, "chipSearch")}: ${state.search} x`;
    btn.addEventListener("click", () => {
      state.search = "";
      if (els.searchInput) els.searchInput.value = "";
      syncFilterInputs(state, els);
      onChange?.();
      render(state, els, onChange, activeActions);
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
    render(state, els, onChange, activeActions);
  });
  bar.appendChild(clear);
}

function renderGrid(state, els, onChange, actions, L) {
  if (state.activeCollectionId === "liquid") {
    els.grid.innerHTML = "";
    els.grid.classList.remove("grid--empty");
    return;
  }
  const list = filteredItems(state);
  els.grid.classList.toggle("grid--empty", !list.length);
  // Batch DOM writes for better render performance on large lists.
  const fragment = document.createDocumentFragment();

  if (!list.length) {
    const active = getActiveCollection(state);
    const empty = document.createElement("div");
    empty.className = "empty";

    if (!active || active.id === "all") {
      empty.innerHTML = `<div class="empty__title">${escapeHtml(t(L, "emptyAllTitle"))}</div><div class="empty__text">${escapeHtml(t(L, "emptyAllText"))}</div><div class="empty__actions"><button class="btn btn--primary" type="button" data-add-link="1">${escapeHtml(t(L, "quickAdd"))}</button></div>`;
    } else if (active.id === "fav") {
      empty.innerHTML = `<div class="empty__title">${escapeHtml(t(L, "emptyFavTitle"))}</div><div class="empty__text">${escapeHtml(t(L, "emptyFavText"))}</div><div class="empty__actions"><button class="btn btn--primary" type="button" data-add-link="1">${escapeHtml(t(L, "quickAdd"))}</button></div>`;
    } else if (active.id === "recent") {
      empty.innerHTML = `<div class="empty__title">${escapeHtml(t(L, "emptyRecentTitle"))}</div><div class="empty__text">${escapeHtml(t(L, "emptyRecentText"))}</div>`;
    } else if (active.id === "hidden") {
      empty.innerHTML = `<div class="empty__title">${escapeHtml(t(L, "emptyHiddenTitle"))}</div><div class="empty__text">${escapeHtml(t(L, "emptyHiddenText"))}</div><div class="empty__actions"><button class="btn btn--primary" type="button" data-add-link="1">${escapeHtml(t(L, "quickAdd"))}</button></div>`;
    } else {
      empty.innerHTML = `<div class="empty__title">${escapeHtml(t(L, "emptyCollectionTitle"))}</div><div class="empty__text">${escapeHtml(t(L, "emptyCollectionText"))}</div><div class="empty__actions"><button class="btn btn--primary" type="button" data-add-link="1">${escapeHtml(t(L, "quickAdd"))}</button></div>`;
    }

    wireQuickAdd(empty);
    fragment.appendChild(empty);
    els.grid.replaceChildren(fragment);
    return;
  }

  for (let index = 0; index < list.length; index += 1) {
    const item = list[index];
    const card = document.createElement("div");
    card.className = `card${item.isDemo ? " card--demo" : ""}`;
    card.style.setProperty("--stagger", `${Math.min(index, 14) * 20}ms`);
    card.draggable = true;
    card.dataset.itemId = item.id;

    const domain = domainFromUrl(item.url);
    const tags = (item.tags || []).slice(0, 10);
    const icon = faviconUrl(item.url);
    const previewSrc = item.previewImage || previewFallbackUrl(item.url);
    const noteText = String(item.note || "").trim();
    const hasNote = !!noteText;
    const noteNeedsExpand = hasNote && (noteText.length > 90 || /\r?\n/.test(noteText));
    const notePreview = hasNote ? noteText : t(L, "noteEmpty");

    card.innerHTML = `
      <div class="card__preview-wrap">
        ${item.isDemo ? `<span class="demo-badge">${escapeHtml(t(L, "demoBadge"))}</span>` : ""}
        ${item.isAiNew ? `<span class="new-badge">NEW</span>` : ""}
        <a class="card__preview-link" href="${item.url}" target="_blank" rel="noreferrer" draggable="false">
          <img class="card__preview" src="${escapeHtml(previewSrc)}" data-fallback="${escapeHtml(previewFallbackUrl(item.url))}" alt="${escapeHtml(item.title || "preview")}" loading="lazy" referrerpolicy="no-referrer" />
        </a>
        <button class="card__fav-preview ${item.favorite ? "card__fav-preview--on" : ""} ${item.isDemo ? "card__fav-preview--disabled" : ""}" type="button" title="${escapeHtml(t(L, "favorites"))}" ${item.isDemo ? "disabled" : ""}>
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true" focusable="false">
            <path d="M8 2.5L9.9 6.3l4.2.6-3 2.9.7 4.2L8 11.8l-3.8 2.2.7-4.2-3-2.9 4.2-.6L8 2.5z"></path>
          </svg>
        </button>
      </div>

      <div class="card__top">
        <div class="card__left">
          ${icon ? `<img class="favicon" src="${icon}" alt="">` : `<div class="favicon"></div>`}
          <div>
            <a class="card__title-link" href="${item.url}" target="_blank" rel="noreferrer" draggable="false">${escapeHtml(item.title || domain || "Untitled")}</a>
          </div>
        </div>
        <div class="card__tools">
          ${item.isDemo ? "" : `<button class="card__delete" type="button" data-del="1" aria-label="${escapeHtml(t(L, "del"))}" title="${escapeHtml(t(L, "del"))}">
            <svg viewBox="18 18 20 22" aria-hidden="true" focusable="false"><path fill="currentColor" fill-rule="evenodd" d="M36 26v10.997c0 1.659-1.337 3.003-3.009 3.003h-9.981c-1.662 0-3.009-1.342-3.009-3.003v-10.997h16zm-2 0v10.998c0 .554-.456 1.002-1.002 1.002h-9.995c-.554 0-1.002-.456-1.002-1.002v-10.998h12zm-9-5c0-.552.451-1 .991-1h4.018c.547 0 .991.444.991 1 0 .552-.451 1-.991 1h-4.018c-.547 0-.991-.444-.991-1zm0 6.997c0-.551.444-.997 1-.997.552 0 1 .453 1 .997v6.006c0 .551-.444.997-1 .997-.552 0-1-.453-1-.997v-6.006zm4 0c0-.551.444-.997 1-.997.552 0 1 .453 1 .997v6.006c0 .551-.444.997-1 .997-.552 0-1-.453-1-.997v-6.006zm-6-5.997h-4.008c-.536 0-.992.448-.992 1 0 .556.444 1 .992 1h18.016c.536 0 .992-.448.992-1 0-.556-.444-1-.992-1h-4.008v-1c0-1.653-1.343-3-3-3h-3.999c-1.652 0-3 1.343-3 3v1z"/></svg>
          </button>`}
        </div>
      </div>

      <div class="card__note-wrap">
        <div class="card__note ${hasNote ? "" : "card__note--empty"}">${escapeHtml(notePreview)}</div>
        ${noteNeedsExpand ? `<button class="card__note-more" type="button" data-note-expand="1">${escapeHtml(t(L, "expandNote"))}</button>` : ""}
      </div>
      <div class="tags">${tags.map((tg, i) => `<span class="tag ${i === 0 ? "tag--accent" : ""}"><span class="tag__text">${escapeHtml(tg)}</span></span>`).join("")}</div>
    `;

    wireCardInteractions({ card, item, noteText, actions, els, L });

    fragment.appendChild(card);
  }

  const addCard = document.createElement("button");
  addCard.type = "button";
  addCard.className = "card card--add";
  addCard.style.setProperty("--stagger", `${Math.min(list.length, 14) * 20}ms`);
  addCard.innerHTML = `<span class="card__add-plus">+</span><span class="card__add-text">${escapeHtml(t(L, "quickAddHint"))}</span>`;
  addCard.addEventListener("click", openAddModal);
  fragment.appendChild(addCard);
  els.grid.replaceChildren(fragment);
}

function wireCardInteractions({ card, item, noteText, actions, els, L }) {
  card.addEventListener("click", async (e) => {
    const target = e.target instanceof Element ? e.target : null;
    if (!target) return;

    if (!item.isDemo && target.closest(".card__fav-preview")) {
      e.preventDefault();
      e.stopPropagation();
      await actions?.onToggleFavorite?.(item.id, !item.favorite);
      return;
    }

    if (!item.isDemo && target.closest("[data-del]")) {
      e.preventDefault();
      const confirmed = await confirmDelete(els, L);
      if (!confirmed) return;
      await actions?.onDeleteItem?.(item.id);
      return;
    }

    if (target.closest("[data-note-expand]")) {
      e.preventDefault();
      await confirmAction(els, L, {
        title: t(L, "modalNote"),
        text: noteText,
        confirm: t(L, "cancel"),
        hideCancel: true
      });
      return;
    }

    const link = target.closest('a[target="_blank"]');
    if (link) actions?.onOpenItem?.(item.id);
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

  if (active?.id === "recent") return list.sort((a, b) => (recentOrder.get(a.id) ?? Number.MAX_SAFE_INTEGER) - (recentOrder.get(b.id) ?? Number.MAX_SAFE_INTEGER));
  return list.sort((a, b) => compareItems(a, b, state.sortBy || "newest"));
}

function visibleItems(state, collection) {
  return state.items.filter((item) => itemInCollectionView(item, collection));
}

function getActiveCollection(state) {
  if (state.activeCollectionId === "all") return { id: "all", name: "All" };
  if (state.activeCollectionId === "fav") return { id: "fav", name: "Favorites" };
  if (state.activeCollectionId === "hidden") return { id: "hidden", name: "Hidden" };
  if (state.activeCollectionId === "recent") return { id: "recent", name: "Recent", recentViewedIds: state.recentViewedIds || [] };
  if (state.activeCollectionId === "liquid") return { id: "liquid", name: "Liquid Lab" };
  return state.collections.find((c) => c.id === state.activeCollectionId) || { id: "all", name: "All" };
}

function itemInActiveContext(item, active) {
  if (active?.id === "hidden") return !!item.hidden;
  if (!active || active.id === "all") return !item.hidden;
  if (active.id === "fav") return !!item.favorite && !item.hidden;
  if (active.id === "recent") return Array.isArray(active.recentViewedIds) && active.recentViewedIds.includes(item.id) && !item.hidden;
  return itemInCollectionView(item, active);
}

function itemInCollectionView(item, collection) {
  if (!collection || collection.id === "all") return !item.hidden;
  if (collection.id === "fav") return !!item.favorite && !item.hidden;
  if (collection.id === "hidden") return !!item.hidden;
  if (item.hidden) return false;
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
  const sourceA = String(a.source || "other").toLowerCase();
  const sourceB = String(b.source || "other").toLowerCase();

  switch (sortBy) {
    case "oldest": return (a.createdAt || 0) - (b.createdAt || 0);
    case "title_asc": return titleA.localeCompare(titleB, "ru");
    case "title_desc": return titleB.localeCompare(titleA, "ru");
    case "source_asc": return sourceA.localeCompare(sourceB, "ru") || titleA.localeCompare(titleB, "ru");
    case "newest":
    default: return (b.createdAt || 0) - (a.createdAt || 0);
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
  root.querySelectorAll("[data-add-link]").forEach((el) => el.addEventListener("click", openAddModal));
}

let collectionMenuOutsideBound = false;

function closeAllCollectionMenus() {
  document.querySelectorAll("[data-col-pop], [data-filter-pop]").forEach((el) => {
    el.hidden = true;
    el.closest(".collection__menu")?.classList.remove("collection__menu--open");
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

function confirmDelete(els, L) {
  return confirmAction(els, L, {
    title: t(L, "deleteLinkTitle"),
    text: t(L, "deleteLinkText"),
    confirm: t(L, "del")
  });
}

function confirmAction(els, L, options = {}) {
  const dialog = els.modalDeleteLink;
  if (!dialog || !els.deleteCancel || !els.deleteConfirm || !els.modalDeleteTitle || !els.modalDeleteText) {
    return confirmDialog({
      title: String(options.title || t(L, "deleteLinkTitle")),
      message: String(options.text || t(L, "deleteLinkText")),
      confirmText: String(options.confirm || t(L, "del")),
      cancelText: t(L, "cancel")
    });
  }

  const title = String(options.title || t(L, "deleteLinkTitle"));
  const text = String(options.text || t(L, "deleteLinkText"));
  const confirmLabel = String(options.confirm || t(L, "del"));
  const hideCancel = !!options.hideCancel;

  const prevTitle = els.modalDeleteTitle.textContent || "";
  const prevText = els.modalDeleteText.textContent || "";
  const prevConfirm = els.deleteConfirm.textContent || "";
  const prevCancelHidden = !!els.deleteCancel.hidden;

  els.modalDeleteTitle.textContent = title;
  els.modalDeleteText.textContent = text;
  els.deleteConfirm.textContent = confirmLabel;
  els.deleteCancel.hidden = hideCancel;

  return new Promise((resolve) => {
    let settled = false;
    const cleanup = () => {
      els.deleteCancel.removeEventListener("click", onCancel);
      els.deleteConfirm.removeEventListener("click", onConfirm);
      dialog.removeEventListener("cancel", onCancel);
      dialog.removeEventListener("close", onClose);
      els.modalDeleteTitle.textContent = prevTitle;
      els.modalDeleteText.textContent = prevText;
      els.deleteConfirm.textContent = prevConfirm;
      els.deleteCancel.hidden = prevCancelHidden;
    };

    const onCancel = (e) => {
      if (e) e.preventDefault();
      if (settled) return;
      settled = true;
      cleanup();
      dialog.close();
      resolve(false);
    };

    const onConfirm = () => {
      if (settled) return;
      settled = true;
      cleanup();
      dialog.close();
      resolve(true);
    };

    const onClose = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(false);
    };

    els.deleteCancel.addEventListener("click", onCancel);
    els.deleteConfirm.addEventListener("click", onConfirm);
    dialog.addEventListener("cancel", onCancel);
    dialog.addEventListener("close", onClose, { once: true });
    showDialogWithA11y(dialog, { preferredFocus: hideCancel ? els.deleteConfirm : els.deleteCancel });
  });
}
