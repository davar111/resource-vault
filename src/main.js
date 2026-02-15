import "./styles.css";
import { state } from "./state.js";
import { loadLegacyVault, loadUiSettings, saveUiSettings } from "./storage.js";
import { TAG_MAX_LEN, TAG_MIN_LEN, detectSourceFromUrl, domainFromUrl, normalizeSearchText, normalizeTags, previewFallbackUrl } from "./filter.js";
import { t } from "./i18n.js";
import { render } from "./ui.js";
import { SOURCE_CODES, TYPE_CODES } from "./domain.js";
import { makeDemoLinks } from "./demo-data.js";
import { initAuth, loginWithGoogle, logout } from "./useAuth.js";
import { createLink, deleteLink, listLinks, updateLink } from "./useLinks.js";
import { addLinkCollections, createCollection, createCollectionInvite, deleteCollection, listCollections, listLinkCollections, replaceLinkCollections, updateCollection } from "./useCollections.js";
import { createSavedFilter, deleteSavedFilter, listSavedFilters } from "./useSavedFilters.js";

const TITLE_MIN_LEN = 2;
const TITLE_MAX_LEN = 120;
const NOTE_MAX_LEN = 500;
const FILTER_SORTS = new Set(["newest", "oldest", "title_asc", "title_desc", "source_asc"]);
const THEME_MODES = new Set(["system", "light", "dark"]);
const HIDDEN_PASSWORD_KEY = "resource_vault_hidden_password_v1";
const DEMO_PREFS_KEY = "resource_vault_demo_prefs_v1";

const els = {
  langSelect: document.getElementById("langSelect"),
  btnTheme: document.getElementById("btnTheme"),
  appRoot: document.getElementById("appRoot"),
  authGate: document.getElementById("authGate"),
  authGateTitle: document.getElementById("authGateTitle"),
  authGateText: document.getElementById("authGateText"),
  authGateBtn: document.getElementById("authGateBtn"),
  authGateGuestBtn: document.getElementById("authGateGuestBtn"),
  brand: document.getElementById("brand"),
  navAll: document.getElementById("navAll"),
  navFav: document.getElementById("navFav"),
  navHidden: document.getElementById("navHidden"),
  navRecent: document.getElementById("navRecent"),
  labelNav: document.getElementById("labelNav"),
  labelCollections: document.getElementById("labelCollections"),
  labelSavedFilters: document.getElementById("labelSavedFilters"),
  savedFiltersSection: document.getElementById("savedFiltersSection"),
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
  demoHint: document.getElementById("demoHint"),
  demoHintText: document.getElementById("demoHintText"),
  demoHintAdd: document.getElementById("demoHintAdd"),
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
  btnSaveFilterInline: document.getElementById("btnSaveFilterInline"),
  btnAuth: document.getElementById("btnAuth"),
  btnAuthLabel: document.getElementById("btnAuthLabel"),
  authStatus: document.getElementById("authStatus"),
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
  addToSection: document.getElementById("addToSection"),
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
  labelColShared: document.getElementById("labelColShared"),
  colShared: document.getElementById("colShared"),
  modalDeleteLink: document.getElementById("modalDeleteLink"),
  modalDeleteTitle: document.getElementById("modalDeleteTitle"),
  modalDeleteText: document.getElementById("modalDeleteText"),
  deleteCancel: document.getElementById("deleteCancel"),
  deleteConfirm: document.getElementById("deleteConfirm"),
  modalHiddenAuth: document.getElementById("modalHiddenAuth"),
  formHiddenAuth: document.getElementById("formHiddenAuth"),
  hiddenAuthTitle: document.getElementById("hiddenAuthTitle"),
  hiddenAuthText: document.getElementById("hiddenAuthText"),
  hiddenAuthPasswordLabel: document.getElementById("hiddenAuthPasswordLabel"),
  hiddenAuthPassword: document.getElementById("hiddenAuthPassword"),
  hiddenAuthConfirmField: document.getElementById("hiddenAuthConfirmField"),
  hiddenAuthConfirmLabel: document.getElementById("hiddenAuthConfirmLabel"),
  hiddenAuthConfirm: document.getElementById("hiddenAuthConfirm"),
  hiddenAuthCancel: document.getElementById("hiddenAuthCancel"),
  hiddenAuthSubmit: document.getElementById("hiddenAuthSubmit")
};

