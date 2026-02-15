import "./styles.css";
import { state } from "./state.js";
import { loadLegacyVault, loadUiSettings, saveUiSettings } from "./storage.js";
import { TAG_MAX_LEN, TAG_MIN_LEN, detectSourceFromUrl, domainFromUrl, normalizeSearchText, normalizeTags, previewFallbackUrl } from "./filter.js";
import { t } from "./i18n.js";
import { render } from "./ui.js";
import { SOURCE_CODES, TYPE_CODES } from "./domain.js";
import { initAuth, loginWithGoogle, logout } from "./useAuth.js";
import { createLink, deleteLink, listLinks, updateLink } from "./useLinks.js";
import { createCollection, deleteCollection, listCollections, listLinkCollections, replaceLinkCollections, updateCollection } from "./useCollections.js";
import { createSavedFilter, deleteSavedFilter, listSavedFilters } from "./useSavedFilters.js";

const TITLE_MIN_LEN = 2;
const TITLE_MAX_LEN = 120;
const NOTE_MAX_LEN = 500;
const FILTER_SORTS = new Set(["newest", "oldest", "title_asc", "title_desc", "source_asc"]);

const els = {
  langRu: document.getElementById("langRu"),
  langEn: document.getElementById("langEn"),
  brand: document.getElementById("brand"),
  navAll: document.getElementById("navAll"),
  navFav: document.getElementById("navFav"),
  navRecent: document.getElementById("navRecent"),
  labelNav: document.getElementById("labelNav"),
  labelCollections: document.getElementById("labelCollections"),
  labelSavedFilters: document.getElementById("labelSavedFilters"),
  collectionsList: document.getElementById("collectionsList"),
  savedFiltersList: document.getElementById("savedFiltersList"),
  sidebar: document.getElementById("sidebar"),
  btnMobileMenu: document.getElementById("btnMobileMenu"),
  btnMobileClose: document.getElementById("btnMobileClose"),
  mobileOverlay: document.getElementById("mobileOverlay"),
  activeTitle: document.getElementById("activeTitle"),
  activeMeta: document.getElementById("activeMeta"),
  searchInput: document.getElementById("searchInput"),
  sortSelect: document.getElementById("sortSelect"),
  btnFilters: document.getElementById("btnFilters"),
  filtersPanel: document.getElementById("filtersPanel"),
  activeFilters: document.getElementById("activeFilters"),
  filterTypes: document.getElementById("filterTypes"),
  filterSources: document.getElementById("filterSources"),
  filterTagInput: document.getElementById("filterTagInput"),
  filterFavoriteOnly: document.getElementById("filterFavoriteOnly"),
  labelFilterTypes: document.getElementById("labelFilterTypes"),
  labelFilterSources: document.getElementById("labelFilterSources"),
  labelFilterTag: document.getElementById("labelFilterTag"),
  labelFilterFavorite: document.getElementById("labelFilterFavorite"),
  grid: document.getElementById("grid"),
  btnAddLink: document.getElementById("btnAddLink"),
  btnNewCollection: document.getElementById("btnNewCollection"),
  btnSaveFilter: document.getElementById("btnSaveFilter"),
  btnSettings: document.getElementById("btnSettings"),
  settingsMenu: document.getElementById("settingsMenu"),
  btnExport: document.getElementById("btnExport"),
  btnImport: document.getElementById("btnImport"),
  btnAuth: document.getElementById("btnAuth"),
  btnAuthLabel: document.getElementById("btnAuthLabel"),
  authStatus: document.getElementById("authStatus"),
  fileImport: document.getElementById("fileImport"),
  localHint: document.getElementById("localHint"),
  modalAddLink: document.getElementById("modalAddLink"),
  formAddLink: document.getElementById("formAddLink"),
  addCloseX: document.getElementById("addCloseX"),
  addCancel: document.getElementById("addCancel"),
  addSave: document.getElementById("addSave"),
  modalAddTitle: document.getElementById("modalAddTitle"),
  labelAddUrl: document.getElementById("labelAddUrl"),
  labelAddTitle: document.getElementById("labelAddTitle"),
  labelAddTags: document.getElementById("labelAddTags"),
  labelAddType: document.getElementById("labelAddType"),
  labelAddSource: document.getElementById("labelAddSource"),
  labelAddNote: document.getElementById("labelAddNote"),
  labelAddTo: document.getElementById("labelAddTo"),
  labelAddFavorite: document.getElementById("labelAddFavorite"),
  inputAddUrl: document.querySelector('#formAddLink input[name="url"]'),
  inputAddTitle: document.getElementById("inputAddTitle"),
  inputAddTags: document.getElementById("inputAddTags"),
  inputAddNote: document.getElementById("inputAddNote"),
  inputAddSource: document.getElementById("inputAddSource"),
  addFavorite: document.getElementById("addFavorite"),
  addCollectionsList: document.getElementById("addCollectionsList"),
  addTagsMenu: document.getElementById("addTagsMenu"),
  modalCollection: document.getElementById("modalCollection"),
  formCollection: document.getElementById("formCollection"),
  colCloseX: document.getElementById("colCloseX"),
  colCancel: document.getElementById("colCancel"),
  colCreate: document.getElementById("colCreate"),
  modalCollectionTitle: document.getElementById("modalCollectionTitle"),
  labelColName: document.getElementById("labelColName"),
  labelColDescription: document.getElementById("labelColDescription"),
  modalDeleteLink: document.getElementById("modalDeleteLink"),
  modalDeleteTitle: document.getElementById("modalDeleteTitle"),
  modalDeleteText: document.getElementById("modalDeleteText"),
  deleteCancel: document.getElementById("deleteCancel"),
  deleteConfirm: document.getElementById("deleteConfirm")
};