let currentUser = null;
let knownTags = [];
let activeTagMenuIndex = -1;
let sourceAutofillEnabled = true;
let prevGateVisible = null;
const pendingLinkOps = new Set();
const pendingCollectionOps = new Set();
const pendingSavedFilterOps = new Set();

function ensureAuth() {
  if (currentUser?.id) return true;
  alert(t(state.lang, state.isGuestMode ? "authRequiredGuest" : "authRequired"));
  return false;
}

function persistUiSettings() {
  saveUiSettings({ lang: state.lang, sortBy: state.sortBy, themeMode: state.themeMode });
}

function syncSaveFilterButton() {
  if (!els.btnSaveFilterInline) return;
  els.btnSaveFilterInline.hidden = !isFilterActive();
}

function syncSavedFiltersSection() {
  if (!els.savedFiltersSection) return;
  const hasSaved = Array.isArray(state.savedFilters) && state.savedFilters.length > 0;
  els.savedFiltersSection.hidden = !state.isAuthenticated || !hasSaved;
}

function syncAuthGate() {
  const showGate = !state.isAuthenticated && !state.isGuestMode;
  const wasGateVisible = prevGateVisible;
  prevGateVisible = showGate;
  if (els.appRoot) els.appRoot.hidden = showGate;
  if (els.authGate) els.authGate.hidden = !showGate;
  if (els.appRoot && wasGateVisible === true && showGate === false) {
    els.appRoot.classList.remove("app--enter");
    // Force reflow so repeated login transitions replay animation.
    void els.appRoot.offsetWidth;
    els.appRoot.classList.add("app--enter");
  }
}

function syncGuestModeUi() {
  const guestReadOnly = !!(state.isGuestMode && !state.isAuthenticated);
  if (els.btnAddLink) els.btnAddLink.disabled = guestReadOnly;
  if (els.btnNewCollection) els.btnNewCollection.disabled = guestReadOnly;
  if (els.btnSaveFilterInline) els.btnSaveFilterInline.disabled = guestReadOnly;
  if (els.navHidden) els.navHidden.disabled = guestReadOnly;
  if (els.localHint && guestReadOnly) els.localHint.textContent = t(state.lang, "guestModeHint");
}

function renderApp() {
  persistUiSettings();
  syncSaveFilterButton();
  syncSavedFiltersSection();
  syncAuthGate();
  syncGuestModeUi();
  render(state, els, persistUiSettings, actions);
}

function authEmail(user) {
  return String(user?.email || user?.user_metadata?.email || "").trim();
}

function preferredBrowserTheme() {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return "dark";
  return window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
}

function resolveTheme(mode) {
  return mode === "system" ? preferredBrowserTheme() : (mode === "light" ? "light" : "dark");
}

function applyTheme(mode) {
  const nextMode = THEME_MODES.has(mode) ? mode : "system";
  const nextTheme = resolveTheme(nextMode);
  state.themeMode = nextMode;
  state.theme = nextTheme;
  document.documentElement.dataset.theme = nextTheme;
}

function syncLanguageSelect() {
  if (!els.langSelect) return;
  els.langSelect.value = state.lang === "en" ? "en" : "ru";
}

function syncThemeToggle() {
  if (!els.btnTheme) return;
  const nextIsDark = state.theme !== "dark";
  els.btnTheme.textContent = state.theme === "dark" ? t(state.lang, "themeDark") : t(state.lang, "themeLight");
  els.btnTheme.setAttribute("title", nextIsDark ? t(state.lang, "switchThemeToDark") : t(state.lang, "switchThemeToLight"));
  els.btnTheme.setAttribute("aria-label", nextIsDark ? t(state.lang, "switchThemeToDark") : t(state.lang, "switchThemeToLight"));
}