let currentUser = null;
let knownTags = [];
let activeTagMenuIndex = -1;
let sourceAutofillEnabled = true;

function persistUiSettings() {
  saveUiSettings({ lang: state.lang, sortBy: state.sortBy });
}

function renderApp() {
  persistUiSettings();
  render(state, els, persistUiSettings, actions);
}

function authEmail(user) {
  return String(user?.email || user?.user_metadata?.email || "").trim();
}

function updateLangButtons() {
  els.langRu?.classList.toggle("lang__btn--active", state.lang === "ru");
  els.langEn?.classList.toggle("lang__btn--active", state.lang === "en");
}

function renderAuthStatus() {
  const email = authEmail(currentUser);
  if (els.btnAuthLabel) els.btnAuthLabel.textContent = email ? t(state.lang, "signOut") : t(state.lang, "signInGoogle");
  if (els.authStatus) {
    els.authStatus.textContent = email ? `${t(state.lang, "authSignedInAs")}: ${email}` : t(state.lang, "authSignedOut");
  }
}

function optionKey(value) {
  return String(value || "").toLowerCase();
}

function chipCheckHtml(name, value, label, checked = false) {
  return `<label class="chip-check"><input type="checkbox" name="${escapeHtml(name)}" value="${escapeHtml(value)}" ${checked ? "checked" : ""}/><span>${escapeHtml(label)}</span></label>`;
}

function renderFilterChips() {
  if (els.filterTypes) els.filterTypes.innerHTML = TYPE_CODES.map((x) => chipCheckHtml("filterType", x, t(state.lang, `type_${x}`))).join("");
  if (els.filterSources) els.filterSources.innerHTML = SOURCE_CODES.map((x) => chipCheckHtml("filterSource", x, t(state.lang, `source_${x}`))).join("");

  els.filterTypes?.querySelectorAll("input").forEach((input) => {
    input.checked = state.filters.types.includes(input.value);
    input.addEventListener("change", () => {
      state.activeSavedFilterId = null;
      state.filters.types = [...els.filterTypes.querySelectorAll("input:checked")].map((x) => x.value);
      renderApp();
    });
  });
  els.filterSources?.querySelectorAll("input").forEach((input) => {
    input.checked = state.filters.sources.includes(input.value);
    input.addEventListener("change", () => {
      state.activeSavedFilterId = null;
      state.filters.sources = [...els.filterSources.querySelectorAll("input:checked")].map((x) => x.value);
      renderApp();
    });
  });
}

function renderAddCollectionChoices(selectedIds = []) {
  if (!els.addCollectionsList) return;
  const set = new Set(selectedIds);
  const chips = [`<span class="chip">${escapeHtml(t(state.lang, "addToInbox"))}</span>`];
  for (const col of state.collections) chips.push(chipCheckHtml("collections", col.id, col.name, set.has(col.id)));
  els.addCollectionsList.innerHTML = chips.join("");
}

function normalizeUrlForCompare(rawUrl) {
  try {
    const u = new URL(String(rawUrl || "").trim());
    u.hash = "";
    if (u.pathname.length > 1) u.pathname = u.pathname.replace(/\/+$/, "");
    return u.toString();
  } catch {
    return String(rawUrl || "").trim();
  }
}

function findDuplicateLink(url) {
  const target = normalizeUrlForCompare(url);
  return state.items.find((item) => normalizeUrlForCompare(item.url) === target) || null;
}

function invalidTagChunks(rawInput) {
  return String(rawInput || "").split(",").map((x) => String(x || "").trim().toLowerCase()).filter(Boolean).filter((x) => x.length < TAG_MIN_LEN || x.length > TAG_MAX_LEN);
}

function updateAddSourceUi() {
  if (!els.inputAddSource || !els.inputAddUrl || !sourceAutofillEnabled) return;
  const detected = detectSourceFromUrl(els.inputAddUrl.value || "");
  els.inputAddSource.value = SOURCE_CODES.includes(detected) ? detected : "other";
}

function closeAddModal() {
  sourceAutofillEnabled = true;
  activeTagMenuIndex = -1;
  if (els.addTagsMenu) els.addTagsMenu.hidden = true;
  els.modalAddLink?.close();
}

function openNewLinkModal(preset = {}) {
  sourceAutofillEnabled = true;
  activeTagMenuIndex = -1;
  els.formAddLink?.reset();
  renderAddCollectionChoices();
  renderTagSuggestions();
  if (els.inputAddUrl) els.inputAddUrl.value = String(preset.url || "");
  if (els.inputAddTitle) els.inputAddTitle.value = String(preset.title || "");
  if (els.inputAddSource) els.inputAddSource.value = "other";
  if (els.addFavorite) els.addFavorite.checked = state.activeCollectionId === "fav";
  updateAddSourceUi();
  els.modalAddLink?.showModal();
}

function updateTagsMenu() {
  if (!els.addTagsMenu || !els.inputAddTags) return;
  if (document.activeElement !== els.inputAddTags) {
    els.addTagsMenu.hidden = true;
    return;
  }
  const raw = String(els.inputAddTags.value || "");
  const chunks = raw.split(",");
  const query = normalizeSearchText(chunks.pop() || "");
  const chosen = normalizeTags(chunks.join(","));
  const next = knownTags.filter((tag) => !chosen.includes(tag)).filter((tag) => !query || tag.includes(query)).slice(0, 8);
  if (!next.length) {
    activeTagMenuIndex = -1;
    els.addTagsMenu.hidden = true;
    els.addTagsMenu.innerHTML = "";
    return;
  }
  if (activeTagMenuIndex >= next.length) activeTagMenuIndex = next.length - 1;
  if (activeTagMenuIndex < -1) activeTagMenuIndex = -1;
  els.addTagsMenu.innerHTML = next.map((tag, i) => `<button type="button" class="add-tags-menu__item ${i === activeTagMenuIndex ? "add-tags-menu__item--active" : ""}" data-tag-suggestion="${escapeHtml(tag)}">${escapeHtml(tag)}</button>`).join("");
  els.addTagsMenu.hidden = false;
}

function renderTagSuggestions() {
  knownTags = [...new Set(state.items.flatMap((item) => normalizeTags(item.tags || [])))].sort((a, b) => a.localeCompare(b, state.lang));
  updateTagsMenu();
}

function applyTagSuggestion(tag) {
  if (!els.inputAddTags) return;
  const raw = String(els.inputAddTags.value || "");
  const chunks = raw.split(",");
  chunks.pop();
  const chosen = normalizeTags(chunks.join(","));
  if (!chosen.includes(tag)) chosen.push(tag);
  els.inputAddTags.value = `${chosen.join(", ")}${chosen.length ? ", " : ""}`;
  activeTagMenuIndex = -1;
  updateTagsMenu();
}