function renderAuthStatus() {
  const email = authEmail(currentUser);
  if (!email && state.isGuestMode && !state.isAuthenticated) {
    if (els.btnAuthLabel) els.btnAuthLabel.textContent = t(state.lang, "signInGoogle");
    if (els.authStatus) els.authStatus.textContent = t(state.lang, "guestModeStatus");
    return;
  }
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
  const pool = state.isUsingDemoData ? state.items.filter((item) => !item.isDemo) : state.items;
  return pool.find((item) => normalizeUrlForCompare(item.url) === target) || null;
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
  const lockCollectionTarget = state.activeCollectionId === "hidden" || (
    state.activeCollectionId !== "all"
    && state.activeCollectionId !== "fav"
    && state.activeCollectionId !== "recent"
    && !state.activeSavedFilterId
    && state.collections.some((c) => c.id === state.activeCollectionId)
  );
  if (els.addToSection) els.addToSection.hidden = lockCollectionTarget;
  const presetCollections = state.activeCollectionId === "hidden"
    ? []
    : (lockCollectionTarget ? [state.activeCollectionId] : []);
  renderAddCollectionChoices(presetCollections);
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
  if (els.btnSaveFilterInline) {
    els.btnSaveFilterInline.setAttribute("aria-label", t(L, "saveFilter"));
    els.btnSaveFilterInline.textContent = t(L, "saveFilter");
  }
  if (els.localHint) els.localHint.textContent = t(L, "localHint");
  if (els.authGateTitle) els.authGateTitle.textContent = t(L, "authGateTitle");
  if (els.authGateText) els.authGateText.textContent = t(L, "authGateText");
  if (els.authGateBtn) els.authGateBtn.textContent = t(L, "authGateBtn");
  if (els.authGateGuestBtn) els.authGateGuestBtn.textContent = t(L, "authGateGuestBtn");
  if (els.langSelect) els.langSelect.value = L === "en" ? "en" : "ru";
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
  if (els.labelColShared) els.labelColShared.textContent = t(L, "sharedCollection");
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
  syncThemeToggle();
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

function normalizeEmail(input) {
  return String(input || "").trim().toLowerCase();
}

function isValidEmail(input) {
  const normalized = normalizeEmail(input);
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized);
}