function applyI18n() {
  const L = state.lang;
  if (els.brand) els.brand.textContent = t(L, "brand");
  if (els.labelNav) els.labelNav.textContent = t(L, "nav");
  if (els.labelCollections) els.labelCollections.textContent = t(L, "collections");
  if (els.labelSavedFilters) els.labelSavedFilters.textContent = t(L, "savedFilters");
  if (els.btnAddLink) els.btnAddLink.textContent = t(L, "addLink");
  if (els.btnNewCollection) els.btnNewCollection.setAttribute("aria-label", t(L, "newCollection"));
  if (els.btnSaveFilter) els.btnSaveFilter.setAttribute("aria-label", t(L, "saveFilter"));
  if (els.btnSettings) els.btnSettings.textContent = t(L, "settings");
  if (els.btnExport) els.btnExport.textContent = t(L, "exportJson");
  if (els.btnImport) els.btnImport.textContent = t(L, "importJson");
  if (els.localHint) els.localHint.textContent = t(L, "localHint");
  if (els.searchInput) els.searchInput.placeholder = t(L, "searchPlaceholder");
  if (els.btnFilters) els.btnFilters.textContent = t(L, "filters");
  if (els.labelFilterTypes) els.labelFilterTypes.textContent = t(L, "filterTypes");
  if (els.labelFilterSources) els.labelFilterSources.textContent = t(L, "filterSources");
  if (els.labelFilterTag) els.labelFilterTag.textContent = t(L, "filterTag");
  if (els.labelFilterFavorite) els.labelFilterFavorite.textContent = t(L, "filterFavoriteOnly");
  if (els.modalAddTitle) els.modalAddTitle.textContent = t(L, "modalAddTitle");
  if (els.labelAddUrl) els.labelAddUrl.textContent = t(L, "modalUrl");
  if (els.labelAddTitle) els.labelAddTitle.textContent = t(L, "modalTitle");
  if (els.labelAddTags) els.labelAddTags.textContent = t(L, "modalTags");
  if (els.labelAddType) els.labelAddType.textContent = t(L, "modalType");
  if (els.labelAddSource) els.labelAddSource.textContent = t(L, "modalSource");
  if (els.labelAddNote) els.labelAddNote.textContent = t(L, "modalNote");
  if (els.labelAddTo) els.labelAddTo.textContent = t(L, "addTo");
  if (els.labelAddFavorite) els.labelAddFavorite.textContent = t(L, "markFavorite");
  if (els.inputAddTitle) els.inputAddTitle.placeholder = t(L, "modalTitleHint");
  if (els.inputAddNote) els.inputAddNote.placeholder = L === "ru" ? "Зачем сохранил?" : "Why saved?";
  if (els.addCancel) els.addCancel.textContent = t(L, "cancel");
  if (els.addSave) els.addSave.textContent = t(L, "save");
  if (els.modalCollectionTitle) els.modalCollectionTitle.textContent = t(L, "modalCollectionTitle");
  if (els.labelColName) els.labelColName.textContent = t(L, "name");
  if (els.labelColDescription) els.labelColDescription.textContent = t(L, "description");
  if (els.colCancel) els.colCancel.textContent = t(L, "cancel");
  if (els.colCreate) els.colCreate.textContent = t(L, "create");
  if (els.modalDeleteTitle) els.modalDeleteTitle.textContent = t(L, "deleteLinkTitle");
  if (els.modalDeleteText) els.modalDeleteText.textContent = t(L, "deleteLinkText");
  if (els.deleteCancel) els.deleteCancel.textContent = t(L, "cancel");
  if (els.deleteConfirm) els.deleteConfirm.textContent = t(L, "del");

  if (els.sortSelect) {
    const labels = {
      newest: t(L, "sortNewest"),
      oldest: t(L, "sortOldest"),
      title_asc: t(L, "sortTitleAsc"),
      title_desc: t(L, "sortTitleDesc"),
      source_asc: t(L, "sortSource")
    };
    for (const option of els.sortSelect.options) option.textContent = labels[option.value] || option.value;
  }
  const typeSelect = els.formAddLink?.querySelector('select[name="type"]');
  if (typeSelect) {
    for (const option of typeSelect.options) option.textContent = option.value ? t(L, `type_${optionKey(option.value)}`) : t(L, "anyOption");
  }
  if (els.inputAddSource) {
    for (const option of els.inputAddSource.options) option.textContent = t(L, `source_${optionKey(option.value)}`);
  }

  renderFilterChips();
  renderAddCollectionChoices();
  renderTagSuggestions();
  renderAuthStatus();
}

function filterPayload() {
  return {
    types: [...state.filters.types],
    sources: [...state.filters.sources],
    tag: String(state.filters.tag || ""),
    favoriteOnly: !!state.filters.favoriteOnly,
    search: String(state.search || ""),
    sortBy: FILTER_SORTS.has(state.sortBy) ? state.sortBy : "newest"
  };
}

function isFilterActive() {
  return Boolean(state.filters.types.length || state.filters.sources.length || state.filters.tag || state.filters.favoriteOnly || state.search);
}

async function loadData() {
  const [links, collections, rows, savedFilters] = await Promise.all([
    listLinks(),
    listCollections(),
    listLinkCollections(),
    listSavedFilters()
  ]);
  const relMap = new Map();
  for (const rel of rows || []) {
    const linkId = String(rel.link_id || "");
    const colId = String(rel.collection_id || "");
    if (!linkId || !colId) continue;
    const list = relMap.get(linkId) || [];
    if (!list.includes(colId)) list.push(colId);
    relMap.set(linkId, list);
  }
  state.items = links.map((x) => ({ ...x, previewImage: previewFallbackUrl(x.url), collectionIds: relMap.get(x.id) || [] }));
  state.collections = collections;
  state.savedFilters = savedFilters;
}

async function migrateLegacyIfNeeded() {
  if (!currentUser?.id) return;
  const key = `resource_vault_migrated_v5_${currentUser.id}`;
  if (localStorage.getItem(key) === "1") return;
  const legacy = loadLegacyVault();
  if (!legacy || (!(legacy.items || []).length && !(legacy.collections || []).length)) {
    localStorage.setItem(key, "1");
    return;
  }

  const map = new Map();
  for (const col of legacy.collections || []) {
    const created = await createCollection({ name: String(col.name || "Collection"), description: String(col.description || "") }, currentUser.id);
    if (created) map.set(col.id, created.id);
  }

  const seen = new Set(state.items.map((x) => normalizeUrlForCompare(x.url)));
  for (const item of legacy.items || []) {
    let url = "";
    try { url = new URL(String(item.url || "").trim()).toString(); } catch {}
    if (!url) continue;
    const normalized = normalizeUrlForCompare(url);
    if (seen.has(normalized)) continue;
    seen.add(normalized);

    const created = await createLink({
      url,
      title: String(item.title || "").trim() || domainFromUrl(url),
      note: String(item.note || "").trim().slice(0, NOTE_MAX_LEN),
      tags: normalizeTags(item.tags || []),
      type: item.type || null,
      source: item.source || detectSourceFromUrl(url),
      favorite: !!item.favorite
    }, currentUser.id);
    if (!created) continue;
    const colIds = (item.collectionIds || []).map((id) => map.get(id)).filter(Boolean);
    await replaceLinkCollections(created.id, colIds, currentUser.id);
  }
  localStorage.setItem(key, "1");
}

const actions = {
  onOpenItem: (id) => {
    state.recentViewedIds = [id, ...state.recentViewedIds.filter((x) => x !== id)].slice(0, 100);
    renderApp();
  },
  onToggleFavorite: async (id, next) => {
    const item = state.items.find((x) => x.id === id);
    if (!item) return;
    const updated = await updateLink(id, { ...item, favorite: !!next });
    if (!updated) return;
    item.favorite = updated.favorite;
    renderApp();
  },
  onDeleteItem: async (id) => {
    await deleteLink(id);
    state.items = state.items.filter((x) => x.id !== id);
    renderTagSuggestions();
    renderApp();
  },
  onAssignToCollection: async (linkId, collectionId) => {
    const item = state.items.find((x) => x.id === linkId);
    if (!item) return;
    const next = [...new Set([...(item.collectionIds || []), collectionId])];
    await replaceLinkCollections(linkId, next, currentUser.id);
    item.collectionIds = next;
    renderApp();
  },
  onRenameCollection: async (collectionId, name) => {
    const col = state.collections.find((x) => x.id === collectionId);
    if (!col) return;
    const updated = await updateCollection(collectionId, { name, description: col.description });
    if (!updated) return;
    col.name = updated.name;
    col.description = updated.description;
    renderAddCollectionChoices();
    renderApp();
  },
  onDeleteCollection: async (collectionId) => {
    await deleteCollection(collectionId);
    state.collections = state.collections.filter((x) => x.id !== collectionId);
    for (const item of state.items) item.collectionIds = (item.collectionIds || []).filter((id) => id !== collectionId);
    if (state.activeCollectionId === collectionId) state.activeCollectionId = "all";
    renderAddCollectionChoices();
    renderApp();
  },
  onDeleteSavedFilter: async (id) => {
    await deleteSavedFilter(id);
    state.savedFilters = state.savedFilters.filter((x) => x.id !== id);
    if (state.activeSavedFilterId === id) {
      state.activeSavedFilterId = null;
      state.activeCollectionId = "all";
    }
    renderApp();
  }
};