function loadDemoPrefs() {
  try {
    const raw = localStorage.getItem(DEMO_PREFS_KEY);
    const parsed = raw ? JSON.parse(raw) : {};
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

function saveDemoFavorite(id, favorite) {
  const prefs = loadDemoPrefs();
  prefs[String(id)] = !!favorite;
  localStorage.setItem(DEMO_PREFS_KEY, JSON.stringify(prefs));
}

function applyDemoPrefs(items) {
  const prefs = loadDemoPrefs();
  return (items || []).map((item) => {
    if (!item?.isDemo) return item;
    if (!(item.id in prefs)) return item;
    return { ...item, favorite: !!prefs[item.id] };
  });
}

function bytesToHex(bytes) {
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function sha256Hex(input) {
  const text = String(input || "");
  if (!text) return "";
  const data = new TextEncoder().encode(text);
  const digest = await crypto.subtle.digest("SHA-256", data);
  return bytesToHex(new Uint8Array(digest));
}

function hiddenAuthCopy(mode) {
  const isCreate = mode === "create";
  return {
    title: isCreate ? t(state.lang, "hiddenAuthCreateTitle") : t(state.lang, "hiddenAuthUnlockTitle"),
    text: isCreate ? t(state.lang, "hiddenAuthCreateText") : t(state.lang, "hiddenAuthUnlockText"),
    passwordLabel: t(state.lang, "hiddenAuthPasswordLabel"),
    confirmLabel: t(state.lang, "hiddenAuthConfirmLabel"),
    submit: isCreate ? t(state.lang, "save") : t(state.lang, "open"),
    cancel: t(state.lang, "cancel")
  };
}

function openHiddenAuthDialog(mode = "unlock") {
  const dialog = els.modalHiddenAuth;
  if (!dialog || !els.hiddenAuthPassword || !els.hiddenAuthCancel || !els.hiddenAuthSubmit) return Promise.resolve(null);
  const isCreate = mode === "create";
  const copy = hiddenAuthCopy(mode);
  if (els.hiddenAuthTitle) els.hiddenAuthTitle.textContent = copy.title;
  if (els.hiddenAuthText) els.hiddenAuthText.textContent = copy.text;
  if (els.hiddenAuthPasswordLabel) els.hiddenAuthPasswordLabel.textContent = copy.passwordLabel;
  if (els.hiddenAuthConfirmLabel) els.hiddenAuthConfirmLabel.textContent = copy.confirmLabel;
  if (els.hiddenAuthCancel) els.hiddenAuthCancel.textContent = copy.cancel;
  if (els.hiddenAuthSubmit) els.hiddenAuthSubmit.textContent = copy.submit;
  if (els.hiddenAuthConfirmField) els.hiddenAuthConfirmField.hidden = !isCreate;
  els.hiddenAuthPassword.value = "";
  if (els.hiddenAuthConfirm) els.hiddenAuthConfirm.value = "";
  els.hiddenAuthPassword.setAttribute("autocomplete", isCreate ? "new-password" : "current-password");
  els.hiddenAuthConfirm?.setAttribute("autocomplete", "new-password");

  return new Promise((resolve) => {
    let done = false;
    const cleanup = () => {
      els.formHiddenAuth?.removeEventListener("submit", onSubmit);
      els.hiddenAuthCancel?.removeEventListener("click", onCancel);
      dialog.removeEventListener("cancel", onCancel);
      dialog.removeEventListener("close", onClose);
    };
    const finish = (payload) => {
      if (done) return;
      done = true;
      cleanup();
      resolve(payload);
    };
    const onSubmit = (e) => {
      e.preventDefault();
      const password = String(els.hiddenAuthPassword?.value || "");
      const confirm = String(els.hiddenAuthConfirm?.value || "");
      dialog.close();
      finish({ password, confirm });
    };
    const onCancel = (e) => {
      if (e) e.preventDefault();
      dialog.close();
      finish(null);
    };
    const onClose = () => finish(null);
    els.formHiddenAuth?.addEventListener("submit", onSubmit);
    els.hiddenAuthCancel?.addEventListener("click", onCancel);
    dialog.addEventListener("cancel", onCancel);
    dialog.addEventListener("close", onClose, { once: true });
    dialog.showModal();
    setTimeout(() => els.hiddenAuthPassword?.focus(), 0);
  });
}

async function ensureHiddenAccess() {
  if (state.ui.hiddenUnlocked) return true;

  const existingHash = localStorage.getItem(HIDDEN_PASSWORD_KEY) || "";
  if (!existingHash) {
    const created = await openHiddenAuthDialog("create");
    if (!created) return false;
    const first = String(created.password || "");
    if (first.length < 4) {
      alert(t(state.lang, "hiddenPasswordTooShort"));
      return false;
    }
    const confirmPwd = String(created.confirm || "");
    if (first !== confirmPwd) {
      alert(t(state.lang, "hiddenPasswordMismatch"));
      return false;
    }
    const hash = await sha256Hex(first);
    localStorage.setItem(HIDDEN_PASSWORD_KEY, hash);
    state.ui.hiddenUnlocked = true;
    return true;
  }

  const enteredData = await openHiddenAuthDialog("unlock");
  if (!enteredData) return false;
  const entered = String(enteredData.password || "");
  if (!entered) return false;
  const enteredHash = await sha256Hex(entered);
  if (enteredHash !== existingHash) {
    alert(t(state.lang, "hiddenWrongPassword"));
    return false;
  }
  state.ui.hiddenUnlocked = true;
  return true;
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
  state.items = links.map((x) => ({ ...x, isDemo: false, previewImage: previewFallbackUrl(x.url), collectionIds: relMap.get(x.id) || [] }));
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
    if (!ensureAuth()) return;
    if (pendingLinkOps.has(id)) return;
    pendingLinkOps.add(id);
    const item = state.items.find((x) => x.id === id);
    if (!item) {
      pendingLinkOps.delete(id);
      return;
    }
    if (item.isDemo) {
      pendingLinkOps.delete(id);
      return;
    }
    const updated = await updateLink(id, { ...item, favorite: !!next });
    if (updated) item.favorite = updated.favorite;
    pendingLinkOps.delete(id);
    renderApp();
  },
  onDeleteItem: async (id) => {
    if (!ensureAuth()) return;
    if (pendingLinkOps.has(id)) return;
    pendingLinkOps.add(id);
    const item = state.items.find((x) => x.id === id);
    if (item?.isDemo) {
      state.items = state.items.filter((x) => x.id !== id);
      pendingLinkOps.delete(id);
      renderTagSuggestions();
      renderApp();
      return;
    }
    await deleteLink(id);
    state.items = state.items.filter((x) => x.id !== id);
    renderTagSuggestions();
    pendingLinkOps.delete(id);
    renderApp();
  },
  onAssignToCollection: async (linkId, collectionId) => {
    if (!ensureAuth()) return;
    if (pendingLinkOps.has(linkId)) return;
    pendingLinkOps.add(linkId);
    const item = state.items.find((x) => x.id === linkId);
    if (!item) {
      pendingLinkOps.delete(linkId);
      return;
    }
    const next = [...new Set([...(item.collectionIds || []), collectionId])];
    await replaceLinkCollections(linkId, next, currentUser.id);
    item.collectionIds = next;
    pendingLinkOps.delete(linkId);
    renderApp();
  },
  onRenameCollection: async (collectionId, name) => {
    if (!ensureAuth()) return;
    if (pendingCollectionOps.has(collectionId)) return;
    pendingCollectionOps.add(collectionId);
    const col = state.collections.find((x) => x.id === collectionId);
    if (!col) {
      pendingCollectionOps.delete(collectionId);
      return;
    }
    const updated = await updateCollection(collectionId, {
      name,
      description: col.description,
      isShared: !!col.isShared
    });
    if (updated) {
      col.name = updated.name;
      col.description = updated.description;
      col.isShared = updated.isShared;
    }
    pendingCollectionOps.delete(collectionId);
    renderAddCollectionChoices();
    renderApp();
  },
  onInviteCollection: async (collectionId) => {
    if (!ensureAuth()) return;
    const col = state.collections.find((x) => x.id === collectionId);
    if (!col || !col.isShared || col.ownerId !== currentUser?.id) return;
    const emailRaw = prompt(t(state.lang, "invitePrompt"), "") || "";
    const email = normalizeEmail(emailRaw);
    if (!email) return;
    if (!isValidEmail(email)) {
      alert(t(state.lang, "inviteInvalidEmail"));
      return;
    }
    if (email === normalizeEmail(authEmail(currentUser))) {
      alert(t(state.lang, "inviteSelfError"));
      return;
    }
    try {
      await createCollectionInvite(collectionId, email, currentUser.id);
      alert(t(state.lang, "inviteSent"));
    } catch (err) {
      const msg = String(err?.message || "");
      if (msg.includes("duplicate key")) {
        alert(t(state.lang, "inviteSent"));
      } else {
        alert(msg || "Invite failed");
      }
    }
  },
  onDeleteCollection: async (collectionId) => {
    if (!ensureAuth()) return;
    if (pendingCollectionOps.has(collectionId)) return;
    pendingCollectionOps.add(collectionId);
    await deleteCollection(collectionId);
    state.collections = state.collections.filter((x) => x.id !== collectionId);
    for (const item of state.items) item.collectionIds = (item.collectionIds || []).filter((id) => id !== collectionId);
    if (state.activeCollectionId === collectionId) state.activeCollectionId = "all";
    pendingCollectionOps.delete(collectionId);
    renderAddCollectionChoices();
    renderApp();
  },
  onDeleteSavedFilter: async (id) => {
    if (!ensureAuth()) return;
    if (pendingSavedFilterOps.has(id)) return;
    pendingSavedFilterOps.add(id);
    await deleteSavedFilter(id);
    state.savedFilters = state.savedFilters.filter((x) => x.id !== id);
    if (state.activeSavedFilterId === id) {
      state.activeSavedFilterId = null;
      state.activeCollectionId = "all";
    }
    pendingSavedFilterOps.delete(id);
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
  els.navHidden?.addEventListener("click", async () => {
    if (!ensureAuth()) return;
    const ok = await ensureHiddenAccess();
    if (!ok) return;
    state.activeSavedFilterId = null;
    state.activeCollectionId = "hidden";
    renderApp();
    closeMobileMenuIfNeeded();
  });
  els.navRecent?.addEventListener("click", () => { state.activeSavedFilterId = null; state.activeCollectionId = "recent"; renderApp(); closeMobileMenuIfNeeded(); });
  els.searchInput?.addEventListener("input", (e) => { state.activeSavedFilterId = null; state.search = String(e.target.value || ""); renderApp(); });
  els.sortSelect?.addEventListener("change", (e) => { state.activeSavedFilterId = null; state.sortBy = FILTER_SORTS.has(String(e.target.value || "")) ? String(e.target.value) : "newest"; renderApp(); });
  els.btnFilters?.addEventListener("click", () => { state.ui.filtersOpen = !state.ui.filtersOpen; if (els.filtersPanel) els.filtersPanel.hidden = !state.ui.filtersOpen; });
  els.filterTagInput?.addEventListener("input", (e) => { state.activeSavedFilterId = null; state.filters.tag = normalizeSearchText(e.target.value); renderApp(); });
  els.filterFavoriteOnly?.addEventListener("change", (e) => { state.activeSavedFilterId = null; state.filters.favoriteOnly = !!e.target.checked; renderApp(); });

  els.langSelect?.addEventListener("change", (e) => {
    state.lang = String(e.target?.value || "") === "en" ? "en" : "ru";
    applyI18n();
    syncLanguageSelect();
    renderApp();
  });
  els.btnTheme?.addEventListener("click", () => {
    applyTheme(state.theme === "dark" ? "light" : "dark");
    syncThemeToggle();
    renderApp();
  });

  els.btnAuth?.addEventListener("click", async () => {
    if (authEmail(currentUser)) {
      await logout();
      window.location.reload();
      return;
    }
    loginWithGoogle();
  });
  els.authGateBtn?.addEventListener("click", () => loginWithGoogle());
  els.authGateGuestBtn?.addEventListener("click", () => {
    state.isGuestMode = true;
    renderApp();
  });

  els.btnAddLink?.addEventListener("click", () => { openNewLinkModal(); closeMobileMenuIfNeeded(); });
  els.demoHintAdd?.addEventListener("click", () => { openNewLinkModal(); });
  els.btnNewCollection?.addEventListener("click", () => { els.formCollection?.reset(); els.modalCollection?.showModal(); closeMobileMenuIfNeeded(); });
  els.btnSaveFilterInline?.addEventListener("click", async () => {
    if (!ensureAuth()) return;
    if (els.btnSaveFilterInline?.disabled) return;
    if (!isFilterActive()) { alert(state.lang === "ru" ? "Сначала установите фильтры." : "Set filters first."); return; }
    if (els.btnSaveFilterInline) els.btnSaveFilterInline.disabled = true;
    const name = String(prompt(t(state.lang, "saveFilterPrompt"), "") || "").trim();
    if (name) {
      const created = await createSavedFilter({ name, filter: filterPayload() }, currentUser.id);
      if (created) state.savedFilters.push(created);
    }
    if (els.btnSaveFilterInline) els.btnSaveFilterInline.disabled = false;
    renderApp();
  });

  els.formCollection?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!ensureAuth()) return;
    if (els.colCreate?.disabled) return;
    const fd = new FormData(els.formCollection);
    const name = String(fd.get("name") || "").trim();
    if (!name) return;
    const description = String(fd.get("description") || "").trim();
    const isShared = !!fd.get("shared");
    if (els.colCreate) els.colCreate.disabled = true;
    const created = await createCollection({ name, description, isShared }, currentUser.id);
    if (created) {
      state.collections.push(created);
      state.activeCollectionId = created.id;
    }
    if (els.colCreate) els.colCreate.disabled = false;
    els.modalCollection?.close();
    renderAddCollectionChoices();
    renderApp();
  });

  els.formAddLink?.addEventListener("submit", async (e) => {
    e.preventDefault();
    if (!ensureAuth()) return;
    if (els.addSave?.disabled) return;
    const fd = new FormData(els.formAddLink);
    const rawUrl = String(fd.get("url") || "").trim();
    const title = String(fd.get("title") || "").trim().slice(0, TITLE_MAX_LEN);
    const note = String(fd.get("note") || "").trim().slice(0, NOTE_MAX_LEN);
    if (title && title.length < TITLE_MIN_LEN) { alert(state.lang === "ru" ? `Название: ${TITLE_MIN_LEN}-${TITLE_MAX_LEN} символов.` : `Title must be ${TITLE_MIN_LEN}-${TITLE_MAX_LEN} characters.`); return; }
    if (invalidTagChunks(fd.get("tags")).length) { alert(state.lang === "ru" ? `Теги: ${TAG_MIN_LEN}-${TAG_MAX_LEN} символов.` : `Tags must be ${TAG_MIN_LEN}-${TAG_MAX_LEN} chars.`); return; }
    let url = "";
    try { url = new URL(rawUrl).toString(); } catch { alert(state.lang === "ru" ? "Некорректный URL." : "Invalid URL."); return; }
    if (findDuplicateLink(url)) { alert(state.lang === "ru" ? "Такая ссылка уже есть." : "Link already exists."); return; }

    const activeCollectionIsManual = state.activeCollectionId !== "all"
      && state.activeCollectionId !== "fav"
      && state.activeCollectionId !== "hidden"
      && state.activeCollectionId !== "recent"
      && !state.activeSavedFilterId
      && state.collections.some((c) => c.id === state.activeCollectionId);
    const inHiddenContext = state.activeCollectionId === "hidden";
    const selectedCollections = inHiddenContext
      ? []
      : activeCollectionIsManual
      ? [state.activeCollectionId]
      : fd.getAll("collections").map((x) => String(x)).filter((id) => state.collections.some((c) => c.id === id));
    if (els.addSave) els.addSave.disabled = true;
    try {
      const created = await createLink({
        url,
        title: title || domainFromUrl(url),
        note,
        tags: normalizeTags(fd.get("tags")),
        type: String(fd.get("type") || "") || null,
        source: String(fd.get("source") || "") || detectSourceFromUrl(url),
        favorite: !!fd.get("favorite"),
        hidden: inHiddenContext
      }, currentUser.id);
      if (created) {
        if (state.isUsingDemoData) {
          state.items = [];
          state.isUsingDemoData = false;
        }
        // For newly created links we only need INSERT into relation table.
        await addLinkCollections(created.id, selectedCollections, currentUser.id);
        state.items.unshift({ ...created, isDemo: false, previewImage: previewFallbackUrl(created.url), collectionIds: selectedCollections });
        closeAddModal();
        renderTagSuggestions();
      }
      renderApp();
    } catch (err) {
      alert(err?.message || (state.lang === "ru" ? "Не удалось добавить ссылку." : "Failed to add link."));
    } finally {
      if (els.addSave) els.addSave.disabled = false;
    }
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
  applyTheme(THEME_MODES.has(settings.themeMode) ? settings.themeMode : "system");
  state.ui.filtersOpen = false;
  state.ui.mobileMenuOpen = false;

  if (typeof window !== "undefined" && typeof window.matchMedia === "function") {
    const colorScheme = window.matchMedia("(prefers-color-scheme: dark)");
    colorScheme.addEventListener("change", () => {
      if (state.themeMode === "system") {
        applyTheme("system");
        syncThemeToggle();
      }
    });
  }

  setupEvents();
  try { currentUser = await initAuth(); } catch (err) { console.warn("Auth failed", err?.message || err); }
  state.isAuthenticated = !!currentUser?.id;
  state.currentUserId = currentUser?.id || "";
  if (currentUser?.id) {
    try {
      await loadData();
      if (!state.items.length && !state.collections.length) {
        await migrateLegacyIfNeeded();
        await loadData();
      }
      if (!state.items.length) {
        state.items = applyDemoPrefs(makeDemoLinks());
        state.isUsingDemoData = true;
      } else {
        state.isUsingDemoData = false;
      }
    } catch (err) {
      console.warn("Load failed", err?.message || err);
      state.items = applyDemoPrefs(makeDemoLinks());
      state.isUsingDemoData = true;
    }
  } else {
    state.currentUserId = "";
    state.items = applyDemoPrefs(makeDemoLinks());
    state.isUsingDemoData = true;
    state.collections = [];
    state.savedFilters = [];
    state.activeSavedFilterId = null;
  }

  applyI18n();
  syncLanguageSelect();
  syncThemeToggle();
  if (els.sortSelect) els.sortSelect.value = state.sortBy;
  if (els.filterTagInput) els.filterTagInput.value = state.filters.tag;
  if (els.filterFavoriteOnly) els.filterFavoriteOnly.checked = !!state.filters.favoriteOnly;
  if (els.filtersPanel) els.filtersPanel.hidden = !state.ui.filtersOpen;
  renderTagSuggestions();
  renderApp();
}

void bootstrap();