function firstHttpUrl(input) {
  const text = String(input || "").trim();
  if (!text) return "";
  const lines = text.split(/\r?\n/).map((x) => x.trim()).filter(Boolean);
  for (const line of lines) {
    try {
      const u = new URL(line);
      if (u.protocol === "http:" || u.protocol === "https:") return u.toString();
    } catch {}
  }
  const inline = text.match(/https?:\/\/[^\s<>"')]+/i)?.[0] || "";
  if (!inline) return "";
  try {
    const u = new URL(inline);
    return u.protocol === "http:" || u.protocol === "https:" ? u.toString() : "";
  } catch {
    return "";
  }
}

function setupEvents() {
  const mobileMq = window.matchMedia("(max-width: 700px)");
  const setMobileMenu = (open) => {
    state.ui.mobileMenuOpen = !!open;
    document.body.classList.toggle("mobile-menu-open", !!open);
    els.btnMobileMenu?.setAttribute("aria-expanded", open ? "true" : "false");
  };
  const closeMobileMenuIfNeeded = () => { if (mobileMq.matches) setMobileMenu(false); };

  els.inputAddTitle && (els.inputAddTitle.maxLength = TITLE_MAX_LEN);
  els.inputAddNote && (els.inputAddNote.maxLength = NOTE_MAX_LEN);
  els.navAll?.addEventListener("click", () => { state.activeSavedFilterId = null; state.activeCollectionId = "all"; renderApp(); closeMobileMenuIfNeeded(); });
  els.navFav?.addEventListener("click", () => { state.activeSavedFilterId = null; state.activeCollectionId = "fav"; renderApp(); closeMobileMenuIfNeeded(); });
  els.navRecent?.addEventListener("click", () => { state.activeSavedFilterId = null; state.activeCollectionId = "recent"; renderApp(); closeMobileMenuIfNeeded(); });
  els.searchInput?.addEventListener("input", (e) => { state.activeSavedFilterId = null; state.search = String(e.target.value || ""); renderApp(); });
  els.sortSelect?.addEventListener("change", (e) => { state.activeSavedFilterId = null; state.sortBy = FILTER_SORTS.has(String(e.target.value || "")) ? String(e.target.value) : "newest"; renderApp(); });
  els.btnFilters?.addEventListener("click", () => { state.ui.filtersOpen = !state.ui.filtersOpen; if (els.filtersPanel) els.filtersPanel.hidden = !state.ui.filtersOpen; });
  els.filterTagInput?.addEventListener("input", (e) => { state.activeSavedFilterId = null; state.filters.tag = normalizeSearchText(e.target.value); renderApp(); });
  els.filterFavoriteOnly?.addEventListener("change", (e) => { state.activeSavedFilterId = null; state.filters.favoriteOnly = !!e.target.checked; renderApp(); });

  els.langRu?.addEventListener("click", () => { state.lang = "ru"; applyI18n(); updateLangButtons(); renderApp(); });
  els.langEn?.addEventListener("click", () => { state.lang = "en"; applyI18n(); updateLangButtons(); renderApp(); });
  els.btnSettings?.addEventListener("click", (e) => { e.stopPropagation(); if (els.settingsMenu) els.settingsMenu.hidden = !els.settingsMenu.hidden; });
  document.addEventListener("click", (e) => { if (!e.target.closest(".settings") && els.settingsMenu) els.settingsMenu.hidden = true; });

  els.btnAuth?.addEventListener("click", async () => {
    if (authEmail(currentUser)) {
      await logout();
      window.location.reload();
      return;
    }
    loginWithGoogle();
  });

  els.btnAddLink?.addEventListener("click", () => { openNewLinkModal(); closeMobileMenuIfNeeded(); });
  els.btnNewCollection?.addEventListener("click", () => { els.formCollection?.reset(); els.modalCollection?.showModal(); closeMobileMenuIfNeeded(); });
  els.btnSaveFilter?.addEventListener("click", async () => {
    if (!currentUser?.id) return;
    if (!isFilterActive()) { alert(state.lang === "ru" ? "Сначала установите фильтры." : "Set filters first."); return; }
    const name = String(prompt(t(state.lang, "saveFilterPrompt"), "") || "").trim();
    if (!name) return;
    const created = await createSavedFilter({ name, filter: filterPayload() }, currentUser.id);
    if (!created) return;
    state.savedFilters.push(created);
    renderApp();
  });

  els.btnExport?.addEventListener("click", () => {
    const payload = {
      version: 5,
      exportedAt: new Date().toISOString(),
      links: state.items,
      collections: state.collections,
      savedFilters: state.savedFilters
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const anchor = document.createElement("a");
    anchor.href = URL.createObjectURL(blob);
    anchor.download = `vault_export_${new Date().toISOString().slice(0, 10)}.json`;
    anchor.click();
    URL.revokeObjectURL(anchor.href);
  });

  els.btnImport?.addEventListener("click", () => {
    alert(state.lang === "ru" ? "Импорт отключен. Используется Supabase." : "Import is disabled. Supabase is the source of truth.");
  });

  els.formCollection?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentUser?.id) return;
    const fd = new FormData(els.formCollection);
    const name = String(fd.get("name") || "").trim();
    if (!name) return;
    const description = String(fd.get("description") || "").trim();
    const created = await createCollection({ name, description }, currentUser.id);
    if (!created) return;
    state.collections.push(created);
    state.activeCollectionId = created.id;
    els.modalCollection?.close();
    renderAddCollectionChoices();
    renderApp();
  });

  els.formAddLink?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!currentUser?.id) return;
    const fd = new FormData(els.formAddLink);
    const rawUrl = String(fd.get("url") || "").trim();
    const title = String(fd.get("title") || "").trim().slice(0, TITLE_MAX_LEN);
    const note = String(fd.get("note") || "").trim().slice(0, NOTE_MAX_LEN);
    if (title && title.length < TITLE_MIN_LEN) { alert(state.lang === "ru" ? `Название: ${TITLE_MIN_LEN}-${TITLE_MAX_LEN} символов.` : `Title must be ${TITLE_MIN_LEN}-${TITLE_MAX_LEN} characters.`); return; }
    if (invalidTagChunks(fd.get("tags")).length) { alert(state.lang === "ru" ? `Теги: ${TAG_MIN_LEN}-${TAG_MAX_LEN} символов.` : `Tags must be ${TAG_MIN_LEN}-${TAG_MAX_LEN} chars.`); return; }
    let url = "";
    try { url = new URL(rawUrl).toString(); } catch { alert(state.lang === "ru" ? "Некорректный URL." : "Invalid URL."); return; }
    if (findDuplicateLink(url)) { alert(state.lang === "ru" ? "Такая ссылка уже есть." : "Link already exists."); return; }

    const selectedCollections = fd.getAll("collections").map((x) => String(x)).filter((id) => state.collections.some((c) => c.id === id));
    const created = await createLink({
      url,
      title: title || domainFromUrl(url),
      note,
      tags: normalizeTags(fd.get("tags")),
      type: String(fd.get("type") || "") || null,
      source: String(fd.get("source") || "") || detectSourceFromUrl(url),
      favorite: !!fd.get("favorite")
    }, currentUser.id);
    if (!created) return;
    await replaceLinkCollections(created.id, selectedCollections, currentUser.id);
    state.items.unshift({ ...created, previewImage: previewFallbackUrl(created.url), collectionIds: selectedCollections });
    closeAddModal();
    renderTagSuggestions();
    renderApp();
  });

  els.inputAddUrl?.addEventListener("input", updateAddSourceUi);
  els.inputAddSource?.addEventListener("change", () => { sourceAutofillEnabled = false; });
  els.inputAddTags?.addEventListener("input", () => { activeTagMenuIndex = -1; updateTagsMenu(); });
  els.inputAddTags?.addEventListener("focus", () => { activeTagMenuIndex = -1; updateTagsMenu(); });
  els.addTagsMenu?.addEventListener("mousedown", (e) => {
    const btn = e.target.closest("[data-tag-suggestion]");
    if (!btn) return;
    e.preventDefault();
    const tag = String(btn.dataset.tagSuggestion || "").trim();
    if (!tag) return;
    applyTagSuggestion(tag);
    els.inputAddTags?.focus();
  });
  els.inputAddTags?.addEventListener("keydown", (e) => {
    if (!els.addTagsMenu || els.addTagsMenu.hidden) return;
    const list = els.addTagsMenu.querySelectorAll("[data-tag-suggestion]");
    if (!list.length) return;
    if (e.key === "ArrowDown") { e.preventDefault(); activeTagMenuIndex = (activeTagMenuIndex + 1 + list.length) % list.length; updateTagsMenu(); }
    if (e.key === "ArrowUp") { e.preventDefault(); activeTagMenuIndex = (activeTagMenuIndex - 1 + list.length) % list.length; updateTagsMenu(); }
    if (e.key === "Enter" && activeTagMenuIndex >= 0) { e.preventDefault(); const tag = list[activeTagMenuIndex]?.dataset?.tagSuggestion; if (tag) applyTagSuggestion(tag); }
  });
  document.addEventListener("mousedown", (e) => {
    if (!els.addTagsMenu || !els.inputAddTags) return;
    if (e.target.closest("#addTagsMenu") || e.target === els.inputAddTags) return;
    activeTagMenuIndex = -1;
    els.addTagsMenu.hidden = true;
  });
  els.addCloseX?.addEventListener("click", closeAddModal);
  els.addCancel?.addEventListener("click", closeAddModal);
  els.colCloseX?.addEventListener("click", () => els.modalCollection?.close());
  els.colCancel?.addEventListener("click", () => els.modalCollection?.close());

  window.addEventListener("dragover", (e) => {
    const types = e.dataTransfer?.types;
    if (!types || types.includes("text/resource-vault-item-id")) return;
    if (!types.includes("text/uri-list") && !types.includes("text/plain")) return;
    e.preventDefault();
  });
  window.addEventListener("drop", (e) => {
    const types = e.dataTransfer?.types;
    if (types?.includes("text/resource-vault-item-id")) return;
    const target = e.target instanceof Element ? e.target : null;
    if (target?.closest("input, textarea, select, [contenteditable='true']")) return;
    const url = firstHttpUrl(e.dataTransfer?.getData("text/uri-list")) || firstHttpUrl(e.dataTransfer?.getData("text/plain"));
    if (!url) return;
    e.preventDefault();
    openNewLinkModal({ url });
  });

  els.btnMobileMenu?.addEventListener("click", () => { if (mobileMq.matches) setMobileMenu(!state.ui.mobileMenuOpen); });
  els.btnMobileClose?.addEventListener("click", () => setMobileMenu(false));
  els.mobileOverlay?.addEventListener("click", () => setMobileMenu(false));
  mobileMq.addEventListener("change", (e) => { if (!e.matches) setMobileMenu(false); });
  document.addEventListener("keydown", (e) => { if (e.key === "Escape") setMobileMenu(false); });
}

function escapeHtml(str) {
  return String(str || "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
}

async function bootstrap() {
  const settings = loadUiSettings();
  state.lang = settings.lang === "en" ? "en" : "ru";
  state.sortBy = FILTER_SORTS.has(settings.sortBy) ? settings.sortBy : "newest";
  state.ui.filtersOpen = false;
  state.ui.mobileMenuOpen = false;

  setupEvents();
  try { currentUser = await initAuth(); } catch (err) { console.warn("Auth failed", err?.message || err); }
  if (currentUser?.id) {
    try {
      await loadData();
      if (!state.items.length && !state.collections.length) {
        await migrateLegacyIfNeeded();
        await loadData();
      }
    } catch (err) {
      console.warn("Load failed", err?.message || err);
    }
  }

  applyI18n();
  updateLangButtons();
  if (els.sortSelect) els.sortSelect.value = state.sortBy;
  if (els.filterTagInput) els.filterTagInput.value = state.filters.tag;
  if (els.filterFavoriteOnly) els.filterFavoriteOnly.checked = !!state.filters.favoriteOnly;
  if (els.filtersPanel) els.filtersPanel.hidden = !state.ui.filtersOpen;
  renderTagSuggestions();
  renderApp();
}

void bootstrap();
